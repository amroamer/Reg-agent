import uuid
from datetime import datetime

from pydantic import BaseModel


class AdminStatsResponse(BaseModel):
    total_documents: int
    documents_by_source: dict[str, int]
    documents_by_status: dict[str, int]
    total_chunks: int
    total_searches: int
    pending_cross_refs: int


class CrossReferenceResponse(BaseModel):
    id: uuid.UUID
    source_document_id: uuid.UUID
    target_document_id: uuid.UUID
    relationship_type: str
    confidence: float
    verified: bool
    verified_by: uuid.UUID | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CrossReferenceVerifyRequest(BaseModel):
    verified: bool


class SearchLogEntry(BaseModel):
    query: str
    query_language: str | None
    results_count: int | None
    response_time_ms: int | None
    created_at: datetime

    model_config = {"from_attributes": True}
