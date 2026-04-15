"""Batch processing task: processes documents from the ingestion queue sequentially."""

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update

from app.config import settings
from app.models.document import Document, DocumentStatus
from app.models.ingestion_batch import (
    BatchStatus,
    IngestionBatch,
    IngestionQueue,
    QueueItemStatus,
)
from app.services.sse_emitter import sync_publish
from worker.celery_app import app
from worker.tasks.ingest import _get_sync_session, ingest_document

logger = logging.getLogger(__name__)


@app.task(bind=True, name="worker.tasks.batch.process_batch")
def process_batch(self, batch_id: str):
    """Process all pending documents in a batch sequentially."""
    session = _get_sync_session()
    try:
        batch = session.execute(
            select(IngestionBatch).where(IngestionBatch.id == uuid.UUID(batch_id))
        ).scalar_one_or_none()

        if not batch:
            logger.error("Batch not found: %s", batch_id)
            return {"status": "error", "message": "Batch not found"}

        # Mark batch as processing
        batch.status = BatchStatus.PROCESSING
        session.commit()

        # Get pending queue items in order
        queue_items = session.execute(
            select(IngestionQueue)
            .where(
                IngestionQueue.batch_id == uuid.UUID(batch_id),
                IngestionQueue.status == QueueItemStatus.PENDING,
            )
            .order_by(IngestionQueue.position)
        ).scalars().all()

        logger.info("[Batch %s] Processing %d documents", batch_id[:8], len(queue_items))

        for item in queue_items:
            doc_id = str(item.document_id)
            queue_item_id = str(item.id)

            # Mark queue item as processing
            item.status = QueueItemStatus.PROCESSING
            item.started_at = datetime.now(timezone.utc)
            session.commit()

            # Emit SSE event
            sync_publish(batch_id, "document_started", {
                "document_id": doc_id,
                "queue_item_id": queue_item_id,
                "position": item.position,
                "total": batch.total_documents,
            })

            try:
                # Run the 6-stage ingestion pipeline
                result = ingest_document(
                    doc_id,
                    queue_item_id=queue_item_id,
                    batch_id=batch_id,
                )

                # Mark queue item completed
                item.status = QueueItemStatus.COMPLETED
                item.completed_at = datetime.now(timezone.utc)
                batch.completed_documents += 1
                session.commit()

                total_articles = result.get("total_articles", 0) if isinstance(result, dict) else 0
                total_chunks = result.get("total_chunks", 0) if isinstance(result, dict) else 0

                sync_publish(batch_id, "document_completed", {
                    "document_id": doc_id,
                    "queue_item_id": queue_item_id,
                    "position": item.position,
                    "total_articles": total_articles,
                    "total_chunks": total_chunks,
                })

                logger.info("[Batch %s] Document %s completed", batch_id[:8], doc_id[:8])

            except Exception as e:
                logger.error("[Batch %s] Document %s failed: %s", batch_id[:8], doc_id[:8], e)

                item.status = QueueItemStatus.FAILED
                item.error_message = str(e)
                item.completed_at = datetime.now(timezone.utc)
                batch.failed_documents += 1
                session.commit()

                sync_publish(batch_id, "document_failed", {
                    "document_id": doc_id,
                    "queue_item_id": queue_item_id,
                    "position": item.position,
                    "stage": item.current_stage,
                    "error": str(e),
                })

        # Determine final batch status
        if batch.failed_documents == 0:
            batch.status = BatchStatus.COMPLETED
        elif batch.completed_documents == 0:
            batch.status = BatchStatus.FAILED
        else:
            batch.status = BatchStatus.COMPLETED  # partial success
        batch.updated_at = datetime.now(timezone.utc)
        session.commit()

        sync_publish(batch_id, "batch_completed", {
            "batch_id": batch_id,
            "total": batch.total_documents,
            "completed": batch.completed_documents,
            "failed": batch.failed_documents,
            "status": batch.status.value,
        })

        logger.info(
            "[Batch %s] Complete: %d/%d succeeded, %d failed",
            batch_id[:8], batch.completed_documents, batch.total_documents, batch.failed_documents,
        )

        return {
            "batch_id": batch_id,
            "completed": batch.completed_documents,
            "failed": batch.failed_documents,
        }

    except Exception as e:
        logger.exception("Batch processing failed: %s", e)
        raise
    finally:
        session.close()
