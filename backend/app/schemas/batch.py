import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class BulkUploadDocumentInfo(BaseModel):
    document_id: str
    filename: str
    source: str
    document_number: str | None = None
    queue_position: int
    status: str
    metadata_source: str  # "csv", "json", "auto_detected"
    warnings: list[str] = []


class BulkUploadResponse(BaseModel):
    batch_id: str
    batch_name: str | None
    total_documents: int
    accepted: int
    duplicates: list[str] = []
    errors: list[str] = []
    documents: list[BulkUploadDocumentInfo] = []
    csv_warnings: list[str] = []


class QueueItemResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    filename: str | None = None
    source: str | None = None
    position: int
    status: str
    current_stage: str | None = None
    stage_progress: dict = {}
    error_message: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}


class BatchSummaryResponse(BaseModel):
    id: uuid.UUID
    name: str | None
    status: str
    total_documents: int
    completed_documents: int
    failed_documents: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BatchDetailResponse(BatchSummaryResponse):
    queue_items: list[QueueItemResponse] = []


class BatchListResponse(BaseModel):
    batches: list[BatchSummaryResponse]
    total: int
    page: int
    page_size: int
