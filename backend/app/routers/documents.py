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

import pathlib

# Use /app/uploads in Docker, ./uploads locally
UPLOAD_DIR = "/app/uploads" if pathlib.Path("/app/uploads").exists() else str(pathlib.Path(__file__).resolve().parent.parent.parent / "uploads")
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
    user: User | None = Depends(get_optional_user),
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
        uploaded_by=user.id if user else None,
    )
    db.add(doc)
    await db.flush()

    # Dispatch ingestion: try Celery first, fall back to sync in background thread
    try:
        from worker.tasks.ingest import ingest_document

        ingest_document.delay(str(doc_id))
        logger.info("Dispatched Celery ingestion task for document: %s", doc_id)
    except Exception as e:
        logger.warning("Celery unavailable (%s), running ingestion in background thread", e)
        import threading

        def _run_sync_ingest(did: str):
            try:
                from worker.tasks.ingest import ingest_document as _ingest
                _ingest(did)
            except Exception as ex:
                logger.error("Background ingestion failed for %s: %s", did, ex)

        t = threading.Thread(target=_run_sync_ingest, args=(str(doc_id),), daemon=True)
        t.start()

    return doc


@router.post("/bulk-upload")
async def bulk_upload(
    files: list[UploadFile] = File(...),
    metadata_file: UploadFile | None = File(None),
    default_source: SourceAuthority = Form(SourceAuthority.SAMA),
    batch_name: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """Upload multiple PDF documents with optional CSV/JSON metadata."""
    from app.models.ingestion_batch import IngestionBatch, IngestionQueue
    from app.schemas.batch import BulkUploadDocumentInfo, BulkUploadResponse
    from app.services.metadata_parser import (
        detect_source_from_filename,
        extract_doc_number,
        parse_csv_metadata,
        parse_json_metadata,
    )

    if len(files) > 50:
        raise HTTPException(400, "Maximum 50 files per upload")
    if not files:
        raise HTTPException(400, "No files provided")

    # Parse metadata file if provided
    metadata_map: dict[str, dict] = {}
    csv_warnings: list[str] = []

    if metadata_file:
        content = await metadata_file.read()
        fname = (metadata_file.filename or "").lower()
        if fname.endswith(".csv"):
            metadata_map, csv_warnings = parse_csv_metadata(content)
        elif fname.endswith(".json"):
            metadata_map, csv_warnings = parse_json_metadata(content)
        else:
            csv_warnings.append("Metadata file must be .csv or .json")

    # Create batch
    batch = IngestionBatch(
        name=batch_name,
        total_documents=0,
        uploaded_by=user.id if user else None,
    )
    db.add(batch)
    await db.flush()

    documents_info: list[BulkUploadDocumentInfo] = []
    duplicates: list[str] = []
    errors: list[str] = []
    position = 0

    for upload_file in files:
        filename = upload_file.filename or "unknown.pdf"

        # Validate PDF
        if not filename.lower().endswith(".pdf"):
            errors.append(f"{filename}: not a PDF")
            continue

        content = await upload_file.read()

        # Check magic bytes
        if not content[:4] == b"%PDF":
            errors.append(f"{filename}: invalid PDF (bad magic bytes)")
            continue

        if len(content) > MAX_FILE_SIZE:
            errors.append(f"{filename}: exceeds 50MB limit")
            continue

        # Compute hash and check duplicates
        import hashlib
        file_hash = hashlib.sha256(content).hexdigest()
        result = await db.execute(
            select(Document).where(Document.file_hash == file_hash)
        )
        if result.scalar_one_or_none():
            duplicates.append(filename)
            continue

        # Resolve metadata
        meta = metadata_map.get(filename.lower(), {})
        metadata_source = "csv" if filename.lower() in metadata_map else "auto_detected"

        source_str = meta.get("source") or detect_source_from_filename(filename) or default_source.value
        source = SourceAuthority(source_str)
        doc_number = meta.get("document_number") or extract_doc_number(filename)

        # Save file
        doc_id = uuid.uuid4()
        source_dir = os.path.join(UPLOAD_DIR, source.value.lower())
        os.makedirs(source_dir, exist_ok=True)
        file_path = os.path.join(source_dir, f"{doc_id}.pdf")
        with open(file_path, "wb") as f:
            f.write(content)

        # Create document
        doc = Document(
            id=doc_id,
            title_en=meta.get("title_en") or filename,
            title_ar=meta.get("title_ar"),
            source=source,
            document_number=doc_number,
            status=DocumentStatus.PENDING,
            file_path=file_path,
            file_hash=file_hash,
            source_url=meta.get("source_url"),
            batch_id=batch.id,
            uploaded_by=user.id if user else None,
        )
        db.add(doc)
        await db.flush()

        # Create queue entry
        position += 1
        queue_item = IngestionQueue(
            batch_id=batch.id,
            document_id=doc_id,
            position=position,
        )
        db.add(queue_item)

        documents_info.append(BulkUploadDocumentInfo(
            document_id=str(doc_id),
            filename=filename,
            source=source.value,
            document_number=doc_number,
            queue_position=position,
            status="queued",
            metadata_source=metadata_source,
            warnings=[],
        ))

    # Update batch total
    batch.total_documents = position
    await db.flush()

    # Check for CSV rows that didn't match any uploaded file
    uploaded_lower = {(f.filename or "").lower() for f in files}
    for csv_fn in metadata_map:
        if csv_fn not in uploaded_lower:
            csv_warnings.append(f"CSV row for '{csv_fn}' has no matching uploaded file — skipped")

    # Dispatch batch processing
    if position > 0:
        try:
            from worker.tasks.batch import process_batch
            process_batch.delay(str(batch.id))
            logger.info("Dispatched batch %s with %d documents", batch.id, position)
        except Exception as e:
            logger.warning("Celery unavailable (%s), running batch in background", e)
            import threading

            def _run(bid: str):
                try:
                    from worker.tasks.batch import process_batch as _pb
                    _pb(bid)
                except Exception as ex:
                    logger.error("Background batch failed: %s", ex)

            threading.Thread(target=_run, args=(str(batch.id),), daemon=True).start()

    return BulkUploadResponse(
        batch_id=str(batch.id),
        batch_name=batch_name,
        total_documents=position,
        accepted=position,
        duplicates=duplicates,
        errors=errors,
        documents=documents_info,
        csv_warnings=csv_warnings,
    )


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
