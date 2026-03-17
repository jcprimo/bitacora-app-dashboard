---
name: bitacora-ops-bootstrap
description: Transferable memory for the bitacora-ops orchestrator project — all context needed to start building from scratch
type: project
---

# Bitácora Ops — Transferable Project Memory

This memory file contains everything a fresh Claude Code session needs to build the `bitacora-ops` orchestrator project. Move this file into the new project's memory directory.

---

## What Is This Project?

**Bitácora Ops** is a Node.js orchestrator that automates the Bitácora AI agent team. It runs on a Hostinger VPS, receives events (webhooks, cron), spawns Claude Code CLI agents, and posts results to Slack. The founder (solopreneur) only gets pinged when human intervention is needed.

**Ticket:** BIT-21
**Spec doc:** `BITACORA-OPS.md` in the dashboard repo (the source of truth for architecture, phases, and decisions)

---

## Critical Decisions (Non-Negotiable)

1. **Claude Code CLI, not Anthropic API** — All agent automation runs via `claude` CLI subprocess with `--agent` flag. Never use the Anthropic SDK or raw API calls. The founder explicitly chose this to leverage Claude Code's built-in agent system, tools, and CLAUDE.md context.

2. **Event-driven architecture** — Agents respond to triggers (crashes, reviews, PRs, threshold breaches). Not continuous polling. Cron jobs only for scheduled reports (weekly/monthly).

3. **Slack for all alerting** — Single custom Slack App handles everything: agent results, slash commands (`/bitacora run`, `/bitacora chat`, `/bitacora status`, `/bitacora pause`). Free plan is sufficient.

4. **No student PII on VPS** — Agents receive only metadata: stack traces, review text, PR diffs. Never pass student names, IDs, or behavioral data. Use encrypted IDs or row_sec_labels when referencing data.

5. **Hostinger VPS first, AWS later** — Start on Hostinger KVM 2 ($6.99/mo). Migrate to AWS (Lambda + EventBridge + DynamoDB) only after system is proven and monthly spend exceeds $100 or uptime needs exceed Hostinger's capability.

6. **All agent outputs are advisory** — No agent auto-publishes, merges PRs, commits code, or modifies production data. Everything goes through Slack for founder approval.

---

## The App: Bitácora

- **Name:** Bitácora (not Reporta — brand was reverted)
- **What it does:** iOS app for student behavioral incident reporting (voice recording → AI transcription → structured report)
- **Markets:** US (FERPA) + Mexico (LFPDPPP). Bilingual EN/ES.
- **Architecture:** Local-first SwiftData, OpenAI AI pipeline (Whisper + GPT-4o Mini), optional cloud sync via Supabase
- **iOS repo:** `bitacora-app-ios` on GitHub (`jcprimo/bitacora-app-ios`)
- **Admin webapp:** Under construction (Bitácora Admin Dashboard) — Supabase backend, React frontend
- **Android version:** Planned future project. Design evaluations should consider Material 3 compatibility.
- **Current version tag:** `v0.5.0_2026-03-14`

---

## Agent Roster & Automation Modes

| Agent | Mode | Trigger | Model |
|---|---|---|---|
| security-compliance | Automated | Sentry webhook, GitHub PR webhook | sonnet |
| customer-success | Automated | App Store reviews, support tickets | haiku |
| data-analytics | Automated | Cron (weekly Friday) | haiku |
| qa-testing | Automated | GitHub PR webhook | sonnet |
| product-manager | Automated | Cron (weekly Monday) | sonnet |
| gtm-agent | Automated | Supabase milestone events | sonnet |
| engineer-mentor | Conversational | `/bitacora chat` — threaded Slack conversations | sonnet |
| ux-ui-designer | Conversational | `/bitacora chat` — design evaluations, plan reviews | opus |
| ios-senior-developer | CLI Only | Never automated — too risky (writes code) | opus |

**Three modes:**
- **Automated**: Event-driven, no human trigger needed
- **Conversational**: On-demand via `/bitacora chat <agent>`, threaded Slack conversations with follow-ups, 30-min auto-expiry, max 3 concurrent sessions
- **CLI Only**: Interactive terminal sessions only, never remote

