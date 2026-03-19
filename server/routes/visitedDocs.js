// ─── server/routes/visitedDocs.js — Visited Document State ───────
// Session-authenticated endpoints for persisting visited document IDs
// server-side so state syncs across devices.
//
// GET  /api/visited-docs        — returns the user's visited doc ID list
// POST /api/visited-docs        — marks one or more doc IDs as visited

import { Router } from "express";
import { db } from "../db.js";
import { users } from "../schema.js";
import { eq } from "drizzle-orm";

const router = Router();

// GET /api/visited-docs
// Returns { visitedDocIds: number[] }
router.get("/", (req, res) => {
  const [user] = db
    .select({ visitedDocIds: users.visitedDocIds })
    .from(users)
    .where(eq(users.id, req.session.userId))
    .limit(1)
    .all();

  if (!user) return res.status(404).json({ error: "User not found" });

  let ids = [];
  try {
    ids = JSON.parse(user.visitedDocIds || "[]");
    if (!Array.isArray(ids)) ids = [];
  } catch {
    ids = [];
  }

  return res.json({ visitedDocIds: ids });
});

// POST /api/visited-docs
// Body: { docId: number } or { docIds: number[] }
// Adds the provided ID(s) to the user's visited set (no duplicates).
// Returns { visitedDocIds: number[] }
router.post("/", (req, res) => {
  const { docId, docIds } = req.body;

  // Accept either a single ID or a batch — coerce to numbers
  const incoming = [];
  if (docId != null && !isNaN(Number(docId))) incoming.push(Number(docId));
  if (Array.isArray(docIds)) {
    for (const id of docIds) {
      if (!isNaN(Number(id))) incoming.push(Number(id));
    }
  }

  if (incoming.length === 0) {
    return res.status(400).json({ error: "Provide docId (number) or docIds (array)" });
  }

  const [user] = db
    .select({ visitedDocIds: users.visitedDocIds })
    .from(users)
    .where(eq(users.id, req.session.userId))
    .limit(1)
    .all();

  if (!user) return res.status(404).json({ error: "User not found" });

  let current = [];
  try {
    current = JSON.parse(user.visitedDocIds || "[]");
    if (!Array.isArray(current)) current = [];
  } catch {
    current = [];
  }

  const merged = Array.from(new Set([...current, ...incoming]));

  db.update(users)
    .set({ visitedDocIds: JSON.stringify(merged) })
    .where(eq(users.id, req.session.userId))
    .run();

  return res.json({ visitedDocIds: merged });
});

export default router;
