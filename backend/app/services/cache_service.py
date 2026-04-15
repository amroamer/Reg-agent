import hashlib
import json
import logging

from app.config import settings

logger = logging.getLogger(__name__)

SEARCH_CACHE_TTL = 300  # 5 minutes
LLM_CACHE_TTL = 600  # 10 minutes


def _get_redis():
    """Get the Redis client from the FastAPI app."""
    from app.main import redis_client

    return redis_client


def _make_search_key(query: str, filters: dict | None = None) -> str:
    """Create a deterministic cache key for a search query."""
    payload = json.dumps({"q": query, "f": filters or {}}, sort_keys=True)
    h = hashlib.sha256(payload.encode()).hexdigest()[:16]
    return f"search:{h}"


def _make_llm_key(query: str, chunk_ids: list[str]) -> str:
    """Create a cache key for LLM responses."""
    payload = json.dumps({"q": query, "c": sorted(chunk_ids)}, sort_keys=True)
    h = hashlib.sha256(payload.encode()).hexdigest()[:16]
    return f"llm:{h}"


async def get_cached_search(query: str, filters: dict | None = None) -> dict | None:
    """Get cached search results."""
    redis = _get_redis()
    if not redis:
        return None

    key = _make_search_key(query, filters)
    try:
        data = await redis.get(key)
        if data:
            logger.debug("Cache hit for search: %s", key)
            return json.loads(data)
    except Exception as e:
        logger.warning("Redis cache read error: %s", e)

    return None


async def set_cached_search(
    query: str, filters: dict | None, results: dict
) -> None:
    """Cache search results."""
    redis = _get_redis()
    if not redis:
        return

    key = _make_search_key(query, filters)
    try:
        await redis.set(key, json.dumps(results, default=str), ex=SEARCH_CACHE_TTL)
    except Exception as e:
        logger.warning("Redis cache write error: %s", e)


async def get_cached_llm(query: str, chunk_ids: list[str]) -> dict | None:
    """Get cached LLM response."""
    redis = _get_redis()
    if not redis:
        return None

    key = _make_llm_key(query, chunk_ids)
    try:
        data = await redis.get(key)
        if data:
            logger.debug("Cache hit for LLM: %s", key)
            return json.loads(data)
    except Exception as e:
        logger.warning("Redis cache read error: %s", e)

    return None


async def set_cached_llm(
    query: str, chunk_ids: list[str], response: dict
) -> None:
    """Cache LLM response."""
    redis = _get_redis()
    if not redis:
        return

    key = _make_llm_key(query, chunk_ids)
    try:
        await redis.set(key, json.dumps(response, default=str), ex=LLM_CACHE_TTL)
    except Exception as e:
        logger.warning("Redis cache write error: %s", e)


async def invalidate_document_cache(document_id: str) -> None:
    """Invalidate all cached results containing a document."""
    redis = _get_redis()
    if not redis:
        return

    # For simplicity, flush all search caches when a document changes
    try:
        keys = []
        async for key in redis.scan_iter(match="search:*"):
            keys.append(key)
        if keys:
            await redis.delete(*keys)
            logger.info("Invalidated %d search cache entries", len(keys))
    except Exception as e:
        logger.warning("Redis cache invalidation error: %s", e)
