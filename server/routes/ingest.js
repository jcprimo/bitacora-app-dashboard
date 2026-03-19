// ─── server/routes/ingest.js — Agent Ingest API (token-auth) ─────
// Accepts markdown documents from CLI agents running on the VPS.
// Auth: Bearer token (INGEST_TOKEN env var), not session-based.

import { Router } from "express";
import { db } from "../db.js";
import { documents, users, tickets } from "../schema.js";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireIngestToken } from "../middleware/ingestAuth.js";
import { createIssue as ytCreateIssue, updateIssue as ytUpdateIssue } from "../youtrack.js";
import { broadcast } from "../sse.js";

const router = Router();

router.use(requireIngestToken);

// ─── Helper: get admin user id ──────────────────────────────────
function getAdminId() {
  const [admin] = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1)
    .all();
  return admin?.id;
}

// POST /api/ingest/documents — push a markdown document
// Body: { name, content, agent? }
// Upserts by name so re-pushing the same plan updates it.
router.post("/documents", (req, res) => {
  const { name, content, agent } = req.body;

  if (!name || !content) {
    return res.status(400).json({ error: "name and content are required" });
  }

  if (typeof name !== "string" || name.length > 255) {
    return res.status(400).json({ error: "name must be a string under 255 characters" });
  }

  if (typeof content !== "string" || content.length > 500_000) {
    return res.status(400).json({ error: "content must be a string under 500,000 characters" });
  }

  if (agent !== undefined && (typeof agent !== "string" || !/^[a-z0-9-]+$/i.test(agent))) {
    return res.status(400).json({ error: "agent must contain only alphanumeric characters and hyphens" });
  }

  const adminId = getAdminId();
  if (!adminId) {
    return res.status(500).json({ error: "No admin user exists yet — run setup first" });
  }

  const path = agent ? `agents/${agent}` : "agents";

  // Check if document with same name + admin already exists
  const [existing] = db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.name, name), eq(documents.userId, adminId)))
    .limit(1)
    .all();

  if (existing) {
    db.update(documents)
      .set({ content, path, updatedAt: sql`datetime('now')` })
      .where(eq(documents.id, existing.id))
      .run();
    broadcast("ingest", { type: "document", action: "updated", name });
    return res.json({ ok: true, id: existing.id, action: "updated" });
  }

  const result = db.insert(documents).values({
    userId: adminId,
    name,
    path,
    content,
  }).returning().get();

  broadcast("ingest", { type: "document", action: "created", name });
  return res.status(201).json({ ok: true, id: result.id, action: "created" });
});

// GET /api/ingest/documents — list all agent-pushed docs
router.get("/documents", (_req, res) => {
  const rows = db
    .select({
      id: documents.id,
      name: documents.name,
      path: documents.path,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(sql`${documents.path} LIKE 'agents%'`)
    .all();

  return res.json(rows);
});

// ─── Tickets ─────────────────────────────────────────────────────

const VALID_STATUSES   = ["open", "in-progress", "done", "closed"];
const VALID_PRIORITIES = ["low", "normal", "high", "critical"];
const VALID_TYPES      = ["feature", "bug", "task", "chore"];

// GET /api/ingest/tickets — list tickets, optionally filtered
// Query params:
//   status   — filter by status (open | in-progress | done | closed)
//   priority — filter by priority (low | normal | high | critical)
//   type     — filter by type (feature | bug | task | chore)
//   source   — filter by source agent slug
router.get("/tickets", (req, res) => {
  const { status, priority, type, source } = req.query;

  // Validate filter values so callers get clear errors instead of empty results
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }
  if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({
      error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(", ")}`,
    });
  }
  if (type !== undefined && !VALID_TYPES.includes(type)) {
    return res.status(400).json({
      error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}`,
    });
  }

  // Build WHERE clauses — only add conditions that were actually provided
  const conditions = [];
  if (status   !== undefined) conditions.push(eq(tickets.status,   status));
  if (priority !== undefined) conditions.push(eq(tickets.priority, priority));
  if (type     !== undefined) conditions.push(eq(tickets.type,     type));
  if (source   !== undefined) conditions.push(eq(tickets.source,   source));

  const rows = db
    .select()
    .from(tickets)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(tickets.createdAt))
    .all();

  return res.json(rows);
});

