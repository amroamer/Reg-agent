import logging

from app.config import settings
from app.llm.base import LLMProvider
from app.llm.claude_provider import ClaudeProvider
from app.llm.ollama_provider import OllamaProvider
from app.llm.prompts.anti_hallucination import ANTI_HALLUCINATION_SUFFIX

logger = logging.getLogger(__name__)

_provider: LLMProvider | None = None


def get_llm_provider() -> LLMProvider:
    """Get or create the LLM provider based on configuration."""
    global _provider
    if _provider is not None:
        return _provider

    if settings.LLM_PROVIDER == "claude" and settings.ANTHROPIC_API_KEY:
        logger.info("Using Claude API as LLM provider")
        _provider = ClaudeProvider(
            api_key=settings.ANTHROPIC_API_KEY,
            model=settings.LLM_MODEL,
        )
    else:
        logger.info("Using Ollama as LLM provider")
        _provider = OllamaProvider(
            host=settings.OLLAMA_HOST,
            port=settings.OLLAMA_PORT,
            model=settings.OLLAMA_MODEL,
        )

    # Inject anti-hallucination rules into all prompts
    _provider.set_system_suffix(ANTI_HALLUCINATION_SUFFIX)

    return _provider
