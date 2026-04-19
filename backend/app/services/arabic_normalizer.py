"""Arabic Text Normalizer.

Fixes common PDF extraction issues with Arabic text:
1. Converts Arabic Presentation Forms (FB50-FDFF, FE70-FEFF) to standard Arabic (0600-06FF)
2. Removes kashida/tatweel stretching (U+0640)
3. Removes zero-width characters
4. Normalizes Unicode (NFKC then NFC)
5. Fixes common extraction artifacts

MUST run on all extracted Arabic text BEFORE structural parsing.
"""

import re
import unicodedata


# ═══════════════════════════════════════════════════════════
# ARABIC PRESENTATION FORMS → STANDARD ARABIC
# ═══════════════════════════════════════════════════════════
# PDFs often store visual glyph forms (isolated/initial/medial/final)
# from ranges FE70-FEFF and FB50-FDFF. We map them back to the
# standard Arabic logical characters in 0600-06FF.

PRESENTATION_TO_STANDARD = {
    # Alef
    "\uFE8D": "\u0627", "\uFE8E": "\u0627",
    # Alef Madda
    "\uFE81": "\u0622", "\uFE82": "\u0622",
    # Alef Hamza Above
    "\uFE83": "\u0623", "\uFE84": "\u0623",
    # Alef Hamza Below
    "\uFE87": "\u0625", "\uFE88": "\u0625",
    # Waw Hamza
    "\uFE85": "\u0624", "\uFE86": "\u0624",
    # Yeh Hamza
    "\uFE89": "\u0626", "\uFE8A": "\u0626",
    "\uFE8B": "\u0626", "\uFE8C": "\u0626",
    # Beh
    "\uFE8F": "\u0628", "\uFE90": "\u0628",
    "\uFE91": "\u0628", "\uFE92": "\u0628",
    # Teh Marbuta
    "\uFE93": "\u0629", "\uFE94": "\u0629",
    # Teh
    "\uFE95": "\u062A", "\uFE96": "\u062A",
    "\uFE97": "\u062A", "\uFE98": "\u062A",
    # Theh
    "\uFE99": "\u062B", "\uFE9A": "\u062B",
    "\uFE9B": "\u062B", "\uFE9C": "\u062B",
    # Jeem
    "\uFE9D": "\u062C", "\uFE9E": "\u062C",
    "\uFE9F": "\u062C", "\uFEA0": "\u062C",
    # Hah
    "\uFEA1": "\u062D", "\uFEA2": "\u062D",
    "\uFEA3": "\u062D", "\uFEA4": "\u062D",
    # Khah
    "\uFEA5": "\u062E", "\uFEA6": "\u062E",
    "\uFEA7": "\u062E", "\uFEA8": "\u062E",
    # Dal
    "\uFEA9": "\u062F", "\uFEAA": "\u062F",
    # Thal
    "\uFEAB": "\u0630", "\uFEAC": "\u0630",
    # Reh
    "\uFEAD": "\u0631", "\uFEAE": "\u0631",
    # Zain
    "\uFEAF": "\u0632", "\uFEB0": "\u0632",
    # Seen
    "\uFEB1": "\u0633", "\uFEB2": "\u0633",
    "\uFEB3": "\u0633", "\uFEB4": "\u0633",
    # Sheen
    "\uFEB5": "\u0634", "\uFEB6": "\u0634",
    "\uFEB7": "\u0634", "\uFEB8": "\u0634",
    # Sad
    "\uFEB9": "\u0635", "\uFEBA": "\u0635",
    "\uFEBB": "\u0635", "\uFEBC": "\u0635",
    # Dad
    "\uFEBD": "\u0636", "\uFEBE": "\u0636",
    "\uFEBF": "\u0636", "\uFEC0": "\u0636",
    # Tah
    "\uFEC1": "\u0637", "\uFEC2": "\u0637",
    "\uFEC3": "\u0637", "\uFEC4": "\u0637",
    # Zah
    "\uFEC5": "\u0638", "\uFEC6": "\u0638",
    "\uFEC7": "\u0638", "\uFEC8": "\u0638",
    # Ain
    "\uFEC9": "\u0639", "\uFECA": "\u0639",
    "\uFECB": "\u0639", "\uFECC": "\u0639",
    # Ghain
    "\uFECD": "\u063A", "\uFECE": "\u063A",
    "\uFECF": "\u063A", "\uFED0": "\u063A",
    # Feh
    "\uFED1": "\u0641", "\uFED2": "\u0641",
    "\uFED3": "\u0641", "\uFED4": "\u0641",
    # Qaf
    "\uFED5": "\u0642", "\uFED6": "\u0642",
    "\uFED7": "\u0642", "\uFED8": "\u0642",
    # Kaf
    "\uFED9": "\u0643", "\uFEDA": "\u0643",
    "\uFEDB": "\u0643", "\uFEDC": "\u0643",
    # Lam
    "\uFEDD": "\u0644", "\uFEDE": "\u0644",
    "\uFEDF": "\u0644", "\uFEE0": "\u0644",
    # Meem
    "\uFEE1": "\u0645", "\uFEE2": "\u0645",
    "\uFEE3": "\u0645", "\uFEE4": "\u0645",
    # Noon
    "\uFEE5": "\u0646", "\uFEE6": "\u0646",
    "\uFEE7": "\u0646", "\uFEE8": "\u0646",
    # Heh
    "\uFEE9": "\u0647", "\uFEEA": "\u0647",
    "\uFEEB": "\u0647", "\uFEEC": "\u0647",
    # Waw
    "\uFEED": "\u0648", "\uFEEE": "\u0648",
    # Alef Maqsura
    "\uFEEF": "\u0649", "\uFEF0": "\u0649",
    # Yeh
    "\uFEF1": "\u064A", "\uFEF2": "\u064A",
    "\uFEF3": "\u064A", "\uFEF4": "\u064A",
    # Lam-Alef ligatures
    "\uFEF5": "\u0644\u0622", "\uFEF6": "\u0644\u0622",
    "\uFEF7": "\u0644\u0623", "\uFEF8": "\u0644\u0623",
    "\uFEF9": "\u0644\u0625", "\uFEFA": "\u0644\u0625",
    "\uFEFB": "\u0644\u0627", "\uFEFC": "\u0644\u0627",
    # Hamza
    "\uFE80": "\u0621",
    # Tatweel → removed
    "\u0640": "",
}

