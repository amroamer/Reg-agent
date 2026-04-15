import logging
import time

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.search_log import SearchLog
from app.models.user import User
from app.schemas.search import SearchRequest, SearchResponse, SearchResultItem
from app.services.auth_service import get_current_user
from app.services.search_service import hybrid_search

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/search", tags=["search"])


@router.post("", response_model=SearchResponse)
async def search(
    body: SearchRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Execute a hybrid search across all regulatory documents."""
    start = time.time()

    # Execute hybrid search
    search_results = await hybrid_search(
        query=body.query,
        db=db,
        sources=body.sources,
        language=body.language,
        top_k=body.top_k,
    )

    results = [SearchResultItem(**r) for r in search_results.get("results", [])]

    # Generate LLM answer if requested
    answer = None
    sama_regs = []
    cma_regs = []
    bank_pols = []
    cross_refs = []

    if body.generate_answer and results:
        try:
            from app.services.llm_service import generate_answer

            llm_response = await generate_answer(
                query=body.query,
                search_results=search_results.get("results", []),
                query_language=search_results.get("query_language", "en"),
            )
            answer = llm_response.get("answer")
            sama_regs = llm_response.get("sama_regulations", [])
            cma_regs = llm_response.get("cma_regulations", [])
            bank_pols = llm_response.get("bank_policies", [])
            cross_refs = llm_response.get("cross_references", [])
        except Exception as e:
            logger.warning("LLM answer generation failed: %s", e)

    elapsed_ms = int((time.time() - start) * 1000)

    # Log the search
    log = SearchLog(
        query=body.query,
        query_language=search_results.get("query_language"),
        filters={"sources": body.sources},
        results_count=len(results),
        response_time_ms=elapsed_ms,
        user_id=user.id,
    )
    db.add(log)

    return SearchResponse(
        answer=answer,
        results=results,
        sama_regulations=sama_regs,
        cma_regulations=cma_regs,
        bank_policies=bank_pols,
        cross_references=cross_refs,
        metadata={
            "query_language": search_results.get("query_language"),
            "total_candidates": search_results.get("total_candidates", 0),
            "response_time_ms": elapsed_ms,
            "from_cache": search_results.get("from_cache", False),
        },
    )
