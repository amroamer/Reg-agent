import logging
from threading import Lock

from sentence_transformers import SentenceTransformer

from app.config import settings

logger = logging.getLogger(__name__)

_model: SentenceTransformer | None = None
_lock = Lock()


def _get_model() -> SentenceTransformer:
    """Lazy-load the embedding model (singleton)."""
    global _model
    if _model is None:
        with _lock:
            if _model is None:
                logger.info("Loading embedding model: %s", settings.EMBEDDING_MODEL)
                _model = SentenceTransformer(settings.EMBEDDING_MODEL)
                logger.info("Embedding model loaded (dim=%d)", _model.get_sentence_embedding_dimension())
    return _model


def embed_passage(text: str) -> list[float]:
    """Embed a document chunk with 'passage: ' prefix (required by E5 models)."""
    model = _get_model()
    return model.encode(f"passage: {text}").tolist()


def embed_query(text: str) -> list[float]:
    """Embed a search query with 'query: ' prefix (required by E5 models)."""
    model = _get_model()
    return model.encode(f"query: {text}").tolist()


def embed_batch(texts: list[str], is_query: bool = False) -> list[list[float]]:
    """Embed a batch of texts with appropriate prefix."""
    model = _get_model()
    prefix = "query: " if is_query else "passage: "
    prefixed = [f"{prefix}{t}" for t in texts]
    return model.encode(prefixed, batch_size=32, show_progress_bar=False).tolist()


def get_embedding_dimension() -> int:
    """Return the dimension of the embedding model."""
    model = _get_model()
    return model.get_sentence_embedding_dimension()