# Presentation Forms-A (less common: Persian/Urdu letters)
PRESENTATION_FORMS_A = {
    "\uFB50": "\u0671", "\uFB51": "\u0671",
    "\uFB56": "\u067E", "\uFB57": "\u067E",
    "\uFB58": "\u067E", "\uFB59": "\u067E",
    "\uFB7A": "\u0686", "\uFB7B": "\u0686",
    "\uFB7C": "\u0686", "\uFB7D": "\u0686",
    "\uFB8A": "\u0698", "\uFB8B": "\u0698",
    "\uFB92": "\u06AF", "\uFB93": "\u06AF",
    "\uFB94": "\u06AF", "\uFB95": "\u06AF",
}
PRESENTATION_TO_STANDARD.update(PRESENTATION_FORMS_A)


# Common broken forms seen in SAMA docs (post-NFKC safety net)
_COMMON_FIXES = {
    # These appear after NFKC when certain Arabic-Indic forms don't normalize cleanly
}

# Zero-width / bidirectional control characters to strip
_ZERO_WIDTH = [
    "\u200B",  # zero-width space
    "\u200C",  # zero-width non-joiner
    "\u200D",  # zero-width joiner
    "\u200E",  # LTR mark
    "\u200F",  # RTL mark
    "\uFEFF",  # BOM / zero-width no-break space
    "\u202A", "\u202B", "\u202C", "\u202D", "\u202E",  # bidi embedding/override
    "\u2066", "\u2067", "\u2068", "\u2069",  # bidi isolate
]

PRESENTATION_RE = re.compile(r"[\uFB50-\uFDFF\uFE70-\uFEFF]")
ARABIC_RE = re.compile(r"[\u0600-\u06FF]")
CID_RE = re.compile(r"\(cid:\d+\)")