// POST /api/ingest/tickets — create or update a ticket from an agent
// Body: { title, description?, status?, priority?, type?, source?, assignee?, youtrackId? }
// Upserts by title so re-pushing the same ticket updates it rather than duplicating.
router.post("/tickets", (req, res) => {
  const { title, description, status, priority, type, source, assignee, youtrackId } = req.body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return res.status(400).json({ error: "title is required" });
  }
  if (title.length > 255) {
    return res.status(400).json({ error: "title must be 255 characters or fewer" });
  }
  if (status    !== undefined && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
  }
  if (priority  !== undefined && !VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(", ")}` });
  }
  if (type      !== undefined && !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}` });
  }
  if (source    !== undefined && (typeof source    !== "string" || !/^[a-z0-9-]+$/i.test(source))) {
    return res.status(400).json({ error: "source must contain only alphanumeric characters and hyphens" });
  }
  if (assignee  !== undefined && (typeof assignee  !== "string" || assignee.length > 100)) {
    return res.status(400).json({ error: "assignee must be a string under 100 characters" });
  }
  if (youtrackId !== undefined && (typeof youtrackId !== "string" || youtrackId.length > 100)) {
    return res.status(400).json({ error: "youtrackId must be a string under 100 characters" });
  }

  const trimmedTitle = title.trim();

  const [existing] = db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.title, trimmedTitle))
    .limit(1)
    .all();

  if (existing) {
    const updates = { updatedAt: sql`datetime('now')` };
    if (description !== undefined) updates.description = description;
    if (status      !== undefined) updates.status      = status;
    if (priority    !== undefined) updates.priority    = priority;
    if (type        !== undefined) updates.type        = type;
    if (source      !== undefined) updates.source      = source;
    if (assignee    !== undefined) updates.assignee    = assignee;
    if (youtrackId  !== undefined) updates.youtrackId  = youtrackId;

    db.update(tickets)
      .set(updates)
      .where(eq(tickets.id, existing.id))
      .run();

    broadcast("ingest", { type: "ticket", action: "updated", title: trimmedTitle });

    // ── YouTrack sync (update) ──────────────────────────────────
    // Re-fetch the row to get the current youtrackId (may have been
    // set on a previous ingest even if not provided this time).
    const [updated] = db
      .select({ youtrackId: tickets.youtrackId })
      .from(tickets)
      .where(eq(tickets.id, existing.id))
      .limit(1)
      .all();

    const activeYoutrackId = youtrackId ?? updated?.youtrackId;
    if (activeYoutrackId && process.env.YOUTRACK_TOKEN) {
      ytUpdateIssue(activeYoutrackId, {
        summary:     trimmedTitle,
        description: description,
      }).catch((err) => {
        console.error(`[YouTrack] Failed to update issue ${activeYoutrackId}:`, err.message);
      });
    }

    return res.json({ ok: true, id: existing.id, action: "updated" });
  }

  const result = db.insert(tickets).values({
    title: trimmedTitle,
    description:  description  ?? null,
    status:       status       ?? "open",
    priority:     priority     ?? "normal",
    type:         type         ?? "task",
    source:       source       ?? null,
    assignee:     assignee     ?? null,
    youtrackId:   youtrackId   ?? null,
  }).returning().get();

  // ── YouTrack sync (create) ────────────────────────────────────
  if (process.env.YOUTRACK_TOKEN) {
    ytCreateIssue({
      summary:     trimmedTitle,
      description: description,
      priority:    result.priority,
    }).then((ytIssue) => {
      db.update(tickets)
        .set({ youtrackId: ytIssue.id })
        .where(eq(tickets.id, result.id))
        .run();
    }).catch((err) => {
      console.error("[YouTrack] Failed to create issue:", err.message);
    });
  }

  broadcast("ingest", { type: "ticket", action: "created", title: trimmedTitle });
  return res.status(201).json({ ok: true, id: result.id, action: "created" });
});

export default router;
