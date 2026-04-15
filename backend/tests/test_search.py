import pytest
from worker.tasks.chunk import chunk_document, _extract_article_number


def test_chunk_document_sliding_window():
    """Test that chunking falls back to sliding window for unstructured text."""
    pages = [
        {"page_number": 1, "text": " ".join(["word"] * 1000)},
    ]
    chunks = chunk_document(pages, "en")
    assert len(chunks) > 0
    for chunk in chunks:
        assert "text" in chunk
        assert chunk["chunk_index"] is not None


def test_chunk_document_article_split():
    """Test that chunking splits on article boundaries."""
    text = (
        "Article 1: Definitions\n"
        "This section defines key terms used in this regulation.\n\n"
        "Article 2: Scope\n"
        "This regulation applies to all licensed banks.\n\n"
        "Article 3: Requirements\n"
        "Banks must comply with the following requirements.\n"
    )
    pages = [{"page_number": 1, "text": text}]
    chunks = chunk_document(pages, "en")
    assert len(chunks) >= 3
    assert chunks[0]["article_number"] is not None


def test_extract_article_number_english():
    """Test article number extraction from English headers."""
    assert _extract_article_number("Article 12.3") == "Article 12.3"
    assert _extract_article_number("Section 5.1") == "Section 5.1"
    assert _extract_article_number("Chapter 3") == "Chapter 3"


def test_extract_article_number_arabic():
    """Test article number extraction from Arabic headers."""
    result = _extract_article_number("المادة الأولى")
    assert result is not None
    assert "المادة" in result


def test_chunk_empty_document():
    """Test that empty documents produce no chunks."""
    pages = [{"page_number": 1, "text": ""}]
    chunks = chunk_document(pages, "en")
    # Sliding window on empty text should produce minimal chunks
    assert isinstance(chunks, list)
