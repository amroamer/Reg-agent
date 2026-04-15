import pytest
from worker.tasks.ocr import _detect_language


def test_detect_language_english():
    """Test English language detection."""
    assert _detect_language("This is an English text about banking regulations.") == "en"


def test_detect_language_arabic():
    """Test Arabic language detection."""
    assert _detect_language("هذا نص عربي حول الأنظمة المصرفية") == "ar"


def test_detect_language_empty():
    """Test empty text defaults to English."""
    assert _detect_language("") == "en"


def test_detect_language_bilingual():
    """Test bilingual text detection."""
    result = _detect_language(
        "Article 1 المادة الأولى: Definitions التعريفات "
        "This regulation applies to all banks. "
        "ينطبق هذا النظام على جميع البنوك المرخصة."
    )
    assert result in ("ar", "en", "bilingual")
