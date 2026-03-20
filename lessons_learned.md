# Lessons Learned

Non-obvious debugging insights, gotchas, and patterns that broke. Read before starting work. Update after shipping.

---

## 2026-03-20 — Agent dispatcher producing no output

**Symptoms:** Dispatched jobs showed "Spawned PID..." then nothing. No logs, no errors, no timeout — just silence.

**Root causes (three stacked issues):**

1. **Missing `--agent` flag.** `spawn()` called `claude -p <prompt>` without `--agent <type>`. Agent `.md` files (system prompt, model override) were never loaded. Jobs ran as vanilla Claude.

2. **Agent files inaccessible inside container.** Docker-compose mounted agents at `/root/.claude/agents:ro`. The non-root `agent` user (uid 1000) can't traverse `/root/` on Alpine (permissions `700`). Symlink from `/home/agent/.claude/agents` was dangling. Fix: mount at `/opt/claude-agents` and symlink from both users.

3. **Missing `--verbose` flag.** Claude CLI requires `--verbose` when combining `-p` (print mode) with `--output-format stream-json`. Without it, CLI exits immediately with an error — but the error went to stderr and wasn't surfaced in the UI. This was the final blocker.

**Bonus issue:** `CLAUDE_CODE_OAUTH_TOKEN` is the env var Claude CLI reads for auth, not `CLAUDE_CODE_TOKEN`. Both must be set in docker-compose.

**Default host path:** Agent definitions live at `/home/bitacora-ops/repos/primo-engineering-team/agents`, not `/opt/bitacora/repos/`.

**How to avoid next time:**
- Test new CLI flags inside the container as the `agent` user before wiring into the orchestrator
- Always surface stderr in the job logs — silent failures kill debugging
- When adding spawn flags, check `claude --help` for required flag combinations
- Mount shared files at neutral paths (e.g., `/opt/`), never under user home dirs

**PRs:** #42 (--agent flag), #43 (mount path fix), #44 (default path), #47 (oauth token env), #48 (--verbose flag)
