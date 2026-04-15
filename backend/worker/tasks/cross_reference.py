import logging
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.chunk import Chunk
from app.models.cross_reference import CrossReference
from app.models.document import Document
from worker.celery_app import app
from worker.tasks.ingest import _get_sync_session

logger = logging.getLogger(__name__)


@app.task(name="worker.tasks.cross_reference.detect_cross_references")
def detect_cross_references(document_id: str):
    """Celery task to detect cross-references for a newly ingested document.

    Scans all chunks of the document for references to other documents
    using regex patterns. Creates CrossReference records with confidence scores.
    """
    session = _get_sync_session()
    try:
        doc_id = uuid.UUID(document_id)

        # Get all chunks for this document
        chunks = session.execute(
            select(Chunk).where(Chunk.document_id == doc_id)
        ).scalars().all()

        # Get all other indexed documents
        other_docs = session.execute(
            select(Document).where(
                Document.id != doc_id,
                Document.status == "indexed",
            )
        ).scalars().all()

        if not chunks or not other_docs:
            logger.info("No cross-references to detect for %s", document_id[:8])
            return {"detected": 0}

        import re

        patterns = [
            re.compile(r"(?:SAMA|CMA)\s*(?:Circular|Rule|Regulation)\s*(?:No\.?\s*)?([\w\-/]+)", re.IGNORECASE),
            re.compile(r"pursuant to\s+(.+?)(?:\.|,)", re.IGNORECASE),
            re.compile(r"وفقاً?\s+لـ?\s*(.+?)(?:\.|،)"),
            re.compile(r"بموجب\s+(.+?)(?:رقم|\.)", re.IGNORECASE),
        ]

        detected = []
        seen_pairs = set()

        for chunk in chunks:
            text = (chunk.content_en or "") + " " + (chunk.content_ar or "")
            for pattern in patterns:
                for match in pattern.finditer(text):
                    matched_text = match.group(0)
                    # Try matching against known documents
                    for doc in other_docs:
                        pair_key = (str(doc_id), str(doc.id))
                        if pair_key in seen_pairs:
                            continue
                        if _text_references_doc(matched_text, doc):
                            ref = CrossReference(
                                source_document_id=doc_id,
                                target_document_id=doc.id,
                                relationship_type="references",
                                confidence=0.7,
                                notes=f"Auto-detected: '{matched_text[:120]}'",
                            )
                            session.add(ref)
                            seen_pairs.add(pair_key)
                            detected.append(str(doc.id))

        session.commit()
        logger.info(
            "Detected %d cross-references for document %s",
            len(detected),
            document_id[:8],
        )
        return {"detected": len(detected)}

    except Exception as e:
        session.rollback()
        logger.exception("Cross-reference detection failed: %s", e)
        raise
    finally:
        session.close()


def _text_references_doc(text: str, doc: Document) -> bool:
    """Check if text references a document."""
    text_lower = text.lower()
    if doc.document_number and doc.document_number.lower() in text_lower:
        return True
    for title in [doc.title_en, doc.title_ar]:
        if title:
            keywords = [w for w in title.split() if len(w) > 3]
            if keywords:
                matches = sum(1 for w in keywords if w.lower() in text_lower)
                if matches / len(keywords) > 0.4:
                    return True
    return False
