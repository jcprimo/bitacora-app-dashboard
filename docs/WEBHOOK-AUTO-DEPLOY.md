# Webhook Auto-Deploy — Bitácora Dashboard

> Live as of 2026-03-20. Tickets: BIT-40 (this doc), BIT-33 (VPS hardening).

---

## What This Document Covers

This guide explains the full webhook-based continuous deployment pipeline that
powers `bitacora-app-dashboard`. When you merge a PR to `master`, the VPS
rebuilds and restarts the app automatically — no manual SSH required.

It also covers the **identical parallel setup** for `primo.engineering`, since
both sites run on the same VPS using the same pattern.

By the end you will understand:
- Why HMAC-SHA256 signatures exist and how they work
- How Caddy acts as a TLS-terminating gatekeeper for the webhook endpoint
- How systemd manages the webhook daemon and where env vars come from
- What the `ref` filter does and why it matters
- Every gotcha that burned time during initial setup

---

## Architecture at a Glance

```
Developer's machine
      |
      |  git push / merge PR to master
      |
      v
  GitHub (github.com/jcprimo/bitacora-app-dashboard)
      |
      |  POST https://deploy.bitacora.cloud/hooks/deploy-bitacora
      |  Headers:
      |    X-Hub-Signature-256: sha256=<hmac>
      |    Content-Type: application/json
      |  Body: { "ref": "refs/heads/master", ... }
      |
      v
  Caddy (port 443 on VPS, deploy.bitacora.cloud)
      |
      |  TLS termination + GitHub IP allowlist
      |  Reverse proxy to localhost:9000
      |
      v
  webhook daemon (localhost:9000, internal only)
      |
      |  1. Verify HMAC-SHA256 signature
      |  2. Check ref == "refs/heads/master"
      |  3. If both pass, execute the deploy script
      |
      v
  /opt/bitacora/bitacora-app-dashboard/scripts/run-bitacora.sh
      |
      |  git pull
      |  docker compose up -d --build
      |
      v
  New container running — deploy complete
```

Two parallel pipelines run on the same VPS:

| Site | Webhook path | Deploy script |
|------|-------------|--------------|
| `bitacora-app-dashboard` | `/hooks/deploy-bitacora` | `/opt/bitacora/bitacora-app-dashboard/scripts/run-bitacora.sh` |
| `primo.engineering` | `/hooks/deploy-primo` | `/opt/primo/primo-engineering/scripts/force-recreate.sh` |

Both share the same `/etc/webhook/hooks.json`, the same `webhook` daemon, and
the same Caddy virtual host at `deploy.bitacora.cloud`.

---

## Why Each Piece Exists

Understanding the "why" is more valuable than memorizing the "what". Here is a
mental model for each component.

### GitHub Webhooks

When you push to a branch or merge a PR, GitHub can notify an external URL.
It sends an HTTP POST with the event payload (who pushed, what branch, what
commits). This is how GitHub talks to your infrastructure.

The challenge: your deploy endpoint is public. Anyone who discovers the URL
could POST to it and trigger a deploy. This is why GitHub lets you configure a
**secret** — a shared passphrase that proves the request really came from
GitHub and not from an attacker.

### HMAC-SHA256 Signatures

HMAC stands for Hash-based Message Authentication Code. It answers the
question: "Did the party who knows the secret produce this message?"

How it works:

```
secret  =  "your-webhook-secret"
payload =  <raw JSON body from GitHub>

signature = HMAC-SHA256(key=secret, message=payload)
```

GitHub computes this signature over the raw request body using your secret,
then sends the result in the `X-Hub-Signature-256` header as `sha256=<hex>`.

Your webhook daemon receives the request, computes the same HMAC independently,
and compares the two signatures. If they match, the request is authentic. If
they do not match, the daemon ignores the request.

Crucially, HMAC is computed over the **raw bytes** of the body. This means the
content type must be `application/json` — if the body arrives
URL-encoded, the raw bytes are different and the signature check will fail even
with a correct secret. This is Gotcha #3 below.

### The `webhook` Daemon

`webhook` (github.com/adnanh/webhook) is a small Go binary that:
1. Listens on a local port (9000 by default)
2. Reads a `hooks.json` config that defines rules
3. When a request arrives, evaluates the rules (signature check, ref filter)
4. If rules pass, executes a configured shell script

