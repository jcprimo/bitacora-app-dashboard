# Bitacora YouTrack Integration

A purpose-built YouTrack integration tool for **Bitacora**, a bilingual (EN/ES) iOS app for student behavioral incident reporting in US and Mexico schools.

Manage YouTrack tickets through an agent-based workflow with AI-assisted or template-based generation, inline stage/priority updates, real-time AI spend tracking, and dual FERPA + LFPDPPP compliance awareness.

## Features

### Ticket Management
- **Full CRUD** — Create, read, update, and delete YouTrack tickets from a single board view
- **Inline Stage & Priority** — Update ticket workflow (Backlog → Develop → Review → Test → Staging → Done) and priority directly from the board
- **Copy JSON** — Export any ticket as JSON for agent handoff

### AI-Powered Generation
- **AI Generate** — Claude-powered ticket creation with structured output (summary, description, compliance flags, effort estimate)
- **Template Generate** — Structured ticket templates per agent — no API key required
- **8 Specialized Agents** — PM, iOS Sr. Developer, UX/UI, QA, Data, Security, GTM, Customer Success — each with tailored system prompts and templates
- **Smart Priority Mapping** — AI-generated values like "High" or "Medium" are automatically mapped to valid Bitacora priorities

### AI Usage & Cost Tracking
- **Credit Balance Card** — Set your Anthropic balance and watch remaining credits in real-time
- **Per-Request Tracking** — Every AI Generate call logs input/output tokens and cost
- **Budget Alerts** — Set a monthly spend limit with visual progress bar (green → amber → red)
- **Request History** — Full table with timestamp, agent, tokens, and cost per request
- **OpenAI Integration** — Optional OpenAI costs/usage tracking via Admin API for cross-platform spend visibility

### Compliance & UX
- **Dual Compliance** — FERPA (US) and LFPDPPP (Mexico) risk flagging built into every agent prompt
- **Compliance Tooltips** — Hover over FERPA/LFPDPPP badges for full descriptions and official links
- **Light / Dark Mode** — Toggle with theme persistence
- **Runtime Settings** — Update YouTrack token and Anthropic API key from the UI without restarting
- **Token Estimates** — See estimated token usage and cost before generating

## Quick Start

```bash
# 1. Clone
git clone https://github.com/jcprimo/bitacora-youtrack.git
cd bitacora-youtrack

# 2. Configure
cp .env.example .env
# Edit .env with your YouTrack token and (optionally) Anthropic API key

# 3. Install & run
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_YT_URL` | Yes | YouTrack instance URL (e.g. `https://your-instance.youtrack.cloud`) |
| `VITE_YT_TOKEN` | Yes | YouTrack permanent token ([how to generate](https://www.jetbrains.com/help/youtrack/server/Manage-Permanent-Token.html)) |
| `VITE_YT_PROJECT_ID` | Yes | YouTrack project ID (e.g. `0-1`) |
| `VITE_ANTHROPIC_KEY` | No | Anthropic API key for AI-assisted ticket generation |
| `VITE_OPENAI_KEY` | No | OpenAI Admin API key (`sk-admin-*`) for usage/cost tracking |

Credentials can also be set at runtime via the **BIT Connected** badge in the header — no restart required.

## Docker

```bash
# Build
docker build -t bitacora-youtrack .

# Run
docker run -p 8080:8080 \
  -e YOUTRACK_URL=https://your-instance.youtrack.cloud \
  bitacora-youtrack
```

Open [http://localhost:8080](http://localhost:8080).

The Docker image uses a multi-stage build (Node 22 → nginx Alpine) and proxies `/yt-api` and `/openai-api` through nginx so the browser never hits CORS.

## Project Structure

```
src/
├── App.jsx                        # App shell — hooks, nav, view router (~210 lines)
├── App.css                        # Component styles (light + dark mode)
├── index.css                      # CSS variables, theme definitions, animations
├── main.jsx                       # React entry point
│
├── constants/
│   ├── agents.js                  # 8-agent team definitions (id, icon, color, priority)
│   ├── prompts.js                 # System prompts, placeholders, Markdown templates
│   └── pricing.js                 # Token estimation & cost calculation helpers
│
├── hooks/
│   ├── useToast.js                # Toast notification state (auto-dismiss 3.5s)
│   ├── useTheme.js                # Light/dark mode with localStorage persistence
│   ├── useSettings.js             # Runtime credential management (modal state)
│   ├── useBoard.js                # Issue list fetching & filtering
│   ├── useCreateTicket.js         # 3-step creation: AI Generate / Template / Manual
│   ├── useIssueDetail.js          # Issue editing, inline field updates, delete
│   ├── useAnthropicUsage.js       # Client-side Anthropic spend tracker (localStorage)
│   └── useOpenAIUsage.js          # OpenAI Costs API integration (Admin key required)
│
├── views/
│   ├── BoardView.jsx              # Issue list with filter bar & inline stage updates
│   ├── CreateView.jsx             # Agent sidebar + 3-step wizard (Input → Review → Done)
│   ├── UsageView.jsx              # AI spend dashboard (Anthropic + OpenAI tabs)
│   └── DetailView.jsx             # Single issue editor with delete confirmation
│
├── components/
│   ├── Toast.jsx                  # Fixed-position notification banner
│   ├── Header.jsx                 # App title, compliance badges, connection status
│   └── SettingsModal.jsx          # Overlay for editing credentials at runtime
│
├── youtrack.js                    # YouTrack REST API service (CRUD, custom fields)
├── openai.js                      # OpenAI Costs & Usage API service
├── youtrack.test.js               # Unit tests (node:test)
└── youtrack.e2e.test.js           # E2E tests (against real YouTrack)

public/
└── favicon.svg

Dockerfile                         # Multi-stage build (Node 22 → nginx Alpine)
nginx.conf                         # Production reverse proxy (/yt-api, /openai-api)
vite.config.js                     # Dev server + API proxy config
.env.example                       # Template for environment variables
package.json
```

### Architecture Notes

- **App.jsx** is a thin shell (~210 lines) — all business logic lives in custom hooks, all UI lives in views/components.
- **State ownership**: each hook owns its slice of state. App.jsx composes them and passes data down via props. No context providers or global state libraries.
- **API proxying**: in development, Vite proxies `/yt-api` → YouTrack and `/openai-api` → OpenAI. In production, nginx handles the same routes. The Anthropic API is called directly from the browser (no proxy) using the `anthropic-dangerous-direct-browser-access` header.
- **localStorage keys**: `bitacora-yt-token`, `bitacora-anthropic-key`, `bitacora-openai-key`, `bitacora-ai-usage`, `bitacora-openai-usage`, `bitacora-theme`.
- **Theming**: CSS-only via `:root` (dark default) and `[data-theme="light"]` selectors in `index.css`. No JS theme library.

## Testing

```bash
# Unit tests
npm test

# E2E tests (against a real YouTrack instance)
YOUTRACK_E2E=1 YOUTRACK_TOKEN=your-token npm test
```

## Tech Stack

- **React 19** + **Vite 8** — Frontend
- **Anthropic Claude API** (claude-sonnet-4-20250514) — AI ticket generation
- **OpenAI Admin API** — Optional cross-platform usage tracking
- **YouTrack REST API** — Issue management
- **nginx** — Production reverse proxy
- **Docker** — Containerized deployment

## Authors

Built collaboratively by:

- **Primo** ([@jcprimo](https://github.com/jcprimo)) — Product vision, architecture, and engineering
- **Claude** ([Anthropic](https://anthropic.com)) — AI pair programmer (Claude Opus 4.6)

## License

MIT
