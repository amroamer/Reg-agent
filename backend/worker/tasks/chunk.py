import logging
import re

logger = logging.getLogger(__name__)

# Regex patterns for regulatory document structure
ARABIC_ARTICLE = re.compile(
    r"(المادة)\s+(الأولى|الثانية|الثالثة|الرابعة|الخامسة|السادسة|السابعة|الثامنة|التاسعة|العاشرة|[\u0660-\u0669\d]+)"
)
ARABIC_CHAPTER = re.compile(
    r"(الباب|الفصل)\s+(الأول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر|[\u0660-\u0669\d]+)"
)
ENGLISH_ARTICLE = re.compile(r"Article\s+(\d+[\.\d]*)", re.IGNORECASE)
ENGLISH_CHAPTER = re.compile(r"Chapter\s+(\d+)", re.IGNORECASE)
ENGLISH_SECTION = re.compile(r"Section\s+(\d+[\.\d]*)", re.IGNORECASE)

# Combined pattern to detect article/section boundaries
BOUNDARY_PATTERN = re.compile(
    r"(?:"
    r"المادة\s+(?:الأولى|الثانية|الثالثة|الرابعة|الخامسة|[\u0660-\u0669\d]+)"
    r"|الباب\s+(?:الأول|الثاني|الثالث|[\u0660-\u0669\d]+)"
    r"|الفصل\s+(?:الأول|الثاني|الثالث|[\u0660-\u0669\d]+)"
    r"|Article\s+\d+[\.\d]*"
    r"|Chapter\s+\d+"
    r"|Section\s+\d+[\.\d]*"
    r")",
    re.IGNORECASE,
)

MAX_CHUNK_TOKENS = 1000
OVERLAP_TOKENS = 64
FALLBACK_CHUNK_SIZE = 512


def chunk_document(pages: list[dict], language: str) -> list[dict]:
    """Chunk a document by regulatory article/section boundaries.

    Args:
        pages: List of {"page_number": int, "text": str}
        language: "ar", "en", or "bilingual"

    Returns:
        List of chunk dicts with keys:
        - text: str (the chunk content)
        - article_number: str | None
        - section_title: str | None
        - page_number: int
        - chunk_index: int
    """
    # Combine all pages with page markers
    full_text = ""
    page_boundaries = []  # (start_offset, page_number)

    for page in pages:
        page_boundaries.append((len(full_text), page["page_number"]))
        full_text += page["text"] + "\n\n"

    # Try article-based chunking first
    chunks = _chunk_by_articles(full_text, page_boundaries)

    if not chunks:
        # Fallback to sliding window
        logger.info("No article boundaries found, using sliding window")
        chunks = _chunk_by_sliding_window(full_text, page_boundaries)

    # Post-process: split oversized chunks
    final_chunks = []
    for i, chunk in enumerate(chunks):
        tokens = chunk["text"].split()
        if len(tokens) > MAX_CHUNK_TOKENS:
            sub_chunks = _split_large_chunk(chunk, MAX_CHUNK_TOKENS, OVERLAP_TOKENS)
            final_chunks.extend(sub_chunks)
        else:
            final_chunks.append(chunk)

    # Assign chunk indexes
    for i, chunk in enumerate(final_chunks):
        chunk["chunk_index"] = i

    logger.info("Created %d chunks from %d pages", len(final_chunks), len(pages))
    return final_chunks


def _chunk_by_articles(
    text: str, page_boundaries: list[tuple[int, int]]
) -> list[dict]:
    """Split text at article/section boundaries."""
    matches = list(BOUNDARY_PATTERN.finditer(text))

    if len(matches) < 2:
        return []

    chunks = []
    for i, match in enumerate(matches):
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)

        chunk_text = text[start:end].strip()
        if not chunk_text:
            continue

        # Extract article number
        article_number = _extract_article_number(match.group())
        section_title = _extract_section_title(chunk_text)
        page_number = _find_page_number(start, page_boundaries)

        chunks.append(
            {
                "text": chunk_text,
                "article_number": article_number,
                "section_title": section_title,
                "page_number": page_number,
            }
        )

    return chunks


def _chunk_by_sliding_window(
    text: str, page_boundaries: list[tuple[int, int]]
) -> list[dict]:
    """Fallback: chunk by sliding window with overlap."""
    words = text.split()
    chunks = []

    i = 0
    while i < len(words):
        chunk_words = words[i : i + FALLBACK_CHUNK_SIZE]
        chunk_text = " ".join(chunk_words)

        # Find the character offset for page number lookup
        char_offset = len(" ".join(words[:i]))
        page_number = _find_page_number(char_offset, page_boundaries)

        chunks.append(
            {
                "text": chunk_text,
                "article_number": None,
                "section_title": None,
                "page_number": page_number,
            }
        )

        i += FALLBACK_CHUNK_SIZE - OVERLAP_TOKENS

    return chunks


def _split_large_chunk(
    chunk: dict, max_tokens: int, overlap: int
) -> list[dict]:
    """Split an oversized chunk into smaller pieces, preserving the article header."""
    words = chunk["text"].split()
    # Extract first line as header to prepend to sub-chunks
    first_line_end = chunk["text"].find("\n")
    header = chunk["text"][:first_line_end] if first_line_end > 0 else ""
    header_words = header.split()

    sub_chunks = []
    i = 0
    effective_max = max_tokens - len(header_words)

    while i < len(words):
        sub_words = words[i : i + effective_max]
        sub_text = " ".join(sub_words)

        # Prepend header to sub-chunks after the first
        if i > 0 and header:
            sub_text = header + "\n" + sub_text

        sub_chunks.append(
            {
                "text": sub_text,
                "article_number": chunk.get("article_number"),
                "section_title": chunk.get("section_title"),
                "page_number": chunk.get("page_number"),
            }
        )

        i += effective_max - overlap

    return sub_chunks


def _extract_article_number(header: str) -> str | None:
    """Extract article number from a header string."""
    # English
    m = ENGLISH_ARTICLE.search(header)
    if m:
        return f"Article {m.group(1)}"

    m = ENGLISH_SECTION.search(header)
    if m:
        return f"Section {m.group(1)}"

    m = ENGLISH_CHAPTER.search(header)
    if m:
        return f"Chapter {m.group(1)}"

    # Arabic
    m = ARABIC_ARTICLE.search(header)
    if m:
        return f"المادة {m.group(2)}"

    m = ARABIC_CHAPTER.search(header)
    if m:
        return f"{m.group(1)} {m.group(2)}"

    return None


def _extract_section_title(text: str) -> str | None:
    """Extract the first line as section title."""
    first_line = text.split("\n")[0].strip()
    if first_line and len(first_line) < 300:
        return first_line
    return None


def _find_page_number(
    char_offset: int, page_boundaries: list[tuple[int, int]]
) -> int:
    """Find which page a character offset falls on."""
    page_number = 1
    for boundary_offset, pn in page_boundaries:
        if char_offset >= boundary_offset:
            page_number = pn
        else:
            break
    return page_number