It is not a web server. It has no TLS, no access logging, no rate limiting. It
is intentionally simple — Caddy handles all of that.

### Caddy as a Gatekeeper

Caddy sits in front of the webhook daemon and provides:

1. **TLS termination** — the webhook URL is `https://`. Caddy handles the
   certificate automatically via Let's Encrypt. The daemon itself only speaks
   plain HTTP on localhost.

2. **GitHub IP restriction** — GitHub publishes the list of IP ranges it uses
   to send webhooks. Caddy's `remote_ip` matcher limits the
   `deploy.bitacora.cloud` block to those ranges only. Any other IP receives a
   connection refused before the request reaches the daemon.

This is defense in depth: even if someone spoofed a GitHub IP and crafted a
valid HMAC signature, they would also need to be routing traffic from a GitHub
AS. In practice the IP restriction plus HMAC makes unauthorized triggering
effectively impossible.

### systemd and `EnvironmentFile`

The `webhook` daemon is managed as a systemd service. It needs the
`WEBHOOK_SECRET` environment variable to validate signatures. The challenge:
systemd unit files are world-readable in `/etc/systemd/system/`, so you must
not put secrets in them directly.

The solution is a `systemd override` with `EnvironmentFile`:

```
# /etc/systemd/system/webhook.service.d/override.conf
[Service]
EnvironmentFile=/etc/default/webhook
```

`/etc/default/webhook` is chmod 600, owned by root. It contains:

```
WEBHOOK_SECRET=your-secret-here
```

The daemon reads `$WEBHOOK_SECRET` from its environment at startup. The
`{{ getenv "WEBHOOK_SECRET" }}` template syntax in `hooks.json` is how the
daemon injects the env var into the signature check at runtime.

Note: in some webhook versions the `{{ getenv }}` template does not evaluate
correctly in the `secret` field. If you see signature mismatches even with the
correct secret, replace the template reference with the literal secret value
directly in `hooks.json`. This is less clean but unambiguous. See Gotcha #2.

---

## Repository: hooks.json

The live config on the VPS at `/etc/webhook/hooks.json`:

```json
[
  {
    "id": "deploy-bitacora.sh",
    "execute-command": "/opt/bitacora/bitacora-app-dashboard/scripts/run-bitacora.sh",
    "command-working-directory": "/opt/bitacora/bitacora-app-dashboard",
    "response-message": "Deploy triggered.",
    "trigger-rule": {
      "and": [
        {
          "match": {
            "type": "payload-hmac-sha256",
            "secret": "{{ getenv \"WEBHOOK_SECRET\" }}",
            "parameter": {
              "source": "header",
              "name": "X-Hub-Signature-256"
            }
          }
        },
        {
          "match": {
            "type": "value",
            "value": "refs/heads/master",
            "parameter": {
              "source": "payload",
              "name": "ref"
            }
          }
        }
      ]
    }
  },
  {
    "id": "deploy-primo",
    "execute-command": "/opt/primo/primo-engineering/scripts/force-recreate.sh",
    "command-working-directory": "/opt/primo/primo-engineering",
    "response-message": "Deploy triggered.",
    "trigger-rule": {
      "and": [
        {
          "match": {
            "type": "payload-hmac-sha256",
            "secret": "{{ getenv \"WEBHOOK_SECRET\" }}",
            "parameter": {
              "source": "header",
              "name": "X-Hub-Signature-256"
            }
          }
        },
        {
          "match": {
            "type": "value",
            "value": "refs/heads/master",
            "parameter": {
              "source": "payload",
              "name": "ref"
            }
          }
        }
      ]
    }
  }
]
```

The `and` rule requires **both** conditions to be true before the script runs:
1. The HMAC signature on the `X-Hub-Signature-256` header is valid
2. The `ref` field in the JSON body equals `refs/heads/master`

The `ref` filter is essential. GitHub fires webhooks on every push — feature
branches, tags, forks. Without the filter, any push to the repo would trigger a
production deploy. With the filter, only pushes that land on `master` (i.e.
merged PRs) trigger the pipeline.

---

## The Deploy Script

`/opt/bitacora/bitacora-app-dashboard/scripts/run-bitacora.sh` (as tracked
in this repo at `scripts/run-bitacora.sh`):

```bash
git pull
docker compose up -d
```

That is intentionally minimal. The webhook daemon has already done the
authentication work. This script just pulls the latest code and tells Docker
Compose to recreate the container.

