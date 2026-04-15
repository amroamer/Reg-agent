"""Embedding service using multilingual-e5-large. Lazy-loads the model."""

import logging
from threading import Lock

from app.config import settings

logger = logging.getLogger(__name__)

_model = None
_lock = Lock()
_available = True


def _get_model():
    """Lazy-load the embedding model (singleton)."""
    global _model, _available
    if _model is None:
        with _lock:
            if _model is None:
                try:
                    from sentence_transformers import SentenceTransformer

                    logger.info("Loading embedding model: %s", settings.EMBEDDING_MODEL)
                    _model = SentenceTransformer(settings.EMBEDDING_MODEL)
                    logger.info("Embedding model loaded (dim=%d)", _model.get_sentence_embedding_dimension())
                except ImportError:
                    logger.warning(
                        "sentence_transformers not installed. "
                        "Embedding service will return zero vectors. "
                        "Install with: pip install sentence-transformers"
                    )
                    _available = False
                except Exception as e:
                    logger.error("Failed to load embedding model: %s", e)
                    _available = False
    return _model


def embed_passage(text: str) -> list[float]:
    """Embed a document chunk with 'passage: ' prefix (required by E5 models)."""
    model = _get_model()
    if model is None:
        return [0.0] * 1024
    return model.encode(f"passage: {text}").tolist()


def embed_query(text: str) -> list[float]:
    """Embed a search query with 'query: ' prefix (required by E5 models)."""
    model = _get_model()
    if model is None:
        return [0.0] * 1024
    return model.encode(f"query: {text}").tolist()


def embed_batch(texts: list[str], is_query: bool = False) -> list[list[float]]:
    """Embed a batch of texts with appropriate prefix."""
    model = _get_model()
    if model is None:
        return [[0.0] * 1024 for _ in texts]
    prefix = "query: " if is_query else "passage: "
    prefixed = [f"{prefix}{t}" for t in texts]
    return model.encode(prefixed, batch_size=32, show_progress_bar=False).tolist()


def get_embedding_dimension() -> int:
    """Return the dimension of the embedding model."""
    model = _get_model()
    if model is None:
        return 1024
    return model.get_sentence_embedding_dimension()


def is_available() -> bool:
    """Check if the embedding model is loaded and available."""
    _get_model()
    return _available
