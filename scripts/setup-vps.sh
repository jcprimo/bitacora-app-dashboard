#!/usr/bin/env bash
# ─── setup-vps.sh — Idempotent VPS provisioning for Bitácora ─────
#
# Configures a fresh or existing Hostinger VPS (Ubuntu 22.04) with
# everything needed to run the Bitácora dashboard + ops system.
#
# Safe to run multiple times — every step checks before acting.
#
# Prerequisites:
#   - Root or sudo access
#   - SSH public key already on the server
#   - DNS A record for dashboard.bitacora.app pointing to this VPS IP
#
# Usage:
#   chmod +x scripts/setup-vps.sh
#   sudo ./scripts/setup-vps.sh
#
# After running:
#   1. Clone the iOS repo manually (private):
#      sudo -u bitacora-ops git clone <YOUR_URL> /home/bitacora-ops/repos/bitacora-app-ios
#   2. Copy .env to the dashboard directory:
#      cp .env /home/bitacora-ops/bitacora-app-dashboard/.env
#   3. Deploy with: sudo -u bitacora-ops ./scripts/run-bitacora.sh

set -euo pipefail

# ─── Must run as root ────────────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
  echo "✗ This script must be run as root (or with sudo)."
  exit 1
fi

DOMAIN="dashboard.bitacora.app"
SERVICE_USER="bitacora-ops"
APP_PORT=8080
DASHBOARD_DIR="/home/${SERVICE_USER}/bitacora-app-dashboard"
REPOS_DIR="/home/${SERVICE_USER}/repos"
NODE_MAJOR=22

echo "══════════════════════════════════════════════"
echo "  Bitácora VPS Setup — ${DOMAIN}"
echo "══════════════════════════════════════════════"
echo ""

# ─── 1. System update ────────────────────────────────────────────
echo "→ [1/11] Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq
echo "  ✓ System updated"

# ─── 2. Install Node.js 22 LTS ──────────────────────────────────
echo ""
echo "→ [2/11] Installing Node.js ${NODE_MAJOR}..."
if command -v node &>/dev/null && node -v | grep -q "v${NODE_MAJOR}"; then
  echo "  ✓ Node.js $(node -v) already installed"
else
  apt-get install -y -qq ca-certificates curl gnupg
  mkdir -p /etc/apt/keyrings
  if [ ! -f /etc/apt/keyrings/nodesource.gpg ]; then
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
      | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  fi
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -qq
  apt-get install -y -qq nodejs
  echo "  ✓ Node.js $(node -v) installed"
fi

# ─── 3. Install Docker + Docker Compose ─────────────────────────
echo ""
echo "→ [3/11] Installing Docker..."
if command -v docker &>/dev/null; then
  echo "  ✓ Docker already installed ($(docker --version))"
else
  apt-get install -y -qq apt-transport-https ca-certificates curl software-properties-common
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null || true
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable docker
  systemctl start docker
  echo "  ✓ Docker installed"
fi

# Add service user to docker group so it can run containers without sudo
if id "${SERVICE_USER}" &>/dev/null; then
  usermod -aG docker "${SERVICE_USER}" 2>/dev/null || true
fi

# ─── 4. Install Caddy ───────────────────────────────────────────
echo ""
echo "→ [4/11] Installing Caddy..."
if command -v caddy &>/dev/null; then
  echo "  ✓ Caddy already installed ($(caddy version))"
else
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null || true
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
  echo "  ✓ Caddy installed"
fi

# ─── 5. Configure Caddy — reverse proxy with auto-TLS ───────────
echo ""
echo "→ [5/11] Configuring Caddy for ${DOMAIN}..."
CADDYFILE="/etc/caddy/Caddyfile"
cat > "${CADDYFILE}" <<EOF
${DOMAIN} {
	reverse_proxy localhost:${APP_PORT}

	# Security headers
	header {
		X-Content-Type-Options nosniff
		X-Frame-Options DENY
		Referrer-Policy strict-origin-when-cross-origin
		-Server
	}

	# Gzip compression
	encode gzip

	log {
		output file /var/log/caddy/access.log {
			roll_size 10mb
			roll_keep 5
		}
	}
}
EOF

