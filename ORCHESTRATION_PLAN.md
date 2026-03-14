# Orchestration Plan — QA Agent Containerized Execution

## Vision

The Bitacora admin app becomes the **central operations hub** that dispatches QA work to isolated, ephemeral Docker containers running on a Hostinger VPS. Each container clones the iOS repo, runs the qa-testing agent against a specific test case, produces XCTest code, pushes a PR, and self-destructs — all without interfering with other agents or in-progress feature work.

---

## Architecture Overview

```
┌────────────────────┐
│   Admin Web App    │  (browser — Bitacora YouTrack Integration)
│   ┌──────────────┐ │
│   │  QA Tracker  │─┼──── Click "Start Dev" ────┐
│   └──────────────┘ │                            │
└────────────────────┘                            ▼
                                        ┌──────────────────┐
                                        │   Orchestration   │
                                        │      API          │
                                        │  (VPS — Express)  │
                                        └────────┬─────────┘
                                                 │
                              ┌──────────────────┼──────────────────┐
                              ▼                  ▼                  ▼
                     ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
                     │  Container 1 │   │  Container 2 │   │  Container 3 │
                     │  TC-OB-001   │   │  TC-REC-005  │   │  TC-SM-012   │
                     │  qa-testing  │   │  qa-testing  │   │  qa-testing  │
                     │  agent       │   │  agent       │   │  agent       │
                     └──────────────┘   └──────────────┘   └──────────────┘
                           │                  │                  │
                           └──────────────────┴──────────────────┘
                                              │
                                              ▼
                                    ┌──────────────────┐
                                    │   GitHub Repo     │
                                    │   (PRs to develop)│
                                    └──────────────────┘
```

---

## Implementation Phases

### Phase A — Clipboard Handoff (IMPLEMENTED)

**Status: Done**

When "Start Dev" is clicked:
1. Ticket transitions to Develop in YouTrack
2. A structured context bundle is built (test case details, relevant Swift files, branch strategy)
3. Bundle is copied to clipboard
4. User pastes into Claude Code terminal session manually

After transition, two buttons appear:
- **📋** — re-copy the context bundle
- **▶** — copy a ready-to-run `claude --agent qa-testing` launch command

### Phase B — In-App AI Pre-Analysis

Before the clipboard handoff, call the Anthropic API with the qa-testing system prompt to generate:
- A test implementation plan (which XCTest files to create/modify)
- Skeleton XCTest code
- Risk assessment (FERPA implications, bilingual coverage gaps)

Display the plan inline in the admin app for review before the user launches the agent.

**Requires:** Loading the qa-testing.md agent prompt into the app (already accessible).

### Phase C — VPS Container Orchestration (this document)

Full automation: admin app dispatches work to the VPS, which spins up containers that execute independently and report back.

---

## Phase C — Detailed Design

### Container Lifecycle

```
1. DISPATCH   — Admin app sends POST /api/qa/dispatch { testCase, ticketId }
2. PROVISION  — VPS pulls Docker image, creates container
3. CLONE      — Container clones student-reports-ios @ develop
4. BRANCH     — Container creates test/{TC-ID}-{slug} from develop
5. EXECUTE    — Claude Agent SDK runs qa-testing agent with context bundle
6. COMMIT     — Agent commits XCTest code
7. PUSH       — Container pushes branch, creates PR via gh CLI
8. REPORT     — Container sends results back to orchestration API
9. TEARDOWN   — Container self-destructs, resources freed
```

### VPS Orchestration API (Express on the Hostinger VPS)

```
POST   /api/qa/dispatch      — start a container for a test case
GET    /api/qa/status/:id     — poll container status (queued/running/done/failed)
GET    /api/qa/results/:id    — get agent output, PR URL, logs
POST   /api/qa/cancel/:id     — kill a running container
GET    /api/qa/capacity       — available slots, memory, running count
DELETE /api/qa/cleanup        — remove all stopped containers
```

### Docker Image

```dockerfile
FROM node:22-alpine

# Claude Code CLI + Agent SDK
RUN npm install -g @anthropic-ai/claude-code

# Git + GitHub CLI for PR creation
RUN apk add --no-cache git gh openssh

# Working directory
WORKDIR /workspace

# Entry script: clone → branch → run agent → push → report
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
```

### Secrets Injection

Secrets are passed as environment variables at container runtime — never baked into the image:

| Secret | Purpose | Source |
|--------|---------|--------|
| `ANTHROPIC_API_KEY` | Claude API calls from the agent | Admin app settings |
| `GITHUB_TOKEN` | Clone private repo + create PRs | GitHub PAT (fine-grained, repo scope) |
| `YOUTRACK_TOKEN` | Update ticket status on completion | Admin app settings |

Stored on the VPS in `/etc/bitacora/.env` with `600` permissions, owned by the orchestration service user.

