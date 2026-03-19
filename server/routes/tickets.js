// ─── server/routes/tickets.js — Agent Tickets Read API ───────────
// Read-only endpoint for agents (e.g. Lucy the PM agent) to query
// open tickets/tasks. Auth: Bearer token (INGEST_TOKEN), same as
// the ingest endpoint.
//
// GET /api/tickets            — list all tickets (newest first)
// GET /api/tickets/:id        — get a single ticket by ID
// DELETE /api/tickets/:id     — delete a ticket by ID
//
// Query params for GET /api/tickets:
//   status   — open | in-progress | done | closed
//   priority — low | normal | high | critical
//   type     — feature | bug | task | chore
//   source   — agent slug (e.g. 'baal', 'lucy')

import { Router } from "express";
import { db } from "../db.js";
import { tickets } from "../schema.js";
import { eq, and, desc } from "drizzle-orm";
import { requireIngestToken } from "../middleware/ingestAuth.js";

const router = Router();

router.use(requireIngestToken);

const VALID_STATUSES   = ["open", "in-progress", "done", "closed"];
const VALID_PRIORITIES = ["low", "normal", "high", "critical"];
const VALID_TYPES      = ["feature", "bug", "task", "chore"];

// GET /api/tickets
router.get("/", (req, res) => {
  const { status, priority, type, source } = req.query;

  if (status   !== undefined && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
  }
  if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(", ")}` });
  }
  if (type     !== undefined && !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}` });
  }

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

// GET /api/tickets/:id
router.get("/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid ticket ID" });
  }

  const [ticket] = db
    .select()
    .from(tickets)
    .where(eq(tickets.id, id))
    .limit(1)
    .all();

  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  return res.json(ticket);
});

// DELETE /api/tickets/:id
router.delete("/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid ticket ID" });
  }

  const [ticket] = db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.id, id))
    .limit(1)
    .all();

  if (!ticket) return res.status(404).json({ error: "Ticket not found" });

  db.delete(tickets).where(eq(tickets.id, id)).run();
  return res.json({ ok: true, id, action: "deleted" });
});

export default router;