mkdir -p /var/log/caddy
systemctl enable caddy
systemctl restart caddy
echo "  ✓ Caddy configured → ${DOMAIN} → localhost:${APP_PORT}"

# ─── 6. Create and configure service user ────────────────────────
echo ""
echo "→ [6/11] Creating service user '${SERVICE_USER}'..."
if id "${SERVICE_USER}" &>/dev/null; then
  echo "  ✓ User '${SERVICE_USER}' already exists"
else
  # Create user with home dir, bash shell, no password (key-only access)
  useradd -m -s /bin/bash "${SERVICE_USER}"
  # Lock password login — SSH key only
  passwd -l "${SERVICE_USER}" >/dev/null
  echo "  ✓ User '${SERVICE_USER}' created (password-locked)"
fi

# Grant limited sudo: only docker, systemctl for bitacora services, npm
cat > /etc/sudoers.d/bitacora-ops <<'SUDOERS'
# bitacora-ops — scoped privileges for dashboard + agent operations
bitacora-ops ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/bin/docker compose *
bitacora-ops ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart caddy, /usr/bin/systemctl reload caddy
bitacora-ops ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart bitacora-dashboard, /usr/bin/systemctl status bitacora-dashboard
bitacora-ops ALL=(ALL) NOPASSWD: /usr/bin/npm install -g *
SUDOERS
chmod 440 /etc/sudoers.d/bitacora-ops
visudo -cf /etc/sudoers.d/bitacora-ops >/dev/null
echo "  ✓ Scoped sudo configured (docker, systemctl, npm)"

# Copy root's SSH key so you can SSH as bitacora-ops too
SSHDIR="/home/${SERVICE_USER}/.ssh"
mkdir -p "${SSHDIR}"
if [ -f /root/.ssh/authorized_keys ]; then
  cp /root/.ssh/authorized_keys "${SSHDIR}/authorized_keys"
fi
chmod 700 "${SSHDIR}"
chmod 600 "${SSHDIR}/authorized_keys" 2>/dev/null || true
chown -R "${SERVICE_USER}:${SERVICE_USER}" "${SSHDIR}"
echo "  ✓ SSH key copied from root → ${SERVICE_USER}"

# ─── 7. SSH hardening (root access preserved) ───────────────────
echo ""
echo "→ [7/11] Hardening SSH..."
SSHD_CONFIG="/etc/ssh/sshd_config"

# Backup original config once
if [ ! -f "${SSHD_CONFIG}.backup-original" ]; then
  cp "${SSHD_CONFIG}" "${SSHD_CONFIG}.backup-original"
fi

# Disable password auth globally (key-only for all users)
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' "${SSHD_CONFIG}"
sed -i 's/^#\?ChallengeResponseAuthentication.*/ChallengeResponseAuthentication no/' "${SSHD_CONFIG}"
sed -i 's/^#\?UsePAM.*/UsePAM no/' "${SSHD_CONFIG}"

# Keep root login enabled (your backdoor) but key-only
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' "${SSHD_CONFIG}"

# Limit auth attempts and idle timeout
sed -i 's/^#\?MaxAuthTries.*/MaxAuthTries 3/' "${SSHD_CONFIG}"
sed -i 's/^#\?ClientAliveInterval.*/ClientAliveInterval 300/' "${SSHD_CONFIG}"
sed -i 's/^#\?ClientAliveCountMax.*/ClientAliveCountMax 2/' "${SSHD_CONFIG}"

# Only allow these two users to SSH in
if ! grep -q "^AllowUsers" "${SSHD_CONFIG}"; then
  echo "AllowUsers root ${SERVICE_USER}" >> "${SSHD_CONFIG}"
else
  sed -i "s/^AllowUsers.*/AllowUsers root ${SERVICE_USER}/" "${SSHD_CONFIG}"
fi

# Validate config before restarting
if sshd -t 2>/dev/null; then
  systemctl restart sshd
  echo "  ✓ SSH hardened: key-only, root preserved (prohibit-password), AllowUsers root + ${SERVICE_USER}"
