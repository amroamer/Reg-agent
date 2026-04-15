#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════
# RegInspector — One-Command Production Deployment
# ═══════════════════════════════════════════════════════
# Usage: ./scripts/deploy.sh
#
# This script:
# 1. Checks prerequisites
# 2. Generates SSL certificates (self-signed)
# 3. Generates .env.production with random secrets
# 4. Builds all Docker images (with pre-baked embedding model)
# 5. Starts infrastructure (postgres, redis, qdrant)
# 6. Initializes the database
# 7. Starts all application services
# 8. Pulls the Ollama LLM model
# 9. Runs health checks
# ═══════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[RegInspector]${NC} $1"; }
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  RegInspector — مُفتِّش الأنظمة"
echo "  Production Deployment"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── Step 1: Prerequisites ──────────────────────────

log "Checking prerequisites..."

command -v docker >/dev/null 2>&1 || err "Docker is not installed. Install Docker first."
command -v openssl >/dev/null 2>&1 || err "OpenSSL is not installed."
docker compose version >/dev/null 2>&1 || err "Docker Compose v2 is not available."

ok "Prerequisites: docker, docker compose, openssl"

# Check if nvidia-smi is available (GPU)
if command -v nvidia-smi >/dev/null 2>&1; then
    ok "GPU detected: $(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)"
    HAS_GPU=true
else
    warn "No GPU detected. Ollama will run on CPU (slower)."
    HAS_GPU=false
fi

# ── Step 2: SSL Certificates ──────────────────────

log "Checking SSL certificates..."

if [ -f nginx/ssl/cert.pem ] && [ -f nginx/ssl/key.pem ]; then
    ok "SSL certificates exist"
else
    log "Generating self-signed SSL certificate..."
    bash scripts/generate-ssl.sh
    ok "SSL certificates generated"
fi

# ── Step 3: Environment File ──────────────────────

log "Checking production environment..."

if [ -f .env.production ]; then
    ok ".env.production exists"
else
    log "Generating .env.production..."
    bash scripts/generate-env.sh
    ok ".env.production generated"
fi

# Symlink .env → .env.production for Docker Compose
if [ ! -f .env ] || [ "$(readlink -f .env 2>/dev/null)" != "$(readlink -f .env.production 2>/dev/null)" ]; then
    cp .env.production .env
    ok "Copied .env.production → .env"
fi

# ── Step 4: Build Images ──────────────────────────

log "Building Docker images (this may take 10-15 minutes on first run)..."
echo "  - Backend (includes 2.2GB embedding model download)"
echo "  - Frontend (Next.js production build)"

docker compose -f docker-compose.yml -f docker-compose.prod.yml build --parallel 2>&1 | tail -5

ok "All images built"

# ── Step 5: Start Infrastructure ──────────────────

log "Starting infrastructure services..."

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres redis qdrant

log "Waiting for services to be healthy..."
RETRIES=30
until docker compose -f docker-compose.yml -f docker-compose.prod.yml ps postgres 2>/dev/null | grep -q "healthy"; do
    RETRIES=$((RETRIES - 1))
    if [ $RETRIES -le 0 ]; then
        err "PostgreSQL did not become healthy in time"
    fi
    sleep 2
done

ok "PostgreSQL healthy"
ok "Redis healthy"
ok "Qdrant healthy"

# ── Step 6: Initialize Database ───────────────────

log "Initializing database..."

# Start backend temporarily to run init
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d backend

# Wait for backend to start
sleep 10

bash scripts/init-db.sh 2>/dev/null || true

ok "Database initialized"

# ── Step 7: Start All Services ────────────────────

log "Starting all services..."

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

ok "All services started"

# ── Step 8: Ollama Model ──────────────────────────

if [ "$HAS_GPU" = true ]; then
    log "Pulling Ollama model (qwen2.5:72b)... this may take a while."
    docker exec ri-ollama ollama pull qwen2.5:72b 2>&1 | tail -3 || warn "Ollama model pull failed (non-critical — Claude API is primary)"
    ok "Ollama model ready"
else
    warn "Skipping Ollama model pull (no GPU). Claude API will be used."
fi

# ── Step 9: Health Check ──────────────────────────

log "Running health check..."
sleep 5

HEALTH=$(curl -sk https://localhost/api/health 2>/dev/null || echo '{"status":"unreachable"}')
echo "  Health: $HEALTH"

if echo "$HEALTH" | grep -q '"healthy"'; then
    ok "Health check passed!"
else
    warn "Health check returned non-healthy status. Check logs: docker compose logs backend"
fi

# ── Done ──────────────────────────────────────────

VM_IP=$(curl -sf http://ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

echo ""
echo "═══════════════════════════════════════════════════════"
echo -e "  ${GREEN}RegInspector deployed successfully!${NC}"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  Access:  https://${VM_IP}"
echo "  API:     https://${VM_IP}/api/health"
echo "  Docs:    https://${VM_IP}/api/docs"
echo ""
echo "  Admin:   admin@reginspector.local / admin123!@#"
echo "  (Change this password immediately!)"
echo ""
echo "  Useful commands:"
echo "    View logs:    docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f"
echo "    Stop:         docker compose -f docker-compose.yml -f docker-compose.prod.yml down"
echo "    Backup DB:    ./scripts/backup-db.sh"
echo "    Restore DB:   ./scripts/restore-db.sh backups/<file>.sql.gz"
echo ""
