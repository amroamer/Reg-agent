import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Article(Base):
    __tablename__ = "articles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        index=True,
    )
    article_index: Mapped[int] = mapped_column(Integer)

    # Structural hierarchy
    chapter_number: Mapped[str | None] = mapped_column(String(50))
    chapter_title_ar: Mapped[str | None] = mapped_column(String(500))
    chapter_title_en: Mapped[str | None] = mapped_column(String(500))
    article_number: Mapped[str | None] = mapped_column(String(50))
    article_title_ar: Mapped[str | None] = mapped_column(String(500))
    article_title_en: Mapped[str | None] = mapped_column(String(500))

    # Content (bilingual)
    content_ar: Mapped[str | None] = mapped_column(Text)
    content_en: Mapped[str | None] = mapped_column(Text)

    # Source mapping to PDF
    page_start: Mapped[int | None] = mapped_column(Integer)
    page_end: Mapped[int | None] = mapped_column(Integer)

    metadata_extra: Mapped[dict | None] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    document = relationship("Document", back_populates="articles")
    chunks = relationship("Chunk", back_populates="article", cascade="all, delete-orphan")
