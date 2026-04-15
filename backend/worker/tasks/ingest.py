import hashlib
import logging
import os
import time
import uuid

from sqlalchemy import create_engine, select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.models.chunk import Chunk
from app.models.document import Document, DocumentStatus
from worker.celery_app import app
from worker.tasks.chunk import chunk_document
from worker.tasks.embed import embed_and_store_chunks
from worker.tasks.ocr import extract_text_from_pdf

logger = logging.getLogger(__name__)

# Sync engine for Celery worker (Celery doesn't support async)
_sync_engine = None


def _get_sync_engine():
    global _sync_engine
    if _sync_engine is None:
        _sync_engine = create_engine(settings.DATABASE_URL_SYNC, pool_size=5)
    return _sync_engine


def _get_sync_session() -> Session:
    engine = _get_sync_engine()
    return Session(engine)


@app.task(bind=True, name="worker.tasks.ingest.ingest_document", max_retries=3)
def ingest_document(self, document_id: str):
    """Master ingestion task: OCR → chunk → embed → store.

    Updates document status at each stage.
    """
    start_time = time.time()
    logger.info("Starting ingestion for document: %s", document_id)

    session = _get_sync_session()
    try:
        # Fetch document
        doc = session.execute(
            select(Document).where(Document.id == uuid.UUID(document_id))
        ).scalar_one_or_none()

        if not doc:
            logger.error("Document not found: %s", document_id)
            return {"status": "error", "message": "Document not found"}

        # Update status to processing
        doc.status = DocumentStatus.PROCESSING
        session.commit()

        file_path = doc.file_path
        if not os.path.exists(file_path):
            _fail_document(session, doc, f"File not found: {file_path}")
            return {"status": "error", "message": "File not found"}

        # Step 1: Extract text (OCR)
        logger.info("[%s] Step 1: Extracting text...", document_id[:8])
        try:
            extraction = extract_text_from_pdf(file_path)
        except Exception as e:
            _fail_document(session, doc, f"OCR failed: {e}")
            raise self.retry(exc=e, countdown=60)

        # Update document with extraction metadata
        doc.page_count = extraction["page_count"]
        doc.language = extraction["language"]
        session.commit()

        # Step 2: Chunk by regulatory structure
        logger.info("[%s] Step 2: Chunking (%d pages)...", document_id[:8], len(extraction["pages"]))
        try:
            chunks = chunk_document(extraction["pages"], extraction["language"])
        except Exception as e:
            _fail_document(session, doc, f"Chunking failed: {e}")
            raise

        if not chunks:
            _fail_document(session, doc, "No chunks created (empty document?)")
            return {"status": "error", "message": "No chunks created"}

        # Step 3: Embed and store in Qdrant
        logger.info("[%s] Step 3: Embedding %d chunks...", document_id[:8], len(chunks))
        try:
            chunks = embed_and_store_chunks(
                chunks=chunks,
                document_id=document_id,
                source=doc.source.value,
                language=extraction["language"],
            )
        except Exception as e:
            _fail_document(session, doc, f"Embedding failed: {e}")
            raise self.retry(exc=e, countdown=120)

        # Step 4: Store chunks in PostgreSQL
        logger.info("[%s] Step 4: Storing %d chunks in DB...", document_id[:8], len(chunks))
        _store_chunks_in_db(session, doc, chunks, extraction["language"])

        # Mark as indexed
        doc.status = DocumentStatus.INDEXED
        doc.error_message = None
        session.commit()

        elapsed = time.time() - start_time
        logger.info(
            "[%s] Ingestion complete: %d chunks, %.1fs",
            document_id[:8],
            len(chunks),
            elapsed,
        )

        return {
            "status": "success",
            "document_id": document_id,
            "chunks_created": len(chunks),
            "pages_processed": extraction["page_count"],
            "language": extraction["language"],
            "method": extraction["method"],
            "elapsed_seconds": round(elapsed, 1),
        }

    except Exception as e:
        logger.exception("Ingestion failed for document: %s", document_id)
        _fail_document(session, doc, str(e))
        raise
    finally:
        session.close()


def _store_chunks_in_db(
    session: Session,
    doc: Document,
    chunks: list[dict],
    language: str,
):
    """Store extracted chunks in PostgreSQL."""
    for chunk_data in chunks:
        text = chunk_data["text"]

        # Assign to language-specific columns
        content_en = text if language == "en" else None
        content_ar = text if language == "ar" else None
        if language == "bilingual":
            content_en = text
            content_ar = text

        chunk = Chunk(
            document_id=doc.id,
            chunk_index=chunk_data.get("chunk_index", 0),
            content_en=content_en,
            content_ar=content_ar,
            section_title=chunk_data.get("section_title"),
            article_number=chunk_data.get("article_number"),
            page_number=chunk_data.get("page_number"),
            qdrant_point_id=chunk_data.get("qdrant_point_id"),
            token_count=len(text.split()),
        )
        session.add(chunk)

    session.commit()


def _fail_document(session: Session, doc: Document, error_message: str):
    """Mark a document as failed."""
    try:
        doc.status = DocumentStatus.FAILED
        doc.error_message = error_message
        session.commit()
    except Exception:
        session.rollback()
    logger.error("Document %s failed: %s", doc.id, error_message)


def compute_file_hash(file_path: str) -> str:
    """Compute SHA-256 hash of a file."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for block in iter(lambda: f.read(65536), b""):
            sha256.update(block)
    return sha256.hexdigest()
