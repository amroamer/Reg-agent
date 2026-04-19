"""Stage 1: PDF text extraction with multi-strategy pipeline and Arabic validation.

Strategy priority:
1. PyMuPDF (fast, good for digital PDFs)
2. pdfplumber (fallback for layouts PyMuPDF struggles with)
3. Tesseract OCR (ultimate fallback — always produces readable Arabic if Tesseract Arabic pack is installed)

After each strategy, we VALIDATE the extracted Arabic text:
- No (cid:XXXX) placeholders
- Sufficient Arabic Unicode chars (if we expect Arabic)
- Known regulatory Arabic words present
If validation fails, we try the next strategy.
"""

import logging
import os
import re
import subprocess
import tempfile

import pdfplumber
import pytesseract
from langdetect import DetectorFactory

DetectorFactory.seed = 0

logger = logging.getLogger(__name__)

SCANNED_THRESHOLD = 50
ARABIC_CHAR_RE = re.compile(
    r"[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]"
)
CID_RE = re.compile(r"\(cid:\d+\)")

# Known regulatory Arabic words used to validate extraction quality
KNOWN_AR_WORDS = [
    "المادة", "الباب", "الفصل", "البنك", "المركزي",
    "نظام", "قانون", "لائحة", "أحكام", "التعريفات",
    "السعودي", "المملكة", "مادة",
]