def normalize_arabic(text: str) -> str:
    """Main normalizer. Apply to ALL extracted text (Arabic segments will be fixed;
    non-Arabic passes through untouched).

    Pipeline:
    1. NFKC normalization (converts many presentation forms)
    2. Explicit presentation-form mapping (covers what NFKC misses)
    3. Remove kashida/tatweel
    4. Remove zero-width + bidi control chars
    5. NFC composition for clean output
    6. Whitespace cleanup
    """
    if not text:
        return text

    # Step 1: NFKC — catches most presentation forms in one pass
    text = unicodedata.normalize("NFKC", text)

    # Step 2: Explicit mapping for anything NFKC missed
    text = _convert_presentation_forms(text)

    # Step 3: Remove tatweel (already in map but belt-and-suspenders)
    text = text.replace("\u0640", "")

    # Step 4: Remove zero-width + bidi controls
    for ch in _ZERO_WIDTH:
        text = text.replace(ch, "")

    # Step 5: NFC composition
    text = unicodedata.normalize("NFC", text)

    # Step 6: Fix common broken SAMA-doc patterns
    text = _fix_common_errors(text)

    # Step 7: Whitespace
    text = _clean_whitespace(text)

    return text


def _convert_presentation_forms(text: str) -> str:
    """Replace any remaining Arabic Presentation Form characters."""
    # Fast path: if no presentation-form chars, skip the loop
    if not PRESENTATION_RE.search(text):
        return text
    return "".join(PRESENTATION_TO_STANDARD.get(c, c) for c in text)


def _fix_common_errors(text: str) -> str:
    """Fix common extraction artifacts."""
    # Fix: hamza combined awkwardly with alef
    text = text.replace("\u0621\u0627", "\u0623")  # hamza + alef → alef with hamza
    text = text.replace("\u0627\u0621", "\u0623")  # alef + hamza → alef with hamza
    return text


def _clean_whitespace(text: str) -> str:
    """Normalize whitespace without touching newlines."""
    text = re.sub(r"[^\S\n]+", " ", text)  # collapse horizontal whitespace
    text = re.sub(r" +\n", "\n", text)  # trim trailing spaces
    text = re.sub(r"\n{3,}", "\n\n", text)  # collapse blank lines
    return text.strip()


def validate_arabic_quality(text: str) -> dict:
    """Assess Arabic text quality after normalization.

    Returns:
        {"quality": "good|fair|poor|empty", "score": 0.0-1.0,
         "arabic_ratio": 0.0-1.0, "issues": [...]}
    """
    if not text:
        return {"quality": "empty", "score": 0, "arabic_ratio": 0, "issues": ["No text"]}

    issues: list[str] = []

    # Remaining presentation forms
    pres = len(PRESENTATION_RE.findall(text))
    if pres > 0:
        issues.append(f"{pres} presentation form chars remain")

    # CID placeholders
    cids = len(CID_RE.findall(text))
    if cids > 0:
        issues.append(f"{cids} CID references")

    # Kashida
    kashida = text.count("\u0640")
    if kashida > 10:
        issues.append(f"{kashida} kashida chars (stretching artifacts)")

    # Known regulatory words
    known = [
        "المادة", "الباب", "الفصل", "البنك", "المركزي", "نظام",
        "أحكام", "يجب", "المملكة", "التعريفات",
    ]
    found = sum(1 for w in known if w in text)
    if found == 0:
        issues.append("No known Arabic regulatory terms")

    # Ratios
    arabic_chars = len(ARABIC_RE.findall(text))
    total = len(re.sub(r"\s+", "", text))
    arabic_ratio = arabic_chars / max(total, 1)

    # Score
    score = 1.0
    if pres > 0:
        score -= min(0.3, pres / max(len(text), 1) * 10)
    if cids > 0:
        score -= min(0.4, cids * 0.05)
    if kashida > 10:
        score -= 0.1
    if found == 0 and arabic_chars > 50:
        score -= 0.3
    score = max(0.0, min(1.0, score))

    if score >= 0.85:
        quality = "good"
    elif score >= 0.6:
        quality = "fair"
    else:
        quality = "poor"

    return {
        "quality": quality,
        "score": round(score, 2),
        "arabic_ratio": round(arabic_ratio, 2),
        "issues": issues,
    }
