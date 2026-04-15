import logging

from app.llm.factory import get_llm_provider
from app.llm.prompts.search_answer import SEARCH_ANSWER_PROMPT, build_search_prompt
from app.services.cache_service import get_cached_llm, set_cached_llm

logger = logging.getLogger(__name__)


async def generate_answer(
    query: str,
    search_results: list[dict],
    query_language: str = "en",
) -> dict:
    """Generate a structured LLM answer from search results.

    Returns the parsed JSON response with answer, regulations, and cross-references.
    """
    if not search_results:
        return _empty_response(query_language)

    # Check LLM cache
    chunk_ids = [r.get("chunk_id", "") for r in search_results if r.get("chunk_id")]
    cached = await get_cached_llm(query, chunk_ids)
    if cached:
        return cached

    # Build prompt
    user_prompt = build_search_prompt(query, search_results, query_language)

    # Call LLM
    provider = get_llm_provider()
    try:
        response = await provider.generate_with_retry(
            system_prompt=SEARCH_ANSWER_PROMPT,
            user_prompt=user_prompt,
            json_mode=True,
        )
    except Exception as e:
        logger.error("LLM generation failed: %s", e)
        return _fallback_response(search_results, query_language)

    # Normalize and validate response
    result = _normalize_response(response, query_language)

    # Cache the result
    await set_cached_llm(query, chunk_ids, result)

    return result


def _normalize_response(response: dict, query_language: str) -> dict:
    """Ensure the LLM response has all expected fields."""
    answer = response.get("answer", {})
    if isinstance(answer, str):
        answer = {"text": answer, "language": query_language}

    return {
        "answer": {
            "text": answer.get("text", ""),
            "language": answer.get("language", query_language),
            "citations": answer.get("citations", []),
            "confidence": answer.get("confidence", "medium"),
        },
        "sama_regulations": response.get("sama_regulations", []),
        "cma_regulations": response.get("cma_regulations", []),
        "bank_policies": response.get("bank_policies", []),
        "cross_references": response.get("cross_references", []),
    }


def _empty_response(query_language: str) -> dict:
    """Return an empty response when no results are found."""
    no_results_msg = {
        "ar": "لم يتم العثور على نتائج مطابقة في قاعدة البيانات التنظيمية.",
        "en": "No matching results found in the regulatory database.",
    }
    return {
        "answer": {
            "text": no_results_msg.get(query_language, no_results_msg["en"]),
            "language": query_language,
            "citations": [],
            "confidence": "low",
        },
        "sama_regulations": [],
        "cma_regulations": [],
        "bank_policies": [],
        "cross_references": [],
    }


def _fallback_response(results: list[dict], query_language: str) -> dict:
    """Generate a simple fallback when LLM is unavailable."""
    sources = set()
    for r in results:
        source = r.get("source")
        title = r.get("document_title_en") or r.get("document_title_ar")
        if source and title:
            sources.add(f"{source}: {title}")

    sources_text = "\n".join(f"- {s}" for s in sources)

    msg = {
        "ar": f"تعذر توليد الإجابة التلقائية. المصادر ذات الصلة:\n{sources_text}",
        "en": f"Could not generate an automated answer. Related sources:\n{sources_text}",
    }

    return {
        "answer": {
            "text": msg.get(query_language, msg["en"]),
            "language": query_language,
            "citations": [],
            "confidence": "low",
        },
        "sama_regulations": [],
        "cma_regulations": [],
        "bank_policies": [],
        "cross_references": [],
    }
