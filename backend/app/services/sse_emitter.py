"""SSE Event Emitter — bridges Celery worker → FastAPI SSE endpoints via Redis pub/sub."""

import asyncio
import json
import logging
from collections import defaultdict
from typing import AsyncGenerator

from app.config import settings

logger = logging.getLogger(__name__)

# In-process fallback queues (when Redis is unavailable)
_local_queues: dict[str, list[asyncio.Queue]] = defaultdict(list)


def _channel(batch_id: str) -> str:
    return f"sse:batch:{batch_id}"


# ── Sync side (for Celery worker) ─────────────────────────

def sync_publish(batch_id: str, event: str, data: dict):
    """Publish an SSE event from the Celery worker (synchronous)."""
    message = json.dumps({"event": event, "data": data}, default=str)
    try:
        import redis as sync_redis

        r = sync_redis.from_url(settings.REDIS_URL, decode_responses=True)
        r.publish(_channel(batch_id), message)
        r.close()
    except Exception as e:
        logger.debug("Redis pub/sub unavailable (%s), using local fallback", e)
        # Push to in-process queues (only works if FastAPI and worker share process)
        for q in _local_queues.get(batch_id, []):
            try:
                q.put_nowait(message)
            except Exception:
                pass


# ── Async side (for FastAPI SSE endpoint) ──────────────────

async def subscribe(batch_id: str) -> AsyncGenerator[str, None]:
    """Subscribe to SSE events for a batch. Yields formatted SSE strings."""
    try:
        from app.main import redis_client

        if redis_client:
            async for msg in _redis_subscribe(batch_id, redis_client):
                yield msg
            return
    except Exception as e:
        logger.debug("Redis subscribe unavailable (%s), using local fallback", e)

    # Fallback: in-process queue
    async for msg in _local_subscribe(batch_id):
        yield msg


async def _redis_subscribe(batch_id: str, redis_client) -> AsyncGenerator[str, None]:
    """Subscribe via Redis pub/sub."""
    import redis.asyncio as aioredis

    pubsub = redis_client.pubsub()
    await pubsub.subscribe(_channel(batch_id))
    try:
        while True:
            message = await asyncio.wait_for(
                pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0),
                timeout=30,
            )
            if message and message["type"] == "message":
                parsed = json.loads(message["data"])
                yield f"event: {parsed['event']}\ndata: {json.dumps(parsed['data'], default=str)}\n\n"
            elif message is None:
                # Send keepalive every 30s
                yield ": keepalive\n\n"
    except asyncio.TimeoutError:
        yield ": keepalive\n\n"
    except asyncio.CancelledError:
        pass
    finally:
        await pubsub.unsubscribe(_channel(batch_id))
        await pubsub.close()


async def _local_subscribe(batch_id: str) -> AsyncGenerator[str, None]:
    """Fallback: in-process queue subscription."""
    queue: asyncio.Queue = asyncio.Queue()
    _local_queues[batch_id].append(queue)
    try:
        while True:
            try:
                message = await asyncio.wait_for(queue.get(), timeout=30)
                parsed = json.loads(message)
                yield f"event: {parsed['event']}\ndata: {json.dumps(parsed['data'], default=str)}\n\n"
            except asyncio.TimeoutError:
                yield ": keepalive\n\n"
            except asyncio.CancelledError:
                break
    finally:
        _local_queues[batch_id] = [q for q in _local_queues[batch_id] if q is not queue]
