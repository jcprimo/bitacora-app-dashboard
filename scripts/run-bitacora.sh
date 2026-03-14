#!/usr/bin/env bash
# ─── run-bitacora.sh — First-time deploy or full rebuild ─────────
# Use this script for:
#   - Fresh deployment on a new VPS
#   - Full rebuild after major changes (Dockerfile, deps, etc.)
#
# What it does:
#   1. Pulls the latest code from the current branch
#   2. Builds the Docker image (React frontend + Express backend)
#   3. Starts the container with Docker Compose
#   4. SQLite database is preserved on a Docker volume (bitacora-data)
#
# Prerequisites:
#   - Docker and Docker Compose installed
#   - .env file exists with SESSION_SECRET and ENCRYPTION_KEY
#   - Run from the project root (where docker-compose.yml lives)
#
# Usage:
#   ./scripts/run-bitacora.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "──────────────────────────────────────────────"
echo "  Bitacora App Dashboard — Deploy"
echo "──────────────────────────────────────────────"

# ─── Preflight checks ────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "✗ Docker is not installed. Run: curl -fsSL https://get.docker.com | sh"
  exit 1
fi

if ! docker compose version &>/dev/null; then
  echo "✗ Docker Compose is not available. Update Docker or install the compose plugin."
  exit 1
fi

if [ ! -f .env ]; then
  echo "✗ .env file not found. Run: cp .env.example .env && nano .env"
  echo "  You need SESSION_SECRET and ENCRYPTION_KEY set."
  exit 1
fi

# ─── Check required env vars are set (not empty) ─────────────────
source .env 2>/dev/null || true
if [ -z "${SESSION_SECRET:-}" ] || [ "$SESSION_SECRET" = "change-me-to-a-random-string" ]; then
  echo "✗ SESSION_SECRET is not set or still has the default value."
  echo "  Generate one with: openssl rand -base64 32"
  exit 1
fi

if [ -z "${ENCRYPTION_KEY:-}" ] || [ ${#ENCRYPTION_KEY} -ne 64 ]; then
  echo "✗ ENCRYPTION_KEY is missing or not 64 hex characters."
  echo "  Generate one with: openssl rand -hex 32"
  exit 1
fi

# ─── Pull latest code ────────────────────────────────────────────
echo ""
echo "→ Pulling latest code..."
git pull

# ─── Build and start ─────────────────────────────────────────────
echo ""
echo "→ Building Docker image and starting container..."
docker compose up -d --build

# ─── Verify ──────────────────────────────────────────────────────
echo ""
echo "→ Waiting for server to start..."
sleep 3

if docker compose ps --format '{{.Status}}' | grep -q "Up"; then
  echo ""
  echo "──────────────────────────────────────────────"
  echo "  ✓ Bitacora is running on port 8080"
  echo "──────────────────────────────────────────────"
  echo ""
  echo "  View logs:    docker compose logs -f app"
  echo "  Check status: docker compose ps"
  echo ""
else
  echo ""
  echo "✗ Container failed to start. Check logs:"
  echo "  docker compose logs app"
  exit 1
fi
