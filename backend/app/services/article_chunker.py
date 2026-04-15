"""Stage 4: Split articles into embedding-ready chunks with token awareness."""

import logging
import uuid

logger = logging.getLogger(__name__)

MAX_TOKENS = 800
OVERLAP_TOKENS = 200


def _count_tokens(text: str) -> int:
    """Approximate token count (words * 1.3 for multilingual text)."""
    return int(len(text.split()) * 1.3)


class ArticleChunker:
    """Chunk articles for vector embedding.

    Rules:
    - One article = one chunk if under MAX_TOKENS
    - Oversized articles split by sub-articles, then by paragraph
    - Every chunk starts with a context header
    - Bilingual articles produce separate AR and EN chunks
    - Never split mid-sentence
    """

    def chunk_document(self, document_json: dict) -> list[dict]:
        """Chunk all articles in a document."""
        all_chunks = []
        doc = document_json["document"]

        for article in document_json["articles"]:
            chunks = self._chunk_article(article, doc)
            all_chunks.extend(chunks)

        logger.info("Created %d chunks from %d articles", len(all_chunks), len(document_json["articles"]))
        return all_chunks

    def _chunk_article(self, article: dict, doc: dict) -> list[dict]:
        """Chunk a single article into one or more chunks per language."""
        chunks = []
        article_id = str(uuid.uuid4())

        # Context header for retrieval
        title = article.get("article_title_en") or article.get("article_title_ar") or ""
        header = (
            f"[{doc['source']} | "
            f"{doc.get('title_en') or doc.get('title_ar', '')} | "
            f"Article {article['article_number']}: {title}]"
        )

        # Process Arabic content
        if article.get("content_ar"):
            ar_texts = self._split_content(
                article["content_ar"], header, article.get("sub_articles", []), "ar"
            )
            for idx, text in enumerate(ar_texts):
                chunks.append(self._make_chunk(
                    text, "ar", idx, article_id, article, doc
                ))

        # Process English content
        if article.get("content_en"):
            en_texts = self._split_content(
                article["content_en"], header, article.get("sub_articles", []), "en"
            )
            for idx, text in enumerate(en_texts):
                chunks.append(self._make_chunk(
                    text, "en", idx, article_id, article, doc
                ))

        return chunks

    def _split_content(
        self, content: str, header: str, sub_articles: list, lang: str
    ) -> list[str]:
        """Split content into chunks respecting token limits."""
        full_text = f"{header}\n\n{content}"
        token_count = _count_tokens(full_text)

        # Case 1: fits in one chunk
        if token_count <= MAX_TOKENS:
            return [full_text]

        # Case 2: split by sub-articles
        relevant_subs = [
            s for s in sub_articles
            if s.get(f"content_{lang}") or s.get("content")
        ]
        if relevant_subs:
            chunks = []
            current = header + "\n\n"
            for sub in relevant_subs:
                sub_content = sub.get(f"content_{lang}") or sub.get("content", "")
                sub_text = f"\n{sub.get('number', '')}: {sub_content}"

                if _count_tokens(current + sub_text) > MAX_TOKENS:
                    if current.strip() != header.strip():
                        chunks.append(current.strip())
                    current = header + "\n\n" + sub_text
                else:
                    current += sub_text

            if current.strip() != header.strip():
                chunks.append(current.strip())
            return chunks if chunks else [full_text]

        # Case 3: split by paragraph
        return self._split_by_paragraph(content, header)

    def _split_by_paragraph(self, content: str, header: str) -> list[str]:
        """Split by paragraphs with overlap. Never split mid-sentence."""
        paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]
        if not paragraphs:
            return [f"{header}\n\n{content}"]

        chunks = []
        current = header + "\n\n"
        overlap_buffer = []

        for para in paragraphs:
            candidate = current + para + "\n\n"
            if _count_tokens(candidate) > MAX_TOKENS:
                if current.strip() != header.strip():
                    chunks.append(current.strip())
                overlap_text = "\n\n".join(overlap_buffer[-2:]) if overlap_buffer else ""
                current = header + "\n\n" + overlap_text + "\n\n" + para + "\n\n"
            else:
                current = candidate
            overlap_buffer.append(para)

        if current.strip() != header.strip():
            chunks.append(current.strip())

        return chunks

    def _make_chunk(
        self, text: str, language: str, idx: int, article_id: str,
        article: dict, doc: dict,
    ) -> dict:
        return {
            "chunk_id": str(uuid.uuid4()),
            "article_id": article_id,
            "document_id": doc["id"],
            "content": text,
            "language": language,
            "chunk_index": idx,
            "token_count": _count_tokens(text),
            "source": doc["source"],
            "document_number": doc.get("document_number", ""),
            "article_number": article["article_number"],
            "chapter_title": article.get(f"chapter_title_{language}") or article.get("chapter_title_en") or "",
            "article_title": article.get(f"article_title_{language}") or article.get("article_title_en") or "",
        }
