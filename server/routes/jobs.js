// ─── server/routes/jobs.js — Agent Job API ───────────────────────
// CRUD + dispatch for agent_jobs. Session-auth required.
//
// POST   /api/jobs          — dispatch a new job
// GET    /api/jobs          — list jobs (with optional filters)
// GET    /api/jobs/:id      — get single job + logs
// POST   /api/jobs/:id/cancel  — cancel a running/queued job
// POST   /api/jobs/:id/retry   — retry a failed job
//
// Job lifecycle: queued → running → done | failed | cancelled

import { Router } from "express";
import { db } from "../db.js";
import { agentJobs, agentLogs } from "../schema.js";
import { eq, desc, and, inArray } from "drizzle-orm";
import { broadcast } from "../sse.js";
import { dispatchJob, cancelJob } from "../orchestrator.js";

const router = Router();

// Valid agent types that can be dispatched
const CODE_AGENTS = [
  "baal",
  "beast",
  "qa-testing",
  "hades",
  "matute",
  "lucifer",
  "security-compliance",
  "ux-ui-designer",
  "data-analytics",
  "engineer-mentor",
  "customer-success",
  "gtm-agent",
];
const VALID_REPOS = [
  "bitacora-app-dashboard",
  "bitacora-app-ios",
  "primo-engineering",
  "primo-engineering-team",
];

// Auto-merge repos (no human review needed)
const AUTO_MERGE_REPOS = ["bitacora-app-dashboard", "primo-engineering", "primo-engineering-team"];

// ─── POST /api/jobs — Dispatch a new agent job ──────────────────
router.post("/", async (req, res) => {
  const { agentType, repo, prompt, ticketId } = req.body;

  if (!agentType || !repo || !prompt) {
    return res.status(400).json({ error: "agentType, repo, and prompt are required" });
  }
  if (!CODE_AGENTS.includes(agentType)) {
    return res.status(400).json({ error: `Invalid agent type. Must be one of: ${CODE_AGENTS.join(", ")}` });
  }
  if (!VALID_REPOS.includes(repo)) {
    return res.status(400).json({ error: `Invalid repo. Must be one of: ${VALID_REPOS.join(", ")}` });
  }

  const inputJson = JSON.stringify({
    agentType,
    repo,
    prompt,
    ticketId: ticketId || null,
    autoMerge: AUTO_MERGE_REPOS.includes(repo),
  });

  const result = db.insert(agentJobs).values({
    userId: req.session.userId,
    agentType,
    status: "queued",
    inputJson,
    ticketId: ticketId || null,
  }).returning().get();

  // Broadcast to dashboard
  broadcast("job", { action: "created", job: result });

  // Kick off the agent asynchronously
  dispatchJob(result.id).catch((err) => {
    console.error(`[orchestrator] Failed to dispatch job ${result.id}:`, err.message);
  });

  return res.status(201).json(result);
});

// ─── GET /api/jobs — List jobs ──────────────────────────────────
router.get("/", (req, res) => {
  const { status, agentType, limit: rawLimit } = req.query;
  const limit = Math.min(parseInt(rawLimit, 10) || 50, 200);

  let query = db.select().from(agentJobs).orderBy(desc(agentJobs.createdAt)).limit(limit);

  // Apply filters via JS since Drizzle's dynamic where chaining is verbose
  const rows = query.all();
  const filtered = rows.filter((row) => {
    if (status && row.status !== status) return false;
    if (agentType && row.agentType !== agentType) return false;
    return true;
  });

  return res.json(filtered);
});

// ─── GET /api/jobs/:id — Single job + logs ──────────────────────
router.get("/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid job ID" });

  const job = db.select().from(agentJobs).where(eq(agentJobs.id, id)).get();
  if (!job) return res.status(404).json({ error: "Job not found" });

  const logs = db
    .select()
    .from(agentLogs)
    .where(eq(agentLogs.jobId, id))
    .orderBy(agentLogs.createdAt)
    .all();

  // Hoist debrief out of resultJson for convenient access by the UI
  let debrief = null;
  if (job.resultJson) {
    try {
      const parsed = JSON.parse(job.resultJson);
      debrief = parsed.debrief ?? null;
    } catch { /* malformed resultJson — ignore */ }
  }

  return res.json({ ...job, logs, debrief });
});

// ─── POST /api/jobs/:id/cancel — Cancel a queued/running job ────
router.post("/:id/cancel", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid job ID" });

  const job = db.select().from(agentJobs).where(eq(agentJobs.id, id)).get();
  if (!job) return res.status(404).json({ error: "Job not found" });

  if (!["queued", "running"].includes(job.status)) {
    return res.status(400).json({ error: `Cannot cancel job in '${job.status}' state` });
  }

  // Kill the process if running
  cancelJob(id);

  db.update(agentJobs)
    .set({ status: "cancelled", finishedAt: new Date().toISOString() })
    .where(eq(agentJobs.id, id))
    .run();

  broadcast("job", { action: "cancelled", jobId: id });
  return res.json({ ok: true, status: "cancelled" });
});

// ─── POST /api/jobs/:id/retry — Retry a failed/cancelled job ───
router.post("/:id/retry", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid job ID" });

  const job = db.select().from(agentJobs).where(eq(agentJobs.id, id)).get();
  if (!job) return res.status(404).json({ error: "Job not found" });

  if (!["failed", "cancelled"].includes(job.status)) {
    return res.status(400).json({ error: `Cannot retry job in '${job.status}' state` });
  }

  // Create a new job with the same input
  const newJob = db.insert(agentJobs).values({
    userId: req.session.userId,
    agentType: job.agentType,
    status: "queued",
    inputJson: job.inputJson,
    ticketId: job.ticketId,
  }).returning().get();

  broadcast("job", { action: "created", job: newJob });

  dispatchJob(newJob.id).catch((err) => {
    console.error(`[orchestrator] Failed to dispatch retry job ${newJob.id}:`, err.message);
  });

  return res.status(201).json(newJob);
});

export default router;
