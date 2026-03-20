# Agent Dispatch Flow — Bitácora Dashboard

> A complete technical walkthrough of what happens, step by step, from the moment you click "Dispatch" to the moment you see agent output in the terminal panel.

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER (React SPA)                                            │
│                                                                 │
│  AgentsView.jsx          useAgentJobs.js                        │
│  ┌──────────────┐        ┌──────────────────────────┐          │
│  │ Dispatch Form│──────> │ dispatch()               │          │
│  │              │        │   POST /api/jobs          │          │
│  │ Job List     │<─────  │   SSE /api/events         │          │
│  │              │        │   GET /api/jobs/:id       │          │
│  │ Terminal     │<─────  │   SSE job-log events      │          │
│  └──────────────┘        └──────────────────────────┘          │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP + SSE (persistent TCP)
┌──────────────────────────────▼──────────────────────────────────┐
│  SERVER (Node.js / Express — VPS)                               │
│                                                                 │
│  server/index.js                                                │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐   │
│  │ /api/jobs    │──>│ orchestrator │──>│ sse.js broadcast │   │
│  │ (jobs.js)    │   │ .js          │   │ (in-process Set) │   │
│  └──────────────┘   └──────┬───────┘   └──────────────────┘   │
│                             │                                   │
│  ┌──────────────┐   ┌──────▼───────┐                          │
│  │ SQLite DB    │<──│ worktree.js  │                          │
│  │ agent_jobs   │   │ (git + spawn)│                          │
│  │ agent_logs   │   └──────┬───────┘                          │
│  └──────────────┘          │                                   │
└───────────────────────────-┼────────────────────────────────────┘
                             │ Child process (Node spawn)
┌────────────────────────────▼────────────────────────────────────┐
│  CLAUDE CODE CLI  (runs inside /tmp/bitacora-agents/<worktree>) │
│                                                                 │
│  claude -p "<prompt>" --output-format stream-json               │
│                                                                 │
│  Reads CLAUDE.md, edits files, commits changes                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Dispatch Lifecycle

### Step 1 — User fills the form and clicks "Dispatch"

**File:** `src/views/AgentsView.jsx`, lines 60-70

```
const handleDispatch = async () => {
  if (!prompt.trim()) return;
  await dispatch({ agentType, repo, prompt, ticketId });
  ...
};
```

The form collects four pieces of information:
- `agentType` — which agent to run (`baal`, `ios`, `qa`, or `security`)
- `repo` — which repository the agent will work in
- `prompt` — the task description, written by the human
- `ticketId` — an optional YouTrack ticket to associate with the job

The "Dispatch" button is disabled while `dispatching` is true and re-enabled when the POST completes.

---

### Step 2 — The hook sends a POST to /api/jobs

**File:** `src/hooks/useAgentJobs.js`, lines 45-66

```
const res = await fetch("/api/jobs", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ agentType, repo, prompt, ticketId }),
});
```

Key things happening here:
- `credentials: "include"` sends the session cookie so the server knows who is making the request.
- The hook sets `dispatching = true` immediately so the button goes grey. This is optimistic UI feedback.
- On a successful 201 response, the new job object is prepended to the local job list and `activeJobId` is set to the new job's ID, so the terminal panel switches to it immediately.

---

### Step 3 — The route validates and inserts the job record

**File:** `server/routes/jobs.js`, lines 33-71

The route does three things in sequence:

**3a. Validate the payload.**
It checks that `agentType` is one of `["baal", "ios", "qa", "security"]` and that `repo` is one of three known repos. Any invalid value gets a 400 with a clear error message. This is the boundary where user input is sanitized before it can affect the file system.

**3b. Insert a row into `agent_jobs` with status `"queued"`.**

```
const result = db.insert(agentJobs).values({
  userId: req.session.userId,
  agentType,
  status: "queued",
  inputJson,      // JSON string with all dispatch params
  ticketId,
}).returning().get();
```

`inputJson` is a JSON-serialized blob that contains `agentType`, `repo`, `prompt`, `ticketId`, and an `autoMerge` flag. The flag is set to `true` for `bitacora-app-dashboard` and `primo-engineering` — repos where no human review is required before merging changes.

**3c. Broadcast a `"job"` SSE event so all connected browser tabs know immediately.**

```
broadcast("job", { action: "created", job: result });
```

This is fire-and-forget from the client's perspective. Any other open dashboard tabs will see the new job appear in their job list without polling.

**3d. Call `dispatchJob()` asynchronously and return 201.**

```
dispatchJob(result.id).catch((err) => { ... });
return res.status(201).json(result);
```

