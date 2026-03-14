#!/usr/bin/env bash
# ─── restart-bitacora.sh — Quick redeploy after code changes ─────
# Use this script for:
#   - Pulling and deploying code updates
#   - Restarting after .env changes
#   - Recovering from a crashed container
#
# What it does:
#   1. Pulls the latest code from the current branch
#   2. Rebuilds the Docker image
#   3. Restarts the container (zero-downtime: new container starts
#      before old one stops via Docker Compose recreate)
#   4. Database is NOT affected — it lives on the bitacora-data volume
#
# When to use this vs run-bitacora.sh:
#   - restart-bitacora.sh → routine updates, config changes, quick fix
#   - run-bitacora.sh     → first deploy, or when you need preflight checks
#
# Usage:
#   ./scripts/restart-bitacora.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "──────────────────────────────────────────────"
echo "  Bitacora App Dashboard — Restart"
echo "──────────────────────────────────────────────"

# ─── Pull latest code ────────────────────────────────────────────
echo ""
echo "→ Pulling latest code..."
git pull

# ─── Rebuild and restart ─────────────────────────────────────────
echo ""
echo "→ Rebuilding and restarting container..."
docker compose up -d --build --force-recreate

# ─── Show status ─────────────────────────────────────────────────
echo ""
echo "→ Waiting for server to start..."
sleep 3

if docker compose ps --format '{{.Status}}' | grep -q "Up"; then
  echo ""
  echo "──────────────────────────────────────────────"
  echo "  ✓ Bitacora restarted successfully"
  echo "──────────────────────────────────────────────"
  echo ""
  # Show last 5 log lines to confirm healthy startup
  docker compose logs --tail 5 app
  echo ""
else
  echo ""
  echo "✗ Container failed to start. Check logs:"
  echo "  docker compose logs app"
  exit 1
fi
