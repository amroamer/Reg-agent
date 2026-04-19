"""Master ingestion task: orchestrates the 6-stage PDF → JSON → Markdown → Vectors pipeline."""

import hashlib
import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.article import Article
from app.models.chunk import Chunk
from app.models.document import Document, DocumentStatus
from app.models.ingestion_error import IngestionError
from app.services.article_chunker import ArticleChunker
from app.services.enrichment import EnrichmentService
from app.services.markdown_generator import MarkdownGenerator
from app.services.pdf_extractor import PDFExtractor
from app.services.structural_parser import StructuralParser
from worker.celery_app import app
from worker.tasks.embed import embed_and_store_chunks

logger = logging.getLogger(__name__)

_sync_engine = None


def _get_sync_engine():
    global _sync_engine
    if _sync_engine is None:
        _sync_engine = create_engine(settings.DATABASE_URL_SYNC, pool_size=5)
    return _sync_engine


def _get_sync_session() -> Session:
    return Session(_get_sync_engine())


# Pipeline services (initialized once)
_extractor = PDFExtractor()
_parser = StructuralParser()
_md_generator = MarkdownGenerator()
_chunker = ArticleChunker()


@app.task(bind=True, name="worker.tasks.ingest.ingest_document", max_retries=3)
def ingest_document(self, document_id: str, queue_item_id: str | None = None, batch_id: str | None = None):
    """6-stage ingestion pipeline: Extract → Parse → Markdown → Chunk → Embed → Enrich."""
    start_time = time.time()
    logger.info("[%s] Starting 6-stage ingestion...", document_id[:8])

    def _emit_stage(stage: str, session=None):
        """Update queue item and emit SSE event when entering a new stage."""
        if queue_item_id and session:
            try:
                from app.models.ingestion_batch import IngestionQueue
                qi = session.execute(
                    select(IngestionQueue).where(IngestionQueue.id == uuid.UUID(queue_item_id))
                ).scalar_one_or_none()
                if qi:
                    qi.current_stage = stage
                    prog = qi.stage_progress or {}
                    prog[stage] = {"status": "processing"}
                    qi.stage_progress = prog
                    session.commit()
            except Exception:
                pass
        try:
            from app.services.sse_emitter import sync_publish
            # Emit to batch channel if in batch, else to single-doc channel
            channel = batch_id if batch_id else f"doc:{document_id}"
            sync_publish(channel, "stage_changed", {
                "document_id": document_id,
                "queue_item_id": queue_item_id,
                "stage": stage,
            })
        except Exception:
            pass

    def _complete_stage(stage: str, duration: float, session=None):
        """Mark a stage as completed in the queue item + emit SSE."""
        if queue_item_id and session:
            try:
                from app.models.ingestion_batch import IngestionQueue
                qi = session.execute(
                    select(IngestionQueue).where(IngestionQueue.id == uuid.UUID(queue_item_id))
                ).scalar_one_or_none()
                if qi:
                    prog = qi.stage_progress or {}
                    prog[stage] = {"status": "completed", "duration_s": round(duration, 1)}
                    qi.stage_progress = prog
                    session.commit()
            except Exception:
                pass
        try:
            from app.services.sse_emitter import sync_publish
            channel = batch_id if batch_id else f"doc:{document_id}"
            sync_publish(channel, "stage_completed", {
                "document_id": document_id,
                "stage": stage,
                "duration_s": round(duration, 1),
            })
        except Exception:
            pass

    session = _get_sync_session()
    try:
        doc = session.execute(
            select(Document).where(Document.id == uuid.UUID(document_id))
        ).scalar_one_or_none()

        if not doc:
            logger.error("Document not found: %s", document_id)
            return {"status": "error", "message": "Document not found"}

        doc.status = DocumentStatus.PROCESSING
        doc.ingestion_started_at = datetime.now(timezone.utc)
        session.commit()

        file_path = doc.file_path
        if not os.path.exists(file_path):
            _fail(session, doc, "extraction", f"File not found: {file_path}")
            return {"status": "error", "message": "File not found"}

        source_folder = doc.source.value.lower()
        if source_folder == "bank_policy":
            source_folder = "bank_policies"
        base_name = Path(file_path).stem

        # Build document metadata for the parser
        doc_meta = {
            "source": doc.source.value,
            "document_number": doc.document_number,
            "title_ar": doc.title_ar,
            "title_en": doc.title_en,
            "issue_date": str(doc.issue_date) if doc.issue_date else None,
            "effective_date": str(doc.effective_date) if doc.effective_date else None,
            "source_url": doc.source_url,
            "pdf_filename": Path(file_path).name,
        }

        # ══════════ STAGE 1: PDF EXTRACTION ══════════
        _emit_stage("extraction", session)
        logger.info("[%s] Stage 1: Extracting PDF...", document_id[:8])
        try:
            extraction = _extractor.extract(file_path)
        except Exception as e:
            _fail(session, doc, "extraction", str(e))
            raise self.retry(exc=e, countdown=60)

        doc.page_count = extraction["total_pages"]
        doc.language = extraction["language"]
        session.commit()
        s1_time = time.time() - start_time
        _complete_stage("extraction", s1_time, session)
        logger.info("[%s] Stage 1 done: %d pages via %s (%.1fs)", document_id[:8], extraction["total_pages"], extraction["method"], s1_time)

        # ══════════ STAGE 2: STRUCTURAL PARSING ══════════
        s2_start = time.time()
        _emit_stage("parsing", session)
        logger.info("[%s] Stage 2: Parsing structure...", document_id[:8])
        try:
            document_json = _parser.parse(extraction, doc_meta)
            document_json["document"]["id"] = document_id
        except Exception as e:
            _fail(session, doc, "parsing", str(e))
            raise

        # Save structured JSON
        json_path = f"/app/processed/json/{source_folder}/{base_name}.json"
        os.makedirs(os.path.dirname(json_path), exist_ok=True)
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(document_json, f, ensure_ascii=False, indent=2)

        # Insert articles into DB
        article_db_ids = _insert_articles(session, doc, document_json["articles"])
        for i, article in enumerate(document_json["articles"]):
            if i < len(article_db_ids):
                article["article_id_in_db"] = article_db_ids[i]

        s2_time = time.time() - s2_start
        _complete_stage("parsing", s2_time, session)
        logger.info("[%s] Stage 2 done: %d articles (%.1fs)", document_id[:8], len(document_json["articles"]), s2_time)

        # ══════════ STAGE 3: MARKDOWN GENERATION ══════════
        s3_start = time.time()
        _emit_stage("markdown", session)
        logger.info("[%s] Stage 3: Generating Markdown...", document_id[:8])
        try:
            markdown = _md_generator.generate(document_json)
            md_path = f"/app/processed/markdown/{source_folder}/{base_name}.md"
            _md_generator.save(markdown, md_path)
        except Exception as e:
            _fail(session, doc, "markdown", str(e))
            # Non-fatal: continue without markdown
            md_path = None
            logger.warning("[%s] Markdown generation failed: %s", document_id[:8], e)

        s3_time = time.time() - s3_start
        _complete_stage("markdown", s3_time, session)
        logger.info("[%s] Stage 3 done (%.1fs)", document_id[:8], s3_time)

        # ══════════ STAGE 4: CHUNKING ══════════
        s4_start = time.time()
        _emit_stage("chunking", session)
        logger.info("[%s] Stage 4: Chunking articles...", document_id[:8])
        try:
            chunks = _chunker.chunk_document(document_json)
        except Exception as e:
            _fail(session, doc, "chunking", str(e))
            raise

        s4_time = time.time() - s4_start
        _complete_stage("chunking", s4_time, session)
        logger.info("[%s] Stage 4 done: %d chunks (%.1fs)", document_id[:8], len(chunks), s4_time)

        # ══════════ STAGE 5: EMBEDDING & STORAGE ══════════
        s5_start = time.time()
        _emit_stage("embedding", session)
        logger.info("[%s] Stage 5: Embedding %d chunks...", document_id[:8], len(chunks))
        try:
            chunks = embed_and_store_chunks(
                chunks=chunks,
                document_id=document_id,
                source=doc.source.value,
                language=extraction["language"],
            )
        except Exception as e:
            _fail(session, doc, "embedding", str(e))
            raise self.retry(exc=e, countdown=120)

        # Store chunks in PostgreSQL
        _insert_chunks(session, doc, chunks, extraction["language"], article_db_ids)

        s5_time = time.time() - s5_start
        _complete_stage("embedding", s5_time, session)
        logger.info("[%s] Stage 5 done: %d vectors stored (%.1fs)", document_id[:8], len(chunks), s5_time)

        # ══════════ STAGE 6: ENRICHMENT ══════════
        s6_start = time.time()
        _emit_stage("enrichment", session)
        logger.info("[%s] Stage 6: Enrichment...", document_id[:8])
        try:
            enrichment = EnrichmentService(session)
            enrichment.enrich_document(document_json, document_id)
        except Exception as e:
            _fail(session, doc, "enrichment", str(e))
            logger.warning("[%s] Enrichment failed (non-fatal): %s", document_id[:8], e)

        s6_time = time.time() - s6_start
        _complete_stage("enrichment", s6_time, session)
        logger.info("[%s] Stage 6 done (%.1fs)", document_id[:8], s6_time)

        # ══════════ COMPLETE ══════════
        total_time = time.time() - start_time
        doc.status = DocumentStatus.INDEXED
        doc.json_path = json_path
        doc.markdown_path = md_path
        doc.total_articles = len(document_json["articles"])
        doc.total_chunks = len(chunks)
        doc.ingestion_completed_at = datetime.now(timezone.utc)
        doc.error_message = None
        session.commit()

        summary = {
            "status": "completed",
            "document_id": document_id,
            "total_pages": extraction["total_pages"],
            "total_articles": len(document_json["articles"]),
            "total_chunks": len(chunks),
            "language": extraction["language"],
            "method": extraction["method"],
            "timing": {
                "extraction": f"{s1_time:.1f}s",
                "parsing": f"{s2_time:.1f}s",
                "markdown": f"{s3_time:.1f}s",
                "chunking": f"{s4_time:.1f}s",
                "embedding": f"{s5_time:.1f}s",
                "enrichment": f"{s6_time:.1f}s",
                "total": f"{total_time:.1f}s",
            },
            "warnings": extraction.get("warnings", []),
        }
        logger.info("[%s] INGESTION COMPLETE: %s", document_id[:8], json.dumps(summary))

        # Emit final "document_completed" event (for both single-doc and batch)
        try:
            from app.services.sse_emitter import sync_publish
            channel = batch_id if batch_id else f"doc:{document_id}"
            sync_publish(channel, "document_completed", {
                "document_id": document_id,
                "total_articles": summary.get("total_articles", 0),
                "total_chunks": summary.get("total_chunks", 0),
                "total_pages": summary.get("total_pages", 0),
                "timing": summary.get("timing", {}),
            })
        except Exception:
            pass

        return summary

    except Exception as e:
        logger.exception("Ingestion failed for %s", document_id)
        try:
            doc.status = DocumentStatus.FAILED
            doc.error_message = str(e)
            session.commit()
        except Exception:
            session.rollback()

        # Emit "document_failed" event
        try:
            from app.services.sse_emitter import sync_publish
            channel = batch_id if batch_id else f"doc:{document_id}"
            sync_publish(channel, "document_failed", {
                "document_id": document_id,
                "error": str(e),
            })
        except Exception:
            pass
        raise
    finally:
        session.close()


