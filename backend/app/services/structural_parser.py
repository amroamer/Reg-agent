"""Stage 2: Parse extracted PDF text into structured JSON with articles.

Key fix: Distinguish article HEADINGS from article REFERENCES.

- HEADING: "Article 5:" at start of a line, followed by title + body
- REFERENCE: "Article 5" appearing mid-sentence (e.g., "as specified in Article 5")

We handle this by:
1. Anchoring regex to line start (^ with MULTILINE)
2. Requiring minimum content length (20 chars) after a heading
3. Rejecting fragments that start with conjunctions/punctuation
4. Deduplicating article numbers (keep the one with more content)
"""

import logging
import re
import uuid
from collections import Counter
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Arabic ordinal → number mapping
ARABIC_ORDINALS = {
    "الأولى": "1", "الأول": "1",
    "الثانية": "2", "الثاني": "2",
    "الثالثة": "3", "الثالث": "3",
    "الرابعة": "4", "الرابع": "4",
    "الخامسة": "5", "الخامس": "5",
    "السادسة": "6", "السادس": "6",
    "السابعة": "7", "السابع": "7",
    "الثامنة": "8", "الثامن": "8",
    "التاسعة": "9", "التاسع": "9",
    "العاشرة": "10", "العاشر": "10",
    "الحادي عشر": "11", "الحادية عشرة": "11",
    "الثاني عشر": "12", "الثانية عشرة": "12",
    "الثالث عشر": "13", "الثالثة عشرة": "13",
    "الرابع عشر": "14", "الرابعة عشرة": "14",
    "الخامس عشر": "15", "الخامسة عشرة": "15",
    "السادس عشر": "16", "السادسة عشرة": "16",
    "السابع عشر": "17", "السابعة عشرة": "17",
    "الثامن عشر": "18", "الثامنة عشرة": "18",
    "التاسع عشر": "19", "التاسعة عشرة": "19",
    "العشرون": "20", "العشرين": "20",
}
ORDINAL_ALT = "|".join(sorted(ARABIC_ORDINALS.keys(), key=len, reverse=True))

# ═══════════════════════════════════════════════════════════
# ANCHORED HEADING REGEX (must be at start of line)
# ═══════════════════════════════════════════════════════════

# English article heading — at line start, number + optional delimiter + optional title
# Must have either a delimiter (:.-) OR be at end of line (title follows on next line)
ARTICLE_EN_HEADING = re.compile(
    r"^[\s]*(?:Article|ARTICLE)\s+(\d+(?:[\.\d]+)?)\s*(?:[:\-\u2013\u2014\.]+\s*(.*?))?$",
    re.MULTILINE,
)
SECTION_EN_HEADING = re.compile(
    r"^[\s]*(?:Section|SECTION)\s+(\d+(?:[\.\d]+)?)\s*(?:[:\-\u2013\u2014\.]+\s*(.*?))?$",
    re.MULTILINE,
)
# Roman-numeral section heading — "I.", "II.", "III." at line start followed by
# a title. Used by Ministerial Resolutions and SAMA implementation rules that
# don't use "Article N:" numbering for their own sections (they reference
# articles of OTHER laws instead).
# Strict: ≥10-char title on the same line to avoid matching random "I." bullets.
ROMAN_SECTION_HEADING = re.compile(
    r"^[\s]*([IVXLCDM]{1,6})\.\s+(.{10,}?)\s*$",
    re.MULTILINE,
)
CHAPTER_EN_HEADING = re.compile(
    r"^[\s]*(?:Chapter|CHAPTER|Part|PART)\s+(\d+(?:[\.\d]+)?)\s*(?:[:\-\u2013\u2014\.]?\s*(.*?))?$",
    re.MULTILINE,
)

# Valid Roman numerals we accept (I–XX covers most regulatory docs)
_VALID_ROMANS = {
    "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
    "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX",
}


def _roman_to_int(s: str) -> int:
    """Convert a Roman numeral string (I, II, IV, ...) to its integer value."""
    vals = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}
    total = 0
    prev = 0
    for ch in reversed(s.upper()):
        v = vals.get(ch, 0)
        if v < prev:
            total -= v
        else:
            total += v
        prev = v
    return total

