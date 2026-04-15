import asyncio
import json
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.document import Document, DocumentStatus
from app.models.ingestion_batch import (
    BatchStatus,
    IngestionBatch,
    IngestionQueue,
    QueueItemStatus,
)
from app.models.user import User
from app.schemas.batch import (
    BatchDetailResponse,
    BatchListResponse,
    BatchSummaryResponse,
    QueueItemResponse,
)
from app.services.auth_service import get_optional_user, require_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/batches", tags=["batches"])


@router.get("", response_model=BatchListResponse)
async def list_batches(
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """List all ingestion batches."""
    query = select(IngestionBatch)
    if status:
        query = query.where(IngestionBatch.status == status)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(IngestionBatch.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    batches = result.scalars().all()

    return BatchListResponse(
        batches=[BatchSummaryResponse.model_validate(b) for b in batches],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{batch_id}", response_model=BatchDetailResponse)
async def get_batch(
    batch_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """Get batch detail with all queue items."""
    result = await db.execute(
        select(IngestionBatch)
        .options(selectinload(IngestionBatch.queue_items))
        .where(IngestionBatch.id == batch_id)
    )
    batch = result.scalar_one_or_none()

    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    # Enrich queue items with document info
    queue_items = []
    for qi in sorted(batch.queue_items, key=lambda q: q.position):
        # Fetch document for filename
        doc_result = await db.execute(
            select(Document).where(Document.id == qi.document_id)
        )
        doc = doc_result.scalar_one_or_none()

        queue_items.append(QueueItemResponse(
            id=qi.id,
            document_id=qi.document_id,
            filename=doc.title_en if doc else None,
            source=doc.source.value if doc else None,
            position=qi.position,
            status=qi.status.value,
            current_stage=qi.current_stage,
            stage_progress=qi.stage_progress or {},
            error_message=qi.error_message,
            started_at=qi.started_at,
            completed_at=qi.completed_at,
        ))

    return BatchDetailResponse(
        id=batch.id,
        name=batch.name,
        status=batch.status.value,
        total_documents=batch.total_documents,
        completed_documents=batch.completed_documents,
        failed_documents=batch.failed_documents,
        created_at=batch.created_at,
        updated_at=batch.updated_at,
        queue_items=queue_items,
    )


@router.post("/{batch_id}/retry-failed")
async def retry_failed(
    batch_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """Retry all failed documents in a batch."""
    result = await db.execute(
        select(IngestionQueue).where(
            IngestionQueue.batch_id == batch_id,
            IngestionQueue.status == QueueItemStatus.FAILED,
        )
    )
    failed_items = result.scalars().all()

    if not failed_items:
        return {"retried": 0, "message": "No failed documents to retry"}

    retried_ids = []
    for item in failed_items:
        item.status = QueueItemStatus.PENDING
        item.current_stage = None
        item.stage_progress = {}
        item.error_message = None
        item.started_at = None
        item.completed_at = None
        retried_ids.append(str(item.document_id))

        # Reset document status
        doc_result = await db.execute(
            select(Document).where(Document.id == item.document_id)
        )
        doc = doc_result.scalar_one_or_none()
        if doc:
            doc.status = DocumentStatus.PENDING

    # Update batch
    batch_result = await db.execute(
        select(IngestionBatch).where(IngestionBatch.id == batch_id)
    )
    batch = batch_result.scalar_one_or_none()
    if batch:
        batch.status = BatchStatus.PROCESSING
        batch.failed_documents = max(0, batch.failed_documents - len(failed_items))

    await db.flush()

    # Re-dispatch
    try:
        from worker.tasks.batch import process_batch
        process_batch.delay(str(batch_id))
    except Exception:
        import threading

        def _run(bid):
            from worker.tasks.batch import process_batch as _pb
            _pb(bid)

        threading.Thread(target=_run, args=(str(batch_id),), daemon=True).start()

    return {"retried": len(failed_items), "document_ids": retried_ids}


@router.delete("/{batch_id}", status_code=204)
async def delete_batch(
    batch_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Delete a batch. Documents remain in the system."""
    result = await db.execute(
        select(IngestionBatch).where(IngestionBatch.id == batch_id)
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    # Clear batch_id from documents (don't delete docs)
    docs_result = await db.execute(
        select(Document).where(Document.batch_id == batch_id)
    )
    for doc in docs_result.scalars():
        doc.batch_id = None

    await db.delete(batch)


@router.get("/{batch_id}/events")
async def batch_events(
    batch_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """SSE endpoint for real-time batch progress updates."""
    from app.services.sse_emitter import subscribe

    async def event_stream():
        # Send initial snapshot
        result = await db.execute(
            select(IngestionBatch).where(IngestionBatch.id == batch_id)
        )
        batch = result.scalar_one_or_none()
        if batch:
            snapshot = {
                "batch_id": str(batch.id),
                "status": batch.status.value,
                "total": batch.total_documents,
                "completed": batch.completed_documents,
                "failed": batch.failed_documents,
            }
            yield f"event: snapshot\ndata: {json.dumps(snapshot)}\n\n"

        # Stream live events
        async for msg in subscribe(str(batch_id)):
            if await request.is_disconnected():
                break
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
