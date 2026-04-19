import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.document import DocumentStatus, LanguageCode, SourceAuthority


class DocumentUpload(BaseModel):
    title_en: str | None = None
    title_ar: str | None = None
    source: SourceAuthority
    document_number: str | None = None
    issue_date: date | None = None
    effective_date: date | None = None
    source_url: str | None = None


class DocumentResponse(BaseModel):
    id: uuid.UUID
    title_en: str | None
    title_ar: str | None
    source: SourceAuthority
    document_number: str | None
    issue_date: date | None
    effective_date: date | None
    status: DocumentStatus
    language: LanguageCode | None
    file_path: str
    source_url: str | None
    page_count: int | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]
    total: int
    page: int
    page_size: int


class ChunkResponse(BaseModel):
    id: uuid.UUID
    chunk_index: int
    content_en: str | None
    content_ar: str | None
    section_title: str | None
    article_number: str | None
    page_number: int | None
    token_count: int | None

    model_config = {"from_attributes": True}


class DocumentDetailResponse(DocumentResponse):
    chunks: list[ChunkResponse] = []
    chunks_count: int = 0
    total_articles: int | None = None
    total_chunks: int | None = None
    json_path: str | None = None
    markdown_path: str | None = None
    ingestion_started_at: datetime | None = None
    ingestion_completed_at: datetime | None = None


class DocumentUpdate(BaseModel):
    """PATCH body — all fields optional."""
    title_en: str | None = None
    title_ar: str | None = None
    document_number: str | None = None
    issue_date: date | None = None
    effective_date: date | None = None
    status: DocumentStatus | None = None
    source_url: str | None = None


class DuplicateInfo(BaseModel):
    found: bool = False
    existing_document_id: str | None = None
    existing_title: str | None = None
    uploaded_at: datetime | None = None


class AutoDetectedMetadata(BaseModel):
    title_en: str | None = None
    title_ar: str | None = None
    document_number: str | None = None
    source: str | None = None


class FileValidationResponse(BaseModel):
    valid: bool
    issues: list[str] = []
    file_size_mb: float = 0
    page_count: int | None = None
    is_scanned: bool = False
    detected_language: str | None = None
    file_hash: str | None = None
    duplicate: DuplicateInfo = DuplicateInfo()
    auto_detected_metadata: AutoDetectedMetadata = AutoDetectedMetadata()


class ArticleSummary(BaseModel):
    id: uuid.UUID
    article_index: int
    chapter_number: str | None
    chapter_title_ar: str | None
    chapter_title_en: str | None
    article_number: str | None
    article_title_ar: str | None
    article_title_en: str | None
    page_start: int | None
    page_end: int | None

    model_config = {"from_attributes": True}


class ArticleWithContent(ArticleSummary):
    content_ar: str | None = None
    content_en: str | None = None


class ChapterGroup(BaseModel):
    chapter_number: str | None
    chapter_title_ar: str | None
    chapter_title_en: str | None
    articles: list[ArticleSummary] = []


class ArticlesResponse(BaseModel):
    chapters: list[ChapterGroup] = []
    total_articles: int = 0


class IngestionStageLog(BaseModel):
    stage: str
    status: str  # "completed" | "failed" | "processing" | "pending"
    duration_s: float | None = None
    error: str | None = None


class IngestionLogResponse(BaseModel):
    document_id: uuid.UUID
    document_status: str
    ingestion_started_at: datetime | None = None
    ingestion_completed_at: datetime | None = None
    total_duration_s: float | None = None
    stages: list[IngestionStageLog] = []
    errors: list[dict] = []
    warnings: list[str] = []