The repo also contains `restart-bitacora.sh` for use in manual deploys — it
adds `--build --force-recreate` flags and provides human-readable output. The
webhook script keeps things minimal because:
- It runs non-interactively (no terminal)
- The daemon captures stdout/stderr and includes it in its own logs
- `docker compose up -d` will rebuild the image if the Dockerfile changed

The `run-bitacora.sh` on the VPS is the canonical version. The file in this
repo is a reference copy. If you update the deploy logic, update both.

**Critical requirements for the deploy script:**
- Must have a `#!/bin/bash` shebang on line 1 — the daemon does not invoke a
  shell wrapper; it executes the file directly
- Must use Unix line endings (LF, not CRLF) — a script with Windows line
  endings will fail with a cryptic "bad interpreter" error because the `\r`
  becomes part of the shebang path

---

## Caddy Configuration

The relevant block in `/etc/caddy/Caddyfile` on the VPS:

```
deploy.bitacora.cloud {
    @github_ips remote_ip 192.30.252.0/22 185.199.108.0/22 140.82.112.0/20 143.55.64.0/20
    handle @github_ips {
        reverse_proxy localhost:9000
    }
    respond 403
}
```

How to read this:

- `@github_ips` is a named matcher that passes only when the client's IP falls
  within GitHub's published webhook delivery ranges
- `handle @github_ips` applies the reverse proxy rule only when that matcher
  passes
- `respond 403` is the fallback — anything that does not match the IP ranges
  gets a 403 before the request reaches the daemon

The IP ranges above are GitHub's current webhook ranges as of early 2026.
GitHub publishes the authoritative list at `https://api.github.com/meta`
(look at the `hooks` key). Review this periodically, especially if webhook
deliveries suddenly stop.

---

## GitHub Repository Configuration

In `bitacora-app-dashboard` → Settings → Webhooks → Add webhook:

| Field | Value |
|-------|-------|
| Payload URL | `https://deploy.bitacora.cloud/hooks/deploy-bitacora` |
| Content type | `application/json` |
| Secret | matches `WEBHOOK_SECRET` on VPS |
| Events | Just the push event |
| Active | checked |

The same pattern applies to `primo.engineering` with payload URL
`https://deploy.bitacora.cloud/hooks/deploy-primo`.

---

## Step-by-Step Setup (Reproducible)

Use this section to rebuild the pipeline on a new VPS or after a catastrophic
failure. Each step is idempotent — running it twice will not break anything.

### Step 1 — Install the webhook binary

```bash
apt-get update && apt-get install -y webhook
```

If the package is not available in your distro's repos, install from the
GitHub releases page (download the Linux amd64 binary, place it at
`/usr/local/bin/webhook`, chmod +x).

Verify:

```bash
webhook --version
```

### Step 2 — Create the hooks config

```bash
mkdir -p /etc/webhook
```

Create `/etc/webhook/hooks.json` with the content shown in the
"Repository: hooks.json" section above.

### Step 3 — Create the env file for the secret

```bash
touch /etc/default/webhook
chmod 600 /etc/default/webhook
chown root:root /etc/default/webhook
```

Edit it:

```bash
nano /etc/default/webhook
```

Contents:

```
WEBHOOK_SECRET=your-strong-random-secret-here
```

Generate a good secret:

```bash
openssl rand -hex 32
```

### Step 4 — Configure systemd to inject the env file

The default `webhook.service` unit does not load `EnvironmentFile`. Create a
systemd override:

```bash
systemctl edit webhook
```

This opens a drop-in editor. Add:

```ini
[Service]
EnvironmentFile=/etc/default/webhook
```

Save and close. The override lives at
`/etc/systemd/system/webhook.service.d/override.conf`. Reload and start:

```bash
systemctl daemon-reload
systemctl enable webhook
systemctl start webhook
```

Verify the daemon is running and listening:

```bash
systemctl status webhook
ss -tlnp | grep 9000
```

### Step 5 — Create the deploy scripts

```bash
mkdir -p /opt/bitacora/bitacora-app-dashboard/scripts
```

Create `/opt/bitacora/bitacora-app-dashboard/scripts/run-bitacora.sh`:

```bash
#!/bin/bash
git pull
docker compose up -d
```

Make it executable with Unix line endings:

