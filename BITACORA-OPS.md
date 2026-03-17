# BITACORA-OPS.md — Autonomous AI Team Operations System

**Ticket:** BIT-21
**Date:** 2026-03-14
**Author:** JC Primo (Founder/Architect) + Claude (Pair Programmer)
**Status:** PLANNING — Pending founder decisions before Phase 0

---

## TL;DR — What This System Does

### The Problem

Right now, every agent on the Bitácora team (security-compliance, customer-success, qa-testing, etc.) runs only when you manually open Claude Code and invoke them. If a crash happens at 2am, nobody knows until you check. If a 1-star App Store review drops, it sits unanswered for days. If a PR touches FERPA-sensitive code, nobody flags it unless you remember to ask. You are the bottleneck for every operational task.

### The Solution

We build a lightweight **orchestrator** — a small Node.js service running on a Hostinger VPS — that listens for events (crashes, App Store reviews, GitHub PRs, support tickets) and automatically spawns the right Claude Code agent with the right prompt. The agent does its work, and the result gets posted to Slack. You only get pinged when something actually needs your attention.

Think of it as a dispatcher: events come in, the dispatcher decides which agent should handle it, runs that agent, and sends you the outcome on Slack. If the agent says "this is fine, no action needed," you see a quiet log entry. If the agent says "FERPA risk detected — human review required," your phone buzzes.

### What It Looks Like Day-to-Day

| What Happens | What You See |
|---|---|
| App crashes for 3 users | Slack: "security-compliance assessed crash #4521 — no PII exposure, low severity. Stack trace points to AudioRecorderView line 142." |
| 1-star App Store review in Spanish | Slack: "customer-success drafted response (ES). Review: 'La app se cierra al grabar.' Draft: '...' — approve or edit before posting." |
| PR opened touching `Report.swift` | GitHub PR comment: "qa-testing generated test checklist: ✅ sync fields, ✅ severity validation, ⚠️ missing offline test case." |
| Monday morning | Slack: "product-manager weekly digest: 3 PRs merged, 2 open issues, App Store rating 4.6 (+0.1), 12 new downloads." |
| Nothing unusual happens | Nothing. You hear nothing. That's the point. |

### The Golden Rule

**Every agent output is advisory.** No agent auto-publishes App Store responses, merges PRs, commits code, or modifies production data. Everything goes through Slack for your approval first. You always have the final say.

---

## 1. Full Cost Breakdown

### Monthly Operating Costs

| Service | Plan | Monthly Cost | What You Get | Notes |
|---|---|---|---|---|
| **Hostinger VPS** | KVM 2 | **$6.99/mo** | 2 vCPU, 8GB RAM, 100GB NVMe, 8TB bandwidth | 24-month term. Entry plan ($4.99, 1 vCPU, 4GB RAM) works too but tight for Claude CLI |
| **Claude Code** | Max 5x | **$100/mo** | 5x Pro usage capacity for CLI automation | Pro ($20/mo) may work initially but will throttle with multiple daily agent runs |
| **Slack** | Free | **$0** | Unlimited users, 90-day message history, 3 app integrations | Sufficient for MVP. See Slack section below |
| **Sentry** | Developer (Free) | **$0** | 5K errors/month, 1 user, performance monitoring | Recommended over Crashlytics. See comparison below |
| **Domain** (optional) | ops.bitacora.app | **~$1/mo** | Subdomain for webhook endpoints | Can use VPS IP directly instead |
| **App Store Connect API** | Free | **$0** | Review/rating/download data | Included with Apple Developer Program |

### Monthly Total

| Scenario | Cost |
|---|---|
| **Lean start** (Hostinger entry + Claude Pro + free everything) | **~$25/mo** |
| **Recommended** (Hostinger KVM 2 + Claude Max 5x + free everything) | **~$107/mo** |
| **Growth** (same + Slack Pro + Sentry Team) | **~$140/mo** |

