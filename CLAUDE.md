# RegInspector — مُفتِّش الأنظمة

On-premise, bilingual (Arabic + English) regulatory intelligence platform for Saudi banks. Ingests SAMA/CMA regulations and bank policies, provides hybrid search with structured, source-cited AI responses.

## Tech Stack

- **Backend**: Python 3.11, FastAPI, SQLAlchemy (async), Celery + Redis
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Database**: PostgreSQL 16 (with full-text search for AR+EN)
- **Vector DB**: Qdrant (multilingual-e5-large, 1024 dimensions, cosine)
- **LLM**: Claude API (primary), Ollama (air-gapped fallback)
- **Infrastructure**: Docker Compose, Nginx reverse proxy

## Project Structure

```
backend/
  app/
    main.py              # FastAPI entry point + lifespan
    config.py            # Pydantic settings (loads ../.env)
    database.py          # Async SQLAlchemy engine + session
    models/              # SQLAlchemy models (11 tables)
    schemas/             # Pydantic request/response schemas
    routers/             # API endpoints (health, auth, documents, search, admin, batches)
    services/            # Business logic (search, embedding, qdrant, LLM, SSE, cache)
    llm/                 # LLM provider abstraction (Claude, Ollama, prompts)
    middleware/          # Rate limiting
  worker/
    celery_app.py        # Celery config (Redis broker)
    tasks/               # ingest, batch, embed, chunk, ocr, cross_reference
  scripts/               # seed_sample_data.py, ingest_pdf.py
  tests/
frontend/
  app/                   # Next.js pages (search, documents, admin, settings)
  components/            # React components (layout, search, shared)
  hooks/                 # useAuth, useSearch, useLanguage, useBatchSSE
  lib/                   # api.ts, auth.ts, types.ts, i18n/
```

## Running Locally

```bash
# 1. Start infrastructure
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis qdrant

# 2. Backend
cd backend
python -m venv .venv && source .venv/Scripts/activate  # or bin/activate on Linux
pip install -r requirements.txt
# Optional for semantic search: pip install sentence-transformers
uvicorn app.main:app --host 0.0.0.0 --port 8001

# 3. Frontend
cd frontend
npm install
npm run dev  # port 3000
```

## Dev Ports (non-conflicting)

| Service    | Port |
|------------|------|
| PostgreSQL | 5434 |
| Redis      | 6381 |
| Qdrant     | 6335 |
| Backend    | 8001 |
| Frontend   | 3000 |

## Key Conventions

- **Auth**: JWT (access + refresh tokens). Most endpoints use `get_optional_user` (work without login). Upload/delete/admin-write endpoints require auth.
- **Models**: UUID primary keys, `DateTime(timezone=True)` with UTC defaults, JSONB for flexible metadata.
- **Enums**: SQLAlchemy enums use UPPERCASE values in PostgreSQL (e.g., `INDEXED` not `indexed`). Raw SQL must match.
- **Qdrant client**: v1.17+ uses `query_points()` not `search()`.
- **Embedding**: `intfloat/multilingual-e5-large` requires `"passage: "` prefix for documents, `"query: "` for queries.
- **Config**: `backend/app/config.py` loads `.env` from `"../.env", ".env"` (parent directory first for local dev).
- **Frontend API proxy**: `next.config.js` rewrites `/api/*` to `http://localhost:8001/api/*`.

## Ingestion Pipeline (6 Stages)

PDF → Extract (pdfplumber/Tesseract) → Parse (regex article detection) → Markdown → Chunk (token-aware) → Embed (Qdrant) → Enrich (cross-refs)

## Database

11 tables: users, documents, articles, chunks, cross_references, topics, document_topics, search_logs, ingestion_errors, ingestion_batches, ingestion_queue.

Tables created via `Base.metadata.create_all()` (not Alembic migrations yet).

## Seed Data

```bash
cd backend
python scripts/seed_sample_data.py
# Creates: admin@reginspector.local / admin123!@#
# Creates: 10 topic categories
```

## Brand

KPMG Saudi Arabia. Primary blue: #00338D. Source badges: SAMA (blue), CMA (purple #483698), Bank (green #009A44).