### Concurrency & Resource Limits

| Resource | Limit | Rationale |
|----------|-------|-----------|
| Max concurrent containers | 3 | Hostinger VPS RAM constraint (~4GB typical) |
| Container memory limit | 1GB | Claude API calls are lightweight; git clone is the peak |
| Container timeout | 15 min | Prevents runaway agents from burning API credits |
| API rate limit | 10 dispatches/hour | Anthropic rate limit safety margin |
| Queue depth | 20 | Beyond this, reject with "capacity full" |

### Admin App Integration

The QA Tracker view gains:
- **"Dispatch to VPS"** button (replaces clipboard handoff when VPS is configured)
- **Status indicator** per test case: `Queued → Running → PR Ready → Done`
- **Live log stream** via SSE from the orchestration API
- **PR link** displayed inline when the container finishes
- **VPS capacity widget** showing available slots

---

## Critical Questions — Scenarios to Consider

### 1. iOS Tests Cannot Run on Linux

**Problem:** The VPS runs Linux. XCTest and XCUITest require macOS + Xcode + Simulator. The containerized agent can **write** test code but cannot **execute** it.

**Options:**
- **A) Write-only:** Agent writes XCTest code, pushes PR, but tests run on your Mac via `xcodebuild` after merge. This is the simplest and most realistic path.
- **B) macOS CI:** Add a GitHub Actions runner with macOS (free tier: 10 min/month, paid: $0.08/min). Tests run in CI on every PR.
- **C) Self-hosted runner:** Your Mac as a GitHub Actions self-hosted runner. Free, but ties up your machine.

**Recommendation:** Start with A. Add B when the test suite grows large enough to justify CI cost.

### 2. Branch Conflicts Between Concurrent Agents

**Problem:** If Container 1 works on TC-OB-001 and Container 2 works on TC-OB-003, both touch `OnboardingView.swift`. When both push PRs, the second one will have merge conflicts.

**Mitigations:**
- **Category locking:** Only one container per category at a time. The orchestration API maintains a category lock table.
- **Additive-only convention:** Agents only ADD new test files, never modify existing source. Test files go in `StudentReportsTests/QA/{Category}/TC_OB_001_Tests.swift` — one file per test case, zero overlap.
- **Rebase before push:** The entrypoint script rebases onto `develop` before pushing. If rebase fails, report conflict and bail.

### 3. Agent Memory Is Ephemeral in Containers

**Problem:** The qa-testing agent has a persistent memory directory. Ephemeral containers start fresh — learned patterns, regression notes, and test data conventions are lost.

**Solutions:**
- **Mount a shared volume:** `/var/bitacora/agent-memory/qa-testing/` on the VPS, mounted into every container at the agent's memory path. Memory accumulates across runs.
- **Seed from repo:** Copy the agent memory from the cloned repo's `.claude/agent-memory/qa-testing/` into the container at startup.
- **Write-back:** On completion, copy updated memory files back to the shared volume. Periodically commit memory updates to the repo.

### 4. develop Moves While Containers Run

**Problem:** A feature PR merges to `develop` while a QA container is working. The container's branch is now behind.

**Mitigation:** The entrypoint script does a `git fetch && git rebase origin/develop` before the final push. If the rebase fails (conflict), the container reports failure and the admin app shows "Rebase conflict — manual intervention needed."

### 5. Cost Accumulation

**Problem:** 205 test cases × ~$0.15-0.50 per agent run = $30-100 in API costs. If the agent loops or generates verbose output, costs spike.

**Controls:**
- **Token budget per container:** Set `max_tokens` in the agent config. Hard cap at 50K output tokens per run.
- **Dry run mode:** Preview estimated cost before dispatching a batch.
- **Batch controls:** Dispatch by category, not all 205 at once. Start with a 5-case pilot.
- **Cost callback:** The orchestration API reports per-container API spend. Admin app's Usage view tracks it.

### 6. Container Failures and Orphans

**Problem:** Container crashes, network drops, or agent hangs. The container stays running, consuming resources.

**Safeguards:**
- **Hard timeout:** Docker `--stop-timeout 900` (15 min). After that, Docker kills it.
- **Health check endpoint:** Container exposes a `/health` endpoint. Orchestration API checks every 30s. Three consecutive failures → force kill.
- **Cleanup cron:** Run `docker container prune` every hour on the VPS. The orchestration API also provides a manual `/api/qa/cleanup` endpoint.
- **State machine:** Container states are `queued → running → done | failed | timeout`. Failed/timeout containers are logged and cleaned up.

### 7. Secrets Rotation and Revocation

**Problem:** If the VPS is compromised, all secrets (GitHub token, Anthropic key, YouTrack token) are exposed.

