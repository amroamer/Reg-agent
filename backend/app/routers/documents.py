import logging
import os
import shutil
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.chunk import Chunk
from app.models.document import Document, DocumentStatus, SourceAuthority
from app.models.user import User
from app.schemas.document import (
    ChunkResponse,
    DocumentDetailResponse,
    DocumentListResponse,
    DocumentResponse,
)
from app.services.auth_service import get_current_user, get_optional_user, require_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/documents", tags=["documents"])

UPLOAD_DIR = "/app/uploads"
ALLOWED_EXTENSIONS = {".pdf"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


@router.post("/upload", response_model=DocumentResponse, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    source: SourceAuthority = Form(...),
    title_en: str | None = Form(None),
    title_ar: str | None = Form(None),
    document_number: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Upload a new regulation/policy PDF for ingestion."""
    # Validate file type
    if file.filename:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Only PDF files are allowed. Got: {ext}",
            )

    # Read file and check size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB",
        )

    # Compute hash for dedup
    import hashlib

    file_hash = hashlib.sha256(content).hexdigest()

    # Check for duplicate
    result = await db.execute(
        select(Document).where(Document.file_hash == file_hash)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This file has already been uploaded (document_id: {existing.id})",
        )

    # Save file to disk
    doc_id = uuid.uuid4()
    source_dir = os.path.join(UPLOAD_DIR, source.value.lower())
    os.makedirs(source_dir, exist_ok=True)
    file_path = os.path.join(source_dir, f"{doc_id}.pdf")

    with open(file_path, "wb") as f:
        f.write(content)

    # Create document record
    doc = Document(
        id=doc_id,
        title_en=title_en or file.filename,
        title_ar=title_ar,
        source=source,
        document_number=document_number,
        status=DocumentStatus.PENDING,
        file_path=file_path,
        file_hash=file_hash,
        uploaded_by=user.id,
    )
    db.add(doc)
    await db.flush()

    # Dispatch Celery ingestion task
    try:
        from worker.tasks.ingest import ingest_document

        ingest_document.delay(str(doc_id))
        logger.info("Dispatched ingestion task for document: %s", doc_id)
    except Exception as e:
        logger.warning("Failed to dispatch ingestion task: %s", e)
        doc.error_message = f"Task dispatch failed: {e}"

    return doc


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    source: SourceAuthority | None = Query(None),
    status_filter: DocumentStatus | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """List all documents with optional filters."""
    query = select(Document)

    if source:
        query = query.where(Document.source == source)
    if status_filter:
        query = query.where(Document.status == status_filter)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Paginate
    query = query.order_by(Document.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    documents = result.scalars().all()

    return DocumentListResponse(
        documents=[DocumentResponse.model_validate(d) for d in documents],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{document_id}", response_model=DocumentDetailResponse)
async def get_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """Get document detail with its chunks."""
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.chunks))
        .where(Document.id == document_id)
    )
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    chunks = sorted(doc.chunks, key=lambda c: c.chunk_index)

    return DocumentDetailResponse(
        **DocumentResponse.model_validate(doc).model_dump(),
        chunks=[ChunkResponse.model_validate(c) for c in chunks],
        chunks_count=len(chunks),
    )


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Delete a document and all its chunks (admin only)."""
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete vectors from Qdrant
    try:
        from app.services.qdrant_service import delete_by_document_id

        delete_by_document_id(str(document_id))
    except Exception as e:
        logger.warning("Failed to delete Qdrant vectors: %s", e)

    # Delete file from disk
    if doc.file_path and os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    # Delete from DB (cascades to chunks)
    await db.delete(doc)
