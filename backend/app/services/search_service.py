import logging
import time
import uuid
from collections import defaultdict

from langdetect import detect
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chunk import Chunk
from app.models.document import Document
from app.services import embedding_service, qdrant_service
from app.services.cache_service import get_cached_search, set_cached_search

logger = logging.getLogger(__name__)

RRF_K = 60  # Reciprocal Rank Fusion constant


async def hybrid_search(
    query: str,
    db: AsyncSession,
    sources: list[str] | None = None,
    language: str | None = None,
    top_k: int = 10,
) -> dict:
    """Execute hybrid search combining vector similarity and BM25 keyword matching.

    Returns:
        {
            "results": [...],
            "query_language": str,
            "total_candidates": int,
            "response_time_ms": int,
        }
    """
    start = time.time()

    # Detect query language
    query_language = language or _detect_query_language(query)

    # Check cache
    filters = {"sources": sources, "language": query_language}
    cached = await get_cached_search(query, filters)
    if cached:
        cached["from_cache"] = True
        return cached

    # 1. Vector search via Qdrant
    query_vector = embedding_service.embed_query(query)
    vector_results = qdrant_service.search_vectors(
        query_vector=query_vector,
        sources=sources,
        language=None,  # Search across all languages for better recall
        limit=top_k * 2,
    )

    # 2. BM25 keyword search via PostgreSQL full-text search
    keyword_results = await _bm25_search(db, query, sources, limit=top_k * 2)

    # 3. Reciprocal Rank Fusion
    merged = _reciprocal_rank_fusion(vector_results, keyword_results, k=RRF_K)

    # 4. Take top-k and enrich with document metadata
    top_results = merged[:top_k]
    enriched = await _enrich_results(db, top_results)

    elapsed_ms = int((time.time() - start) * 1000)

    result = {
        "results": enriched,
        "query_language": query_language,
        "total_candidates": len(vector_results) + len(keyword_results),
        "response_time_ms": elapsed_ms,
        "from_cache": False,
    }

    # Cache the results
    await set_cached_search(query, filters, result)

    return result


async def _bm25_search(
    db: AsyncSession,
    query: str,
    sources: list[str] | None = None,
    limit: int = 20,
) -> list[dict]:
    """Execute PostgreSQL full-text search."""
    # Build the query with both English and simple (for Arabic) text search
    sql = text("""
        SELECT
            c.id::text as chunk_id,
            c.document_id::text,
            c.content_en,
            c.content_ar,
            c.article_number,
            c.section_title,
            c.page_number,
            c.qdrant_point_id,
            ts_rank(
                to_tsvector('english', coalesce(c.content_en, '')) ||
                to_tsvector('simple', coalesce(c.content_ar, '')),
                plainto_tsquery('english', :query) || plainto_tsquery('simple', :query)
            ) as rank
        FROM chunks c
        JOIN documents d ON c.document_id = d.id
        WHERE (
            to_tsvector('english', coalesce(c.content_en, '')) ||
            to_tsvector('simple', coalesce(c.content_ar, ''))
        ) @@ (
            plainto_tsquery('english', :query) || plainto_tsquery('simple', :query)
        )
        AND d.status = 'indexed'
        AND (:has_source_filter = false OR d.source = ANY(:sources))
        ORDER BY rank DESC
        LIMIT :limit
    """)

    result = await db.execute(
        sql,
        {
            "query": query,
            "has_source_filter": bool(sources),
            "sources": sources or [],
            "limit": limit,
        },
    )
    rows = result.fetchall()

    return [
        {
            "id": row.qdrant_point_id or row.chunk_id,
            "chunk_id": row.chunk_id,
            "document_id": row.document_id,
            "score": float(row.rank),
            "content_en": row.content_en,
            "content_ar": row.content_ar,
            "article_number": row.article_number,
            "section_title": row.section_title,
            "page_number": row.page_number,
            "source": "bm25",
        }
        for row in rows
    ]


def _reciprocal_rank_fusion(
    vector_results: list[dict],
    keyword_results: list[dict],
    k: int = 60,
) -> list[dict]:
    """Merge results from vector and keyword search using RRF.

    RRF_score(d) = sum( 1 / (k + rank) ) for each list where d appears.
    """
    scores: dict[str, float] = defaultdict(float)
    result_map: dict[str, dict] = {}

    # Score vector results
    for rank, result in enumerate(vector_results):
        doc_key = result["id"]
        scores[doc_key] += 1.0 / (k + rank + 1)
        if doc_key not in result_map:
            result_map[doc_key] = result

    # Score keyword results
    for rank, result in enumerate(keyword_results):
        doc_key = result.get("id", result.get("chunk_id", ""))
        scores[doc_key] += 1.0 / (k + rank + 1)
        if doc_key not in result_map:
            result_map[doc_key] = result

    # Sort by combined RRF score
    sorted_keys = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)

    merged = []
    for key in sorted_keys:
        entry = result_map[key].copy()
        entry["rrf_score"] = scores[key]
        merged.append(entry)

    return merged


async def _enrich_results(
    db: AsyncSession, results: list[dict]
) -> list[dict]:
    """Enrich search results with document metadata."""
    if not results:
        return []

    # Collect unique document IDs
    doc_ids = set()
    for r in results:
        doc_id = r.get("payload", {}).get("document_id") or r.get("document_id")
        if doc_id:
            doc_ids.add(doc_id)

    # Fetch document metadata
    doc_map = {}
    if doc_ids:
        from sqlalchemy import select

        stmt = select(Document).where(
            Document.id.in_([uuid.UUID(d) for d in doc_ids])
        )
        doc_result = await db.execute(stmt)
        for doc in doc_result.scalars():
            doc_map[str(doc.id)] = {
                "document_title_en": doc.title_en,
                "document_title_ar": doc.title_ar,
                "document_number": doc.document_number,
                "source": doc.source.value,
                "source_url": doc.source_url,
                "issue_date": str(doc.issue_date) if doc.issue_date else None,
            }

    # Enrich each result
    enriched = []
    for r in results:
        doc_id = r.get("payload", {}).get("document_id") or r.get("document_id")
        doc_meta = doc_map.get(doc_id, {})

        enriched.append(
            {
                "chunk_id": r.get("payload", {}).get("chunk_id") or r.get("chunk_id"),
                "document_id": doc_id,
                "score": r.get("rrf_score", r.get("score", 0)),
                "article_number": r.get("payload", {}).get("article_number") or r.get("article_number"),
                "section_title": r.get("payload", {}).get("section_title") or r.get("section_title"),
                "page_number": r.get("payload", {}).get("page_number") or r.get("page_number"),
                "content_en": r.get("content_en"),
                "content_ar": r.get("content_ar"),
                **doc_meta,
            }
        )

    return enriched


def _detect_query_language(query: str) -> str:
    """Detect the language of a search query."""
    try:
        lang = detect(query)
        if lang == "ar":
            return "ar"
        return "en"
    except Exception:
        # Check for Arabic characters
        if any("\u0600" <= c <= "\u06FF" for c in query):
            return "ar"
        return "en"
