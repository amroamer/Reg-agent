import logging
import re
import time
import uuid
from collections import defaultdict

from langdetect import detect
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article
from app.models.chunk import Chunk
from app.models.document import Document
from app.services import embedding_service, qdrant_service
from app.services.cache_service import get_cached_search, set_cached_search

# Strips the retrieval context header that article_chunker prepends to each
# chunk (e.g. "[SAMA | SAMA Credit Card Rules 2024 | Article 7: Disclosure Requirements]\n\n")
_CHUNK_HEADER_RE = re.compile(r"^\s*\[[^\]\n]{1,400}\]\s*\n*", re.UNICODE)


def _strip_chunk_header(text: str | None) -> str | None:
    """Remove the leading [SOURCE | Title | Article N: Title] header from a chunk."""
    if not text:
        return text
    return _CHUNK_HEADER_RE.sub("", text, count=1).lstrip()

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
        AND d.status = 'INDEXED'
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
    """Enrich search results with document + chunk metadata + full content."""
    if not results:
        return []

    # Collect unique document IDs and chunk IDs
    doc_ids: set[str] = set()
    chunk_ids: set[str] = set()
    for r in results:
        doc_id = r.get("payload", {}).get("document_id") or r.get("document_id")
        if doc_id:
            doc_ids.add(doc_id)
        # Vector results have Qdrant point ID as `id`, BM25 has chunk row UUID as chunk_id
        chunk_id = r.get("payload", {}).get("chunk_id") or r.get("chunk_id")
        qdrant_id = r.get("id")  # Qdrant point ID (= chunks.qdrant_point_id)
        if chunk_id:
            chunk_ids.add(chunk_id)
        if qdrant_id and qdrant_id != chunk_id:
            chunk_ids.add(qdrant_id)

    # Fetch document metadata
    doc_map: dict[str, dict] = {}
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

    # Fetch chunk content (by Chunk.id OR Chunk.qdrant_point_id)
    from sqlalchemy import select, or_
    chunk_map: dict[str, Chunk] = {}
    article_ids: set[uuid.UUID] = set()
    if chunk_ids:
        chunk_uuids = []
        for c in chunk_ids:
            try:
                chunk_uuids.append(uuid.UUID(c))
            except Exception:
                continue

        chunk_stmt = select(Chunk).where(
            or_(
                Chunk.id.in_(chunk_uuids) if chunk_uuids else False,
                Chunk.qdrant_point_id.in_([str(c) for c in chunk_ids]),
            )
        )
        chunk_result = await db.execute(chunk_stmt)
        for c in chunk_result.scalars():
            chunk_map[str(c.id)] = c
            if c.qdrant_point_id:
                chunk_map[c.qdrant_point_id] = c
            if c.article_id:
                article_ids.add(c.article_id)

    # Fetch article metadata (chapter + article titles for the retrieved chunks)
    article_map: dict[str, Article] = {}
    if article_ids:
        article_stmt = select(Article).where(Article.id.in_(article_ids))
        article_result = await db.execute(article_stmt)
        for a in article_result.scalars():
            article_map[str(a.id)] = a

    # Enrich each result
    enriched = []
    for r in results:
        doc_id = r.get("payload", {}).get("document_id") or r.get("document_id")
        doc_meta = doc_map.get(doc_id, {})

        # Resolve chunk — try each candidate key against chunk_map (first hit wins).
        # Qdrant payload.chunk_id may be stale if chunks were re-ingested without
        # re-upserting vectors, so we must try point id + chunk_id and use whichever
        # actually exists in the DB.
        candidate_keys = [
            r.get("id"),  # Qdrant point id (= chunks.qdrant_point_id, canonical)
            r.get("payload", {}).get("chunk_id"),
            r.get("chunk_id"),
        ]
        chunk = None
        chunk_key = None
        for k in candidate_keys:
            if k and k in chunk_map:
                chunk = chunk_map[k]
                chunk_key = k
                break
        if chunk_key is None:
            # No DB match — fall back to whatever key we have (for output only)
            chunk_key = next((k for k in candidate_keys if k), None)

        # Resolve article (for chapter/article title metadata)
        article = article_map.get(str(chunk.article_id)) if (chunk and chunk.article_id) else None

        # Prefer chunk data (from DB) over whatever was in the result dict
        if chunk:
            content_en = chunk.content_en or chunk.content
            content_ar = chunk.content_ar
            article_number = chunk.article_number
            section_title = chunk.section_title
            page_number = chunk.page_number
            # If EN content is empty but generic content exists, use it
            if not content_en and chunk.content:
                content_en = chunk.content
        else:
            # Fallback to whatever was in the raw result
            content_en = r.get("content_en")
            content_ar = r.get("content_ar")
            article_number = (
                r.get("payload", {}).get("article_number")
                or r.get("article_number")
            )
            section_title = (
                r.get("payload", {}).get("section_title")
                or r.get("section_title")
            )
            page_number = (
                r.get("payload", {}).get("page_number")
                or r.get("page_number")
            )

        # Strip the retrieval header the chunker prepends; the UI renders clean prose
        content_en = _strip_chunk_header(content_en)
        content_ar = _strip_chunk_header(content_ar)

        enriched.append({
            "chunk_id": str(chunk.id) if chunk else chunk_key,
            "document_id": doc_id,
            "score": r.get("rrf_score", r.get("score", 0)),
            "article_number": article_number,
            "article_title_en": article.article_title_en if article else None,
            "article_title_ar": article.article_title_ar if article else None,
            "chapter_number": article.chapter_number if article else None,
            "chapter_title_en": article.chapter_title_en if article else None,
            "chapter_title_ar": article.chapter_title_ar if article else None,
            "section_title": section_title,
            "page_number": page_number,
            "content_en": content_en,
            "content_ar": content_ar,
            **doc_meta,
        })

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
