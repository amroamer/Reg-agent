"""Stage 1: PDF text extraction with automatic scanned-document detection."""

import logging
import os
import re
import tempfile

import pdfplumber
import pytesseract
from langdetect import DetectorFactory, detect

DetectorFactory.seed = 0

logger = logging.getLogger(__name__)

SCANNED_THRESHOLD = 50  # chars/page below this = scanned


class PDFExtractor:
    """Extract text and tables from regulatory PDF documents."""

    def extract(self, pdf_path: str) -> dict:
        """Main extraction. Auto-detects scanned vs digital PDF.

        Returns dict with pages, language, total_pages, method, warnings.
        """
        logger.info("Extracting: %s", pdf_path)

        is_scanned = self._detect_scanned(pdf_path)

        if is_scanned:
            pages = self._extract_with_ocr(pdf_path)
            method = "tesseract-ocr"
        else:
            pages = self._extract_with_pdfplumber(pdf_path)
            method = "pdfplumber"

        # Detect document language
        all_text = " ".join(p["text"] for p in pages if p["text"])
        language = self._detect_language(all_text)

        # Extract tables separately
        pages = self._extract_tables(pdf_path, pages)

        # Collect warnings
        warnings = []
        for page in pages:
            if page.get("confidence", 1.0) < 0.8:
                warnings.append(
                    f"Page {page['page_number']}: Low OCR confidence "
                    f"({page['confidence']:.2f}) — manual review recommended"
                )

        return {
            "pages": pages,
            "language": language,
            "total_pages": len(pages),
            "method": method,
            "warnings": warnings,
        }

    def _detect_scanned(self, pdf_path: str) -> bool:
        """Check if PDF is scanned by probing text of first 5 pages."""
        with pdfplumber.open(pdf_path) as pdf:
            sample = pdf.pages[:5]
            total_chars = sum(len(page.extract_text() or "") for page in sample)
            avg_chars = total_chars / max(len(sample), 1)
            return avg_chars < SCANNED_THRESHOLD

    def _extract_with_pdfplumber(self, pdf_path: str) -> list[dict]:
        """Extract text using PyMuPDF (best Arabic handling) with pdfplumber fallback.

        PyMuPDF correctly handles:
        - Arabic text with proper character ordering
        - Subset fonts with CMap (no (cid:XXX) artifacts)
        - Bilingual PDFs
        """
        # Try PyMuPDF first
        try:
            import fitz  # PyMuPDF

            pages = []
            doc = fitz.open(pdf_path)
            for i in range(len(doc)):
                page = doc[i]
                text = page.get_text("text")
                pages.append({
                    "page_number": i + 1,
                    "text": text.strip(),
                    "tables": [],
                    "confidence": 1.0,
                })
            doc.close()
            return pages
        except Exception as e:
            logger.warning("PyMuPDF extraction failed (%s), falling back to pdfplumber", e)

        # Fallback to pdfplumber
        pages = []
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages):
                text = page.extract_text() or ""
                pages.append({
                    "page_number": i + 1,
                    "text": text.strip(),
                    "tables": [],
                    "confidence": 1.0,
                })
        return pages

    def _extract_with_ocr(self, pdf_path: str) -> list[dict]:
        """Extract text using Tesseract OCR (for scanned PDFs)."""
        pages = []
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages):
                try:
                    img = page.to_image(resolution=300)
                    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                        img.save(tmp.name)
                        # Get OCR data with confidence
                        data = pytesseract.image_to_data(
                            tmp.name, lang="ara+eng", output_type=pytesseract.Output.DICT
                        )
                        text = pytesseract.image_to_string(tmp.name, lang="ara+eng")
                        os.unlink(tmp.name)

                    # Calculate average confidence
                    confidences = [
                        int(c) for c in data.get("conf", []) if str(c).isdigit() and int(c) > 0
                    ]
                    avg_conf = sum(confidences) / max(len(confidences), 1) / 100.0

                    pages.append({
                        "page_number": i + 1,
                        "text": text.strip(),
                        "tables": [],
                        "confidence": round(avg_conf, 2),
                    })
                except Exception as e:
                    logger.warning("OCR failed on page %d: %s", i + 1, e)
                    pages.append({
                        "page_number": i + 1,
                        "text": "",
                        "tables": [],
                        "confidence": 0.0,
                    })
        return pages

    def _extract_tables(self, pdf_path: str, pages: list[dict]) -> list[dict]:
        """Extract tables using pdfplumber and attach to pages."""
        with pdfplumber.open(pdf_path) as pdf:
            for i, pdf_page in enumerate(pdf.pages):
                tables = pdf_page.extract_tables()
                if tables and i < len(pages):
                    for table in tables:
                        if table and len(table) > 1:
                            pages[i]["tables"].append({
                                "headers": [str(h) for h in (table[0] or [])],
                                "rows": [[str(c) for c in (row or [])] for row in table[1:]],
                            })
        return pages

    def _detect_language(self, text: str) -> str:
        """Detect if document is Arabic, English, or bilingual."""
        if not text.strip():
            return "ar"

        arabic_chars = len(re.findall(r"[\u0600-\u06FF]", text))
        latin_chars = len(re.findall(r"[a-zA-Z]", text))
        total = arabic_chars + latin_chars

        if total == 0:
            return "ar"

        arabic_ratio = arabic_chars / total
        if arabic_ratio > 0.8:
            return "ar"
        elif arabic_ratio < 0.2:
            return "en"
        return "bilingual"
