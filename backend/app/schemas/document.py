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
