# Deploy Bitacora App Dashboard to Hostinger VPS

## TL;DR

Docker Compose deployment with persistent SQLite database, session auth, and encrypted API keys. Caddy handles HTTPS. The big change from the old deploy: **nginx is gone** — Express serves everything. The database lives on a Docker volume so it survives rebuilds. You need two new secrets: `SESSION_SECRET` and `ENCRYPTION_KEY`.

**Stack:** Docker Compose (app + DB volume) → Caddy (HTTPS + reverse proxy) → Hostinger VPS → bitacora.cloud

---

## What Changed (vs. old deploy)

| Before (nginx) | Now (Express + SQLite) |
|-----------------|----------------------|
| nginx serves static files | Express serves SPA + API |
| API keys in browser localStorage | Encrypted in SQLite, proxied server-side |
| No auth | Session-based login with bcrypt |
| `docker run` | `docker compose up` with persistent volume |
| No database | SQLite on Docker volume (`bitacora-data`) |
| `.env` optional | `.env` required (SESSION_SECRET, ENCRYPTION_KEY) |

---

## Fresh Deploy (from scratch)

### 1. SSH into your VPS

```bash
ssh root@<your-vps-ip>
```

### 2. Install Docker + Compose (skip if already installed)

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker
docker compose version  # verify
```

### 3. Install Caddy (skip if already installed)

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install caddy
```

### 4. DNS (skip if already configured)

In **Hostinger → Domains → bitacora.cloud → DNS Zone**, ensure:

| Type | Name | Value |
|------|------|-------|
| A | `@` | `<your-vps-ip>` |
| A | `dashboard` | `<your-vps-ip>` |

### 5. Clone the repo

```bash
# Remove old deploy if it exists
rm -rf /opt/bitacora

mkdir -p /opt/bitacora && cd /opt/bitacora
git clone https://github.com/jcprimo/bitacora-app-dashboard.git dashboard
cd dashboard
```

### 6. Checkout the branch (until merged to main)

```bash
git checkout feature/auth-db-orchestrator/phase-2
```

### 7. Create your .env file

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
nano .env
```

```env
# REQUIRED — generate these fresh for production
SESSION_SECRET=<paste-a-long-random-string>
ENCRYPTION_KEY=<paste-64-char-hex-string>

# YouTrack instance
YOUTRACK_URL=https://bitacora.youtrack.cloud

# Port (leave as 8080)
PORT=8080
```

**Generate the secrets locally or on the VPS:**

```bash
# Session secret (any random string)
openssl rand -base64 32

# Encryption key (must be exactly 64 hex chars)
openssl rand -hex 32
```

### 8. Build and start with Docker Compose

```bash
docker compose up -d --build
```

This:
- Builds the React frontend
- Builds the Express server
- Creates a persistent `bitacora-data` volume for the SQLite database
- Runs on port 8080
- Runs as non-root user inside the container

### 9. Configure Caddy

```bash
cat > /etc/caddy/Caddyfile << 'EOF'
dashboard.bitacora.cloud {
    reverse_proxy localhost:8080
}

bitacora.cloud {
    respond "Bitacora App Dashboard — #OpsLife" 200
}
EOF

systemctl reload caddy
```

### 10. Verify

```bash
# Check container is running
docker compose ps

# Check logs
docker compose logs -f app

# Test from VPS
curl -I https://dashboard.bitacora.cloud
```

Open `https://dashboard.bitacora.cloud` in your browser. You should see the **Create Admin Account** setup screen.

---

## First Login After Deploy

1. Open `https://dashboard.bitacora.cloud`
2. You'll see **"Create Admin Account"** — this only appears once
3. Enter your name, email, and password (min 8 chars)
4. Click **Create Admin Account**
5. You're in — configure your API keys in Settings (click the "Not Connected" badge)

---

## Redeploy After Code Changes

```bash
cd /opt/bitacora/dashboard

# Pull latest code
git pull

# Rebuild and restart (DB is preserved on the volume)
docker compose up -d --build

# Verify
docker compose logs -f app
```

The SQLite database is on a Docker volume — it **survives rebuilds**. Your users, credentials, and data persist.

---

## Quick Reference

| Action | Command |
|--------|---------|
| View logs | `docker compose logs -f app` |
| Check status | `docker compose ps` |
| Restart | `docker compose restart app` |
| Stop | `docker compose down` |
| Stop + delete DB | `docker compose down -v` (⚠️ destroys data) |
| Shell into container | `docker compose exec app sh` |
| Check DB | `docker compose exec app sqlite3 /app/data/bitacora.db ".tables"` |
| Rebuild | `docker compose up -d --build` |

---

## Backup the Database

```bash
# Copy DB out of the container
docker compose cp app:/app/data/bitacora.db ./bitacora-backup-$(date +%Y%m%d).db
```

---

## Troubleshooting

| Issue | Solution |
|-------|---------|
| Container won't start | Check `docker compose logs app` — look for missing env vars |
| "SESSION_SECRET must be..." | You're missing secrets in `.env`. Generate them with `openssl` |
| "ENCRYPTION_KEY must be..." | Must be exactly 64 hex chars. Run `openssl rand -hex 32` |
| Caddy shows 502 | Container isn't running. Check `docker compose ps` |
| Can't reach the site | Check DNS: `dig dashboard.bitacora.cloud +short` should return your VPS IP |
| Lost admin password | Delete the DB and re-create: `docker compose down -v && docker compose up -d --build` |

---

## Syncing Locally

To match what's on the VPS:

```bash
# On your local machine
cd bitacora-app-dashboard
git checkout feature/auth-db-orchestrator/phase-2
git pull
npm install
cp .env.example .env
# Generate and set ENCRYPTION_KEY in .env
openssl rand -hex 32
# Set SESSION_SECRET
openssl rand -base64 32
npm run build && npm start
# → http://localhost:8080
```
