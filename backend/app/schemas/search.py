from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    sources: list[str] | None = Field(
        None, description="Filter by source: SAMA, CMA, BANK_POLICY"
    )
    language: str | None = Field(
        None, description="Force response language: ar, en, or auto-detect"
    )
    top_k: int = Field(10, ge=1, le=50)
    generate_answer: bool = Field(
        True, description="Generate LLM answer from results"
    )


class SearchResultItem(BaseModel):
    chunk_id: str | None = None
    document_id: str | None = None
    score: float = 0
    article_number: str | None = None
    article_title_en: str | None = None
    article_title_ar: str | None = None
    chapter_number: str | None = None
    chapter_title_en: str | None = None
    chapter_title_ar: str | None = None
    section_title: str | None = None
    page_number: int | None = None
    content_en: str | None = None
    content_ar: str | None = None
    document_title_en: str | None = None
    document_title_ar: str | None = None
    document_number: str | None = None
    source: str | None = None
    source_url: str | None = None
    issue_date: str | None = None


class LLMAnswer(BaseModel):
    text: str
    language: str
    citations: list[dict] = []
    confidence: str = "medium"


class RegulationResult(BaseModel):
    document_title: str | None = None
    document_number: str | None = None
    article: str | None = None
    relevant_text: str | None = None
    source_url: str | None = None
    confidence: float = 0


class CrossReferenceResult(BaseModel):
    from_document: str | None = None
    to_document: str | None = None
    relationship: str | None = None
    explanation: str | None = None


class SearchResponse(BaseModel):
    answer: LLMAnswer | None = None
    results: list[SearchResultItem] = []
    sama_regulations: list[RegulationResult] = []
    cma_regulations: list[RegulationResult] = []
    bank_policies: list[RegulationResult] = []
    cross_references: list[CrossReferenceResult] = []
    metadata: dict = {}