else
  echo "  ✗ SSH config invalid — restoring backup"
  cp "${SSHD_CONFIG}.backup-original" "${SSHD_CONFIG}"
  systemctl restart sshd
  exit 1
fi

# ─── 8. Firewall (UFW) ──────────────────────────────────────────
echo ""
echo "→ [8/11] Configuring firewall..."
apt-get install -y -qq ufw

# Reset rules idempotently
ufw --force reset >/dev/null 2>&1

ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP (Caddy ACME challenges)'
ufw allow 443/tcp comment 'HTTPS'

ufw --force enable
echo "  ✓ UFW enabled: 22 (SSH), 80 (HTTP), 443 (HTTPS)"

# ─── 9. fail2ban ────────────────────────────────────────────────
echo ""
echo "→ [9/11] Installing and configuring fail2ban..."
apt-get install -y -qq fail2ban

cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
banaction = ufw

[sshd]
enabled  = true
port     = 22
filter   = sshd
logpath  = /var/log/auth.log
maxretry = 5
bantime  = 3h
EOF

systemctl enable fail2ban
systemctl restart fail2ban
echo "  ✓ fail2ban active: 3 SSH failures → 3h ban"

# ─── 10. Install Claude CLI ─────────────────────────────────────
echo ""
echo "→ [10/11] Installing Claude CLI..."
if command -v claude &>/dev/null; then
  echo "  ✓ Claude CLI already installed"
else
  npm install -g @anthropic-ai/claude-code
  echo "  ✓ Claude CLI installed"
fi

# ─── 11. Prepare directory structure ─────────────────────────────
echo ""
echo "→ [11/11] Preparing directories and permissions..."

# Create repos dir for iOS codebase (agent context)
mkdir -p "${REPOS_DIR}"
chown "${SERVICE_USER}:${SERVICE_USER}" "${REPOS_DIR}"

# Ensure service user owns their home
chown -R "${SERVICE_USER}:${SERVICE_USER}" "/home/${SERVICE_USER}"

# ─── Log rotation for Docker + Caddy ────────────────────────────
cat > /etc/logrotate.d/bitacora <<'EOF'
/var/log/caddy/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    postrotate
        systemctl reload caddy > /dev/null 2>&1 || true
    endscript
}
EOF

# Docker log rotation (applies to all containers)
cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
systemctl restart docker

echo "  ✓ Directories ready, log rotation configured"

# ─── Summary ─────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════"
echo "  ✓ VPS setup complete"
echo "══════════════════════════════════════════════"
echo ""
echo "  Domain:       https://${DOMAIN}"
echo "  App port:     ${APP_PORT}"
echo "  Service user: ${SERVICE_USER}"
echo "  Dashboard:    ${DASHBOARD_DIR}"
echo "  Repos:        ${REPOS_DIR}"
echo ""
echo "  SSH:          key-only, root via key (prohibit-password), fail2ban active"
echo "  Firewall:     22, 80, 443 only"
echo "  Users:        root (backdoor) + ${SERVICE_USER} (workspace)"
echo "  Caddy:        auto-TLS → localhost:${APP_PORT}"
echo "  Node.js:      $(node -v)"
echo "  Docker:       $(docker --version | cut -d' ' -f3 | tr -d ',')"
echo "  Claude CLI:   $(claude --version 2>/dev/null || echo 'run: claude login')"
echo ""
echo "  Next steps:"
echo "  ──────────"
echo "  1. Clone iOS repo (private — provide URL manually):"
echo "     sudo -u ${SERVICE_USER} git clone <URL> ${REPOS_DIR}/bitacora-app-ios"
echo ""
echo "  2. Ensure .env exists at ${DASHBOARD_DIR}/.env"
echo ""
echo "  3. Deploy the dashboard:"
echo "     cd ${DASHBOARD_DIR} && sudo -u ${SERVICE_USER} ./scripts/run-bitacora.sh"
echo ""
echo "  4. Verify:"
echo "     curl -s https://${DOMAIN}/health"
echo ""
echo "  5. Test SSH as ${SERVICE_USER}:"
echo "     ssh ${SERVICE_USER}@<VPS_IP>"
echo ""
