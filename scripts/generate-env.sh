#!/usr/bin/env bash
# Generate .env.production with random secrets
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env.production"

if [ -f "$ENV_FILE" ]; then
    echo ".env.production already exists."
    read -p "Overwrite? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Keeping existing file."
        exit 0
    fi
fi

# Generate random passwords
PG_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
SECRET_KEY=$(openssl rand -base64 48 | tr -d '/+=' | head -c 64)

# Prompt for API key
echo ""
read -p "Enter your Anthropic API key (or press Enter to skip): " ANTHROPIC_KEY
ANTHROPIC_KEY=${ANTHROPIC_KEY:-sk-ant-CHANGE_ME}

# Detect VM IP
VM_IP=$(curl -sf http://ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "YOUR_VM_IP")

cat > "$ENV_FILE" << EOF
# ═══════════════════════════════════════════════════════
# RegInspector — Production Environment
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# ═══════════════════════════════════════════════════════

# ── PostgreSQL ─────────────────────────────────────
POSTGRES_USER=reginspector
POSTGRES_PASSWORD=${PG_PASSWORD}
POSTGRES_DB=reginspector
DATABASE_URL=postgresql+asyncpg://reginspector:${PG_PASSWORD}@postgres:5432/reginspector
DATABASE_URL_SYNC=postgresql://reginspector:${PG_PASSWORD}@postgres:5432/reginspector

# ── Redis ──────────────────────────────────────────
REDIS_URL=redis://redis:6379/0

# ── Qdrant ─────────────────────────────────────────
QDRANT_HOST=qdrant
QDRANT_PORT=6333
QDRANT_COLLECTION=regulations

# ── Ollama (GPU LLM) ──────────────────────────────
OLLAMA_HOST=ollama
OLLAMA_PORT=11434
OLLAMA_MODEL=qwen2.5:72b

# ── Claude API ─────────────────────────────────────
ANTHROPIC_API_KEY=${ANTHROPIC_KEY}
LLM_PROVIDER=claude
LLM_MODEL=claude-sonnet-4-20250514

# ── Embedding ─────────────────────────────────────
EMBEDDING_MODEL=intfloat/multilingual-e5-large

# ── Auth ───────────────────────────────────────────
SECRET_KEY=${SECRET_KEY}
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

# ── App ────────────────────────────────────────────
DEBUG=false
APP_NAME=RegInspector
CORS_ORIGINS=https://${VM_IP}
EOF

echo ""
echo ".env.production generated at: $ENV_FILE"
echo "  PostgreSQL password: ${PG_PASSWORD:0:4}****"
echo "  JWT secret key:     ${SECRET_KEY:0:4}****"
echo "  VM IP detected:     $VM_IP"
echo ""
echo "Review the file and adjust if needed."
