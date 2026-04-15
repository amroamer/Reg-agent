import logging
import os
import tempfile

import pdfplumber
import pytesseract
from langdetect import detect

logger = logging.getLogger(__name__)

# Minimum characters per page to consider the PDF as digitally native
MIN_CHARS_PER_PAGE = 50


def extract_text_from_pdf(file_path: str) -> dict:
    """Extract text from a PDF file.

    Returns:
        {
            "pages": [{"page_number": 1, "text": "..."}, ...],
            "language": "ar" | "en" | "bilingual",
            "method": "pdfplumber" | "ocr",
            "page_count": int,
        }
    """
    logger.info("Extracting text from: %s", file_path)

    # First try pdfplumber (for natively digital PDFs)
    pages = _extract_with_pdfplumber(file_path)

    # Check if we got meaningful text
    avg_chars = sum(len(p["text"]) for p in pages) / max(len(pages), 1)

    if avg_chars < MIN_CHARS_PER_PAGE:
        logger.info(
            "Low text density (%.0f chars/page), falling back to OCR",
            avg_chars,
        )
        pages = _extract_with_ocr(file_path)
        method = "ocr"
    else:
        method = "pdfplumber"

    # Detect language from combined text sample
    sample_text = " ".join(p["text"][:500] for p in pages[:5])
    language = _detect_language(sample_text)

    logger.info(
        "Extracted %d pages via %s, language=%s",
        len(pages),
        method,
        language,
    )

    return {
        "pages": pages,
        "language": language,
        "method": method,
        "page_count": len(pages),
    }


def _extract_with_pdfplumber(file_path: str) -> list[dict]:
    """Extract text using pdfplumber (for natively digital PDFs)."""
    pages = []
    with pdfplumber.open(file_path) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            pages.append({"page_number": i + 1, "text": text.strip()})
    return pages


def _extract_with_ocr(file_path: str) -> list[dict]:
    """Extract text using Tesseract OCR (for scanned PDFs)."""
    try:
        from pdf2image import convert_from_path

        images = convert_from_path(file_path, dpi=300)
    except Exception:
        # Fallback: use pdfplumber to render and OCR
        logger.warning("pdf2image not available, using pdfplumber + OCR")
        return _ocr_via_pdfplumber(file_path)

    pages = []
    for i, image in enumerate(images):
        text = pytesseract.image_to_string(image, lang="ara+eng")
        pages.append({"page_number": i + 1, "text": text.strip()})
    return pages


def _ocr_via_pdfplumber(file_path: str) -> list[dict]:
    """Fallback OCR using pdfplumber page images."""
    pages = []
    with pdfplumber.open(file_path) as pdf:
        for i, page in enumerate(pdf.pages):
            # Get page as image
            img = page.to_image(resolution=300)
            # Save to temp file for OCR
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                img.save(tmp.name)
                text = pytesseract.image_to_string(tmp.name, lang="ara+eng")
                os.unlink(tmp.name)
            pages.append({"page_number": i + 1, "text": text.strip()})
    return pages


def _detect_language(text: str) -> str:
    """Detect the language of the text."""
    if not text.strip():
        return "en"

    try:
        lang = detect(text)
        if lang == "ar":
            return "ar"
        elif lang in ("en", "en-US", "en-GB"):
            return "en"
        else:
            # Check for Arabic characters
            arabic_chars = sum(1 for c in text if "\u0600" <= c <= "\u06FF")
            latin_chars = sum(1 for c in text if "a" <= c.lower() <= "z")
            if arabic_chars > 0 and latin_chars > 0:
                return "bilingual"
            elif arabic_chars > 0:
                return "ar"
            return "en"
    except Exception:
        return "en"