Notice the `.catch()`: `dispatchJob` runs in the background. The HTTP response is sent back immediately — the client does not wait for the agent to finish. This is important: agent jobs can take many minutes and you do not want the HTTP connection sitting open that whole time.

---

### Step 4 — The orchestrator creates an isolated git worktree

**File:** `server/orchestrator.js`, lines 65-87
**File:** `server/worktree.js`, lines 38-63

```
const result = createWorktree(repoPath, agentType, jobId);
// result = { worktreePath, branch }
// e.g. worktreePath = /tmp/bitacora-agents/ios-job-42
//      branch       = agent/ios/job-42
```

`createWorktree` does the following shell operations:
1. `git fetch origin` — pull the latest remote state
2. `git worktree add "/tmp/bitacora-agents/ios-job-42" -b "agent/ios/job-42" "origin/master"` — create a fresh directory that contains the repo at the tip of master, on its own branch

A **git worktree** is the key isolation mechanism here. It is not a full clone. It is a lightweight checkout of the same underlying git object database, but at a different path with its own working tree and HEAD. Two agents can work on the same repo simultaneously without stepping on each other because their file changes live in separate directories.

If worktree creation fails (e.g. the repo path does not exist on the VPS), the job is immediately marked `"failed"` in the database and the error is logged. No agent process is spawned.

---

### Step 5 — The orchestrator spawns the Claude Code CLI process

**File:** `server/orchestrator.js`, lines 93-103

```
const proc = spawn("claude", ["-p", agentPrompt, "--output-format", "stream-json"], {
  cwd: worktreePath,     // the agent runs INSIDE the worktree
  env: { ...process.env, PORT: undefined },
  stdio: ["ignore", "pipe", "pipe"],
});
```

This is the heart of the system. `spawn` from Node's `child_process` module launches the `claude` CLI as a subprocess. Three choices here are worth understanding:

- `cwd: worktreePath` — the agent's working directory is the worktree, so all file reads and writes happen inside that isolated checkout.
- `--output-format stream-json` — Claude Code emits a stream of newline-delimited JSON objects, one per event (assistant message, tool use, tool result, error). The server parses these to extract meaningful log lines.
- `stdio: ["ignore", "pipe", "pipe"]` — stdin is closed (the agent runs non-interactively), stdout and stderr are piped back to the Node process so they can be streamed to the dashboard.

The agent prompt is built by `buildPrompt()` (lines 213-230), which wraps the user's raw task description with context: the agent's identity, the repo name, the branch it is on, and a short rules list (read CLAUDE.md first, make focused commits, run tests if they exist, etc.).

A 30-minute kill timer is set immediately after spawning:

```
const timeout = setTimeout(() => {
  proc.kill("SIGTERM");
}, JOB_TIMEOUT_MS);
```

This is a safety net. A hung or runaway agent will be killed and the job marked `"failed"`.

---

### Step 6 — stdout is parsed and streamed to the dashboard as it arrives

**File:** `server/orchestrator.js`, lines 113-143

```
proc.stdout.on("data", (chunk) => {
  const lines = chunk.toString().split("\n").filter(Boolean);
  for (const line of lines) {
    const event = JSON.parse(line);
    if (event.type === "assistant") addLog(jobId, "info", content);
    if (event.type === "tool_use")  addLog(jobId, "info", `[${toolName}] tool_use`);
    if (event.type === "error")     addLog(jobId, "error", event.message);
  }
});
```

`addLog` does two things in one call:
1. Inserts a row into `agent_logs` in SQLite (persistent, survives a page reload)
2. Calls `broadcast("job-log", { jobId, level, message, ts })` — pushes the log line to every connected browser tab via SSE

This is why the terminal in the dashboard updates in real time. There is no polling. Each log line travels: `claude CLI stdout` → `Node.js data event` → `SQLite insert` + `SSE broadcast` → `browser EventSource` → React state update → DOM render.

---

### Step 7 — The browser receives SSE events and updates the UI

**File:** `server/routes/events.js` — sets up the SSE stream
**File:** `server/sse.js` — the broadcaster
**File:** `src/hooks/useAgentJobs.js`, lines 93-125

On mount, `useAgentJobs` opens a persistent connection:

```
const es = new EventSource("/api/events", { withCredentials: true });
```

The browser keeps this HTTP connection open indefinitely. The server sends two event types:

| SSE event | When | What the browser does |
|-----------|------|-----------------------|
| `job` | Job created, status changed | Updates the job list (status badge, timestamps) |
| `job-log` | Each log line from the agent | Appends to `activeJobLogs`, which re-renders the terminal |

