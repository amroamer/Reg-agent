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


# ─── Dashboard ────────────────────────────────────────────────────────────

class DashboardKpi(BaseModel):
    id: str
    label: str
    value: int
    delta: int = 0
    delta_unit: str | None = None  # e.g. "%" for percentage
    delta_label: str = ""
    trend: list[float] = []
    icon: str = "doc"  # doc, stack, search, alert
    tone: str | None = None  # "warn" flips delta colors


class TimeSeriesPoint(BaseModel):
    day: str  # ISO date
    count: int


class SourceBucket(BaseModel):
    id: str
    label: str
    count: int
    color: str


class StatusBucket(BaseModel):
    id: str
    label: str
    count: int
    color: str


class TypeBucket(BaseModel):
    id: str
    count: int
    color: str


class ActivityItem(BaseModel):
    kind: str  # upload, reindex, fail, search
    who: str
    what: str  # may contain <em>...</em>
    src: str | None = None
    detail: str | None = None
    when: str
    document_id: str | None = None


class TopQuery(BaseModel):
    q: str
    count: int
    trend: int = 0  # % change vs previous period


class FailedDoc(BaseModel):
    title: str
    code: str | None = None
    error: str | None = None
    document_id: str


class HealthRow(BaseModel):
    label: str
    value: str
    state: str  # ok, warn, err


class DashboardResponse(BaseModel):
    user: dict
    kpis: list[DashboardKpi]
    ingestion: list[int]  # per-day counts for the range
    searches: list[int]
    source: list[SourceBucket]
    status: list[StatusBucket]
    types: list[TypeBucket]
    activity: list[ActivityItem]
    top_queries: list[TopQuery]
    failed: list[FailedDoc]
    health: list[HealthRow]
    range_days: int
