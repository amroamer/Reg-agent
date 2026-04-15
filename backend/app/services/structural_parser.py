"""Stage 2: Parse extracted PDF text into structured JSON with articles."""

import logging
import re
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# --- Arabic patterns ---
CHAPTER_AR = re.compile(
    r"(الباب|الفصل)\s+"
    r"(الأول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر"
    r"|الحادي عشر|الثاني عشر|[\u0660-\u0669\d]+)"
    r"\s*[:\-\u2013\u2014]?\s*(.*)",
    re.MULTILINE,
)

ARTICLE_AR = re.compile(
    r"(المادة)\s+"
    r"(الأولى|الثانية|الثالثة|الرابعة|الخامسة|السادسة|السابعة|الثامنة|التاسعة|العاشرة"
    r"|[\u0660-\u0669\d]+(?:[\.\u066B]\d+)?)"
    r"\s*[:\-\u2013\u2014]?\s*(.*)",
    re.MULTILINE,
)

# --- English patterns ---
CHAPTER_EN = re.compile(r"Chapter\s+(\d+)\s*[:\-\u2013\u2014]?\s*(.*)", re.MULTILINE | re.IGNORECASE)
ARTICLE_EN = re.compile(r"Article\s+(\d+[\.\d]*)\s*[:\-\u2013\u2014]?\s*(.*)", re.MULTILINE | re.IGNORECASE)
SECTION_EN = re.compile(r"Section\s+(\d+[\.\d]*)\s*[:\-\u2013\u2014]?\s*(.*)", re.MULTILINE | re.IGNORECASE)

# Arabic ordinal → number mapping
ARABIC_ORDINALS = {
    "الأول": "1", "الأولى": "1",
    "الثاني": "2", "الثانية": "2",
    "الثالث": "3", "الثالثة": "3",
    "الرابع": "4", "الرابعة": "4",
    "الخامس": "5", "الخامسة": "5",
    "السادس": "6", "السادسة": "6",
    "السابع": "7", "السابعة": "7",
    "الثامن": "8", "الثامنة": "8",
    "التاسع": "9", "التاسعة": "9",
    "العاشر": "10", "العاشرة": "10",
    "الحادي عشر": "11", "الثاني عشر": "12",
}


