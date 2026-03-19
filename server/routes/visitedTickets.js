// ─── server/routes/visitedTickets.js — Visited Ticket State ──────
// Session-authenticated endpoints for persisting visited ticket IDs
// server-side so state syncs across devices.
//
// GET  /api/visited-tickets        — returns the user's visited ticket ID list
// POST /api/visited-tickets        — marks one or more ticket IDs as visited

import { Router } from "express";
import { db } from "../db.js";
import { users } from "../schema.js";
import { eq, sql } from "drizzle-orm";

const router = Router();

// GET /api/visited-tickets
// Returns { visitedTicketIds: string[] }
router.get("/", (req, res) => {
  const [user] = db
    .select({ visitedTicketIds: users.visitedTicketIds })
    .from(users)
    .where(eq(users.id, req.session.userId))
    .limit(1)
    .all();

  if (!user) return res.status(404).json({ error: "User not found" });

  let ids = [];
  try {
    ids = JSON.parse(user.visitedTicketIds || "[]");
    if (!Array.isArray(ids)) ids = [];
  } catch {
    ids = [];
  }

  return res.json({ visitedTicketIds: ids });
});

// POST /api/visited-tickets
// Body: { ticketId: string } or { ticketIds: string[] }
// Adds the provided ID(s) to the user's visited set (no duplicates).
// Returns { visitedTicketIds: string[] }
router.post("/", (req, res) => {
  const { ticketId, ticketIds } = req.body;

  // Accept either a single ID or a batch
  const incoming = [];
  if (ticketId && typeof ticketId === "string") incoming.push(ticketId);
  if (Array.isArray(ticketIds)) {
    for (const id of ticketIds) {
      if (typeof id === "string") incoming.push(id);
    }
  }

  if (incoming.length === 0) {
    return res.status(400).json({ error: "Provide ticketId (string) or ticketIds (array)" });
  }

  const [user] = db
    .select({ visitedTicketIds: users.visitedTicketIds })
    .from(users)
    .where(eq(users.id, req.session.userId))
    .limit(1)
    .all();

  if (!user) return res.status(404).json({ error: "User not found" });

  let current = [];
  try {
    current = JSON.parse(user.visitedTicketIds || "[]");
    if (!Array.isArray(current)) current = [];
  } catch {
    current = [];
  }

  const merged = Array.from(new Set([...current, ...incoming]));

  db.update(users)
    .set({ visitedTicketIds: JSON.stringify(merged) })
    .where(eq(users.id, req.session.userId))
    .run();

  return res.json({ visitedTicketIds: merged });
});

export default router;
