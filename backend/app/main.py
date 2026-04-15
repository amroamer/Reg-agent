import logging
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, documents, health

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

redis_client: aioredis.Redis | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis_client

    # Startup
    logger.info("Starting %s...", settings.APP_NAME)

    # Connect Redis
    try:
        redis_client = aioredis.from_url(
            settings.REDIS_URL, decode_responses=True
        )
        await redis_client.ping()
        logger.info("Redis connected")
    except Exception as e:
        logger.warning("Redis connection failed: %s", e)
        redis_client = None

    # Ensure Qdrant collection exists
    try:
        from qdrant_client import QdrantClient
        from qdrant_client.models import Distance, VectorParams

        qdrant = QdrantClient(
            host=settings.QDRANT_HOST, port=settings.QDRANT_PORT
        )
        collections = [c.name for c in qdrant.get_collections().collections]
        if settings.QDRANT_COLLECTION not in collections:
            qdrant.create_collection(
                collection_name=settings.QDRANT_COLLECTION,
                vectors_config=VectorParams(
                    size=1024,  # multilingual-e5-large dimension
                    distance=Distance.COSINE,
                ),
            )
            logger.info(
                "Created Qdrant collection: %s", settings.QDRANT_COLLECTION
            )
        else:
            logger.info(
                "Qdrant collection exists: %s", settings.QDRANT_COLLECTION
            )
        qdrant.close()
    except Exception as e:
        logger.warning("Qdrant setup skipped: %s", e)

    yield

    # Shutdown
    if redis_client:
        await redis_client.close()
        logger.info("Redis disconnected")

    from app.database import engine

    await engine.dispose()
    logger.info("Database engine disposed")


app = FastAPI(
    title=settings.APP_NAME,
    description="Regulatory Intelligence Platform for Saudi Banks",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(documents.router)