---

## Tech Stack

- **Runtime:** Node.js 22 LTS + TypeScript
- **Web framework:** Express
- **Database:** SQLite (better-sqlite3) for run log
- **Reverse proxy:** Caddy (auto-TLS)
- **Crash reporting:** Sentry (free Developer plan, 5K errors/mo) — chosen over Crashlytics for native webhook support + cross-platform coverage (iOS + web)
- **Slack:** Free plan + single custom Slack App (bot token, slash commands)
- **Monitoring integrations:** Sentry, App Store Connect API, GitHub webhooks, Supabase realtime

---

## Cost Controls

| Control | Default |
|---|---|
| Per-invocation max turns | Set per agent in config |
| Per-agent cooldown | 5 min minimum between runs |
| Event dedup window | 1 hour (same payload hash) |
| Process timeout | 120 seconds (kill after) |
| Kill switch | `/bitacora pause` halts all processing |
| Max concurrent chat sessions | 3 |
| Chat session auto-expiry | 30 minutes inactivity |

---

## Phased Build Plan

| Phase | Weeks | What |
|---|---|---|
| 0: Foundation | 1-2 | VPS, orchestrator skeleton, Slack bot, slash commands, SQLite run log, cost controls |
| 1: First 2 agents | 3-4 | Sentry webhook → security-compliance; App Store poller → customer-success |
| 2: Reporting + code review | 5-6 | data-analytics (cron), qa-testing (PR webhook), product-manager (cron), GitHub PR comments |
| 3: Full suite + dashboard | 7-8 | gtm-agent, Supabase realtime, admin dashboard page (`/admin/ai-ops`), monthly compliance audit |

---

## Key File Structure

```
bitacora-ops/
├── src/
│   ├── index.ts                    # Express entry
│   ├── config/agents.ts            # Agent registry (model, cooldown, channels)
│   ├── routes/
│   │   ├── health.ts               # GET /health
│   │   ├── slack.ts                # /bitacora slash commands
│   │   ├── slack-threads.ts        # Thread replies for chat sessions
│   │   └── webhooks.ts             # GitHub, Sentry (Phase 1+)
│   ├── services/
│   │   ├── agent-runner.ts         # Spawns `claude` CLI as child process
│   │   ├── slack-notifier.ts       # Posts Block Kit messages to Slack
│   │   ├── run-logger.ts           # SQLite operations
│   │   ├── rate-limiter.ts         # Cooldowns + kill switch
│   │   ├── thread-manager.ts       # Conversational agent sessions
│   │   └── appstore-poller.ts      # App Store Connect API (Phase 1+)
│   ├── cron/schedules.ts           # Weekly/monthly jobs (Phase 2+)
│   └── db/
│       ├── schema.sql              # runs table
│       └── client.ts               # better-sqlite3 wrapper
└── scripts/
    ├── setup-vps.sh                # Idempotent VPS provisioning
    └── test-agent.sh               # Smoke test
```

---

## Founder Preferences

- **Documentation:** Every doc must start with an extensive TL;DR section in plain language (not just a one-liner). Assume the reader is smart but not necessarily technical.
- **Claude Code CLI only:** Never suggest Anthropic API/SDK for agent work. Always use `claude` CLI.
- **Keep it lean:** This is a solopreneur operation. No over-engineering. Simple > clever.
- **Bilingual:** All user-facing content must work in EN and ES.
- **Compliance first:** FERPA (US) and LFPDPPP (Mexico) are non-negotiable. Security-compliance agent must review any data flow changes.

---

## Related Repos & Resources

| Resource | Location |
|---|---|
| iOS app repo | `jcprimo/bitacora-app-ios` (GitHub) |
| Ops spec doc | `BITACORA-OPS.md` in dashboard repo |
| Webapp spec doc | `BITACORA_WEBAPP_IMPL.md` in dashboard repo |
| Agent definitions | `.claude/agents/*.md` in iOS repo |
| Slack workspace | To be created: `bitacora-team` |
| Sentry project | To be created: iOS + Web projects |
| VPS | Provisioned: Hostinger KVM 2 |