The `job-log` listener appends to state unconditionally, but `useAgentJobs` filters the accumulated log list to only show entries where `log.jobId === activeJobId` (line 128-130). This means you can switch between jobs without losing the log history of any of them.

The keep-alive ping in `events.js` (line 31-38) sends an SSE comment every 25 seconds. This prevents reverse proxies and load balancers from closing idle connections.

---

### Step 8 — The agent finishes; the orchestrator wraps up

**File:** `server/orchestrator.js`, lines 152-190

When the Claude CLI process exits:

```
proc.on("close", async (code) => {
  clearTimeout(timeout);
  runningJobs.delete(jobId);

  if (code === 0) {
    const changed = hasChanges(worktreePath);
    if (changed) {
      const diff = getBranchDiff(worktreePath, branch);
      updateJobStatus(jobId, "done", { resultJson: JSON.stringify({ branch, diff, autoMerge, repo }) });
    } else {
      updateJobStatus(jobId, "done", { resultJson: JSON.stringify({ branch, diff: null, noChanges: true }) });
      cleanupWorktree(worktreePath, branch, repoPath);
    }
  } else {
    updateJobStatus(jobId, "failed");
    cleanupWorktree(worktreePath, branch, repoPath);
  }
});
```

Two paths:

**Exit code 0 with file changes:** The diff is captured via `git diff origin/HEAD..HEAD` and stored as `resultJson` on the job record. The worktree is left alive because a human may want to review or the PR workflow will need it. The "Review Changes" button in the UI would use this diff (currently stubbed as "coming soon").

**Exit code 0 with no changes:** The worktree is cleaned up immediately. No branch lingers.

**Non-zero exit code:** The job is marked `"failed"` and the worktree is cleaned up. The Retry button becomes available.

`updateJobStatus` also broadcasts a `"job"` SSE event with `action: "updated"`, so the job card in the browser switches from the cyan "Running" badge to green "Done" or red "Failed" without any polling.

---

### Step 9 — Cancel and Retry

**Cancel (`server/routes/jobs.js`, lines 109-131):**
The route calls `cancelJob(id)` from the orchestrator, which looks up the running process in the `runningJobs` Map and sends `SIGTERM`. The process exits, the `close` handler fires (but the status update is skipped because the DB record is already being set to "cancelled" by the route). The worktree is cleaned up.

**Retry (`server/routes/jobs.js`, lines 133-161):**
A new `agent_jobs` row is inserted with the same `inputJson` from the original job. `dispatchJob()` is called on the new row. This means retry creates a fresh job with a new ID rather than mutating the failed one. The failed record is preserved in the database as history.

---

## What Gets Stored in the Database

**Table: `agent_jobs`**

| Column | What it holds |
|--------|---------------|
| `id` | Auto-increment primary key |
| `user_id` | Who dispatched it (from session) |
| `agent_type` | `baal`, `ios`, `qa`, or `security` |
| `status` | `queued` → `running` → `done` / `failed` / `cancelled` |
| `input_json` | JSON blob: agentType, repo, prompt, ticketId, autoMerge |
| `result_json` | JSON blob: branch name, diff text, noChanges flag, repo |
| `ticket_id` | Optional YouTrack ticket reference |
| `started_at` | ISO timestamp set when process spawns |
| `finished_at` | ISO timestamp set on close |
| `created_at` | ISO timestamp set on insert |

**Table: `agent_logs`**

| Column | What it holds |
|--------|---------------|
| `job_id` | Foreign key to `agent_jobs.id` |
| `level` | `"info"` or `"error"` |
| `message` | One line of agent output |
| `created_at` | ISO timestamp |

---

## Data Flow Summary

