import logging
import re
import uuid

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cross_reference import CrossReference
from app.models.chunk import Chunk
from app.models.document import Document

logger = logging.getLogger(__name__)

# Regex patterns for detecting regulatory cross-references
REFERENCE_PATTERNS = [
    # English patterns
    re.compile(r"pursuant to (?:Article|Section)\s+(\d+[\.\d]*)\s+of\s+(.+?)(?:\.|,|\))", re.IGNORECASE),
    re.compile(r"in accordance with\s+(.+?)(?:Article|Section)\s+(\d+[\.\d]*)", re.IGNORECASE),
    re.compile(r"(?:SAMA|CMA)\s*(?:Circular|Rule|Regulation)\s*(?:No\.?\s*)?([\w\-/]+)", re.IGNORECASE),
    re.compile(r"as (?:required|specified|defined) (?:by|in|under)\s+(.+?)(?:\.|,|\))", re.IGNORECASE),
    # Arabic patterns
    re.compile(r"وفقاً?\s+(?:لـ?|ل)\s*(?:المادة|الفصل|الباب)\s+(\S+)\s+من\s+(.+?)(?:\.|،)"),
    re.compile(r"بموجب\s+(?:نظام|تعميم|قرار)\s+(.+?)(?:رقم|رقم\.?)\s*([\d/\-]+)"),
]


async def detect_cross_references(
    db: AsyncSession,
    document_id: uuid.UUID,
) -> list[dict]:
    """Scan a document's chunks for cross-references to other documents."""
    # Get all chunks for this document
    result = await db.execute(
        select(Chunk).where(Chunk.document_id == document_id)
    )
    chunks = result.scalars().all()

    # Get all other documents for matching
    doc_result = await db.execute(
        select(Document).where(Document.id != document_id)
    )
    all_docs = doc_result.scalars().all()

    detected_refs = []
    for chunk in chunks:
        text = chunk.content_en or chunk.content_ar or ""
        refs = _extract_references_from_text(text, all_docs)
        for ref in refs:
            detected_refs.append({
                "source_document_id": str(document_id),
                "target_document_id": ref["target_document_id"],
                "relationship_type": ref["relationship_type"],
                "confidence": ref["confidence"],
                "notes": ref.get("notes", ""),
            })

    # Deduplicate by (source, target, relationship)
    seen = set()
    unique_refs = []
    for ref in detected_refs:
        key = (ref["source_document_id"], ref["target_document_id"], ref["relationship_type"])
        if key not in seen:
            seen.add(key)
            unique_refs.append(ref)

    return unique_refs


def _extract_references_from_text(text: str, documents: list) -> list[dict]:
    """Extract regulatory references from text and match to known documents."""
    refs = []
    for pattern in REFERENCE_PATTERNS:
        matches = pattern.finditer(text)
        for match in matches:
            matched_text = match.group(0)
            # Try to match against known documents
            for doc in documents:
                if _is_likely_reference(matched_text, doc):
                    refs.append({
                        "target_document_id": str(doc.id),
                        "relationship_type": "references",
                        "confidence": 0.7,
                        "notes": f"Auto-detected: '{matched_text[:100]}'",
                    })
                    break
    return refs


def _is_likely_reference(text: str, doc) -> bool:
    """Check if extracted text likely refers to a specific document."""
    text_lower = text.lower()

    # Check document number
    if doc.document_number:
        if doc.document_number.lower() in text_lower:
            return True

    # Check title keywords
    for title in [doc.title_en, doc.title_ar]:
        if title:
            # Check if significant keywords from the title appear in the reference
            words = [w for w in title.split() if len(w) > 3]
            matches = sum(1 for w in words if w.lower() in text_lower)
            if len(words) > 0 and matches / len(words) > 0.4:
                return True

    return False


async def get_cross_references(
    db: AsyncSession,
    document_id: uuid.UUID | None = None,
    verified_only: bool = False,
    limit: int = 50,
) -> list[CrossReference]:
    """Fetch cross-references with optional filters."""
    query = select(CrossReference)

    if document_id:
        query = query.where(
            (CrossReference.source_document_id == document_id)
            | (CrossReference.target_document_id == document_id)
        )
    if verified_only:
        query = query.where(CrossReference.verified == True)

    query = query.order_by(CrossReference.confidence.desc()).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def verify_cross_reference(
    db: AsyncSession,
    ref_id: uuid.UUID,
    verified: bool,
    user_id: uuid.UUID,
) -> CrossReference | None:
    """Approve or reject a cross-reference."""
    result = await db.execute(
        select(CrossReference).where(CrossReference.id == ref_id)
    )
    ref = result.scalar_one_or_none()
    if ref:
        ref.verified = verified
        ref.verified_by = user_id
    return ref