**Mitigations:**
- **Fine-grained GitHub PAT:** Scoped to the single repo, with only `contents:write` and `pull_requests:write`. Rotated monthly.
- **Anthropic key with spend limit:** Set a monthly budget cap on the Anthropic dashboard. Even if leaked, damage is bounded.
- **VPS hardening:** SSH key-only auth, fail2ban, firewall (only ports 80/443/22). Orchestration API behind TLS + API key auth.

### 8. How Does the Admin App Talk to the VPS?

**Options:**
- **A) Direct HTTPS:** Admin app calls `https://vps.yourdomain.com/api/qa/dispatch`. Requires CORS config and an API key header.
- **B) Vite proxy in dev, nginx in prod:** Same pattern as the YouTrack proxy. Add `/orchestration-api` route.
- **C) WebSocket for live updates:** SSE or WebSocket from VPS → admin app for real-time container status.

**Recommendation:** B + C. Proxy the REST API through the existing infrastructure. Add SSE for live status updates.

### 9. What If the Agent Produces Bad Code?

**Problem:** The agent writes test code that doesn't compile, has wrong assertions, or misunderstands the codebase.

**Controls:**
- **PR review gate:** All agent PRs require human review before merge. The admin app links to the PR for one-click review.
- **Compilation check in container:** Before pushing, run `swift build` on the test target (requires Swift toolchain in the image — possible on Linux for non-UIKit code).
- **Iteration loop:** If compilation fails, the agent gets the error and retries (up to 3 attempts).
- **Quality score:** Track pass/fail rate per agent run. If quality drops below 70%, pause dispatching and review the agent prompt.

### 10. State Synchronization Between Admin App and VPS

**Problem:** If the user closes the browser, the container keeps running. When they return, the admin app needs to show the current state.

**Solution:**
- The orchestration API is the source of truth for container state.
- On mount, the QA Tracker polls `GET /api/qa/status` for all active dispatches.
- Container results (PR URL, logs, cost) are stored in a SQLite database on the VPS.
- The admin app's localStorage only tracks the mapping `Test_ID → dispatch_id`.

### 11. Multi-User / Multi-Project

**Future consideration:** Right now this is single-user, single-project. If multiple people use the admin app:
- Container queue needs user-scoping
- GitHub tokens need to be per-user
- YouTrack ticket assignments need to respect ownership

Not a concern for Phase C launch, but the orchestration API should include a `user_id` field in dispatch requests for future-proofing.

### 12. VPS Provider Lock-in

**Consideration:** Hostinger VPS is the starting point, but the architecture should be portable.

- Docker + Express is provider-agnostic
- The same setup works on any VPS (DigitalOcean, Hetzner, Linode)
- For scale: swap Docker containers for Kubernetes Jobs or AWS ECS Fargate tasks
- The admin app only talks to the orchestration API — it doesn't know or care where containers run

---

## Implementation Roadmap

| Phase | Effort | Deliverable |
|-------|--------|-------------|
| **A — Clipboard** | Done | Context bundle + launch command copy |
| **B — In-app AI** | 1-2 days | Pre-analysis with qa-testing prompt, inline plan display |
| **C1 — VPS Setup** | 1 day | Docker image, entrypoint script, Express orchestration API skeleton |
| **C2 — Dispatch** | 1-2 days | Admin app → VPS dispatch flow, status polling |
| **C3 — Live Updates** | 1 day | SSE streaming, real-time status in QA Tracker |
| **C4 — Hardening** | 1-2 days | Timeouts, cleanup, secrets management, error handling |
| **C5 — Monitoring** | 1 day | Cost tracking per dispatch, quality metrics, capacity dashboard |

**Total Phase C: ~5-8 days**

---

## Decision Log

| Decision | Choice | Why |
|----------|--------|-----|
| Agent isolation strategy | One container per test case | Prevents branch conflicts, enables parallel execution |
| Test file organization | `StudentReportsTests/QA/{Category}/` | Additive-only, zero overlap between agents |
| iOS test execution | Write-only (agent writes, Mac executes) | Linux VPS cannot run Xcode/Simulator |
| Concurrency model | Queue with 3 max concurrent | VPS resource constraints |
| Memory persistence | Shared volume mounted into containers | Preserves agent learning across runs |
| State storage | SQLite on VPS, localStorage in admin app | Simple, no external DB dependency |
| Branch strategy | `test/{TC-ID}-{slug}` from `develop` | Matches repo conventions, clear provenance |

---

## Open Questions for Primo

1. **Hostinger VPS specs?** — RAM, CPU, disk, OS. This determines max concurrency.
2. **GitHub repo visibility?** — Public or private? Affects token scoping.
3. **Budget ceiling?** — Max $/month for Anthropic API spend on automated QA.
4. **Review workflow?** — Auto-merge agent PRs, or human review required?
5. **Priority order?** — Which test categories should we pilot first? (Recommend: Onboarding — smallest scope, highest coverage.)
