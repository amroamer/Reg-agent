import logging
import uuid

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchAny,
    MatchValue,
    PayloadSchemaType,
    PointStruct,
    VectorParams,
)

from app.config import settings

logger = logging.getLogger(__name__)

_client: QdrantClient | None = None


def get_qdrant_client() -> QdrantClient:
    """Get or create a Qdrant client (singleton)."""
    global _client
    if _client is None:
        _client = QdrantClient(
            host=settings.QDRANT_HOST,
            port=settings.QDRANT_PORT,
            timeout=30,
        )
    return _client


def ensure_collection(vector_size: int = 1024):
    """Create the regulations collection if it doesn't exist."""
    client = get_qdrant_client()
    collections = [c.name for c in client.get_collections().collections]

    if settings.QDRANT_COLLECTION not in collections:
        client.create_collection(
            collection_name=settings.QDRANT_COLLECTION,
            vectors_config=VectorParams(
                size=vector_size,
                distance=Distance.COSINE,
            ),
        )
        # Create payload indexes for fast filtering
        for field in ["source", "language", "document_id"]:
            client.create_payload_index(
                collection_name=settings.QDRANT_COLLECTION,
                field_name=field,
                field_schema=PayloadSchemaType.KEYWORD,
            )
        logger.info("Created Qdrant collection: %s", settings.QDRANT_COLLECTION)
    else:
        logger.info("Qdrant collection exists: %s", settings.QDRANT_COLLECTION)


def upsert_vectors(
    points: list[dict],
) -> None:
    """Upsert vectors into Qdrant.

    Each point dict should have: id, vector, payload
    """
    client = get_qdrant_client()
    qdrant_points = [
        PointStruct(
            id=str(p["id"]),
            vector=p["vector"],
            payload=p["payload"],
        )
        for p in points
    ]
    client.upsert(
        collection_name=settings.QDRANT_COLLECTION,
        points=qdrant_points,
    )


def search_vectors(
    query_vector: list[float],
    sources: list[str] | None = None,
    language: str | None = None,
    limit: int = 20,
) -> list[dict]:
    """Search Qdrant for similar vectors with optional filters."""
    client = get_qdrant_client()

    must_conditions = []
    if sources:
        must_conditions.append(
            FieldCondition(key="source", match=MatchAny(any=sources))
        )
    if language:
        must_conditions.append(
            FieldCondition(key="language", match=MatchValue(value=language))
        )

    query_filter = Filter(must=must_conditions) if must_conditions else None

    results = client.search(
        collection_name=settings.QDRANT_COLLECTION,
        query_vector=query_vector,
        query_filter=query_filter,
        limit=limit,
    )

    return [
        {
            "id": str(r.id),
            "score": r.score,
            "payload": r.payload,
        }
        for r in results
    ]


def delete_by_document_id(document_id: str) -> None:
    """Delete all vectors for a given document."""
    client = get_qdrant_client()
    client.delete(
        collection_name=settings.QDRANT_COLLECTION,
        points_selector=Filter(
            must=[
                FieldCondition(
                    key="document_id",
                    match=MatchValue(value=document_id),
                )
            ]
        ),
    )
    logger.info("Deleted vectors for document: %s", document_id)


def get_collection_info() -> dict:
    """Get collection stats."""
    client = get_qdrant_client()
    info = client.get_collection(settings.QDRANT_COLLECTION)
    return {
        "vectors_count": info.vectors_count,
        "points_count": info.points_count,
        "status": info.status.value,
    }