class PDFExtractor:
    """Multi-strategy PDF text extractor with Arabic validation."""

    def extract(self, pdf_path: str) -> dict:
        """Main extraction — tries multiple strategies, validates Arabic, falls back to OCR."""
        logger.info("Extracting: %s", pdf_path)

        is_scanned = self._detect_scanned(pdf_path)
        if is_scanned:
            logger.info("Detected scanned PDF — using OCR directly")
            return self._finalize(self._extract_with_ocr(pdf_path))

        results = {}

        # ── Strategy 1: PyMuPDF ──
        try:
            r = self._extract_with_pymupdf(pdf_path)
            if self._validate_arabic(r):
                logger.info("PyMuPDF produced valid Arabic — using it")
                return self._finalize(r)
            results["pymupdf"] = r
            logger.info("PyMuPDF Arabic validation failed — trying next strategy")
        except Exception as e:
            logger.warning("PyMuPDF failed: %s", e)

        # ── Strategy 2: pdfplumber ──
        try:
            r = self._extract_with_pdfplumber(pdf_path)
            if self._validate_arabic(r):
                logger.info("pdfplumber produced valid Arabic — using it")
                return self._finalize(r)
            results["pdfplumber"] = r
            logger.info("pdfplumber Arabic validation failed")
        except Exception as e:
            logger.warning("pdfplumber failed: %s", e)

        # ── Strategy 3: OCR fallback (always works for Arabic) ──
        logger.info(
            "Text extraction failed to produce valid Arabic — falling back to OCR"
        )
        try:
            ocr_result = self._extract_with_ocr(pdf_path)
            # Even if OCR isn't perfect, prefer it if it has Arabic
            if self._validate_arabic(ocr_result) or not results:
                return self._finalize(ocr_result)
            results["ocr"] = ocr_result
        except Exception as e:
            logger.warning("OCR failed: %s", e)

        # Pick best available result
        if results:
            best = self._pick_best(results)
            best.setdefault("warnings", []).append(
                "Arabic extraction quality is low — some characters may be garbled. "
                "Consider re-uploading a different version of the PDF."
            )
            return self._finalize(best)

        # Everything failed
        raise RuntimeError("All extraction strategies failed")

    # ══════════════════════════════════════════════════════
    # VALIDATION
    # ══════════════════════════════════════════════════════

    def _validate_arabic(self, result: dict) -> bool:
        """Return True if the extracted Arabic content is usable.

        Rules:
        - No (cid:XXX) placeholders
        - If document appears to have Arabic content, it must contain
          at least 50 Arabic chars and at least one known regulatory word
        """
        all_text = " ".join(p.get("text", "") for p in result.get("pages", []))

        # Rule 1: No CID placeholders
        cid_count = len(CID_RE.findall(all_text))
        if cid_count > 0:
            logger.warning("Extraction has %d CID placeholders", cid_count)
            return False

        # Rule 2: If any Arabic is present, check quality
        arabic_chars = ARABIC_CHAR_RE.findall(all_text)
        if len(arabic_chars) > 0:
            # There IS Arabic — validate it's readable
            if len(arabic_chars) < 50:
                # Very little Arabic — may be incidental (just an Arabic title)
                # Don't fail validation for monolingual English docs
                latin = len(re.findall(r"[a-zA-Z]", all_text))
                if latin < 500:  # short monolingual Arabic doc
                    return False
                return True  # Likely monolingual English with incidental Arabic

            # Has substantial Arabic — check if it contains known words
            found = sum(1 for w in KNOWN_AR_WORDS if w in all_text)
            if found == 0:
                logger.warning(
                    "No known Arabic regulatory words found in %d Arabic chars",
                    len(arabic_chars),
                )
                return False
            logger.info(
                "Arabic validation passed: %d chars, %d known words",
                len(arabic_chars),
                found,
            )

        # Non-Arabic (English-only) — passes if no CIDs
        return True

    def _pick_best(self, results: dict) -> dict:
        """Pick the least-bad result when all strategies fail validation."""
        # Score each: fewer CIDs = better, more content = better
        def score(r):
            text = " ".join(p.get("text", "") for p in r.get("pages", []))
            cids = len(CID_RE.findall(text))
            ar_chars = len(ARABIC_CHAR_RE.findall(text))
            return ar_chars - cids * 10 + len(text) // 100

        return max(results.values(), key=score)

    # ══════════════════════════════════════════════════════
    # STRATEGY IMPLEMENTATIONS
    # ══════════════════════════════════════════════════════

    def _detect_scanned(self, pdf_path: str) -> bool:
        """Check if PDF is scanned (low text density)."""
        with pdfplumber.open(pdf_path) as pdf:
            sample = pdf.pages[:5]
            total_chars = sum(len(p.extract_text() or "") for p in sample)
            avg = total_chars / max(len(sample), 1)
            return avg < SCANNED_THRESHOLD

    def _extract_with_pymupdf(self, pdf_path: str) -> dict:
        """Strategy 1: PyMuPDF — fastest, handles most digital PDFs."""
        import fitz

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
        return {
            "pages": pages,
            "language": None,
            "total_pages": len(pages),
            "method": "pymupdf",
            "warnings": [],
        }

    def _extract_with_pdfplumber(self, pdf_path: str) -> dict:
        """Strategy 2: pdfplumber."""
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
        return {
            "pages": pages,
            "language": None,
            "total_pages": len(pages),
            "method": "pdfplumber",
            "warnings": [],
        }

    def _extract_with_ocr(self, pdf_path: str) -> dict:
        """Strategy 3: Tesseract OCR with ara+eng language pack."""
        pages = []
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages):
                try:
                    img = page.to_image(resolution=300)
                    with tempfile.NamedTemporaryFile(
                        suffix=".png", delete=False
                    ) as tmp:
                        img.save(tmp.name)
                        # Extract text
                        text = pytesseract.image_to_string(
                            tmp.name,
                            lang="ara+eng",
                            config="--oem 1 --psm 6",
                        )
                        # Extract confidence
                        data = pytesseract.image_to_data(
                            tmp.name,
                            lang="ara+eng",
                            config="--oem 1 --psm 6",
                            output_type=pytesseract.Output.DICT,
                        )
                        os.unlink(tmp.name)
                    confidences = [
                        int(c)
                        for c in data.get("conf", [])
                        if str(c).lstrip("-").isdigit() and int(c) > 0
                    ]
                    avg_conf = (
                        sum(confidences) / len(confidences) / 100 if confidences else 0
                    )
                    pages.append({
                        "page_number": i + 1,
                        "text": text.strip(),
                        "tables": [],
                        "confidence": round(avg_conf, 2),
                    })
                except Exception as e:
                    logger.warning("OCR page %d failed: %s", i + 1, e)
                    pages.append({
                        "page_number": i + 1,
                        "text": "",
                        "tables": [],
                        "confidence": 0.0,
                    })

        warnings = []
        for p in pages:
            if p["confidence"] > 0 and p["confidence"] < 0.7:
                warnings.append(
                    f"Page {p['page_number']}: Low OCR confidence ({p['confidence']:.0%}) — manual review recommended"
                )

        return {
            "pages": pages,
            "language": None,
            "total_pages": len(pages),
            "method": "tesseract-ocr",
            "warnings": warnings,
        }

    # ══════════════════════════════════════════════════════
    # POST-PROCESSING
    # ══════════════════════════════════════════════════════

    def _finalize(self, result: dict) -> dict:
        """Detect language + extract tables."""
        all_text = " ".join(p.get("text", "") for p in result.get("pages", []))
        result["language"] = self._detect_language(all_text)
        return result

    def _detect_language(self, text: str) -> str:
        """Detect ar / en / bilingual from char distribution."""
        if not text.strip():
            return "en"
        arabic = len(ARABIC_CHAR_RE.findall(text))
        latin = len(re.findall(r"[a-zA-Z]", text))
        total = arabic + latin
        if total == 0:
            return "en"
        ratio = arabic / total
        if ratio > 0.8:
            return "ar"
        if ratio < 0.2:
            return "en"
        return "bilingual"
