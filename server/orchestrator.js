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
import { db } from "./db.js";
import { agentJobs, agentLogs } from "./schema.js";
import { eq } from "drizzle-orm";
import { broadcast } from "./sse.js";
import {
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
 * Dispatch a job — called after inserting the job record.
 */
export async function dispatchJob(jobId) {
  const job = db.select().from(agentJobs).where(eq(agentJobs.id, jobId)).get();
  if (!job) throw new Error(`Job ${jobId} not found`);
  if (job.status !== "queued") throw new Error(`Job ${jobId} is not queued (status: ${job.status})`);

  const input = JSON.parse(job.inputJson);
  const { agentType, repo, prompt } = input;

  addLog(jobId, "info", `Dispatching ${agentType} agent for ${repo}`);

  // 1. Create git worktree
  let worktreePath, branch;
  try {
    const repoPath = getRepoPath(repo);
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

  // 3. Spawn claude CLI
  const agentPrompt = buildPrompt(agentType, repo, prompt);
  const proc = spawn("claude", ["-p", agentPrompt, "--output-format", "stream-json"], {
    cwd: worktreePath,
    env: {
      ...process.env,
      // Ensure the agent doesn't inherit our Express port
      PORT: undefined,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  runningJobs.set(jobId, { process: proc, worktreePath, branch });

  // Timeout kill
  const timeout = setTimeout(() => {
    addLog(jobId, "error", `Job timed out after ${JOB_TIMEOUT_MS / 1000}s`);
    proc.kill("SIGTERM");
  }, JOB_TIMEOUT_MS);

  // Stream stdout
  let outputBuffer = "";
  proc.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    outputBuffer += text;

    // Parse stream-json lines and broadcast meaningful ones
    const lines = text.split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
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
          });
          updateJobStatus(jobId, "done", { resultJson });
          addLog(jobId, "info", `Job completed. Branch: ${branch}. Changes detected.`);
        } else {
          updateJobStatus(jobId, "done", {
            resultJson: JSON.stringify({ branch, diff: null, noChanges: true, repo }),
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
      updateJobStatus(jobId, "failed");
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
    `You are the ${agentType} agent working on the ${repo} repository.`,
    `Branch: you are on an isolated worktree branch. Commit your changes when done.`,
    `Repo: ${repo}`,
    "",
    "## Task",
    userPrompt,
    "",
    "## Rules",
    "- Read CLAUDE.md and any relevant docs before starting.",
    "- Make focused, minimal changes. Do not refactor unrelated code.",
    "- Commit with a clear message describing what you did and why.",
    "- If tests exist, run them before committing.",
    "- If you cannot complete the task, explain why clearly.",
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