class StructuralParser:
    """Parse extracted PDF text into structured JSON with articles."""

    def parse(self, extraction_result: dict, document_meta: dict) -> dict:
        """Parse extraction result into structured document JSON."""
        pages = extraction_result["pages"]
        language = extraction_result["language"]
        full_text = "\n\n".join(p["text"] for p in pages if p["text"])

        # Parse articles based on language
        if language == "ar":
            ar_articles = self._parse_articles(full_text, "ar")
            en_articles = []
        elif language == "en":
            ar_articles = []
            en_articles = self._parse_articles(full_text, "en")
        else:
            # Bilingual: try parsing both
            ar_articles = self._parse_articles(full_text, "ar")
            en_articles = self._parse_articles(full_text, "en")

        # Align bilingual articles
        aligned = self._align_bilingual(ar_articles, en_articles)

        # Map page numbers
        page_boundaries = [(0, 1)]
        offset = 0
        for page in pages:
            offset += len(page["text"]) + 2
            page_boundaries.append((offset, page["page_number"]))
        aligned = self._map_pages(aligned, full_text, page_boundaries)

        # Collect tables
        all_tables = []
        for page in pages:
            for table in page.get("tables", []):
                all_tables.append({
                    "table_index": len(all_tables),
                    "article_number": "",
                    "caption_ar": None,
                    "caption_en": None,
                    "headers": table.get("headers", []),
                    "rows": table.get("rows", []),
                    "page_number": page["page_number"],
                })

        # Build TOC
        toc = self._build_toc(aligned)

        doc_id = str(uuid.uuid4())

        return {
            "$schema": "reginspector-document-v1",
            "document": {
                "id": doc_id,
                "title_ar": document_meta.get("title_ar"),
                "title_en": document_meta.get("title_en"),
                "source": document_meta["source"],
                "document_number": document_meta.get("document_number"),
                "issue_date": document_meta.get("issue_date"),
                "effective_date": document_meta.get("effective_date"),
                "superseded_date": None,
                "status": "active",
                "language": language,
                "source_url": document_meta.get("source_url"),
                "total_pages": extraction_result["total_pages"],
                "pdf_filename": document_meta.get("pdf_filename", ""),
                "extraction_method": extraction_result["method"],
                "extraction_date": datetime.now(timezone.utc).isoformat(),
                "extraction_confidence": self._avg_confidence(pages),
            },
            "table_of_contents": toc,
            "articles": aligned,
            "appendices": [],
            "tables": all_tables,
            "definitions": [],
            "metadata": {
                "total_articles": len(aligned),
                "total_sub_articles": sum(len(a.get("sub_articles", [])) for a in aligned),
                "total_tables": len(all_tables),
                "total_definitions": 0,
                "total_appendices": 0,
                "primary_language": language,
                "extraction_warnings": extraction_result.get("warnings", []),
            },
        }

    def _parse_articles(self, text: str, language: str) -> list[dict]:
        """Parse text into a list of articles."""
        if language == "ar":
            article_pattern = ARTICLE_AR
            chapter_pattern = CHAPTER_AR
        else:
            article_pattern = ARTICLE_EN
            chapter_pattern = CHAPTER_EN

        # Find all article positions
        matches = list(article_pattern.finditer(text))
        if not matches:
            # Try section pattern for English
            if language == "en":
                matches = list(SECTION_EN.finditer(text))

        if not matches:
            # No articles found — treat entire text as one article
            return [{
                "article_index": 0,
                "chapter_number": None,
                "chapter_title": None,
                "article_number": "1",
                "article_title": "",
                "content": text.strip(),
                "sub_articles": [],
            }]

        # Find chapters for context
        chapter_matches = list(chapter_pattern.finditer(text))
        chapter_ranges = []
        for cm in chapter_matches:
            num = cm.group(2) if language == "en" else ARABIC_ORDINALS.get(cm.group(2), cm.group(2))
            title = cm.group(3) if len(cm.groups()) >= 3 else ""
            chapter_ranges.append({"start": cm.start(), "number": str(num), "title": title.strip()})

        articles = []
        for i, match in enumerate(matches):
            start = match.start()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)

            content = text[start:end].strip()

            # Extract article number
            if language == "ar":
                raw_num = match.group(2)
                article_num = ARABIC_ORDINALS.get(raw_num, raw_num)
                title = match.group(3).strip() if match.group(3) else ""
            else:
                article_num = match.group(1)
                title = match.group(2).strip() if match.group(2) else ""

            # Find parent chapter
            chapter_num = None
            chapter_title = None
            for cr in chapter_ranges:
                if cr["start"] <= start:
                    chapter_num = cr["number"]
                    chapter_title = cr["title"]

            articles.append({
                "article_index": i,
                "chapter_number": chapter_num,
                "chapter_title": chapter_title,
                "article_number": str(article_num),
                "article_title": title,
                "content": content,
                "sub_articles": [],
            })

        return articles

    def _align_bilingual(self, ar_articles: list, en_articles: list) -> list[dict]:
        """Align Arabic and English articles by article number."""
        if not ar_articles and not en_articles:
            return []

        ar_by_num = {a["article_number"]: a for a in ar_articles}
        en_by_num = {a["article_number"]: a for a in en_articles}

        all_numbers = sorted(
            set(list(ar_by_num.keys()) + list(en_by_num.keys())),
            key=lambda x: float(x) if x.replace(".", "").isdigit() else 0,
        )

        aligned = []
        for idx, num in enumerate(all_numbers):
            ar = ar_by_num.get(num, {})
            en = en_by_num.get(num, {})

            aligned.append({
                "article_index": idx,
                "chapter_number": ar.get("chapter_number") or en.get("chapter_number"),
                "chapter_title_ar": ar.get("chapter_title"),
                "chapter_title_en": en.get("chapter_title"),
                "article_number": num,
                "article_title_ar": ar.get("article_title"),
                "article_title_en": en.get("article_title"),
                "content_ar": ar.get("content"),
                "content_en": en.get("content"),
                "page_start": None,
                "page_end": None,
                "has_tables": False,
                "has_lists": False,
                "sub_articles": [],
                "keywords_ar": [],
                "keywords_en": [],
                "topics": [],
            })

        return aligned

    def _map_pages(self, articles: list, full_text: str, page_boundaries: list) -> list:
        """Map articles to their page numbers in the PDF."""
        for article in articles:
            content = article.get("content_ar") or article.get("content_en") or ""
            if content:
                pos = full_text.find(content[:100])
                if pos >= 0:
                    article["page_start"] = self._find_page(pos, page_boundaries)
                    end_pos = pos + len(content)
                    article["page_end"] = self._find_page(end_pos, page_boundaries)
        return articles

    def _find_page(self, offset: int, boundaries: list) -> int:
        page = 1
        for bnd_offset, pn in boundaries:
            if offset >= bnd_offset:
                page = pn
        return page

    def _build_toc(self, articles: list) -> list:
        """Build table of contents grouped by chapter."""
        toc = []
        current_chapter = None
        for article in articles:
            ch = article.get("chapter_number")
            if ch != current_chapter:
                toc.append({
                    "chapter_number": ch,
                    "chapter_title_ar": article.get("chapter_title_ar"),
                    "chapter_title_en": article.get("chapter_title_en"),
                    "articles": [],
                })
                current_chapter = ch
            if toc:
                toc[-1]["articles"].append(article["article_number"])
        return toc

    def _avg_confidence(self, pages: list) -> float:
        confs = [p.get("confidence", 1.0) for p in pages]
        return round(sum(confs) / max(len(confs), 1), 2)
