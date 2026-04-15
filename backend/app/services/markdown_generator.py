"""Stage 3: Generate clean bilingual Markdown from structured JSON."""

import logging
import os

logger = logging.getLogger(__name__)

TEMPLATE = """---
title_ar: {title_ar}
title_en: {title_en}
source: {source}
document_number: {document_number}
issue_date: {issue_date}
effective_date: {effective_date}
status: {status}
language: {language}
total_articles: {total_articles}
---

# {title_ar}
# {title_en}

| | |
|---|---|
| **Document Number** | {document_number} |
| **Issue Date** | {issue_date} |
| **Effective Date** | {effective_date} |
| **Source** | {source} |
| **Status** | {status} |

---

"""

ARTICLE_TEMPLATE = """
<a id="article-{article_number}"></a>

### {article_heading}

> **Page{page_suffix}:** {page_range} in original PDF

{content_block}

---

"""


class MarkdownGenerator:
    """Generate clean bilingual Markdown from structured document JSON."""

    def generate(self, document_json: dict) -> str:
        """Generate Markdown from the structured JSON output of StructuralParser."""
        doc = document_json["document"]
        articles = document_json["articles"]
        metadata = document_json.get("metadata", {})

        # Header
        md = TEMPLATE.format(
            title_ar=doc.get("title_ar") or "",
            title_en=doc.get("title_en") or "",
            source=doc.get("source", ""),
            document_number=doc.get("document_number") or "",
            issue_date=doc.get("issue_date") or "N/A",
            effective_date=doc.get("effective_date") or "N/A",
            status=doc.get("status", "active"),
            language=doc.get("language", "bilingual"),
            total_articles=metadata.get("total_articles", len(articles)),
        )

        # Articles
        current_chapter = None
        for article in articles:
            ch = article.get("chapter_number")

            # Chapter heading
            if ch and ch != current_chapter:
                ch_ar = article.get("chapter_title_ar") or ""
                ch_en = article.get("chapter_title_en") or ""
                if ch_ar or ch_en:
                    md += f"\n## {ch_ar} | {ch_en}\n\n"
                current_chapter = ch

            # Article heading
            num = article.get("article_number", "")
            title_ar = article.get("article_title_ar") or ""
            title_en = article.get("article_title_en") or ""

            if title_ar and title_en:
                heading = f"المادة {num}: {title_ar} | Article {num}: {title_en}"
            elif title_ar:
                heading = f"المادة {num}: {title_ar}"
            elif title_en:
                heading = f"Article {num}: {title_en}"
            else:
                heading = f"Article {num}"

            # Page range
            ps = article.get("page_start")
            pe = article.get("page_end")
            if ps and pe and ps != pe:
                page_range = f"{ps}–{pe}"
                page_suffix = "s"
            elif ps:
                page_range = str(ps)
                page_suffix = ""
            else:
                page_range = "N/A"
                page_suffix = ""

            # Content block
            content_parts = []
            if article.get("content_ar"):
                content_parts.append(article["content_ar"])
            if article.get("content_en"):
                if content_parts:
                    content_parts.append("")  # separator
                content_parts.append(article["content_en"])

            content_block = "\n\n".join(content_parts)

            # Sub-articles
            for sub in article.get("sub_articles", []):
                sub_num = sub.get("number", "")
                sub_title = sub.get("title_en") or sub.get("title_ar") or ""
                content_block += f"\n\n#### {sub_num} — {sub_title}\n\n"
                if sub.get("content_ar"):
                    content_block += sub["content_ar"] + "\n\n"
                if sub.get("content_en"):
                    content_block += sub["content_en"] + "\n\n"

            md += ARTICLE_TEMPLATE.format(
                article_number=num,
                article_heading=heading,
                page_suffix=page_suffix,
                page_range=page_range,
                content_block=content_block,
            )

        # Definitions
        definitions = document_json.get("definitions", [])
        if definitions:
            md += "\n## التعريفات | Definitions\n\n"
            md += "| # | المصطلح (AR) | Term (EN) | Definition |\n"
            md += "|---|---|---|---|\n"
            for i, d in enumerate(definitions, 1):
                term_ar = d.get("term_ar", "")
                term_en = d.get("term_en", "")
                defn = (d.get("definition_en") or d.get("definition_ar") or "")[:100]
                md += f"| {i} | {term_ar} | {term_en} | {defn}... |\n"

        return md

    def save(self, markdown: str, output_path: str):
        """Write Markdown to file."""
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(markdown)
        logger.info("Markdown saved: %s", output_path)
