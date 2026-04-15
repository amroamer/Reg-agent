import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SourceAuthority(str, enum.Enum):
    SAMA = "SAMA"
    CMA = "CMA"
    BANK_POLICY = "BANK_POLICY"


class DocumentStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    INDEXED = "indexed"
    FAILED = "failed"
    SUPERSEDED = "superseded"


class LanguageCode(str, enum.Enum):
    AR = "ar"
    EN = "en"
    BILINGUAL = "bilingual"


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title_en: Mapped[str | None] = mapped_column(String(500))
    title_ar: Mapped[str | None] = mapped_column(String(500))
    source: Mapped[SourceAuthority] = mapped_column(
        Enum(SourceAuthority, name="source_authority"), index=True
    )
    document_number: Mapped[str | None] = mapped_column(
        String(100), index=True
    )
    issue_date: Mapped[datetime | None] = mapped_column(Date)
    effective_date: Mapped[datetime | None] = mapped_column(Date)
    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus, name="document_status"),
        default=DocumentStatus.PENDING,
        index=True,
    )
    language: Mapped[LanguageCode] = mapped_column(
        Enum(LanguageCode, name="language_code"),
        default=LanguageCode.BILINGUAL,
    )
    file_path: Mapped[str] = mapped_column(String(1000))
    file_hash: Mapped[str | None] = mapped_column(
        String(64), unique=True, index=True
    )
    source_url: Mapped[str | None] = mapped_column(String(1000))
    page_count: Mapped[int | None] = mapped_column(Integer)

    # Three-format file paths
    json_path: Mapped[str | None] = mapped_column(String(1000))
    markdown_path: Mapped[str | None] = mapped_column(String(1000))

    total_articles: Mapped[int | None] = mapped_column(Integer)
    total_chunks: Mapped[int | None] = mapped_column(Integer, default=0)

    # Ingestion tracking
    ingestion_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ingestion_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    metadata_extra: Mapped[dict | None] = mapped_column(
        JSONB, default=dict
    )
    batch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ingestion_batches.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    error_message: Mapped[str | None] = mapped_column(Text)
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    batch = relationship("IngestionBatch", back_populates="documents")
    articles = relationship("Article", back_populates="document", cascade="all, delete-orphan")
    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")
