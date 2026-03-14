# Bitacora App Dashboard — Auth, Database & Orchestration Plan

> **Date:** 2026-03-14
> **Status:** Draft — awaiting review
> **Scope:** Add authentication, persistent storage, and lay groundwork for agent orchestration

---

## TL;DR

- **Database:** SQLite via `better-sqlite3` + Drizzle ORM — zero-config, single file on a Docker volume, easy backup. Drizzle allows migration to Postgres later with a config change if needed.
- **Backend:** Express.js server that serves the static React build + API routes. Proxies YouTrack/OpenAI/Anthropic server-side so **API keys never reach the browser**.
- **Auth:** Session-based (not JWT) with `httpOnly` secure cookies, bcrypt-hashed passwords, and a login screen using the existing glass-morphism UI. First launch auto-creates admin account.
- **Data migration:** One-time import from localStorage into SQLite on first login after upgrade.
- **Orchestration (Phase 3):** Job queue for Docker-spawned Claude Code agents, WebSocket live streaming to the dashboard, review queue for agent output before shipping to YouTrack.
- **Implementation:** 10 incremental steps, each independently deployable. Steps 1-10 (auth + DB) are medium effort; step 11 (orchestration) is large.

---

## Current State

- Pure client-side React SPA (Vite + React 19)
- All data in `localStorage` (tokens, CSV, markdown files, AI usage history)
- API keys exposed in browser (YouTrack, Anthropic, OpenAI)
- No backend — proxied API calls via nginx/Vite dev server
- Deployed on Hostinger VPS with Docker + Caddy (auto-TLS)
- Single container: `nginx:stable-alpine` serving static files

---

## Phase 1 — Lightweight Backend + SQLite

### Why SQLite (not Postgres/MySQL)

| Factor | SQLite | Postgres |
|--------|--------|----------|
| Deployment | Zero config, single file | Separate container, connection pool |
| Scale fit | Perfect for 1-10 users | Overkill at this stage |
| Backup | Copy one `.db` file | pg_dump, scheduled jobs |
| Performance | Fast reads, adequate writes | Better concurrent writes |
| Migration path | Easy export to Postgres later via Drizzle ORM | — |
| VPS overhead | ~0 MB RAM | ~100-200 MB RAM |

