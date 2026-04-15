import logging
import uuid

from app.services import embedding_service, qdrant_service

logger = logging.getLogger(__name__)

BATCH_SIZE = 32


def embed_and_store_chunks(
    chunks: list[dict],
    document_id: str,
    source: str,
    language: str,
) -> list[dict]:
    """Embed chunks and store them in Qdrant.

    Args:
        chunks: List of chunk dicts from the chunker
        document_id: UUID string of the parent document
        source: Source authority (SAMA, CMA, BANK_POLICY)
        language: Document language

    Returns:
        List of chunks with added qdrant_point_id
    """
    logger.info(
        "Embedding %d chunks for document %s", len(chunks), document_id
    )

    # Ensure Qdrant collection exists
    qdrant_service.ensure_collection()

    # Process in batches
    all_points = []
    for batch_start in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[batch_start : batch_start + BATCH_SIZE]
        texts = [c["text"] for c in batch]

        # Embed the batch
        vectors = embedding_service.embed_batch(texts, is_query=False)

        # Create Qdrant points
        for chunk, vector in zip(batch, vectors):
            point_id = str(uuid.uuid4())
            chunk["qdrant_point_id"] = point_id

            all_points.append(
                {
                    "id": point_id,
                    "vector": vector,
                    "payload": {
                        "document_id": document_id,
                        "chunk_id": chunk.get("chunk_id", ""),
                        "source": source,
                        "language": language,
                        "article_number": chunk.get("article_number", ""),
                        "section_title": chunk.get("section_title", ""),
                        "page_number": chunk.get("page_number", 0),
                        "chunk_index": chunk.get("chunk_index", 0),
                    },
                }
            )

    # Upsert all points to Qdrant
    if all_points:
        # Upsert in batches to avoid memory issues
        for i in range(0, len(all_points), 100):
            batch_points = all_points[i : i + 100]
            qdrant_service.upsert_vectors(batch_points)

    logger.info(
        "Stored %d vectors in Qdrant for document %s",
        len(all_points),
        document_id,
    )

    return chunks
