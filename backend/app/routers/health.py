import logging

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(tags=["health"])


@router.get("/api/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    status = {"status": "healthy"}
    checks = {}

    # PostgreSQL
    try:
        await db.execute(text("SELECT 1"))
        checks["postgres"] = "ok"
    except Exception as e:
        checks["postgres"] = f"error: {e}"
        status["status"] = "degraded"

    # Redis
    try:
        from app.main import redis_client

        if redis_client:
            await redis_client.ping()
            checks["redis"] = "ok"
        else:
            checks["redis"] = "not connected"
    except Exception as e:
        checks["redis"] = f"error: {e}"
        status["status"] = "degraded"

    # Qdrant
    try:
        from qdrant_client import QdrantClient

        from app.config import settings

        client = QdrantClient(
            host=settings.QDRANT_HOST, port=settings.QDRANT_PORT, timeout=5
        )
        client.get_collections()
        checks["qdrant"] = "ok"
        client.close()
    except Exception as e:
        checks["qdrant"] = f"error: {e}"
        status["status"] = "degraded"

    status["checks"] = checks
    return status
