#!/usr/bin/env python
"""
CLI script to ingest a PDF document directly into RegInspector.

Usage:
    python scripts/ingest_pdf.py <pdf_path> --source SAMA [--title-en "..."] [--title-ar "..."] [--doc-number "..."]

Examples:
    python scripts/ingest_pdf.py ../documents/sama/credit-card-rules.pdf --source SAMA --title-en "Credit Card Rules"
    python scripts/ingest_pdf.py ../documents/cma/market-conduct.pdf --source CMA --title-en "Market Conduct Regulations"
    python scripts/ingest_pdf.py ../documents/bank_policies/aml-policy.pdf --source BANK_POLICY

This runs the full 6-stage pipeline synchronously (no Celery needed).
"""

import argparse
import hashlib
import os
import sys
import uuid

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import Base
from app.models.document import Document, DocumentStatus, SourceAuthority


def compute_hash(file_path: str) -> str:
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for block in iter(lambda: f.read(65536), b""):
            sha256.update(block)
    return sha256.hexdigest()


def main():
    parser = argparse.ArgumentParser(description="Ingest a PDF into RegInspector")
    parser.add_argument("pdf_path", help="Path to the PDF file")
    parser.add_argument("--source", required=True, choices=["SAMA", "CMA", "BANK_POLICY"], help="Source authority")
    parser.add_argument("--title-en", default=None, help="English title")
    parser.add_argument("--title-ar", default=None, help="Arabic title")
    parser.add_argument("--doc-number", default=None, help="Document number (e.g., SAMA-BCR-2023-01)")
    parser.add_argument("--source-url", default=None, help="URL to original document")
    args = parser.parse_args()

    pdf_path = os.path.abspath(args.pdf_path)
    if not os.path.exists(pdf_path):
        print(f"Error: File not found: {pdf_path}")
        sys.exit(1)

    if not pdf_path.lower().endswith(".pdf"):
        print("Error: Only PDF files are supported")
        sys.exit(1)

    print(f"{'='*60}")
    print(f"RegInspector Document Ingestion")
    print(f"{'='*60}")
    print(f"File:   {pdf_path}")
    print(f"Source: {args.source}")
    print(f"Title:  {args.title_en or Path(pdf_path).stem}")
    print(f"{'='*60}")

    # Connect to database
    engine = create_engine(settings.DATABASE_URL_SYNC)
    session = Session(engine)

    # Check for duplicate
    file_hash = compute_hash(pdf_path)
    existing = session.execute(
        select(Document).where(Document.file_hash == file_hash)
    ).scalar_one_or_none()
    if existing:
        print(f"\nThis file has already been ingested (document_id: {existing.id})")
        print(f"Status: {existing.status.value}")
        session.close()
        sys.exit(0)

    # Create document record
    doc_id = uuid.uuid4()
    doc = Document(
        id=doc_id,
        title_en=args.title_en or Path(pdf_path).stem,
        title_ar=args.title_ar,
        source=SourceAuthority(args.source),
        document_number=args.doc_number,
        status=DocumentStatus.PENDING,
        file_path=pdf_path,
        file_hash=file_hash,
        source_url=args.source_url,
    )
    session.add(doc)
    session.commit()
    print(f"\nDocument created: {doc_id}")

    # Run ingestion pipeline
    print("\nStarting 6-stage ingestion pipeline...\n")
    try:
        from worker.tasks.ingest import ingest_document
        result = ingest_document(str(doc_id))
        print(f"\n{'='*60}")
        print(f"INGESTION COMPLETE")
        print(f"{'='*60}")
        if isinstance(result, dict):
            for key, value in result.items():
                if key == "timing":
                    print(f"\nTiming:")
                    for stage, duration in value.items():
                        print(f"  {stage}: {duration}")
                elif key != "status":
                    print(f"  {key}: {value}")
    except Exception as e:
        print(f"\nIngestion FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    main()
