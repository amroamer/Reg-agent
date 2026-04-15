import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.chunk import Chunk
from app.models.cross_reference import CrossReference
from app.models.document import Document
from app.models.search_log import SearchLog
from app.models.user import User
from app.schemas.admin import (
    AdminStatsResponse,
    CrossReferenceResponse,
    CrossReferenceVerifyRequest,
    SearchLogEntry,
)
from app.services.auth_service import get_current_user, get_optional_user, require_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStatsResponse)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """Get dashboard statistics."""
    # Total documents
    total_docs = (
        await db.execute(select(func.count()).select_from(Document))
    ).scalar() or 0

    # Documents by source
    source_counts = (
        await db.execute(
            select(Document.source, func.count())
            .group_by(Document.source)
        )
    ).all()
    docs_by_source = {str(s): c for s, c in source_counts}

    # Documents by status
    status_counts = (
        await db.execute(
            select(Document.status, func.count())
            .group_by(Document.status)
        )
    ).all()
    docs_by_status = {str(s): c for s, c in status_counts}

    # Total chunks
    total_chunks = (
        await db.execute(select(func.count()).select_from(Chunk))
    ).scalar() or 0

    # Total searches
    total_searches = (
        await db.execute(select(func.count()).select_from(SearchLog))
    ).scalar() or 0

    # Pending cross-refs
    pending_refs = (
        await db.execute(
            select(func.count())
            .select_from(CrossReference)
            .where(CrossReference.verified == False)
        )
    ).scalar() or 0

    return AdminStatsResponse(
        total_documents=total_docs,
        documents_by_source=docs_by_source,
        documents_by_status=docs_by_status,
        total_chunks=total_chunks,
        total_searches=total_searches,
        pending_cross_refs=pending_refs,
    )


@router.get("/cross-refs", response_model=list[CrossReferenceResponse])
async def list_cross_references(
    verified: bool | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """List cross-references with optional filter."""
    query = select(CrossReference)
    if verified is not None:
        query = query.where(CrossReference.verified == verified)
    query = query.order_by(CrossReference.confidence.desc()).limit(limit)

    result = await db.execute(query)
    return list(result.scalars().all())


@router.put("/cross-refs/{ref_id}/verify", response_model=CrossReferenceResponse)
async def verify_cross_reference(
    ref_id: uuid.UUID,
    body: CrossReferenceVerifyRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Approve or reject a cross-reference (admin only)."""
    result = await db.execute(
        select(CrossReference).where(CrossReference.id == ref_id)
    )
    ref = result.scalar_one_or_none()
    if not ref:
        raise HTTPException(status_code=404, detail="Cross-reference not found")

    ref.verified = body.verified
    ref.verified_by = user.id
    return ref


@router.get("/search-logs", response_model=list[SearchLogEntry])
async def get_search_logs(
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Get recent search logs (admin only)."""
    result = await db.execute(
        select(SearchLog)
        .order_by(SearchLog.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


@router.post("/reindex")
async def reindex_all(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Re-ingest all indexed documents (admin only)."""
    result = await db.execute(
        select(Document).where(Document.status == "indexed")
    )
    docs = result.scalars().all()

    dispatched = 0
    for doc in docs:
        try:
            from worker.tasks.ingest import ingest_document
            ingest_document.delay(str(doc.id))
            dispatched += 1
        except Exception as e:
            logger.warning("Failed to dispatch reindex for %s: %s", doc.id, e)

    return {"message": f"Dispatched reindex for {dispatched} documents"}
