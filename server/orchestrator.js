// ─── server/orchestrator.js — Agent Job Orchestrator ──────────────
// Spawns Claude Code CLI processes for agent jobs. Each job runs in
// an isolated git worktree so agents never conflict.
//
// Phase 3A: runs agents as local processes on the VPS.
// Phase 3B: will swap to Docker containers on Mac Mini.
//
// Lifecycle: queued → running → done | failed
//
// The orchestrator:
//   1. Creates a git worktree (isolated branch)
//   2. Spawns `claude -p "<prompt>" --output-format json`
//   3. Streams stdout line-by-line via SSE
//   4. On completion: collects result, creates PR (if auto-merge), updates DB
//   5. Cleans up worktree

import { spawn } from "child_process";
import { resolve } from "path";
import { existsSync, readFileSync } from "fs";
import { db } from "./db.js";
import { agentJobs, agentLogs, documents, users } from "./schema.js";
import { eq, and, sql } from "drizzle-orm";
import { broadcast } from "./sse.js";
import {
  ensureRepo,
  createWorktree,
  cleanupWorktree,
  getRepoPath,
  hasChanges,
  getBranchDiff,
} from "./worktree.js";

// Track running processes for cancellation
const runningJobs = new Map(); // jobId → { process, worktreePath, branch }

// Per-job timeout (30 minutes default, configurable via env)
const JOB_TIMEOUT_MS = parseInt(process.env.JOB_TIMEOUT_MS, 10) || 30 * 60 * 1000;

/**
 * Add a log entry for a job and broadcast it via SSE.
 */
function addLog(jobId, level, message) {
  db.insert(agentLogs).values({ jobId, level, message }).run();
  broadcast("job-log", { jobId, level, message, ts: new Date().toISOString() });
}

/**
 * Update job status in DB and broadcast the change.
 */
function updateJobStatus(jobId, status, extra = {}) {
  const updates = { status, ...extra };
  if (status === "running" && !extra.startedAt) {
    updates.startedAt = new Date().toISOString();
  }
  if (["done", "failed", "cancelled"].includes(status) && !extra.finishedAt) {
    updates.finishedAt = new Date().toISOString();
  }
  db.update(agentJobs).set(updates).where(eq(agentJobs.id, jobId)).run();

  const job = db.select().from(agentJobs).where(eq(agentJobs.id, jobId)).get();
  broadcast("job", { action: "updated", job });
}

/**
 * Read DEBRIEF.md from the worktree if the agent wrote one.
 * Returns the content string, or null if missing or unreadable.
 */
function collectDebrief(worktreePath) {
  const debriefPath = resolve(worktreePath, "DEBRIEF.md");
  try {
    if (existsSync(debriefPath)) {
      return readFileSync(debriefPath, "utf-8");
    }
  } catch (err) {
    // Non-fatal — just means the agent didn't produce one
    console.warn(`[orchestrator] Could not read DEBRIEF.md: ${err.message}`);
  }
  return null;
}

/**
 * Store a debrief in the documents table so it appears in the Docs viewer.
 * Uses the admin user (same as the ingest route convention).
 * No-ops silently on any error so it never blocks job completion.
 */
function ingestDebrief(jobId, agentType, debriefContent) {
  try {
    const [admin] = db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"))
      .limit(1)
      .all();
    if (!admin) return;

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const name = `DEBRIEF-job-${jobId}-${agentType}-${today}.md`;
    const path = `agents/${agentType}`;

    const [existing] = db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.name, name), eq(documents.userId, admin.id)))
      .limit(1)
      .all();

    if (existing) {
      db.update(documents)
        .set({ content: debriefContent, updatedAt: sql`datetime('now')` })
        .where(eq(documents.id, existing.id))
        .run();
    } else {
      db.insert(documents).values({
        userId: admin.id,
        name,
        path,
        content: debriefContent,
      }).run();
    }

    broadcast("ingest", { type: "document", action: "created", name });
  } catch (err) {
    console.error(`[orchestrator] Failed to ingest debrief for job ${jobId}: ${err.message}`);
  }
}