**Recommendation:** SQLite via [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) with [Drizzle ORM](https://orm.drizzle.team/). Drizzle supports SQLite → Postgres migration if you outgrow it. The DB file lives on a Docker volume so it persists across rebuilds.

### Backend Stack

```
Express.js (minimal API server)
├── better-sqlite3 + Drizzle ORM (database)
├── express-session + connect-sqlite3 (sessions)
├── bcrypt (password hashing)
└── crypto (AES-256-GCM for API key encryption at rest)
```

**Why Express:** Same JS ecosystem, team already knows it, minimal learning curve. No need for Fastify/Hono/NestJS — Express is sufficient for a dashboard backend.

### Database Schema

```sql
-- Users & auth
CREATE TABLE users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT UNIQUE NOT NULL,
  password   TEXT NOT NULL,          -- bcrypt hash
  name       TEXT,
  role       TEXT DEFAULT 'member',  -- 'admin' | 'member'
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Encrypted API credentials (per user)
CREATE TABLE credentials (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  service    TEXT NOT NULL,          -- 'youtrack' | 'anthropic' | 'openai'
  token_enc  TEXT NOT NULL,          -- AES-256-GCM encrypted
  iv         TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_cred_user_svc ON credentials(user_id, service);

-- Markdown documents (replace localStorage)
CREATE TABLE documents (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  name       TEXT NOT NULL,
  path       TEXT,
  content    TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- AI usage tracking
CREATE TABLE ai_usage (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  agent         TEXT NOT NULL,
  provider      TEXT NOT NULL,       -- 'anthropic' | 'openai'
  input_tokens  INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost_usd      REAL DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- QA test cases (replace localStorage CSV)
CREATE TABLE qa_test_cases (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  file_name   TEXT,
  test_id     TEXT NOT NULL,
  category    TEXT,
  test_name   TEXT,
  description TEXT,
  priority    TEXT,
  status      TEXT DEFAULT 'Not Started',
  ferpa_flag  TEXT,
  ticket_id   TEXT,
  ticket_stage TEXT,
  data_json   TEXT,               -- full CSV row as JSON (flexible schema)
  created_at  TEXT DEFAULT (datetime('now'))
);

-- Sessions (managed by connect-sqlite3)
-- Auto-created by the session middleware
```

### API Routes

```
POST   /api/auth/login          { email, password } → session cookie
POST   /api/auth/logout         → clear session
GET    /api/auth/me             → current user info
POST   /api/auth/register       → create user (admin-only or first-user)

GET    /api/credentials         → list services with status (no raw tokens)
PUT    /api/credentials/:svc    → store encrypted token for service
DELETE /api/credentials/:svc    → remove token

GET    /api/documents           → list user's documents
POST   /api/documents           → upload/create document
PUT    /api/documents/:id       → update content
DELETE /api/documents/:id       → remove document

GET    /api/usage               → usage history + aggregates
POST   /api/usage               → record new AI request

GET    /api/qa/cases            → list test cases
POST   /api/qa/import           → import CSV (multipart)
PUT    /api/qa/cases/:id        → update case (status, ticket link)
DELETE /api/qa/cases             → clear all cases

# Proxied (backend adds auth headers so tokens never reach browser)
ANY    /api/yt/*                → YouTrack API (server injects token)
ANY    /api/openai/*            → OpenAI API (server injects key)
POST   /api/anthropic/generate  → Anthropic API call (server-side, returns draft)
```

**Key security improvement:** API keys never leave the server. The browser sends session cookies, the backend reads encrypted tokens from SQLite, decrypts them in memory, and proxies the request.

### Project Structure

```
bitacora-app-dashboard/
├── server/
│   ├── index.js              # Express entry point
│   ├── db.js                 # SQLite connection + Drizzle setup
│   ├── schema.js             # Drizzle schema definitions
│   ├── migrations/           # Drizzle migration files
│   ├── middleware/
│   │   ├── auth.js           # Session check middleware
│   │   └── encrypt.js        # AES encrypt/decrypt helpers
│   ├── routes/
│   │   ├── auth.js           # Login/logout/register
│   │   ├── credentials.js    # Token CRUD
│   │   ├── documents.js      # Markdown docs
│   │   ├── usage.js          # AI usage tracking
│   │   ├── qa.js             # QA test cases
│   │   └── proxy.js          # YouTrack/OpenAI/Anthropic proxy
│   └── seed.js               # Create first admin user
├── src/                      # Existing React frontend (unchanged)
├── data/                     # SQLite DB file (gitignored, Docker volume)
│   └── bitacora.db
├── Dockerfile                # Updated: multi-stage with backend
├── docker-compose.yml        # New: app + volumes
└── ...
```

### Updated Docker Setup

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - bitacora-data:/app/data
    environment:
      - NODE_ENV=production
      - SESSION_SECRET=${SESSION_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}  # 32-byte hex for AES-256
      - YOUTRACK_URL=${YOUTRACK_URL:-https://bitacora.youtrack.cloud}
    restart: unless-stopped

volumes:
  bitacora-data:
```

```dockerfile
# Updated Dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev
RUN mkdir -p /app/data
EXPOSE 8080
CMD ["node", "server/index.js"]
```

The Express server serves the static `dist/` folder AND handles API routes — no need for nginx in the container anymore.

---

## Phase 2 — Authentication Flow

### Login Screen

- Simple email/password form with the existing glass-morphism style
- First launch: auto-redirect to a "Create Admin" setup screen (if `users` table is empty)
- Session cookie (`httpOnly`, `secure`, `sameSite: strict`) — no JWTs needed for a single-domain dashboard
- Session TTL: 7 days, refresh on activity

### Frontend Changes

1. Add `useAuth` hook — checks `/api/auth/me` on mount, redirects to login if 401
2. Add `LoginView.jsx` — email + password form
3. Add `SetupView.jsx` — first-run admin creation
4. Wrap `App.jsx` with auth gate: show login until authenticated
5. Replace all `localStorage` reads/writes with API calls to `/api/*`
6. Remove token/key inputs from Settings modal — credentials managed server-side via a "Connections" panel
7. Remove `VITE_YT_TOKEN`, `VITE_ANTHROPIC_KEY` env vars — no longer needed client-side

### Migration from localStorage

On first login after the update, offer a one-time "Import existing data" option that:
1. Reads localStorage keys (`bitacora-yt-token`, `bitacora-anthropic-key`, etc.)
2. POSTs them to the backend to store encrypted
3. Clears localStorage

---

## Phase 3 — Agent Orchestration (Future)

Once auth and DB are in place, the backend becomes the orchestration hub.

### Architecture

```
┌─────────────────────────────────────────────┐
│  Bitacora Dashboard (React)                  │
│  - Agent control panel                       │
│  - Live status feeds                         │
│  - Result review & approval                  │
└──────────────┬──────────────────────────────┘
               │ WebSocket / SSE
┌──────────────▼──────────────────────────────┐
│  Express Backend (Orchestrator)              │
│  - Job queue (BullMQ + SQLite or Redis)      │
│  - Agent spawner (child_process / Docker)    │
│  - Result collector                          │
│  - WebSocket hub for live updates            │
└──────────────┬──────────────────────────────┘
               │ spawn / docker exec
    ┌──────────┼──────────┐
    ▼          ▼          ▼
  ┌─────┐  ┌─────┐  ┌─────┐
  │ PM  │  │ iOS │  │ QA  │   Agent containers
  │Agent│  │Agent│  │Agent│   (Claude Code CLI)
  └─────┘  └─────┘  └─────┘
```

### Orchestration Database Additions

```sql
-- Agent job queue
CREATE TABLE agent_jobs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  agent_type  TEXT NOT NULL,        -- 'pm' | 'ios' | 'qa' | 'security'
  status      TEXT DEFAULT 'queued', -- 'queued' | 'running' | 'done' | 'failed'
  input_json  TEXT NOT NULL,
  result_json TEXT,
  ticket_id   TEXT,                  -- linked YouTrack ticket
  started_at  TEXT,
  finished_at TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- Agent execution logs
CREATE TABLE agent_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id     INTEGER NOT NULL REFERENCES agent_jobs(id),
  level      TEXT DEFAULT 'info',   -- 'info' | 'warn' | 'error'
  message    TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### Orchestration Features (future scope)

1. **Job queue** — Queue agent tasks from the dashboard, backend spawns Claude Code CLI in Docker containers
2. **Live streaming** — WebSocket/SSE pushes agent stdout to the dashboard in real-time
3. **Result review** — Agent output lands in a review queue; user approves before it ships to YouTrack
4. **Context bundles** — Backend assembles the agent prompt (ticket + relevant iOS files + QA cases) and injects it
5. **Scheduling** — Cron-based QA runs (nightly regression, pre-release sweeps)
6. **Cost controls** — Per-agent spend limits enforced server-side before spawning

### When to Upgrade from SQLite

Move to Postgres when any of these become true:
- Multiple VPS instances (horizontal scaling)
- >50 concurrent users
- Need for full-text search beyond `LIKE` queries
- Agent jobs need row-level locking for concurrent workers

Drizzle ORM makes this a config change, not a rewrite.

---

## Implementation Order

| Step | What | Effort |
|------|------|--------|
| 1 | Add Express server, serve static `dist/` | Small |
| 2 | Set up SQLite + Drizzle, run migrations | Small |
| 3 | Auth routes (login/logout/register) + session middleware | Medium |
| 4 | Login/Setup views in React + `useAuth` hook | Medium |
| 5 | Credentials API (encrypted storage) + server-side proxy | Medium |
| 6 | Documents API (replace localStorage markdown) | Small |
| 7 | AI usage API (replace localStorage tracking) | Small |
| 8 | QA test cases API (replace localStorage CSV) | Small |
| 9 | Update Dockerfile + docker-compose | Small |
| 10 | localStorage migration flow | Small |
| 11 | Agent orchestration (Phase 3) | Large |

Steps 1-10 can be done incrementally — each step is independently deployable.

---

## Security Checklist

- [ ] API keys encrypted at rest (AES-256-GCM)
- [ ] Session cookies: `httpOnly`, `secure`, `sameSite: strict`
- [ ] CSRF protection (same-site cookies + origin check)
- [ ] Rate limiting on `/api/auth/login` (prevent brute force)
- [ ] Input validation on all API routes
- [ ] SQLite DB file on a Docker volume (not in image)
- [ ] `SESSION_SECRET` and `ENCRYPTION_KEY` in env vars (not committed)
- [ ] Helmet.js for security headers
- [ ] No API keys in browser network tab — all proxied server-side
