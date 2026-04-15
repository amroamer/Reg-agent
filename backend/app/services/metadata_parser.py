"""Parse CSV or JSON metadata files for bulk document upload."""

import csv
import io
import json
import logging
import re

logger = logging.getLogger(__name__)

VALID_SOURCES = {"SAMA", "CMA", "BANK_POLICY"}


def parse_csv_metadata(content: bytes) -> tuple[dict[str, dict], list[str]]:
    """Parse CSV metadata into a filename → metadata dict.

    Returns (metadata_map, warnings).
    """
    text = content.decode("utf-8-sig")  # handle Excel BOM
    reader = csv.DictReader(io.StringIO(text))

    if not reader.fieldnames:
        return {}, ["CSV file is empty or has no headers"]

    # Normalize headers
    fields = [f.strip().lower() for f in reader.fieldnames]
    if "filename" not in fields:
        return {}, ["CSV must have a 'filename' column"]

    metadata_map = {}
    warnings = []

    for row_num, row in enumerate(reader, start=2):
        # Normalize keys to lowercase
        row = {k.strip().lower(): (v or "").strip() for k, v in row.items()}

        filename = row.get("filename", "").lower()
        if not filename:
            continue

        source = row.get("source", "").upper()
        if source and source not in VALID_SOURCES:
            warnings.append(f"Row {row_num}: invalid source '{source}', skipping")
            continue

        metadata_map[filename] = {
            "source": source or None,
            "document_number": row.get("document_number") or None,
            "title_ar": row.get("title_ar") or None,
            "title_en": row.get("title_en") or None,
            "issue_date": row.get("issue_date") or None,
            "effective_date": row.get("effective_date") or None,
            "source_url": row.get("source_url") or None,
        }

    return metadata_map, warnings


def parse_json_metadata(content: bytes) -> tuple[dict[str, dict], list[str]]:
    """Parse JSON metadata array into a filename → metadata dict.

    Returns (metadata_map, warnings).
    """
    warnings = []
    try:
        items = json.loads(content)
    except json.JSONDecodeError as e:
        return {}, [f"Invalid JSON: {e}"]

    if not isinstance(items, list):
        return {}, ["JSON metadata must be an array of objects"]

    metadata_map = {}
    for i, item in enumerate(items):
        if not isinstance(item, dict):
            warnings.append(f"Item {i}: not a dict, skipping")
            continue
        filename = (item.get("filename") or "").strip().lower()
        if not filename:
            warnings.append(f"Item {i}: missing 'filename', skipping")
            continue

        source = (item.get("source") or "").upper()
        if source and source not in VALID_SOURCES:
            warnings.append(f"Item {i}: invalid source '{source}'")
            source = ""

        metadata_map[filename] = {
            "source": source or None,
            "document_number": item.get("document_number"),
            "title_ar": item.get("title_ar"),
            "title_en": item.get("title_en"),
            "issue_date": item.get("issue_date"),
            "effective_date": item.get("effective_date"),
            "source_url": item.get("source_url"),
        }

    return metadata_map, warnings


def detect_source_from_filename(filename: str) -> str | None:
    """Guess document source from filename patterns."""
    name = filename.lower()
    if "sama" in name:
        return "SAMA"
    if "cma" in name:
        return "CMA"
    if any(kw in name for kw in ("bank", "policy", "internal", "bp-")):
        return "BANK_POLICY"
    return None


def extract_doc_number(filename: str) -> str | None:
    """Try to extract a document number from filename."""
    stem = filename.rsplit(".", 1)[0]
    match = re.match(r"(SAMA|CMA|BP)[\-_][\w\-]+", stem, re.IGNORECASE)
    if match:
        return match.group(0).upper()
    return None
