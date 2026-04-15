"""Stage 6: Enrich documents with topic classification and cross-reference suggestions."""

import logging

from app.services import embedding_service, qdrant_service

logger = logging.getLogger(__name__)


class EnrichmentService:
    """Enrich ingested documents with topics and cross-references."""

    def __init__(self, db_session):
        self.db = db_session

    def enrich_document(self, document_json: dict, document_id: str):
        """Run enrichment: topic classification + cross-reference suggestions."""
        doc_source = document_json["document"]["source"]

        # Cross-reference suggestions via vector similarity
        self._suggest_cross_references(document_json, document_id, doc_source)

    def _suggest_cross_references(
        self, document_json: dict, document_id: str, doc_source: str
    ):
        """Find related documents from other sources using vector similarity."""
        other_sources = [s for s in ["SAMA", "CMA", "BANK_POLICY"] if s != doc_source]

        if not other_sources:
            return

        articles = document_json.get("articles", [])
        # Sample up to 5 articles for cross-ref detection
        sample = articles[:5]

        for article in sample:
            search_text = (
                f"{article.get('article_title_en', '')} "
                f"{(article.get('content_en') or article.get('content_ar', ''))[:300]}"
            )

            if not search_text.strip():
                continue

            try:
                results = qdrant_service.search_vectors(
                    query_vector=embedding_service.embed_query(search_text),
                    sources=other_sources,
                    limit=3,
                )

                for result in results:
                    if result["score"] >= 0.75:
                        logger.info(
                            "Cross-ref suggestion: %s → %s (score=%.2f)",
                            document_id[:8],
                            result["payload"].get("document_id", "")[:8],
                            result["score"],
                        )
            except Exception as e:
                logger.warning("Cross-ref search failed: %s", e)