```
CLICK "Dispatch"
      │
      ▼
AgentsView.handleDispatch()                   [src/views/AgentsView.jsx:60]
      │  builds { agentType, repo, prompt, ticketId }
      ▼
useAgentJobs.dispatch()                       [src/hooks/useAgentJobs.js:45]
      │  POST /api/jobs  (JSON body, session cookie)
      ▼
routes/jobs.js  POST handler                  [server/routes/jobs.js:33]
      │  validate → insert agent_jobs (status: queued)
      │  broadcast SSE "job" created → all browser tabs
      │  dispatchJob(id) — async, no await
      │  return 201 JSON to browser
      ▼
orchestrator.dispatchJob()                    [server/orchestrator.js:65]
      │  createWorktree() → /tmp/bitacora-agents/<name>
      │  addLog() → SQLite + SSE broadcast "job-log"
      │  updateJobStatus(running) → SQLite + SSE broadcast "job" updated
      │  spawn("claude", [...])  ← THE AGENT STARTS HERE
      ▼
claude CLI (child process, cwd = worktree)
      │  reads CLAUDE.md, performs task, commits
      │  emits stream-json events on stdout
      ▼
orchestrator stdout handler                   [server/orchestrator.js:114]
      │  parse stream-json lines
      │  addLog() per meaningful event → SQLite + SSE "job-log"
      ▼
sse.js broadcast()                            [server/sse.js:37]
      │  writes "event: job-log\ndata: {...}\n\n"
      │  to all open /api/events response streams
      ▼
browser EventSource handler                   [src/hooks/useAgentJobs.js:113]
      │  appends log to activeJobLogs state
      ▼
AgentsView terminal panel re-renders          [src/views/AgentsView.jsx:357]
      │  new log line appears in the dark terminal box
      ▼
agent process exits (code 0 or non-zero)
      ▼
orchestrator close handler                    [server/orchestrator.js:152]
      │  check for file changes (git status / git diff)
      │  store resultJson (branch, diff)
      │  updateJobStatus(done/failed) → SQLite + SSE "job" updated
      │  cleanupWorktree() if no changes or failure
      ▼
browser "job" SSE handler                     [src/hooks/useAgentJobs.js:105]
      │  updates job status in local state
      ▼
job card badge switches from "Running" to "Done" or "Failed"
```

---

## Key Architectural Decisions Worth Understanding

**Why `spawn` instead of a Docker container or API call?**
The current implementation (Phase 3A) runs agents as local processes directly on the VPS. The claude CLI is installed on the machine, the repos are checked out locally, and the orchestrator just spawns subprocesses. The ORCHESTRATION_PLAN.md describes a future Phase C that would move to Docker containers for stronger isolation, but the current design is simpler and works well for single-developer use.

**Why SSE instead of WebSockets or polling?**
Server-Sent Events are unidirectional (server pushes to browser only), which is all that is needed here. The browser never needs to push streaming data back to the server — all commands go through regular HTTP POST endpoints. SSE is simpler to implement and proxy than WebSockets, and it reconnects automatically if the connection drops.

**Why does the server respond 201 before the agent finishes?**
Agent jobs take minutes. You cannot hold an HTTP connection open that long — proxies will time out, the browser may navigate away, and there is no meaningful response body to return mid-stream anyway. The 201 response confirms the job was created and queued. Everything after that is pushed via SSE.

**Why git worktrees instead of full clones?**
`git worktree add` is fast — it does not copy the object database, only creates a new working tree. This means spinning up a worktree for a new job takes under a second even on large repos. Full clones would take much longer and consume significantly more disk space when multiple jobs run concurrently.

**Why store logs in SQLite?**
In-memory log accumulation would be lost on server restart. By writing each log line to `agent_logs`, a user who reloads the page mid-job (or after it finishes) can fetch the full log history via `GET /api/jobs/:id`, which joins `agent_jobs` with `agent_logs` and returns both together.

---

## Files Referenced in This Document

| File | Role |
|------|------|
| `/Users/primo/Experiments/Repos/bitacora-app-dashboard/src/views/AgentsView.jsx` | UI: form, job list, terminal panel |
| `/Users/primo/Experiments/Repos/bitacora-app-dashboard/src/hooks/useAgentJobs.js` | State management, fetch logic, SSE subscription |
| `/Users/primo/Experiments/Repos/bitacora-app-dashboard/src/App.jsx` | Wires `useAgentJobs` into `AgentsView` |
| `/Users/primo/Experiments/Repos/bitacora-app-dashboard/server/routes/jobs.js` | HTTP API: POST, GET, cancel, retry |
| `/Users/primo/Experiments/Repos/bitacora-app-dashboard/server/orchestrator.js` | Agent lifecycle: worktree, spawn, stream, cleanup |
| `/Users/primo/Experiments/Repos/bitacora-app-dashboard/server/worktree.js` | Git operations: create/remove worktrees, diff, PR |
| `/Users/primo/Experiments/Repos/bitacora-app-dashboard/server/sse.js` | In-process SSE broadcaster |
| `/Users/primo/Experiments/Repos/bitacora-app-dashboard/server/routes/events.js` | SSE endpoint: registers browser as a client |
| `/Users/primo/Experiments/Repos/bitacora-app-dashboard/server/schema.js` | Drizzle ORM schema: `agent_jobs`, `agent_logs` |
| `/Users/primo/Experiments/Repos/bitacora-app-dashboard/server/index.js` | Express entry point, route registration |