```bash
chmod +x /opt/bitacora/bitacora-app-dashboard/scripts/run-bitacora.sh
# Verify no CRLF:
file /opt/bitacora/bitacora-app-dashboard/scripts/run-bitacora.sh
# Should say: "Bourne-Again shell script, ASCII text executable"
# If it says "with CRLF line terminators", fix it:
sed -i 's/\r//' /opt/bitacora/bitacora-app-dashboard/scripts/run-bitacora.sh
```

Repeat for `primo.engineering` at `/opt/primo/primo-engineering/scripts/force-recreate.sh`.

### Step 6 — Configure Caddy

Add the `deploy.bitacora.cloud` block to `/etc/caddy/Caddyfile`:

```
deploy.bitacora.cloud {
    @github_ips remote_ip 192.30.252.0/22 185.199.108.0/22 140.82.112.0/20 143.55.64.0/20
    handle @github_ips {
        reverse_proxy localhost:9000
    }
    respond 403
}
```

Validate and reload:

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

### Step 7 — DNS

Add an A record for `deploy.bitacora.cloud` pointing to your VPS IP. Caddy
will auto-provision the TLS certificate via Let's Encrypt on first request.

### Step 8 — Configure GitHub webhooks

Follow the table in the "GitHub Repository Configuration" section for each
repo. Use the same `WEBHOOK_SECRET` value for both.

### Step 9 — Test end-to-end

Push a commit to `master` (or merge a PR). Then on the VPS:

```bash
# Watch the webhook daemon log for incoming requests
journalctl -u webhook -f

# In another terminal, watch the app container
docker compose -f /opt/bitacora/bitacora-app-dashboard/docker-compose.yml logs -f app
```

You should see the daemon log the incoming POST, validate the signature, match
the ref, and execute the script. The Docker logs should show the build starting.

To test the signature validation without a real push, use the GitHub webhook
UI: Settings → Webhooks → your webhook → Recent Deliveries → Redeliver.

---

## Gotchas — What Burned Time During Setup

These are real problems encountered during the initial setup. Read them before
you debug.

### Gotcha 1 — The webhook daemon does not load env vars from systemd by default

The `webhook` systemd unit starts the process cleanly, but clean processes do
not inherit your shell's environment. If `WEBHOOK_SECRET` is only in your
shell, the daemon cannot see it.

The fix is the `EnvironmentFile` override in Step 4. Without it, `{{ getenv
"WEBHOOK_SECRET" }}` evaluates to an empty string and every request fails
signature validation silently.

**How to diagnose:** `journalctl -u webhook` will show requests arriving but
the rule never matching.

### Gotcha 2 — `{{ getenv }}` template syntax may not work in all webhook versions

The `{{ getenv "WEBHOOK_SECRET" }}` syntax is a Go template evaluated by the
`webhook` binary at startup. In some versions this template is not expanded in
the `secret` field of a `payload-hmac-sha256` rule, which means the daemon
computes the HMAC with an empty key and every signature check fails.

**How to diagnose:** Even after fixing Gotcha 1, signature checks still fail.

**Fix:** Replace the template reference in `hooks.json` with the literal secret
value. Yes, this means the secret is in a file. Compensate by:
- Setting `chmod 600 /etc/webhook/hooks.json`, owned by root
- Never committing `hooks.json` from the VPS to a public repo (the file in
  this repo uses the template syntax as the reference — the VPS copy may differ)

### Gotcha 3 — Content type must be `application/json`, NOT `application/x-www-form-urlencoded`

GitHub's webhook settings default to `application/x-www-form-urlencoded` for
older webhooks. If you use this format, the JSON body is URL-encoded into a
`payload=<encoded>` form field. The `webhook` daemon receives that encoded
string, tries to parse `ref` from the JSON payload, cannot find it (because it
is buried in a form field), and the ref filter never matches.

More importantly, HMAC is computed over the raw body bytes. The raw bytes of a
URL-encoded body are different from the JSON bytes that GitHub used when signing
the request, so the signature check will also fail.

**How to configure correctly:** In GitHub Settings → Webhooks, set Content
type to `application/json` explicitly. This is not the default for older webhook
configs.

### Gotcha 4 — Scripts must have `#!/bin/bash` and Unix line endings

The webhook daemon executes the script file directly, like this:

```
execve("/opt/bitacora/.../run-bitacora.sh", [], env)
```