/**
 * Dispatch a job — called after inserting the job record.
 */
export async function dispatchJob(jobId) {
  const job = db.select().from(agentJobs).where(eq(agentJobs.id, jobId)).get();
  if (!job) throw new Error(`Job ${jobId} not found`);
  if (job.status !== "queued") throw new Error(`Job ${jobId} is not queued (status: ${job.status})`);

  const input = JSON.parse(job.inputJson);
  const { agentType, repo, prompt } = input;

  addLog(jobId, "info", `Dispatching ${agentType} agent for ${repo}`);

  // 1. Ensure repo is cloned (ephemeral container — clone fresh if needed)
  //    Then create git worktree for isolated agent work
  let worktreePath, branch;
  try {
    addLog(jobId, "info", `Ensuring repo ${repo} is available...`);
    const repoPath = ensureRepo(repo);
    const result = createWorktree(repoPath, agentType, jobId);
    worktreePath = result.worktreePath;
    branch = result.branch;
    addLog(jobId, "info", `Worktree created: ${branch}`);
  } catch (err) {
    addLog(jobId, "error", `Worktree creation failed: ${err.message}`);
    updateJobStatus(jobId, "failed");
    return;
  }

  // 2. Mark as running
  updateJobStatus(jobId, "running");

  // 3. Spawn claude CLI as the non-root `agent` user.
  //    Claude CLI refuses --dangerously-skip-permissions when running as root.
  //    uid/gid 1000 matches the `agent` system user created in the Dockerfile.
  //    HOME must point to /home/agent so claude can read its config/agents.
  const agentPrompt = buildPrompt(agentType, repo, prompt);
  const proc = spawn("claude", ["-p", agentPrompt, "--agent", agentType, "--dangerously-skip-permissions", "--output-format", "stream-json", "--verbose"], {
    cwd: worktreePath,
    uid: 1000,
    gid: 1000,
    env: {
      ...process.env,
      HOME: "/home/agent",
      // Ensure the agent doesn't inherit our Express port
      PORT: undefined,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  runningJobs.set(jobId, { process: proc, worktreePath, branch });

  // Debug: log spawn result
  const hasToken = !!process.env.CLAUDE_CODE_TOKEN;
  addLog(jobId, "info", `Spawned PID ${proc.pid || "NONE"} | cwd: ${worktreePath} | token: ${hasToken} | agent: ${agentType}`);
  proc.on("error", (err) => {
    addLog(jobId, "error", `Spawn error: ${err.message}`);
  });

  // Timeout kill
  const timeout = setTimeout(() => {
    addLog(jobId, "error", `Job timed out after ${JOB_TIMEOUT_MS / 1000}s`);
    proc.kill("SIGTERM");
  }, JOB_TIMEOUT_MS);

  // Stream stdout
  let outputBuffer = "";
  let chunkCount = 0;
  proc.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    outputBuffer += text;
    chunkCount++;

    // Debug: log first 3 raw chunks to see actual stream-json format
    if (chunkCount <= 3) {
      addLog(jobId, "info", `[DEBUG stdout chunk ${chunkCount}] ${text.slice(0, 500)}`);
    }

    // Parse stream-json lines and broadcast meaningful ones
    const lines = text.split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        // Debug: log event type so we can see what Claude actually sends
        if (chunkCount <= 5) {
          addLog(jobId, "info", `[DEBUG event] type=${event.type} keys=${Object.keys(event).join(",")}`);
        }
        if (event.type === "assistant" && event.message) {
          // Assistant text output
          const content = typeof event.message === "string"
            ? event.message
            : event.message.content || JSON.stringify(event.message);
          addLog(jobId, "info", content);
        } else if (event.type === "tool_use" || event.type === "tool_result") {
          // Tool activity — log tool name only to avoid flooding
          const toolName = event.tool || event.name || "tool";
          addLog(jobId, "info", `[${toolName}] ${event.type}`);
        } else if (event.type === "error") {
          addLog(jobId, "error", event.message || JSON.stringify(event));
        }
      } catch {
        // Not JSON — raw text, broadcast as-is
        if (line.trim()) {
          addLog(jobId, "info", line.trim());
        }
      }
    }
  });

  // Stream stderr
  proc.stderr.on("data", (chunk) => {
    const text = chunk.toString().trim();
    if (text) addLog(jobId, "error", text);
  });

  // On exit
  proc.on("close", async (code) => {
    clearTimeout(timeout);
    runningJobs.delete(jobId);

    // Collect debrief BEFORE any worktree cleanup — files are gone after
    const debriefContent = collectDebrief(worktreePath);
    if (debriefContent) {
      addLog(jobId, "info", "Debrief captured from DEBRIEF.md");
      ingestDebrief(jobId, agentType, debriefContent);
    } else {
      addLog(jobId, "info", "No DEBRIEF.md found — skipping debrief ingestion");
    }

    if (code === 0) {
      // Check if the agent made any changes
      try {
        const changed = hasChanges(worktreePath);
        if (changed) {
          const diff = getBranchDiff(worktreePath, branch);
          const resultJson = JSON.stringify({
            branch,
            diff,
            autoMerge: input.autoMerge,
            repo,
            debrief: debriefContent ?? null,
          });
          updateJobStatus(jobId, "done", { resultJson });
          addLog(jobId, "info", `Job completed. Branch: ${branch}. Changes detected.`);
        } else {
          updateJobStatus(jobId, "done", {
            resultJson: JSON.stringify({
              branch,
              diff: null,
              noChanges: true,
              repo,
              debrief: debriefContent ?? null,
            }),
          });
          addLog(jobId, "info", "Job completed. No file changes.");
          // Clean up worktree if no changes
          cleanupWorktree(worktreePath, branch, getRepoPath(repo));
        }
      } catch (err) {
        addLog(jobId, "error", `Post-processing failed: ${err.message}`);
        updateJobStatus(jobId, "failed");
      }
    } else {
      updateJobStatus(jobId, "failed", {
        resultJson: JSON.stringify({
          branch,
          repo,
          exitCode: code,
          debrief: debriefContent ?? null,
        }),
      });
      addLog(jobId, "error", `Process exited with code ${code}`);
      // Clean up worktree on failure
      try {
        cleanupWorktree(worktreePath, branch, getRepoPath(repo));
      } catch { /* best effort */ }
    }
  });
}

