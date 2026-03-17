# Bitacora App Dashboard

A full-stack operations dashboard for **Bitacora**, a bilingual (EN/ES) iOS app for student behavioral incident reporting in US and Mexico schools.

Manage YouTrack tickets through an agent-based workflow, track AI spend across Anthropic and OpenAI, import QA test cases, and read Markdown docs — all behind session-based authentication with encrypted credential storage.

## Features

### Authentication & Security
- **Session-based auth** — login, self-signup for engineers, first-run admin setup
- **Encrypted credentials** — API keys stored with AES-256-GCM, proxied server-side (never reach the browser)
- **Rate limiting** — brute-force protection on login and registration endpoints
- **Pre-commit secret scanning** — prevents accidental credential commits

### Ticket Management
- **Full CRUD** — create, read, update, and delete YouTrack tickets from a single board view
- **Inline Stage & Priority** — update ticket workflow (Backlog → Develop → Review → Test → Staging → Done) directly from the board
- **Ticket detail view** — editable summary/description, comment thread synced with YouTrack
- **Copy JSON** — export any ticket as JSON for agent handoff

### AI-Powered Generation
- **AI Generate** — Claude-powered ticket creation with structured output (summary, description, compliance flags, effort estimate)
- **Template Generate** — structured ticket templates per agent — no API key required
- **8 Specialized Agents** — PM, iOS Sr. Developer, UX/UI, QA, Data, Security, GTM, Customer Success
- **Smart Priority Mapping** — AI-generated values like "High" automatically mapped to valid Bitacora priorities

### QA Test Case Tracker
- **CSV import** — drag-and-drop or file picker, persisted in SQLite
- **Filterable table** — pill/chip filters by category, priority, status
- **Ticket integration** — create YouTrack bugs from test cases, track ticket state per row
- **Context bundles** — one-click clipboard handoff of scoped agent prompts

### Markdown Reader
- **Two-panel viewer** — file sidebar + rendered content with custom heading anchors, tables, task lists, code blocks
- **Multi-file support** — import multiple .md files, persisted across sessions

### AI Usage & Cost Tracking
- **Anthropic** — credit balance card, per-request token/cost tracking, budget alerts
- **OpenAI** — costs API integration via Admin key, model breakdown, daily usage charts
- **Combined dashboard** — cross-platform spend visibility

### UI
- **Cosmic glass-morphism** — translucent cards with backdrop blur, nebula background
- **Light / Dark mode** — lavender-slate light theme, cosmic dark theme
- **Responsive design** — optimized for iPhone 16 (393px) through desktop
- **FERPA / LFPDPPP compliance badges** — hover tooltips with official documentation links

## Quick Start

### Development (Vite dev server)

```bash
git clone https://github.com/jcprimo/bitacora-app-dashboard.git
cd bitacora-app-dashboard

cp .env.example .env
# Edit .env — set ENCRYPTION_KEY (run: openssl rand -hex 32)

npm install
npm run dev
# → http://localhost:5173 (frontend only, no auth)
```

### Production (Express + SQLite)

```bash
cp .env.example .env
# Set SESSION_SECRET and ENCRYPTION_KEY in .env

npm install
npm run build
npm start
# → http://localhost:8080 (full stack with auth)
```

### Docker Compose (recommended for deploy)

```bash
cp .env.example .env
# Set SESSION_SECRET and ENCRYPTION_KEY

docker compose up -d --build
# → http://localhost:8080
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | Yes (prod) | Random string for signing session cookies |
| `ENCRYPTION_KEY` | Yes (prod) | 64-char hex string for AES-256-GCM credential encryption |
| `YOUTRACK_URL` | No | YouTrack instance URL (default: `https://bitacora.youtrack.cloud`) |
| `PORT` | No | Server port (default: `8080`) |

Generate secrets:
```bash
openssl rand -base64 32   # SESSION_SECRET
openssl rand -hex 32      # ENCRYPTION_KEY
```

API keys (YouTrack, Anthropic, OpenAI) are configured in the dashboard UI after login — not in environment variables.

## Project Structure

