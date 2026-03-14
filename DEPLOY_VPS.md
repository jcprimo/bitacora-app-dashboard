# Deploy Bitacora App Dashboard to Hostinger VPS

## TL;DR

This guide walks you through deploying the Bitacora App Dashboard (#OpsLife) on your Hostinger KVM 2 VPS using Docker + Caddy. By the end you'll have `dashboard.bitacora.cloud` live with auto-TLS, accessible from your phone. No prior VPS experience needed — just follow the steps in order. The whole process takes about 15–20 minutes if DNS propagates quickly.

**Stack:** Docker (runs the app) → Caddy (handles HTTPS + reverse proxy) → Hostinger VPS (the server) → bitacora.cloud (your domain)

---

## 1. SSH into your VPS

Get your VPS IP and root password from **Hostinger → VPS Dashboard → SSH Access**.

```bash
ssh root@<your-vps-ip>
```

---

## 2. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker
```

Verify with `docker --version`.

---

## 3. Install Caddy (reverse proxy with auto-TLS)

Caddy handles HTTPS certificates automatically via Let's Encrypt — zero config SSL.

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install caddy
```

---

## 4. Set up DNS (Hostinger panel)

Go to **Hostinger → Domains → bitacora.cloud → DNS Zone** and add:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<your-vps-ip>` | 3600 |
| A | `dashboard` | `<your-vps-ip>` | 3600 |

The `dashboard` A record creates `dashboard.bitacora.cloud` pointing to your VPS.

DNS can take a few minutes to propagate. You can check with:

```bash
dig dashboard.bitacora.cloud +short
```

---

## 5. Clone and build the Docker image on the VPS

```bash
mkdir -p /opt/bitacora && cd /opt/bitacora
git clone https://github.com/jcprimo/bitacora-youtrack.git dashboard
cd dashboard/reporta-youtrack

# Create your .env with real values
cp .env.example .env
nano .env  # fill in your YouTrack token, Anthropic key, OpenAI key

# Build the Docker image
docker build -t bitacora-dashboard .

# Run on port 8080 (Caddy will proxy to this)
docker run -d \
  --name bitacora-dashboard \
  --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  --env-file .env \
  -e YOUTRACK_URL=https://bitacora.youtrack.cloud \
  bitacora-dashboard
```

---

## 6. Configure Caddy for dashboard.bitacora.cloud

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

Caddy will automatically:
- Obtain a Let's Encrypt TLS certificate for `dashboard.bitacora.cloud`
- Redirect HTTP to HTTPS
- Proxy all traffic to your Docker container on port 8080

---

## 7. Verify it's live

```bash
# From VPS
curl -I https://dashboard.bitacora.cloud

# From your phone — just open in Safari or Chrome
# https://dashboard.bitacora.cloud
```

---

## 8. Phone access

The app already has a responsive viewport meta tag, so it works on mobile out of the box.

**Add to Home Screen (iOS):** Open the URL in Safari → tap Share → "Add to Home Screen". It will look and feel like a native app.

**Add to Home Screen (Android):** Open in Chrome → tap the three-dot menu → "Add to Home screen".

---

## Quick Reference — After Deployment

| Action | Command |
|--------|---------|
| View logs | `docker logs -f bitacora-dashboard` |
| Check status | `docker ps` |
| Restart | `docker restart bitacora-dashboard` |
| Rebuild after code changes | See below |

### Rebuild and redeploy

```bash
cd /opt/bitacora/dashboard/reporta-youtrack
git pull
docker build -t bitacora-dashboard .
docker stop bitacora-dashboard && docker rm bitacora-dashboard
docker run -d \
  --name bitacora-dashboard \
  --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  --env-file .env \
  -e YOUTRACK_URL=https://bitacora.youtrack.cloud \
  bitacora-dashboard
```

---

## Pending Actions

1. **Rename GitHub repo** — Run `gh repo rename bitacora-app-dashboard` from your local machine to match the new brand
2. **Rename local directory** — `you_track_claude_integration` → `bitacora-app-dashboard`
3. **bitacora.cloud root domain** — Currently returns a placeholder. Later point it to a landing page, App Store listing, or redirect to the dashboard