The kernel reads the first two bytes to find the shebang (`#!`). If the file
has no shebang, the kernel does not know what interpreter to use and the exec
fails with `ENOEXEC`. The daemon logs this as a non-zero exit code with no
useful message.

If the file has CRLF line endings, the shebang line becomes `#!/bin/bash\r`.
The kernel looks for a binary named `bash\r`, which does not exist, and you get
`bad interpreter: No such file or directory`.

Files edited on Windows or copied from a Windows machine commonly have CRLF.
Use `file scriptname` to check and `sed -i 's/\r//' scriptname` to fix.

### Gotcha 5 — Push events fire on ALL pushes, not just merges to master

If you configure GitHub to send the `push` event, you will receive a payload
for every push to any branch in the repo. The `ref` field in the payload is the
branch reference that was pushed to.

The `ref` filter in `hooks.json` gates on `refs/heads/master`. Without this
filter, pushing a feature branch or a tag would also trigger a production
deploy, which would pull whatever is currently on `master` (not your branch).
This would be confusing and could result in partially-integrated deploys.

Always include the ref filter. Never remove it thinking it will "simplify"
things.

### Gotcha 6 — `pull_request` events do not have a top-level `ref` field

GitHub's push event payload has `ref` at the top level. The `pull_request`
event has `pull_request.head.ref` and `pull_request.base.ref`, but no top-level
`ref`. If you mistakenly configure the webhook to send `pull_request` events and
filter on `ref`, the filter will never match.

Use `push` events only. A merge to master fires a push event on `master`.

---

## Runbook — Common Operations

### Manually trigger a redeploy

```bash
cd /opt/bitacora/bitacora-app-dashboard
./scripts/run-bitacora.sh
```

Or use the fuller script with build output:

```bash
./scripts/restart-bitacora.sh
```

### Check webhook daemon status

```bash
systemctl status webhook
journalctl -u webhook --since "1 hour ago"
```

### Check if a GitHub delivery was received

In GitHub: repo → Settings → Webhooks → your webhook → Recent Deliveries.
Each delivery shows the full request, the response code, and the response body.
A 200 response with body `Deploy triggered.` means the daemon accepted and
executed the hook.

A 200 with body like `Hook rules were not satisfied.` means the daemon received
the request but the rules did not pass (signature mismatch or wrong branch).

A non-200 from GitHub's perspective means Caddy or the daemon rejected the
connection.

### Rotate the webhook secret

1. Generate a new secret: `openssl rand -hex 32`
2. Update `/etc/default/webhook` on the VPS
3. If using literal secret in `hooks.json`, update that too
4. Restart the daemon: `systemctl restart webhook`
5. Update the secret in GitHub Settings → Webhooks for each repo
6. Test with a redeliver from GitHub's Recent Deliveries UI

### View Docker Compose deployment logs

```bash
docker compose -f /opt/bitacora/bitacora-app-dashboard/docker-compose.yml logs -f app
```

### Check what is running after a deploy

```bash
docker compose -f /opt/bitacora/bitacora-app-dashboard/docker-compose.yml ps
```

---

## Security Model Summary

| Layer | What it provides |
|-------|-----------------|
| GitHub IP allowlist (Caddy) | Blocks non-GitHub sources at the network edge |
| HMAC-SHA256 signature | Proves the payload was signed with your shared secret |
| `ref` filter | Limits execution to master branch pushes only |
| `EnvironmentFile` (600) | Keeps the secret out of world-readable unit files |
| `localhost:9000` binding | Daemon is not exposed directly to the internet |
| Non-root Docker service user | Deploy script runs in a restricted context |

No single layer is sufficient on its own. The IP allowlist can be bypassed by
IP spoofing (hard but not impossible). The HMAC check prevents replay attacks
and unauthorized triggers. The ref filter prevents accidental triggers. Defense
in depth requires all layers.

---

## Related Documentation

- `/Users/primo/Experiments/Repos/bitacora-app-dashboard/DEPLOY_VPS.md` — full
  VPS provisioning guide (Docker, Caddy, secrets, first deploy)
- `/Users/primo/Experiments/Repos/bitacora-app-dashboard/docs/AGENT-FLOW.md` —
  agent dispatch architecture (SSE, orchestrator, worktrees)
- BIT-33 — VPS hardening: NODE_ENV production, Caddy HSTS headers
- GitHub: `https://api.github.com/meta` — authoritative GitHub IP ranges
  (check `hooks` key when updating the Caddy IP allowlist)