### Cost Control — Hard Caps on Claude Usage

Even with Max 5x subscription, runaway agent loops can burn through usage. The orchestrator enforces:

| Control | Limit | What Happens When Hit |
|---|---|---|
| Per-invocation budget | `--max-turns` on each `claude` call | Agent stops, partial result posted to Slack |
| Per-agent cooldown | 5 minutes minimum between runs | Event queued, processed after cooldown |
| Event deduplication | Same event payload ignored for 1 hour | Prevents storm of identical alerts |
| Process timeout | 120 seconds per agent run | Process killed, timeout alert to Slack |
| Kill switch | `/bitacora pause` Slack command | All agent processing halted immediately |

### One-Time Setup Costs

| Item | Cost | Notes |
|---|---|---|
| Apple Developer Program | $99/year (already paid) | Needed for App Store Connect API |
| Domain registration | ~$12/year | If not using existing domain |
| VPS setup time | Your time | ~4-6 hours for Phase 0 |

---

## 2. Slack — Free Plan Setup Guide

### Can You Use the Free Plan? Yes.

Slack's free plan is sufficient for the Bitácora ops system. Here's what you get and what you don't:

| Feature | Free Plan | Pro ($7.25/user/mo) |
|---|---|---|
| Message history | **90 days** | Unlimited |
| App integrations | **3 apps** | 10 apps |
| Channels | Unlimited | Unlimited |
| Users | Unlimited | Unlimited |
| Huddles | 1-on-1 only | Group |
| File storage | 5 GB total | 10 GB/user |
| Workflows | Basic | Advanced |

### The 3-App Limit — How We Work Around It

The free plan allows only 3 app integrations. Our orchestrator needs to post to Slack, but it does this via a **single custom Slack App** (counts as 1 integration) that handles everything:

1. **Incoming messages** — Our orchestrator posts agent results via the Slack Web API (one bot, multiple channels)
2. **Slash commands** — `/bitacora run`, `/bitacora pause`, `/bitacora status` all go through the same app
3. **No other apps needed** — We don't need Sentry→Slack or GitHub→Slack integrations because our orchestrator IS the integration layer

That leaves 2 app slots free for anything else you want (e.g., Google Calendar, Notion).

### The 90-Day History Limit — Is It a Problem?

No. The orchestrator keeps its own run log in SQLite. Slack is just the notification layer, not the source of truth. If you need to look at an agent run from 4 months ago, query the SQLite database or check the admin dashboard.

### Setup Instructions

**Step 1: Create the Workspace**

