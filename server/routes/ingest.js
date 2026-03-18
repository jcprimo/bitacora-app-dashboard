// ─── server/routes/ingest.js — Agent Ingest API (token-auth) ─────
// Accepts markdown documents from CLI agents running on the VPS.
// Auth: Bearer token (INGEST_TOKEN env var), not session-based.

import { Router } from "express";
import { db } from "../db.js";
import { documents, users } from "../schema.js";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

// ─── Token auth middleware ───────────────────────────────────────
function requireIngestToken(req, res, next) {
  const token = process.env.INGEST_TOKEN;
  if (!token) {
    return res.status(503).json({ error: "Ingest endpoint not configured (INGEST_TOKEN missing)" });
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Bearer token" });
  }

  if (header.slice(7) !== token) {
    return res.status(403).json({ error: "Invalid token" });
  }

  next();
}

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
    return res.json({ ok: true, id: existing.id, action: "updated" });
  }

  const result = db.insert(documents).values({
    userId: adminId,
    name,
    path,
    content,
  }).returning().get();

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

export default router;
