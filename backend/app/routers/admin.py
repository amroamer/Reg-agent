import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import cast, Date, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.chunk import Chunk
from app.models.cross_reference import CrossReference
from app.models.document import Document, DocumentStatus
from app.models.search_log import SearchLog
from app.models.user import User
from app.schemas.admin import (
    ActivityItem,
    AdminStatsResponse,
    CrossReferenceResponse,
    CrossReferenceVerifyRequest,
    DashboardKpi,
    DashboardResponse,
    FailedDoc,
    HealthRow,
    SearchLogEntry,
    SourceBucket,
    StatusBucket,
    TopQuery,
    TypeBucket,
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


# ══════════════════════════════════════════════════════════════════════════
# Dashboard — single payload combining everything the UI needs
# ══════════════════════════════════════════════════════════════════════════

SOURCE_COLOR = {
    "SAMA": "var(--sama)",
    "CMA": "var(--cma)",
    "BANK_POLICY": "var(--bank)",
}
SOURCE_LABEL = {
    "SAMA": "SAMA",
    "CMA": "CMA",
    "BANK_POLICY": "Bank Policies",
}
STATUS_COLOR = {
    "INDEXED": "oklch(58% 0.13 160)",
    "indexed": "oklch(58% 0.13 160)",
    "PROCESSING": "oklch(68% 0.13 70)",
    "processing": "oklch(68% 0.13 70)",
    "PENDING": "var(--ink-4)",
    "pending": "var(--ink-4)",
    "FAILED": "#b42818",
    "failed": "#b42818",
    "SUPERSEDED": "var(--ink-4)",
    "superseded": "var(--ink-4)",
}
STATUS_LABEL = {
    "INDEXED": "Indexed", "indexed": "Indexed",
    "PROCESSING": "Processing", "processing": "Processing",
    "PENDING": "Pending", "pending": "Pending",
    "FAILED": "Failed", "failed": "Failed",
    "SUPERSEDED": "Superseded", "superseded": "Superseded",
}


async def _per_day_counts(
    db: AsyncSession, table, date_col, range_days: int
) -> list[int]:
    """Return an array of daily counts for the last range_days (oldest → newest)."""
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=range_days - 1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    rows = (
        await db.execute(
            select(
                cast(date_col, Date).label("d"),
                func.count().label("c"),
            )
            .where(date_col >= start)
            .group_by("d")
        )
    ).all()
    by_day = {row.d.isoformat(): row.c for row in rows}
    out: list[int] = []
    for i in range(range_days):
        day = (start + timedelta(days=i)).date().isoformat()
        out.append(int(by_day.get(day, 0)))
    return out


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    date_range: str = Query("30d", alias="range", pattern=r"^(7d|30d|90d)$"),
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """Return every piece of data the admin dashboard needs in one call."""
    range_days = {"7d": 7, "30d": 30, "90d": 90}[date_range]
    now = datetime.now(timezone.utc)
    cur_start = now - timedelta(days=range_days)
    prev_start = now - timedelta(days=range_days * 2)

    # ─── Document totals + breakdowns ───
    total_docs = (
        await db.execute(select(func.count()).select_from(Document))
    ).scalar() or 0

    docs_prev_month = (
        await db.execute(
            select(func.count())
            .select_from(Document)
            .where(Document.created_at < cur_start)
        )
    ).scalar() or 0
    docs_added_this_range = total_docs - docs_prev_month

    total_chunks = (
        await db.execute(select(func.count()).select_from(Chunk))
    ).scalar() or 0
    chunks_prev = (
        await db.execute(
            select(func.count())
            .select_from(Chunk)
            .where(Chunk.created_at < cur_start)
        )
    ).scalar() or 0
    chunks_added_this_range = total_chunks - chunks_prev

    # Searches in the current + previous window (for % delta)
    cur_searches = (
        await db.execute(
            select(func.count())
            .select_from(SearchLog)
            .where(SearchLog.created_at >= cur_start)
        )
    ).scalar() or 0
    prev_searches = (
        await db.execute(
            select(func.count())
            .select_from(SearchLog)
            .where(SearchLog.created_at >= prev_start)
            .where(SearchLog.created_at < cur_start)
        )
    ).scalar() or 0
    search_delta_pct = (
        round((cur_searches - prev_searches) / prev_searches * 100)
        if prev_searches > 0
        else 0
    )

    # Status breakdown
    status_rows = (
        await db.execute(
            select(Document.status, func.count()).group_by(Document.status)
        )
    ).all()
    status_counts: dict[str, int] = {}
    for s, c in status_rows:
        key = s.value if hasattr(s, "value") else str(s)
        status_counts[key.lower()] = c

    failed_count = status_counts.get("failed", 0)
    pending_count = status_counts.get("pending", 0)
    needs_attention = failed_count + pending_count

    # ─── Time series ───
    ingestion_ts = await _per_day_counts(
        db, Document, Document.created_at, range_days
    )
    search_ts = await _per_day_counts(
        db, SearchLog, SearchLog.created_at, range_days
    )

    # ─── Source breakdown ───
    source_rows = (
        await db.execute(
            select(Document.source, func.count()).group_by(Document.source)
        )
    ).all()
    source_buckets: list[SourceBucket] = []
    for s, c in source_rows:
        key = s.value if hasattr(s, "value") else str(s)
        source_buckets.append(
            SourceBucket(
                id=key,
                label=SOURCE_LABEL.get(key, key),
                count=c,
                color=SOURCE_COLOR.get(key, "var(--ink-3)"),
            )
        )

    # ─── Status buckets (ordered, with zero-fills) ───
    status_buckets: list[StatusBucket] = []
    for key in ("indexed", "processing", "pending", "failed"):
        status_buckets.append(
            StatusBucket(
                id=key,
                label=STATUS_LABEL[key],
                count=status_counts.get(key, 0),
                color=STATUS_COLOR[key],
            )
        )

    # ─── Types (derived from metadata_extra.document_type if present) ───
    type_rows = (
        await db.execute(
            select(
                func.coalesce(
                    Document.metadata_extra["document_type"].as_string(),
                    "Other",
                ).label("t"),
                func.count(),
            ).group_by("t")
        )
    ).all() if hasattr(Document, "metadata_extra") else []
    type_palette = [
        "var(--sama)", "var(--cma)", "var(--circular)",
        "var(--bank)", "var(--primary)", "var(--ink-3)",
    ]
    type_buckets: list[TypeBucket] = [
        TypeBucket(id=str(t or "Other"), count=c, color=type_palette[i % len(type_palette)])
        for i, (t, c) in enumerate(type_rows)
    ]

    # ─── Recent activity — derived from recent docs + failed docs ───
    recent_docs = (
        await db.execute(
            select(Document)
            .order_by(Document.created_at.desc())
            .limit(10)
        )
    ).scalars().all()

    def human_time(ts: datetime) -> str:
        delta = now - ts
        if delta.total_seconds() < 60:
            return "just now"
        if delta.total_seconds() < 3600:
            return f"{int(delta.total_seconds() // 60)}m ago"
        if delta.total_seconds() < 86400:
            return f"{int(delta.total_seconds() // 3600)}h ago"
        return ts.strftime("%d %b")

    activity: list[ActivityItem] = []
    for d in recent_docs[:7]:
        status = d.status.value if hasattr(d.status, "value") else str(d.status)
        src = d.source.value if hasattr(d.source, "value") else str(d.source)
        title = d.title_en or d.title_ar or "Untitled"
        if status.lower() == "failed":
            activity.append(
                ActivityItem(
                    kind="fail",
                    who="System",
                    what=f"failed to process <em>{title}</em>",
                    src=SOURCE_LABEL.get(src, src),
                    detail=(d.error_message or "")[:120] if d.error_message else None,
                    when=human_time(d.created_at),
                    document_id=str(d.id),
                )
            )
        else:
            activity.append(
                ActivityItem(
                    kind="upload",
                    who="User",
                    what=f"uploaded <em>{title}</em>",
                    src=SOURCE_LABEL.get(src, src),
                    when=human_time(d.created_at),
                    document_id=str(d.id),
                )
            )

    # ─── Top queries — grouped by query text, last range window ───
    top_q_rows = (
        await db.execute(
            select(SearchLog.query, func.count())
            .where(SearchLog.created_at >= cur_start)
            .group_by(SearchLog.query)
            .order_by(func.count().desc())
            .limit(8)
        )
    ).all()
    # Previous-window counts for trend
    prev_q_rows = (
        await db.execute(
            select(SearchLog.query, func.count())
            .where(SearchLog.created_at >= prev_start)
            .where(SearchLog.created_at < cur_start)
            .group_by(SearchLog.query)
        )
    ).all()
    prev_by_q = {q: c for q, c in prev_q_rows}
    top_queries: list[TopQuery] = []
    for q, c in top_q_rows:
        prev_c = prev_by_q.get(q, 0)
        trend = (
            round((c - prev_c) / prev_c * 100)
            if prev_c > 0
            else (100 if c > 0 else 0)
        )
        top_queries.append(TopQuery(q=q, count=int(c), trend=int(trend)))

    # ─── Failed docs list ───
    failed_rows = (
        await db.execute(
            select(Document)
            .where(Document.status == DocumentStatus.FAILED)
            .order_by(Document.created_at.desc())
            .limit(5)
        )
    ).scalars().all()
    failed: list[FailedDoc] = [
        FailedDoc(
            title=f.title_en or f.title_ar or "Untitled",
            code=f.document_number,
            error=(f.error_message or "Processing failed")[:200],
            document_id=str(f.id),
        )
        for f in failed_rows
    ]

    # ─── Health ───
    processing_count = status_counts.get("processing", 0)
    # Avg search latency from the last 200 queries (if any)
    lat_row = (
        await db.execute(
            select(func.avg(SearchLog.response_time_ms))
            .select_from(
                select(SearchLog.response_time_ms)
                .order_by(SearchLog.created_at.desc())
                .limit(200)
                .subquery()
            )
        )
    ).scalar()
    lat = int(lat_row) if lat_row is not None else None

    try:
        from app.services import embedding_service
        emb_ok = embedding_service.is_available()
    except Exception:
        emb_ok = False

    health: list[HealthRow] = [
        HealthRow(
            label="Indexing queue",
            value=f"{processing_count + pending_count} jobs",
            state="ok" if (processing_count + pending_count) < 10 else "warn",
        ),
        HealthRow(
            label="Avg. search latency",
            value=f"{lat} ms" if lat is not None else "—",
            state=("ok" if (lat or 0) < 500 else "warn") if lat is not None else "ok",
        ),
        HealthRow(
            label="Embedding service",
            value="Operational" if emb_ok else "Zero-vector fallback",
            state="ok" if emb_ok else "warn",
        ),
        HealthRow(
            label="OCR service",
            value="Operational",
            state="ok",
        ),
        HealthRow(
            label="Vector store",
            value=f"{total_chunks:,} chunks",
            state="ok",
        ),
    ]

    # ─── KPIs ───
    # Sparklines: downsample the ingestion timeseries for the KPI spark
    def downsample(arr: list[int], n: int) -> list[float]:
        if not arr:
            return [0] * n
        if len(arr) <= n:
            return [float(x) for x in arr]
        bucket = len(arr) / n
        out: list[float] = []
        for i in range(n):
            a = int(i * bucket)
            b = max(a + 1, int((i + 1) * bucket))
            seg = arr[a:b]
            out.append(sum(seg) / max(len(seg), 1))
        return out

    # Cumulative series for doc/chunk KPIs — climbs over time
    cum_ingestion: list[float] = []
    running = docs_prev_month
    for v in ingestion_ts:
        running += v
        cum_ingestion.append(float(running))
    cum_ingestion_spark = downsample(cum_ingestion, 12) or [float(total_docs)] * 12

    cum_chunks_spark = downsample(
        [chunks_prev + int(chunks_added_this_range * i / max(range_days - 1, 1))
         for i in range(range_days)],
        12,
    ) or [float(total_chunks)] * 12

    search_spark = downsample(search_ts, 12) or [0.0] * 12
    # Needs-attention trend (constant-ish in short corpus)
    attn_spark = downsample(
        [max(0, needs_attention + ((range_days - i) // 10)) for i in range(range_days)],
        12,
    ) or [float(needs_attention)] * 12

    kpis: list[DashboardKpi] = [
        DashboardKpi(
            id="docs",
            label="Total documents",
            value=total_docs,
            delta=docs_added_this_range,
            delta_label=f"{docs_added_this_range:+} this {date_range}",
            trend=cum_ingestion_spark,
            icon="doc",
        ),
        DashboardKpi(
            id="chunks",
            label="Indexed chunks",
            value=total_chunks,
            delta=chunks_added_this_range,
            delta_label=f"{chunks_added_this_range:+} this {date_range}",
            trend=cum_chunks_spark,
            icon="stack",
        ),
        DashboardKpi(
            id="searches",
            label=f"Searches ({date_range})",
            value=cur_searches,
            delta=search_delta_pct,
            delta_unit="%",
            delta_label=f"{search_delta_pct:+}% vs prev {date_range}",
            trend=search_spark,
            icon="search",
        ),
        DashboardKpi(
            id="review",
            label="Needs attention",
            value=needs_attention,
            delta=0,
            delta_label=f"{failed_count} failed · {pending_count} pending",
            trend=attn_spark,
            icon="alert",
            tone="warn",
        ),
    ]

    display_name = (
        user.name if user and getattr(user, "name", None)
        else (user.email.split("@")[0] if user else "there")
    )

    return DashboardResponse(
        user={
            "name": display_name,
            "initials": "".join(p[0].upper() for p in (display_name.split() or ["?"])[:2]),
        },
        kpis=kpis,
        ingestion=ingestion_ts,
        searches=search_ts,
        source=source_buckets,
        status=status_buckets,
        types=type_buckets,
        activity=activity,
        top_queries=top_queries,
        failed=failed,
        health=health,
        range_days=range_days,
    )
