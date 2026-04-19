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
    ArticlesResponse,
    ArticleSummary,
    ChapterGroup,
    ChunkResponse,
    DocumentDetailResponse,
    DocumentListResponse,
    DocumentResponse,
    DocumentUpdate,
    DuplicateInfo,
    FileValidationResponse,
    IngestionLogResponse,
    IngestionStageLog,
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
    # Commit so background thread (sync session) can see the new document
    await db.commit()

    # Dispatch ingestion: try Celery first, fall back to sync in background thread
    try:
        from worker.tasks.ingest import ingest_document

        ingest_document.delay(str(doc_id))
        logger.info("Dispatched Celery ingestion task for document: %s", doc_id)
    except Exception as e:
        logger.warning("Celery unavailable (%s), running ingestion in background thread", e)
        import threading
        import time as _time

        def _run_sync_ingest(did: str):
            # Small delay to ensure the async transaction has fully committed
            _time.sleep(0.5)
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
    source: str | None = Query(None, description="Comma-separated list: SAMA,CMA,BANK_POLICY"),
    status_filter: str | None = Query(None, alias="status", description="Comma-separated statuses"),
    search: str | None = Query(None, description="Search title (EN+AR) and document number"),
    sort_by: str = Query("created_at", regex="^(created_at|title_en|status|total_articles|page_count)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """List documents with filters, search, sort, pagination. Returns library-wide stats."""
    from app.schemas.document import LibraryStats

    query = select(Document)

    # Source filter (comma-separated multi-select)
    if source:
        sources = [s.strip().upper() for s in source.split(",") if s.strip()]
        if sources:
            query = query.where(Document.source.in_(sources))

    # Status filter (comma-separated multi-select, case-insensitive)
    if status_filter:
        statuses = [s.strip().lower() for s in status_filter.split(",") if s.strip()]
        if statuses:
            query = query.where(Document.status.in_(statuses))

    # Search: title (EN or AR) or document number (case-insensitive)
    if search:
        term = f"%{search.strip()}%"
        query = query.where(
            (Document.title_en.ilike(term))
            | (Document.title_ar.ilike(term))
            | (Document.document_number.ilike(term))
        )

    # Count filtered total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Sort
    sort_col_map = {
        "created_at": Document.created_at,
        "title_en": Document.title_en,
        "status": Document.status,
        "total_articles": Document.total_articles,
        "page_count": Document.page_count,
    }
    sort_col = sort_col_map.get(sort_by, Document.created_at)
    query = query.order_by(sort_col.desc() if sort_order == "desc" else sort_col.asc())

    # Paginate
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    documents = result.scalars().all()

    # Library-wide stats (NOT filtered — shows total breakdown)
    stats_result = await db.execute(
        select(Document.status, func.count()).group_by(Document.status)
    )
    status_counts = {str(s.value if hasattr(s, "value") else s): c for s, c in stats_result.all()}
    stats = LibraryStats(
        total=sum(status_counts.values()),
        indexed=status_counts.get("indexed", 0),
        processing=status_counts.get("processing", 0),
        pending=status_counts.get("pending", 0),
        failed=status_counts.get("failed", 0),
        superseded=status_counts.get("superseded", 0),
    )

    return DocumentListResponse(
        documents=[DocumentResponse.model_validate(d) for d in documents],
        total=total,
        page=page,
        page_size=page_size,
        stats=stats,
    )


# ════════════════════════════════════════════════════════════════
# NEW: Lightweight polling endpoint for active documents
# ════════════════════════════════════════════════════════════════

@router.get("/processing-status", response_model=list[dict])
async def processing_status(
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """Poll endpoint: return status of all pending/processing documents."""
    result = await db.execute(
        select(Document).where(
            Document.status.in_([DocumentStatus.PENDING, DocumentStatus.PROCESSING])
        )
    )
    docs = result.scalars().all()

    from app.models.ingestion_batch import IngestionQueue
    out = []
    for doc in docs:
        # Find latest queue item for stage info
        qr = await db.execute(
            select(IngestionQueue)
            .where(IngestionQueue.document_id == doc.id)
            .order_by(IngestionQueue.created_at.desc())
            .limit(1)
        )
        qi = qr.scalar_one_or_none()
        out.append({
            "id": str(doc.id),
            "status": doc.status.value,
            "current_stage": qi.current_stage if qi else None,
            "stage_progress": qi.stage_progress if qi else {},
            "total_articles": doc.total_articles,
            "total_chunks": doc.total_chunks,
            "error_message": doc.error_message,
        })
    return out


# ════════════════════════════════════════════════════════════════
# NEW: Bulk delete
# ════════════════════════════════════════════════════════════════

@router.post("/bulk-delete")
async def bulk_delete(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Bulk delete documents. Body: {document_ids: [...], confirm: true}"""
    from app.services.qdrant_service import delete_by_document_id

    ids = body.get("document_ids", [])
    if not body.get("confirm"):
        raise HTTPException(400, "Must set confirm=true")
    if not ids:
        raise HTTPException(400, "No document_ids provided")

    uuids = [uuid.UUID(i) for i in ids]
    result = await db.execute(select(Document).where(Document.id.in_(uuids)))
    docs = result.scalars().all()

    deleted = 0
    for doc in docs:
        # Qdrant
        try:
            delete_by_document_id(str(doc.id))
        except Exception:
            pass
        # Files
        for attr in ("file_path", "json_path", "markdown_path"):
            p = getattr(doc, attr, None)
            if p and os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass
        await db.delete(doc)
        deleted += 1

    return {"deleted": deleted, "requested": len(ids)}


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
    """Delete a document and all its chunks (admin only).

    Cascade order:
    1. Delete Qdrant vectors (by document_id filter)
    2. Delete PDF, JSON, Markdown files from disk
    3. Delete DB record (cascades to chunks, articles, cross_refs, ingestion_queue)
    """
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # 1. Delete vectors from Qdrant
    try:
        from app.services.qdrant_service import delete_by_document_id

        delete_by_document_id(str(document_id))
        logger.info("Deleted Qdrant vectors for doc %s", document_id)
    except Exception as e:
        logger.warning("Failed to delete Qdrant vectors: %s", e)

    # 2. Delete files from disk
    for path_attr in ("file_path", "json_path", "markdown_path"):
        path = getattr(doc, path_attr, None)
        if path and os.path.exists(path):
            try:
                os.remove(path)
                logger.info("Deleted %s: %s", path_attr, path)
            except Exception as e:
                logger.warning("Failed to delete %s: %s", path, e)

    # 3. Delete from DB (cascades)
    await db.delete(doc)


# ════════════════════════════════════════════════════════════════
# NEW: Pre-upload validation
# ════════════════════════════════════════════════════════════════

@router.post("/validate", response_model=FileValidationResponse)
async def validate_upload(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """Validate a PDF before full upload. Returns page count, language, duplicate info, auto-detected metadata."""
    import hashlib
    import io

    issues: list[str] = []

    # Check extension
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        issues.append(f"Only PDF files are accepted. Got: {ext or 'unknown'}")
        return FileValidationResponse(valid=False, issues=issues)

    # Read file (up to MAX_FILE_SIZE+1)
    content = await file.read()
    size_mb = len(content) / (1024 * 1024)

    if len(content) > MAX_FILE_SIZE:
        issues.append(f"File is too large ({size_mb:.1f} MB). Maximum is 50 MB.")
        return FileValidationResponse(valid=False, issues=issues, file_size_mb=round(size_mb, 2))

    # Check PDF magic bytes
    if content[:4] != b"%PDF":
        issues.append("This file is not a valid PDF. It may be corrupted or renamed.")
        return FileValidationResponse(valid=False, issues=issues, file_size_mb=round(size_mb, 2))

    # Compute hash
    file_hash = hashlib.sha256(content).hexdigest()

    # Check duplicate
    dup_info = DuplicateInfo()
    dup_result = await db.execute(
        select(Document).where(Document.file_hash == file_hash)
    )
    dup_doc = dup_result.scalar_one_or_none()
    if dup_doc:
        dup_info = DuplicateInfo(
            found=True,
            existing_document_id=str(dup_doc.id),
            existing_title=dup_doc.title_en or dup_doc.title_ar or "Untitled",
            uploaded_at=dup_doc.created_at,
        )

    # Probe with pdfplumber
    page_count = None
    is_scanned = False
    detected_language = None
    auto_meta = {}

    try:
        import pdfplumber

        with pdfplumber.open(io.BytesIO(content)) as pdf:
            page_count = len(pdf.pages)

            # Sample first 3 pages for text density + language
            sample_pages = pdf.pages[: min(3, page_count)]
            total_chars = 0
            sample_text = ""
            for p in sample_pages:
                t = p.extract_text() or ""
                total_chars += len(t)
                sample_text += t + "\n"

            avg_chars = total_chars / max(len(sample_pages), 1)
            is_scanned = avg_chars < 50

            # Language detection via character ranges
            if sample_text.strip():
                import re

                arabic_chars = len(re.findall(r"[\u0600-\u06FF]", sample_text))
                latin_chars = len(re.findall(r"[a-zA-Z]", sample_text))
                total = arabic_chars + latin_chars
                if total > 0:
                    ar_ratio = arabic_chars / total
                    if ar_ratio > 0.8:
                        detected_language = "ar"
                    elif ar_ratio < 0.2:
                        detected_language = "en"
                    else:
                        detected_language = "bilingual"

                # Auto-detect title from first page (simple heuristic: first non-trivial line)
                first_page_text = sample_pages[0].extract_text() if sample_pages else ""
                if first_page_text:
                    lines = [ln.strip() for ln in first_page_text.split("\n") if ln.strip()]
                    if lines:
                        first_line = lines[0][:200]
                        # Detect if first line is Arabic or English
                        if any("\u0600" <= c <= "\u06FF" for c in first_line):
                            auto_meta["title_ar"] = first_line
                        else:
                            auto_meta["title_en"] = first_line

        # Auto-detect source and doc number from filename
        from app.services.metadata_parser import (
            detect_source_from_filename,
            extract_doc_number,
        )
        auto_src = detect_source_from_filename(filename)
        if auto_src:
            auto_meta["source"] = auto_src
        auto_num = extract_doc_number(filename)
        if auto_num:
            auto_meta["document_number"] = auto_num

    except Exception as e:
        issues.append(f"PDF appears valid but could not be parsed: {e}")

    return FileValidationResponse(
        valid=len(issues) == 0,
        issues=issues,
        file_size_mb=round(size_mb, 2),
        page_count=page_count,
        is_scanned=is_scanned,
        detected_language=detected_language,
        file_hash=file_hash,
        duplicate=dup_info,
        auto_detected_metadata=auto_meta,
    )


# ════════════════════════════════════════════════════════════════
# NEW: Edit metadata
# ════════════════════════════════════════════════════════════════

@router.patch("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: uuid.UUID,
    body: DocumentUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Update document metadata (admin only)."""
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(doc, field, value)

    await db.flush()
    return doc


# ════════════════════════════════════════════════════════════════
# NEW: Retry & Reprocess
# ════════════════════════════════════════════════════════════════

def _dispatch_ingest(doc_id: str):
    """Try Celery first, fall back to background thread."""
    try:
        from worker.tasks.ingest import ingest_document
        ingest_document.delay(doc_id)
    except Exception as e:
        logger.warning("Celery unavailable (%s), using background thread", e)
        import threading
        import time as _time

        def _run(did):
            _time.sleep(0.5)
            try:
                from worker.tasks.ingest import ingest_document as _ingest
                _ingest(did)
            except Exception as ex:
                logger.error("Background ingestion failed: %s", ex)

        threading.Thread(target=_run, args=(doc_id,), daemon=True).start()


@router.post("/{document_id}/retry", response_model=DocumentResponse)
async def retry_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """Retry ingestion for a failed document."""
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.status != DocumentStatus.FAILED:
        raise HTTPException(
            status_code=400,
            detail=f"Can only retry FAILED documents. Current status: {doc.status.value}",
        )

    doc.status = DocumentStatus.PENDING
    doc.error_message = None
    doc.ingestion_started_at = None
    doc.ingestion_completed_at = None
    await db.flush()
    await db.commit()

    _dispatch_ingest(str(document_id))
    return doc


@router.post("/{document_id}/reprocess", response_model=DocumentResponse)
async def reprocess_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Force re-run of the full ingestion pipeline (admin only). Deletes old chunks + vectors first."""
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete Qdrant vectors
    try:
        from app.services.qdrant_service import delete_by_document_id
        delete_by_document_id(str(document_id))
    except Exception as e:
        logger.warning("Failed to delete Qdrant vectors during reprocess: %s", e)

    # Delete old chunks and articles (cascade via ORM)
    from app.models.article import Article
    await db.execute(
        Chunk.__table__.delete().where(Chunk.document_id == document_id)
    )
    await db.execute(
        Article.__table__.delete().where(Article.document_id == document_id)
    )

    doc.status = DocumentStatus.PENDING
    doc.error_message = None
    doc.total_articles = None
    doc.total_chunks = 0
    doc.ingestion_started_at = None
    doc.ingestion_completed_at = None
    await db.flush()
    await db.commit()

    _dispatch_ingest(str(document_id))
    return doc


# ════════════════════════════════════════════════════════════════
# NEW: Serve PDF / JSON / Markdown
# ════════════════════════════════════════════════════════════════

@router.get("/{document_id}/pdf")
async def get_pdf(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """Stream the original PDF file."""
    from fastapi.responses import FileResponse

    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc or not doc.file_path or not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="PDF not found")

    return FileResponse(
        doc.file_path,
        media_type="application/pdf",
        filename=f"{doc.document_number or doc.id}.pdf",
    )


@router.get("/{document_id}/json")
async def get_json(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """Serve the structured JSON file."""
    from fastapi.responses import FileResponse

    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc or not doc.json_path or not os.path.exists(doc.json_path):
        raise HTTPException(status_code=404, detail="JSON not generated for this document")

    return FileResponse(
        doc.json_path,
        media_type="application/json",
        filename=f"{doc.document_number or doc.id}.json",
    )


@router.get("/{document_id}/markdown")
async def get_markdown(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """Serve the generated Markdown file."""
    from fastapi.responses import FileResponse

    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc or not doc.markdown_path or not os.path.exists(doc.markdown_path):
        raise HTTPException(status_code=404, detail="Markdown not generated")

    return FileResponse(
        doc.markdown_path,
        media_type="text/markdown",
        filename=f"{doc.document_number or doc.id}.md",
    )


# ════════════════════════════════════════════════════════════════
# NEW: Articles & Ingestion Log
# ════════════════════════════════════════════════════════════════

@router.get("/{document_id}/articles", response_model=ArticlesResponse)
async def get_articles(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """Get articles grouped by chapter."""
    from app.models.article import Article

    result = await db.execute(
        select(Article)
        .where(Article.document_id == document_id)
        .order_by(Article.article_index)
    )
    articles = result.scalars().all()

    # Group by chapter
    chapters: dict[str, ChapterGroup] = {}
    for a in articles:
        key = a.chapter_number or "_"
        if key not in chapters:
            chapters[key] = ChapterGroup(
                chapter_number=a.chapter_number,
                chapter_title_ar=a.chapter_title_ar,
                chapter_title_en=a.chapter_title_en,
                articles=[],
            )
        chapters[key].articles.append(ArticleSummary.model_validate(a))

    return ArticlesResponse(
        chapters=list(chapters.values()),
        total_articles=len(articles),
    )


@router.get("/{document_id}/articles/{article_index}")
async def get_article(
    document_id: uuid.UUID,
    article_index: int,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """Get a single article with full content (EN + AR)."""
    from app.models.article import Article

    result = await db.execute(
        select(Article)
        .where(
            Article.document_id == document_id,
            Article.article_index == article_index,
        )
    )
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    return {
        "id": str(article.id),
        "article_index": article.article_index,
        "chapter_number": article.chapter_number,
        "chapter_title_ar": article.chapter_title_ar,
        "chapter_title_en": article.chapter_title_en,
        "article_number": article.article_number,
        "article_title_ar": article.article_title_ar,
        "article_title_en": article.article_title_en,
        "content_ar": article.content_ar,
        "content_en": article.content_en,
        "page_start": article.page_start,
        "page_end": article.page_end,
    }


@router.get("/{document_id}/ingestion-log", response_model=IngestionLogResponse)
async def get_ingestion_log(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """Get ingestion stage log (from IngestionQueue.stage_progress if present, else from IngestionError)."""
    from app.models.ingestion_batch import IngestionQueue
    from app.models.ingestion_error import IngestionError

    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Find the latest queue item for this doc (if batch upload)
    q_result = await db.execute(
        select(IngestionQueue)
        .where(IngestionQueue.document_id == document_id)
        .order_by(IngestionQueue.created_at.desc())
    )
    queue_item = q_result.scalars().first()

    stages: list[IngestionStageLog] = []
    if queue_item and queue_item.stage_progress:
        for stage_name in ["extraction", "parsing", "markdown", "chunking", "embedding", "enrichment"]:
            info = queue_item.stage_progress.get(stage_name, {})
            if info:
                stages.append(IngestionStageLog(
                    stage=stage_name,
                    status=info.get("status", "pending"),
                    duration_s=info.get("duration_s"),
                ))

    # Errors
    err_result = await db.execute(
        select(IngestionError).where(IngestionError.document_id == document_id)
    )
    errors = [
        {
            "phase": e.phase,
            "error_message": e.error_message,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in err_result.scalars()
    ]

    total_duration = None
    if doc.ingestion_started_at and doc.ingestion_completed_at:
        total_duration = (doc.ingestion_completed_at - doc.ingestion_started_at).total_seconds()

    return IngestionLogResponse(
        document_id=doc.id,
        document_status=doc.status.value,
        ingestion_started_at=doc.ingestion_started_at,
        ingestion_completed_at=doc.ingestion_completed_at,
        total_duration_s=total_duration,
        stages=stages,
        errors=errors,
    )


# ════════════════════════════════════════════════════════════════
# NEW: Single-doc SSE stream
# ════════════════════════════════════════════════════════════════

@router.get("/{document_id}/ingestion-events")
async def ingestion_events(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """SSE stream for single-document ingestion progress."""
    import json as _json

    from fastapi.responses import StreamingResponse

    from app.services.sse_emitter import subscribe

    async def event_stream():
        # Initial snapshot
        result = await db.execute(select(Document).where(Document.id == document_id))
        doc = result.scalar_one_or_none()
        if doc:
            snapshot = {
                "document_id": str(doc.id),
                "status": doc.status.value,
                "total_articles": doc.total_articles or 0,
                "total_chunks": doc.total_chunks or 0,
                "page_count": doc.page_count,
                "error_message": doc.error_message,
            }
            yield f"event: snapshot\ndata: {_json.dumps(snapshot)}\n\n"

        # Subscribe to single-doc channel (format: "doc:{document_id}")
        async for msg in subscribe(f"doc:{document_id}"):
            yield msg

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