1. Go to [slack.com/create](https://slack.com/get-started#/createnew)
2. Sign up with your email
3. Name it: `bitacora-team` (or whatever you prefer)
4. Skip inviting others for now

**Step 2: Create Channels**

Create these channels (all private):

| Channel | Purpose |
|---|---|
| `#ops-alerts` | Critical/high alerts that need your attention |
| `#ops-reports` | Weekly digests, KPI reports, routine outputs |
| `#ops-log` | All agent runs (low-noise, for audit trail) |

**Step 3: Create the Slack App**

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App** → **From scratch**
3. Name: `Bitácora Ops Bot`
4. Workspace: Select your workspace
5. Under **OAuth & Permissions**, add these Bot Token Scopes:
   - `chat:write` — Post messages
   - `chat:write.public` — Post to channels without joining
   - `commands` — Handle slash commands
   - `incoming-webhook` — Send webhook messages
6. **Install to Workspace** and copy the **Bot User OAuth Token** (starts with `xoxb-`)
7. Save this token — it goes in the VPS `.env` file

**Step 4: Create Slash Commands**

Under **Slash Commands**, add:

| Command | Request URL | Description |
|---|---|---|
| `/bitacora` | `https://ops.bitacora.app/slack/commands` | Run agents, check status, pause/resume |

Usage examples:
- `/bitacora run security-compliance "Audit the OpenAI data flow for FERPA compliance"`
- `/bitacora run customer-success "Draft response for this review: [paste review]"`
- `/bitacora chat engineer-mentor "Why does Bitácora use SwiftData instead of Core Data?"`
- `/bitacora chat ux-ui-designer "Evaluate our student card layout for the Android version"`
- `/bitacora status` — Show today's agent runs and cost
- `/bitacora pause` — Stop all automated runs
- `/bitacora resume` — Resume automated runs

**`run` vs `chat` — what's the difference?**
- `/bitacora run` — Fire-and-forget. Agent runs, posts result, done. For automated agents.
- `/bitacora chat` — Opens a **threaded conversation** in Slack. You can reply in the thread to continue the discussion. The agent maintains context within the thread. For conversational agents (engineer-mentor, ux-ui-designer).

**Step 5: Enable Event Subscriptions (Optional, Phase 3)**

Only needed if you want Slack-triggered workflows later. Skip for now.

### When to Upgrade to Pro

Upgrade when any of these become true:
- You want message history beyond 90 days in Slack itself
- You need more than 3 app integrations
- You add team members who need group huddles

**Estimated upgrade trigger: when you hire your first employee or contractor.**

---

## 3. Crash Reporting — Sentry vs Firebase Crashlytics

### Recommendation: Sentry (Free Developer Plan)

For our event-driven architecture, **Sentry is the clear winner** because of its webhook support. Here's the full comparison:

### Head-to-Head Comparison

| Criteria | Sentry | Firebase Crashlytics |
|---|---|---|
| **Price** | Free (5K errors/mo, 1 user) | Free (unlimited, no caps) |
| **Webhook support** | ✅ Native — fires on new issue, regression, threshold | ❌ No webhooks. Requires Cloud Functions workaround |
| **Platform coverage** | iOS + Web + Backend (all in one) | iOS + Android only |
| **Error context** | Full stack trace + breadcrumbs + user context + tags | Stack trace + device info + logs |
| **Performance monitoring** | ✅ Included in free tier (10K transactions/mo) | ❌ Separate Firebase Performance product |
| **Custom alerts** | ✅ Threshold-based (error rate > X in Y minutes) | ⚠️ Basic (only "new issue" and "regressed issue") |
| **API** | ✅ Full REST API for querying issues, stats | ⚠️ Limited — mostly through Firebase console |
| **Web dashboard** | Full-featured, filterable, searchable | Firebase Console (shared with all Firebase services) |
| **Data export** | ✅ CSV, API, Discover queries | ❌ No export |
| **iOS setup** | `sentry-cocoa` SPM package | `firebase-ios-sdk` SPM package |
| **Dependencies pulled in** | Sentry SDK only (~2 MB) | Firebase Core + Crashlytics (~5-8 MB) |
| **Self-hosted option** | ✅ Yes (Docker) | ❌ No |

### Why Sentry Wins for Bitácora Ops

**1. Webhooks are non-negotiable.**
Our entire system is event-driven. When a crash happens, we need a webhook to hit the orchestrator, which spawns the security-compliance agent. Sentry fires webhooks natively. Crashlytics does not — you'd need to set up Firebase Cloud Functions as a middleman, adding complexity, another GCP dependency, and another thing to monitor.

**2. Covers both iOS and the web admin dashboard.**
Sentry monitors your iOS app AND the React admin webapp with one account, one dashboard, one webhook configuration. Crashlytics only covers mobile.

**3. Custom alert rules match our threshold system.**
Sentry lets you define: "Alert me if error rate exceeds 10 errors in 5 minutes" or "Alert me if this specific issue regresses after being resolved." This maps directly to our orchestrator's event evaluator.

**4. Free tier is more than enough.**
5,000 errors/month is generous for an app at Bitácora's stage. If you're hitting 5K errors/month, you have bigger problems than monitoring costs.

### Where Crashlytics Wins (And Why It Doesn't Matter Here)

| Crashlytics Advantage | Why It's Irrelevant for Us |
|---|---|
| Completely free, no error cap | 5K errors/month is more than enough at our scale |
| Deeper Apple crash symbolication | Sentry's symbolication is also excellent with dSYM upload |
| Firebase ecosystem (Analytics, Remote Config) | We use Supabase, not Firebase — no ecosystem benefit |
| Zero-config Google sign-in | We use Supabase Auth |

### Sentry Setup (Quick Reference)

1. Create account at [sentry.io](https://sentry.io) → Free Developer plan
2. Create project: **Platform → Apple → iOS**
3. Add to Xcode via SPM: `https://github.com/getsentry/sentry-cocoa`
4. Initialize in `App.swift`:
   ```swift
   import Sentry

   SentrySDK.start { options in
       options.dsn = "https://your-dsn@sentry.io/project-id"
       options.tracesSampleRate = 0.2  // 20% of transactions for performance
       options.enableAutoSessionTracking = true
   }
   ```
5. Create webhook: **Settings → Integrations → Webhooks** → point to `https://ops.bitacora.app/webhooks/sentry`
6. Create alert rule: **Alerts → Create Alert → Issue Alert** → "When a new issue is created, send a webhook"

### Second Sentry Project (For Admin Webapp)

Same account, new project: **Platform → Browser → React**. Same webhook endpoint. The orchestrator distinguishes by project slug in the payload.

---

## 4. Phase 0 — What Gets Built (Week 1-2)

Phase 0 is the foundation. At the end of this phase, you will be able to type `/bitacora run security-compliance "Audit the OpenAI data flow"` in Slack and get back a real agent response. Nothing else is automated yet — this is the plumbing.

### Phase 0 Deliverables — Specific

| # | Deliverable | Description | Done When |
|---|---|---|---|
| 1 | **VPS provisioned** | Hostinger KVM 2 running Ubuntu 22.04, SSH-hardened, firewall configured | You can SSH in with key-only auth |
| 2 | **Claude CLI installed** | `claude` command works on VPS, authenticated with your account | `claude -p "hello" --print` returns a response |
| 3 | **iOS repo cloned** | Read-only clone of `student-reports-ios` on VPS so agents have codebase context | Agents can read `.claude/agents/` definitions |
| 4 | **Orchestrator skeleton running** | Express server with health check endpoint, behind Caddy reverse proxy with TLS | `curl https://ops.bitacora.app/health` returns `200 OK` |
| 5 | **SQLite run log** | Database storing every agent invocation: agent, trigger, prompt, output, cost, duration, timestamp | Can query `SELECT * FROM runs` |
| 6 | **Slack bot connected** | Bot posts to `#ops-log` channel on startup | You see "Bitácora Ops online" message in Slack |
| 7 | **Slash command working** | `/bitacora run <agent> <prompt>` spawns Claude CLI, returns result to Slack | Full round-trip: Slack → VPS → Claude → Slack |
| 8 | **Cost controls active** | Per-invocation budget, agent cooldowns, process timeout, kill switch | `/bitacora pause` stops processing; timeout kills long runs |
| 9 | **VPS setup script** | Idempotent `setup-vps.sh` that can rebuild the server from scratch | Run twice with same result |

### Phase 0 — Files We Build

```
bitacora-ops/                              # New repo
├── package.json                           # Node.js project with TypeScript
├── tsconfig.json
├── .env.example                           # Template (never commit real .env)
├── .gitignore                             # node_modules, .env, *.db
├── src/
│   ├── index.ts                           # Express server entry point
│   │                                      #   - Loads config
│   │                                      #   - Mounts routes
│   │                                      #   - Starts Caddy health check
│   │
│   ├── config/
│   │   └── agents.ts                      # Agent registry
│   │                                      #   - Maps agent names to:
│   │                                      #     model (haiku/sonnet/opus)
│   │                                      #     max turns per invocation
│   │                                      #     cooldown (seconds)
│   │                                      #     channels to post results to
│   │
│   ├── routes/
│   │   ├── health.ts                      # GET /health → 200 OK + uptime
│   │   ├── slack.ts                       # POST /slack/commands
│   │   │                                  #   - Verifies Slack signing secret
│   │   │                                  #   - Parses: /bitacora run <agent> <prompt>
│   │   │                                  #   - Parses: /bitacora chat <agent> <prompt>
│   │   │                                  #   - Parses: /bitacora status
│   │   │                                  #   - Parses: /bitacora pause / resume
│   │   │                                  #   - Responds with acknowledgment (200 within 3s)
│   │   │                                  #   - Spawns agent in background
│   │   └── slack-threads.ts               # POST /slack/events (Event Subscriptions)
│   │                                      #   - Listens for thread replies in chat conversations
│   │                                      #   - Maps thread_ts → active agent session
│   │                                      #   - Forwards reply as follow-up prompt to agent
│   │                                      #   - Posts agent response back to same thread
│   │
│   ├── services/
│   │   ├── agent-runner.ts                # Core: spawns `claude` CLI as child process
│   │   │                                  #   - Builds CLI args: -p, --agent, --print, --max-turns
│   │   │                                  #   - Sets cwd to iOS repo path
│   │   │                                  #   - Captures stdout/stderr
│   │   │                                  #   - Enforces timeout (kills after 120s)
│   │   │                                  #   - Returns { output, duration, exitCode }
│   │   │
│   │   ├── slack-notifier.ts              # Posts messages to Slack channels
│   │   │                                  #   - formatAgentResult() → Slack Block Kit message
│   │   │                                  #   - postToChannel(channel, blocks)
│   │   │                                  #   - Severity-based routing:
│   │   │                                  #     Critical → #ops-alerts
│   │   │                                  #     Routine → #ops-log
│   │   │
│   │   ├── run-logger.ts                  # SQLite insert/query wrapper
│   │   │                                  #   - logRun(agent, trigger, prompt, output, cost, duration)
│   │   │                                  #   - getRuns(filters) for status queries
│   │   │                                  #   - getDailyCost() for budget checks
│   │   │
│   │   ├── rate-limiter.ts                # Per-agent cooldown + kill switch
│   │   │                                  #   - In-memory Map<agent, lastRunTimestamp>
│   │   │                                  #   - canRun(agent): boolean
│   │   │                                  #   - globalPaused: boolean (toggled by /bitacora pause)
│   │   │
│   │   └── thread-manager.ts             # Manages conversational agent sessions
│   │                                      #   - Maps Slack thread_ts → { agent, sessionId, lastActivity }
│   │                                      #   - startSession(agent, thread_ts): creates session
│   │                                      #   - continueSession(thread_ts, message): appends to prompt
│   │                                      #   - Sessions auto-expire after 30 min inactivity
│   │                                      #   - Max 3 concurrent chat sessions (cost control)
│   │
│   └── db/
│       ├── schema.sql                     # SQLite schema:
│       │                                  #   CREATE TABLE runs (
│       │                                  #     id INTEGER PRIMARY KEY,
│       │                                  #     agent TEXT NOT NULL,
│       │                                  #     trigger_type TEXT NOT NULL,  -- 'slack_command','webhook','cron'
│       │                                  #     prompt TEXT NOT NULL,
│       │                                  #     output TEXT,
│       │                                  #     exit_code INTEGER,
│       │                                  #     duration_ms INTEGER,
│       │                                  #     created_at TEXT DEFAULT (datetime('now'))
│       │                                  #   );
│       │
│       └── client.ts                      # better-sqlite3 initialization + helper functions
│
├── scripts/
│   ├── setup-vps.sh                       # Idempotent server provisioning:
│   │                                      #   1. Update apt, install Node.js 20 via nodesource
│   │                                      #   2. Install Caddy (reverse proxy + auto-TLS)
│   │                                      #   3. Create bitacora-ops user (no sudo)
│   │                                      #   4. Clone student-reports-ios repo (read-only)
│   │                                      #   5. Configure UFW (22, 443 only)
│   │                                      #   6. Configure fail2ban for SSH
│   │                                      #   7. Install Claude CLI (npm install -g @anthropic-ai/claude-code)
│   │                                      #   8. Create systemd service for orchestrator
│   │                                      #   9. Configure Caddy for ops.bitacora.app → localhost:3000
│   │                                      #  10. Set up log rotation
│   │
│   └── test-agent.sh                      # Manual smoke test:
│                                          #   claude -p "Say hello from security-compliance" \
│                                          #     --agent security-compliance --print
│
├── Caddyfile                              # Reverse proxy config:
│                                          #   ops.bitacora.app {
│                                          #     reverse_proxy localhost:3000
│                                          #   }
│
└── README.md                              # Setup instructions + architecture overview
```

### Phase 0 — Step-by-Step Build Order

**Day 1-2: VPS + Infrastructure**

1. Purchase Hostinger KVM 2 VPS ($6.99/mo)
2. Boot Ubuntu 22.04, set root password
3. Run `setup-vps.sh` (SSH hardening, firewall, Node.js, Caddy, Claude CLI)
4. Point `ops.bitacora.app` DNS A record to VPS IP (or use IP directly)
5. Authenticate Claude CLI: `claude login` (one-time, stores token in `~/.claude/`)
6. Clone iOS repo: `git clone <repo-url> /home/bitacora-ops/repos/student-reports-ios`
7. Verify: `claude -p "hello" --print` returns a response from VPS

**Day 3-4: Orchestrator Core**

8. Init Node.js project: `npm init`, install Express, better-sqlite3, typescript
9. Build `src/db/schema.sql` + `client.ts` — SQLite database for run logging
10. Build `src/services/agent-runner.ts` — the heart: spawns `claude` CLI, captures output
11. Build `src/services/run-logger.ts` — logs every invocation to SQLite
12. Build `src/services/rate-limiter.ts` — cooldowns + kill switch
13. Build `src/routes/health.ts` — simple health endpoint
14. Build `src/index.ts` — Express server, mount routes
15. Test locally: hit health endpoint, trigger a test agent run

**Day 5-6: Slack Integration**

16. Create Slack workspace + channels (`#ops-alerts`, `#ops-reports`, `#ops-log`)
17. Create Slack App (bot token, slash command)
18. Build `src/services/slack-notifier.ts` — posts Block Kit messages to channels
19. Build `src/routes/slack.ts` — handles `/bitacora` slash commands
20. Wire it all together: `/bitacora run security-compliance "test"` → agent runs → result posts to Slack
21. Test `/bitacora status` and `/bitacora pause`

**Day 7: Hardening + Agent Config**

22. Build `src/config/agents.ts` — registry with model, cooldown, channel routing per agent
23. Add cost tracking (parse Claude CLI output for token usage)
24. Set up systemd service so orchestrator auto-starts on reboot
25. Configure log rotation for orchestrator stdout/stderr
26. End-to-end smoke test: reboot VPS, verify orchestrator comes back up, run a slash command

### Phase 0 — What You'll Have at the End

```
You type in Slack:
  /bitacora run customer-success "A teacher left this review: 'Great app but crashes when I try to record for more than 5 minutes.' Draft a response."

What happens:
  1. Slack sends POST to https://ops.bitacora.app/slack/commands
  2. Orchestrator verifies Slack signature
  3. Rate limiter checks: customer-success last ran 10 min ago → OK
  4. Agent runner spawns:
     claude -p "A teacher left this review..." --agent customer-success --print --max-turns 3
     (working directory: /home/bitacora-ops/repos/student-reports-ios)
  5. Claude reads .claude/agents/customer-success.md, runs with that persona
  6. Output captured (e.g., "Draft response: 'Thank you for your feedback! We're aware of the recording timeout issue and are working on a fix in the next update...'")
  7. Run logged to SQLite: agent=customer-success, trigger=slack_command, duration=8200ms
  8. Result posted to #ops-log with formatted Block Kit message
  9. You see the draft in Slack, copy/edit/post it to the App Store

You type:
  /bitacora chat engineer-mentor "Why does our sync service use a queue instead of direct upload?"

What happens:
  1. Orchestrator spawns engineer-mentor agent with your question
  2. Response posts in a NEW Slack thread under the slash command
  3. You reply in the thread: "Would that change for Android?"
  4. thread-manager detects your reply, forwards it as a follow-up prompt
  5. engineer-mentor responds in the same thread with Android-specific context
  6. Conversation continues until you stop replying (auto-expires after 30 min)

You type:
  /bitacora chat ux-ui-designer "Evaluate our student card design for Android Material 3"

What happens:
  Same threaded conversation flow. The ux-ui-designer reviews the current
  StudentCardView.swift design, evaluates it against Material 3 guidelines,
  and suggests adaptations — all in a Slack thread you can revisit later.

You type:
  /bitacora status

You see:
  Today's runs: 3 | Errors: 0 | System: ACTIVE
  Active chats: 1 (ux-ui-designer, thread #ops-log, 4 min ago)
  Last run: customer-success (8.2s ago) via slash command
```

### What Phase 0 Does NOT Include

- No webhooks from Sentry, GitHub, or App Store (that's Phase 1)
- No cron-scheduled reports (that's Phase 2)
- No admin dashboard UI (that's Phase 3)
- No Supabase realtime listener (that's Phase 3)
- No automated event-driven triggers of any kind — Phase 0 is manual-only via Slack slash commands

Phase 0 proves the core loop works: **human trigger → agent runs → result to Slack**. Once that's solid, Phase 1 adds automated triggers.

---

## 5. Phase 1-3 Summary (For Reference)

### Phase 1: First Automated Agents (Week 3-4)
- Sentry webhook → security-compliance (crash triage)
- App Store Connect poller → customer-success (review drafts)
- `src/routes/webhooks.ts` + `src/services/appstore-poller.ts`

### Phase 2: Reporting + Code Review (Week 5-6)
- GitHub webhook → qa-testing (PR test checklists)
- GitHub webhook (data files) → security-compliance (compliance review)
- Cron Monday → product-manager (weekly status)
- Cron Friday → data-analytics (KPI digest)
- `src/cron/schedules.ts` + `src/routes/webhooks.ts` expanded

### Phase 3: Full Suite + Dashboard (Week 7-8)
- Supabase realtime → customer-success (ticket triage)
- Milestone events → gtm-agent (growth alerts)
- Monthly cron → security-compliance (compliance audit)
- Admin dashboard page in webapp (`/admin/ai-ops`)
- AWS migration plan documented

---

## 6. Agents — Automation Status

| Agent | Mode | Phase | Trigger | Model |
|---|---|---|---|---|
| security-compliance | 🤖 Automated | 0 (manual) → 1 (auto) | Slash cmd → Sentry webhook, PR webhook | sonnet |
| customer-success | 🤖 Automated | 0 (manual) → 1 (auto) | Slash cmd → App Store reviews, tickets | haiku |
| data-analytics | 🤖 Automated | 2 | Cron (weekly) | haiku |
| qa-testing | 🤖 Automated | 2 | GitHub PR webhook | sonnet |
| product-manager | 🤖 Automated | 2 | Cron (weekly) | sonnet |
| gtm-agent | 🤖 Automated | 3 | Supabase milestone events | sonnet |
| engineer-mentor | 💬 Conversational | 0 | Slack slash command (`/bitacora chat engineer-mentor`) | sonnet |
| ux-ui-designer | 💬 Conversational | 0 | Slack slash command (`/bitacora chat ux-ui-designer`) | opus |
| ios-senior-developer | ❌ CLI Only | — | Manual Claude Code session only | opus |

### Three Agent Modes

**🤖 Automated** — Event-driven. Agents run without human trigger and post results to Slack.

**💬 Conversational** — On-demand via Slack. You start a conversation with `/bitacora chat <agent>`, ask questions, and get responses in a Slack thread. The agent runs with your full codebase context but never writes code or modifies files. Think of it as having the agent "on call" in Slack.

**❌ CLI Only** — Only used in interactive Claude Code terminal sessions on your local machine. Too risky to run remotely because it writes and modifies code.

### Why each mode?

- **engineer-mentor (💬 Conversational)**: You want to ask "why does X work this way?" or "explain the trade-offs of Y" from Slack without opening a terminal. The mentor explains — never executes. Perfect for learning while on the go.
- **ux-ui-designer (💬 Conversational)**: You want design evaluations, plan reviews, and competitive analysis from Slack. "How should we approach the Android layout?" or "Evaluate our onboarding flow against HIG." The designer advises — never modifies files. Critical as you prepare the Android app.
- **ios-senior-developer (❌ CLI Only)**: Code generation requires interactive sessions with real-time human review. The risk of automated or remote code changes outweighs the convenience.

---

## 7. Security Posture

| Concern | Mitigation |
|---|---|
| Student PII on VPS | **Never.** Agents receive only metadata: stack traces, review text, PR diffs. Prompts explicitly prohibit requesting PII. |
| Secrets on VPS | `.env` file, `chmod 600`, owned by service user only. No secrets in code or logs. |
| Webhook authenticity | HMAC-SHA256 signature verification on all incoming webhooks (Slack, GitHub, Sentry). |
| SSH access | Key-only auth, no passwords. Fail2ban for brute force. |
| Network exposure | UFW firewall: only ports 443 (HTTPS) and 22 (SSH). Caddy handles TLS. |
| Agent writes to codebase | All automated agents run read-only. No commits, no file writes, no PRs. |
| Runaway agent costs | Hard caps at invocation, daily, and weekly levels. Kill switch via Slack. |

---

## 8. Migration Path — Hostinger → AWS

Defer until any of these become true:

| Signal | AWS Target |
|---|---|
| System proven, ready to scale | Full migration |
| Uptime < 99.5% on Hostinger | ECS Fargate for orchestrator |
| Need multiple environments (dev/staging/prod) | CDK stack |
| Agent volume exceeds VPS capacity | Lambda for individual agent runs |

**AWS target architecture** (future):
- API Gateway + Lambda (webhook receivers)
- EventBridge (replaces node-cron)
- Lambda container with Claude CLI (agent runner)
- DynamoDB (replaces SQLite)
- Secrets Manager (replaces .env)
- CloudWatch (monitoring)
- Estimated: $30-50/month base + Claude usage

---

## Sources

### Slack Pricing
- [Slack Free Plan Features & Limitations](https://slack.com/pricing/free)
- [Slack Pricing 2026: Free, Pro, Business+, Enterprise](https://viewexport.com/post/slack-pricing)
- [Slack Free Plan Limits 2026](https://viewexport.com/post/slack-free-plan-limitations)

### Sentry & Crashlytics
- [Sentry Pricing & Plans](https://sentry.io/pricing/)
- [Sentry vs Crashlytics Comparison](https://stackshare.io/stackups/crashlytics-vs-sentry)
- [Sentry Docs: Pricing & Billing](https://docs.sentry.io/pricing/)

### Hostinger VPS
- [Hostinger VPS Pricing & Plans](https://www.hostinger.com/pricing/vps-hosting)
- [Hostinger Ubuntu VPS](https://www.hostinger.com/vps/ubuntu-hosting)

### Claude Code
- [Claude Plans & Pricing](https://claude.com/pricing)
- [Claude Code Pricing Guide](https://claudelog.com/claude-code-pricing/)