# Arabic article heading — same flexibility
ARTICLE_AR_HEADING = re.compile(
    rf"^[\s]*(?:المادة|مادة)\s+(?:({ORDINAL_ALT})|\(?\s*([\u0660-\u0669\d]+)\s*\)?)\s*(?:[:\-\u2013\u2014\.]?\s*(.*?))?$",
    re.MULTILINE,
)
CHAPTER_AR_HEADING = re.compile(
    rf"^[\s]*(?:الباب|الفصل)\s+(?:({ORDINAL_ALT})|\(?\s*([\u0660-\u0669\d]+)\s*\)?)\s*(?:[:\-\u2013\u2014\.]?\s*(.*?))?$",
    re.MULTILINE,
)


# ═══════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════

MIN_CONTENT_LEN = 20  # characters; anything shorter is a fragment
FRAGMENT_STARTS = (",", ".", ";", "and ", "or ", "و ", "،", "أو ", ")", "(")


def _clean_text(text: str) -> str:
    """Remove CID placeholders + normalize whitespace."""
    text = re.sub(r"\(cid:\d+\)", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def _is_fragment(content: str) -> bool:
    """Check if content is too short or starts with a fragment indicator."""
    if len(content.strip()) < MIN_CONTENT_LEN:
        return True
    stripped = content.strip()
    for f in FRAGMENT_STARTS:
        if stripped.startswith(f):
            return True
    return False


def _remove_headers_footers(text: str) -> str:
    """Remove lines that appear 3+ times (page headers/footers)."""
    lines = text.split("\n")
    counts = Counter(ln.strip() for ln in lines if ln.strip() and len(ln) < 200)
    repeated = {ln for ln, c in counts.items() if c >= 3}
    if not repeated:
        return text
    return "\n".join(ln for ln in lines if ln.strip() not in repeated)


# ═══════════════════════════════════════════════════════════
# PARSER
# ═══════════════════════════════════════════════════════════


class StructuralParser:
    """Parse extracted PDF text into structured JSON with articles."""

    def parse(self, extraction_result: dict, document_meta: dict) -> dict:
        """Parse extraction result into structured document JSON."""
        pages = extraction_result["pages"]
        language = extraction_result["language"]

        # Clean all page text
        full_text = "\n\n".join(p["text"] for p in pages if p.get("text"))
        full_text = _clean_text(full_text)
        full_text = _remove_headers_footers(full_text)

        # Parse articles based on detected language
        if language == "ar":
            ar_articles = self._parse_articles_ar(full_text)
            en_articles = []
        elif language == "en":
            ar_articles = []
            en_articles = self._parse_articles_en(full_text)
        else:  # bilingual
            ar_articles = self._parse_articles_ar(full_text)
            en_articles = self._parse_articles_en(full_text)

        # Validate each set
        ar_articles = self._validate_articles(ar_articles)
        en_articles = self._validate_articles(en_articles)

        logger.info(
            "Parsed %d AR articles, %d EN articles (after validation)",
            len(ar_articles),
            len(en_articles),
        )

        # Whole-document fallback: if NO structured articles were found but the
        # document has substantive text, surface the entire body as a single
        # article so users can still read + search the content (and so the
        # Articles tab isn't empty). This covers:
        #   - ministerial decrees with prose-only structure
        #   - circulars with custom numbering the regex doesn't recognize
        #   - scanned PDFs where OCR lost heading boundaries
        warnings = list(extraction_result.get("warnings", []))
        if not ar_articles and not en_articles and len(full_text.strip()) >= MIN_CONTENT_LEN:
            synthetic = {
                "number": "1",
                "title": document_meta.get("title_en")
                    or document_meta.get("title_ar")
                    or "Full Document",
                "content": full_text.strip(),
                "chapter_number": None,
                "chapter_title": None,
            }
            if language == "ar":
                ar_articles = [synthetic]
            else:
                en_articles = [synthetic]
            warnings.append(
                "No structured headings detected; rendered document as single article"
            )
            logger.warning(
                "No article headings detected in %s — falling back to whole-document article",
                document_meta.get("title_en") or document_meta.get("title_ar") or "document",
            )

        # Align bilingual
        aligned = self._align_bilingual(ar_articles, en_articles)

        # Map pages
        aligned = self._map_pages(aligned, full_text, pages)

        # Build output JSON
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
            "articles": aligned,
            "appendices": [],
            "tables": [],
            "definitions": [],
            "metadata": {
                "total_articles": len(aligned),
                "total_sub_articles": 0,
                "total_tables": 0,
                "total_definitions": 0,
                "total_appendices": 0,
                "primary_language": language,
                "extraction_warnings": warnings,
            },
        }

    # ─── English parser ───

    def _parse_articles_en(self, text: str) -> list[dict]:
        """Parse English articles using anchored regex (must be at line start).

        Tries, in order:
          1. "Article N:" headings  (most common)
          2. "Section N:" headings  (US-style)
          3. Roman-numeral headings "I.", "II.", "III." — used by Ministerial
             Resolutions and implementation-rules docs that don't have their
             own article numbering.
        """
        # Find all chapters + articles
        chapters = [
            {
                "start": m.start(),
                "number": m.group(1),
                "title": (m.group(2) or "").strip(),
            }
            for m in CHAPTER_EN_HEADING.finditer(text)
        ]

        mode = "article"
        article_matches = list(ARTICLE_EN_HEADING.finditer(text))
        if not article_matches:
            article_matches = list(SECTION_EN_HEADING.finditer(text))
            mode = "section"
        if not article_matches:
            # Tertiary fallback: Roman-numeral sections. Filter to real Roman
            # numerals (I..XX) to avoid accidentally matching e.g. random "D."
            # or the letter "I" used as a pronoun.
            roman_matches = [
                m for m in ROMAN_SECTION_HEADING.finditer(text)
                if m.group(1).upper() in _VALID_ROMANS
            ]
            # Require at least 2 Roman-numeral sections in increasing order to
            # confidently conclude this is the document's structure. A single
            # "I." could be a list marker; a sequence I/II/III is a structure.
            if len(roman_matches) >= 2:
                ordinals = [_roman_to_int(m.group(1)) for m in roman_matches]
                # Check that at least half are ordered — tolerant of noise
                pairs = sum(1 for a, b in zip(ordinals, ordinals[1:]) if a < b)
                if pairs >= len(ordinals) // 2:
                    article_matches = roman_matches
                    mode = "roman"

        if not article_matches:
            return []

        articles = []
        for i, m in enumerate(article_matches):
            start = m.start()
            end = article_matches[i + 1].start() if i + 1 < len(article_matches) else len(text)

            # Stop at next chapter heading if it comes first
            for ch in chapters:
                if ch["start"] > m.end() and ch["start"] < end:
                    end = ch["start"]
                    break

            raw_block = text[m.end():end].strip()

            if mode == "roman":
                # For Roman-numeral sections, group(2) is the FULL title/first
                # sentence, not an optional delimiter+title. Keep as-is.
                title_line = (m.group(2) or "").strip()
                number = str(_roman_to_int(m.group(1)))
            else:
                title_line = (m.group(2) or "").strip()
                number = m.group(1)

            body = raw_block  # title might continue on next line, body = raw

            # Find parent chapter
            parent_chapter = None
            for ch in chapters:
                if ch["start"] < start:
                    parent_chapter = ch

            articles.append({
                "number": number,
                "title": title_line,
                "content": body,
                "chapter_number": parent_chapter["number"] if parent_chapter else None,
                "chapter_title": parent_chapter["title"] if parent_chapter else None,
            })

        return articles

    # ─── Arabic parser ───

    def _parse_articles_ar(self, text: str) -> list[dict]:
        """Parse Arabic articles with line-anchored regex."""
        chapters = []
        for m in CHAPTER_AR_HEADING.finditer(text):
            ordinal = m.group(1)
            numeric = m.group(2)
            title = (m.group(3) or "").strip()
            num = ARABIC_ORDINALS.get(ordinal, numeric) if ordinal else numeric
            chapters.append({"start": m.start(), "number": str(num), "title": title})

        article_matches = list(ARTICLE_AR_HEADING.finditer(text))
        if not article_matches:
            return []

        articles = []
        for i, m in enumerate(article_matches):
            start = m.start()
            end = article_matches[i + 1].start() if i + 1 < len(article_matches) else len(text)
            for ch in chapters:
                if ch["start"] > m.end() and ch["start"] < end:
                    end = ch["start"]
                    break

            ordinal = m.group(1)
            numeric = m.group(2)
            num = ARABIC_ORDINALS.get(ordinal, numeric) if ordinal else numeric
            title = (m.group(3) or "").strip()
            body = text[m.end():end].strip()

            parent_chapter = None
            for ch in chapters:
                if ch["start"] < start:
                    parent_chapter = ch

            articles.append({
                "number": str(num),
                "title": title,
                "content": body,
                "chapter_number": parent_chapter["number"] if parent_chapter else None,
                "chapter_title": parent_chapter["title"] if parent_chapter else None,
            })

        return articles

    # ─── Validation ───

    def _validate_articles(self, articles: list[dict]) -> list[dict]:
        """Remove fragments + deduplicate by article number (keep longest)."""
        validated = []
        seen: dict[str, int] = {}

        for art in articles:
            content = art.get("content", "")
            # Skip fragments
            if _is_fragment(content):
                logger.debug(
                    "Skipping fragment for Article %s: %r",
                    art.get("number"),
                    content[:30],
                )
                continue

            num = art.get("number")
            if num in seen:
                # Keep the one with longer content
                prev_idx = seen[num]
                if len(content) > len(validated[prev_idx]["content"]):
                    validated[prev_idx] = art
                continue

            seen[num] = len(validated)
            validated.append(art)

        return validated

    # ─── Bilingual alignment ───

    def _normalize_article_content(self, articles: list) -> list:
        """Run Arabic normalization on article titles + content."""
        from app.services.arabic_normalizer import normalize_arabic

        for a in articles:
            if a.get("title"):
                a["title"] = normalize_arabic(a["title"])
            if a.get("content"):
                a["content"] = normalize_arabic(a["content"])
            if a.get("chapter_title"):
                a["chapter_title"] = normalize_arabic(a["chapter_title"])
        return articles

    def _align_bilingual(self, ar_articles: list, en_articles: list) -> list[dict]:
        """Align Arabic and English articles by article number."""
        # Normalize Arabic before alignment
        ar_articles = self._normalize_article_content(ar_articles)

        if not ar_articles and not en_articles:
            return []

        ar_by = {a["number"]: a for a in ar_articles}
        en_by = {a["number"]: a for a in en_articles}
        all_nums = sorted(
            set(list(ar_by.keys()) + list(en_by.keys())),
            key=lambda x: float(x) if x.replace(".", "").isdigit() else 0,
        )

        aligned = []
        for idx, num in enumerate(all_nums):
            ar = ar_by.get(num, {})
            en = en_by.get(num, {})
            aligned.append({
                "article_index": idx,
                "chapter_number": ar.get("chapter_number") or en.get("chapter_number"),
                "chapter_title_ar": ar.get("chapter_title"),
                "chapter_title_en": en.get("chapter_title"),
                "article_number": num,
                "article_title_ar": ar.get("title"),
                "article_title_en": en.get("title"),
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

    # ─── Page mapping ───

    def _map_pages(self, articles: list, full_text: str, pages: list) -> list:
        """Map each article to its page range."""
        # Build cumulative char offsets per page
        boundaries = []  # (char_offset, page_number)
        offset = 0
        for p in pages:
            boundaries.append((offset, p["page_number"]))
            offset += len(_clean_text(p["text"])) + 2  # +2 for "\n\n"

        def find_page(char_offset: int) -> int:
            page = 1
            for bnd, pn in boundaries:
                if char_offset >= bnd:
                    page = pn
                else:
                    break
            return page

        for article in articles:
            content = article.get("content_ar") or article.get("content_en") or ""
            if not content:
                continue
            # Find where content appears in full_text
            snippet = content[:80]
            pos = full_text.find(snippet)
            if pos < 0:
                continue
            article["page_start"] = find_page(pos)
            article["page_end"] = find_page(pos + len(content))

        return articles

    # ─── Helpers ───

    def _avg_confidence(self, pages: list) -> float:
        confs = [p.get("confidence", 1.0) for p in pages]
        return round(sum(confs) / max(len(confs), 1), 2)