def _insert_articles(session: Session, doc: Document, articles: list) -> list[str]:
    """Insert parsed articles into PostgreSQL. Returns list of article DB IDs."""
    ids = []
    for article_data in articles:
        article = Article(
            document_id=doc.id,
            article_index=article_data.get("article_index", 0),
            chapter_number=article_data.get("chapter_number"),
            chapter_title_ar=article_data.get("chapter_title_ar"),
            chapter_title_en=article_data.get("chapter_title_en"),
            article_number=article_data.get("article_number"),
            article_title_ar=article_data.get("article_title_ar"),
            article_title_en=article_data.get("article_title_en"),
            content_ar=article_data.get("content_ar"),
            content_en=article_data.get("content_en"),
            page_start=article_data.get("page_start"),
            page_end=article_data.get("page_end"),
        )
        session.add(article)
        session.flush()
        ids.append(str(article.id))
    session.commit()
    return ids


def _insert_chunks(
    session: Session, doc: Document, chunks: list, language: str, article_ids: list
):
    """Insert chunks into PostgreSQL with article linkage."""
    for chunk_data in chunks:
        text = chunk_data.get("content", "")

        # Find matching article ID
        article_id = None
        art_idx = chunk_data.get("article_index")
        if art_idx is not None and art_idx < len(article_ids):
            article_id = uuid.UUID(article_ids[art_idx])

        chunk = Chunk(
            article_id=article_id,
            document_id=doc.id,
            chunk_index=chunk_data.get("chunk_index", 0),
            content=text,
            content_en=text if chunk_data.get("language") == "en" else None,
            content_ar=text if chunk_data.get("language") == "ar" else None,
            language=chunk_data.get("language", language),
            section_title=chunk_data.get("article_title"),
            article_number=chunk_data.get("article_number"),
            page_number=None,
            qdrant_point_id=chunk_data.get("qdrant_point_id"),
            token_count=chunk_data.get("token_count"),
            source=doc.source.value,
            document_number=doc.document_number,
        )
        session.add(chunk)
    session.commit()


def _fail(session: Session, doc: Document, phase: str, error_msg: str):
    """Log an ingestion error and update document status."""
    try:
        doc.status = DocumentStatus.FAILED
        doc.error_message = f"[{phase}] {error_msg}"
        err = IngestionError(
            document_id=doc.id,
            phase=phase,
            error_message=error_msg,
        )
        session.add(err)
        session.commit()
    except Exception:
        session.rollback()
    logger.error("[%s] Stage '%s' failed: %s", str(doc.id)[:8], phase, error_msg)


def compute_file_hash(file_path: str) -> str:
    """Compute SHA-256 hash of a file."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for block in iter(lambda: f.read(65536), b""):
            sha256.update(block)
    return sha256.hexdigest()