/**
 * Cancel a running job by killing its process.
 */
export function cancelJob(jobId) {
  const entry = runningJobs.get(jobId);
  if (entry) {
    entry.process.kill("SIGTERM");
    runningJobs.delete(jobId);
    // Clean up worktree
    try {
      const job = db.select().from(agentJobs).where(eq(agentJobs.id, jobId)).get();
      const input = JSON.parse(job.inputJson);
      cleanupWorktree(entry.worktreePath, entry.branch, getRepoPath(input.repo));
    } catch { /* best effort */ }
  }
}

/**
 * Build the full prompt for an agent, including context.
 */
function buildPrompt(agentType, repo, userPrompt) {
  const context = [
    `Repo: ${repo} (isolated worktree branch — commit your changes when done).`,
    "",
    "## Task",
    userPrompt,
    "",
    "## Rules",
    "- Read CLAUDE.md before starting.",
    "- Minimal, focused changes only.",
    "- Commit with a clear message.",
    "- Run tests if they exist.",
    "- If you cannot complete the task, explain why.",
    "",
    "## Debrief (required)",
    "Before finishing, write DEBRIEF.md to the repo root (do NOT commit it):",
    "- **What Was Done** — files changed, actions taken",
    "- **Lessons Learned** — gotchas, debugging insights",
    "- **Testing Considerations** — what to test, what might break",
    "- **Critical Changes** — anything affecting other parts of the system",
    "- **Status** — success or failure, and why",
  ];
  return context.join("\n");
}

/**
 * Get status of all running jobs (for health checks).
 */
export function getRunningJobs() {
  return Array.from(runningJobs.entries()).map(([id, entry]) => ({
    id,
    branch: entry.branch,
  }));
}