```
server/                            # Express backend
├── index.js                       # Entry point, migrations, route mounting
├── db.js                          # SQLite connection (WAL mode, foreign keys)
├── schema.js                      # Drizzle ORM schema (7 tables)
├── middleware/
│   ├── auth.js                    # Session auth guards (requireAuth, requireAdmin)
│   ├── encrypt.js                 # AES-256-GCM encrypt/decrypt for credentials
│   └── rateLimiter.js             # In-memory sliding-window rate limiter
└── routes/
    ├── auth.js                    # Login, logout, register, setup-status
    ├── credentials.js             # Encrypted token CRUD + getUserToken()
    ├── documents.js               # Markdown document CRUD
    ├── usage.js                   # AI usage tracking + aggregates
    ├── qa.js                      # QA test case import/CRUD
    └── proxy.js                   # Server-side proxy (YouTrack, OpenAI, Anthropic)

src/                               # React frontend
├── App.jsx                        # Auth gate + Dashboard shell
├── App.css                        # Component styles (login, layout, responsive)
├── index.css                      # CSS variables, themes, animations
├── hooks/
│   ├── useAuth.js                 # Session lifecycle (login, logout, register)
│   ├── useBoard.js                # Issue list fetching & filtering
│   ├── useCreateTicket.js         # 3-step creation: AI / Template / Manual
│   ├── useIssueDetail.js          # Issue editing, comments, delete
│   ├── useQATracker.js            # CSV import, filtering, ticket CRUD
│   ├── useMarkdownReader.js       # MD file import, lazy content loading
│   ├── useAnthropicUsage.js       # Anthropic spend tracking
│   ├── useOpenAIUsage.js          # OpenAI costs API integration
│   ├── useSettings.js             # Runtime credential management
│   ├── useTheme.js                # Light/dark mode toggle
│   └── useToast.js                # Toast notifications
├── views/
│   ├── LoginView.jsx              # Login, signup, first-run admin setup
│   ├── BoardView.jsx              # Issue list with filter & inline updates
│   ├── CreateView.jsx             # Agent sidebar + 3-step wizard
│   ├── DetailView.jsx             # Issue editor + comment thread
│   ├── QATrackerView.jsx          # QA test case table
│   ├── MarkdownView.jsx           # Two-panel markdown reader
│   └── UsageView.jsx              # AI spend dashboard
├── components/
│   ├── Header.jsx                 # Title, badges, user menu, theme toggle
│   ├── SettingsModal.jsx          # Credential editor with show/hide toggle
│   └── Toast.jsx                  # Notification banner
├── youtrack.js                    # YouTrack REST API service
└── openai.js                      # OpenAI Costs API service

scripts/
├── run-bitacora.sh                # First-time deploy (preflight checks + build)
├── restart-bitacora.sh            # Quick redeploy (pull + rebuild)
└── scan-secrets.sh                # Pre-commit secret detection

data/                              # SQLite database (gitignored, Docker volume)
docker-compose.yml                 # App + persistent data volume
Dockerfile                         # Multi-stage: Node 22 build → Node 22 runtime
drizzle.config.js                  # Drizzle Kit migration config
```

## Architecture

- **Backend:** Express.js serves the React SPA and all API routes. SQLite via better-sqlite3 + Drizzle ORM.
- **Auth:** Session-based with bcrypt passwords, httpOnly cookies (7-day TTL), connect-sqlite3 session store.
- **Credential security:** API keys encrypted with AES-256-GCM at rest. The Express server decrypts and injects them into proxied API calls — the browser never sees raw keys.
- **Frontend:** React 19 + Vite 8. CSS-only theming (no Tailwind). All state in custom hooks, no context providers or state libraries.
- **Deploy:** Docker Compose with a persistent volume for the SQLite DB. Caddy for auto-TLS reverse proxy.

## Deploy

See [DEPLOY_VPS.md](DEPLOY_VPS.md) for the full VPS deployment guide.

```bash
# First deploy
./scripts/run-bitacora.sh

# Subsequent updates
./scripts/restart-bitacora.sh
```

## Testing

```bash
# Unit tests
npm test

# Auth flow (see TESTING_AUTH.md for full checklist)
npm run build && npm start
# → http://localhost:8080
```

See [TESTING_AUTH.md](TESTING_AUTH.md) for the complete auth testing plan.

## Tech Stack

- **React 19** + **Vite 8** — frontend
- **Express 5** + **better-sqlite3** + **Drizzle ORM** — backend
- **Anthropic Claude API** — AI ticket generation
- **OpenAI Admin API** — usage tracking
- **YouTrack REST API** — issue management
- **Docker Compose** — containerized deployment
- **Caddy** — auto-TLS reverse proxy

## Authors

Built collaboratively by:

- **Primo** ([@jcprimo](https://github.com/jcprimo)) — Product vision, architecture, and engineering
- **Claude** ([Anthropic](https://anthropic.com)) — AI pair programmer (Claude Opus 4.6)

## License

MIT
