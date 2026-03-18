// ─── server/routes/documents.js — Markdown Document CRUD ────────
import { Router } from "express";
import { db } from "../db.js";
import { documents } from "../schema.js";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

// GET /api/documents — list user's documents (without content for perf)
router.get("/", (req, res) => {
  const rows = db
    .select({
      id: documents.id,
      name: documents.name,
      path: documents.path,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(eq(documents.userId, req.session.userId))
    .all();

  return res.json(rows);
});

// GET /api/documents/:id — get single document with content
router.get("/:id", (req, res) => {
  const [doc] = db
    .select()
    .from(documents)
    .where(and(eq(documents.id, parseInt(req.params.id)), eq(documents.userId, req.session.userId)))
    .limit(1)
    .all();

  if (!doc) return res.status(404).json({ error: "Document not found" });
  return res.json(doc);
});

// POST /api/documents — create document
router.post("/", (req, res) => {
  const { name, path, content } = req.body;
  if (!name || !content) {
    return res.status(400).json({ error: "Name and content are required" });
  }
  if (typeof name !== "string" || name.length > 255) {
    return res.status(400).json({ error: "Name must be 255 characters or fewer" });
  }
  if (path !== undefined && (typeof path !== "string" || path.length > 512)) {
    return res.status(400).json({ error: "Path must be 512 characters or fewer" });
  }
  if (typeof content !== "string" || content.length > 500_000) {
    return res.status(400).json({ error: "Content must be 500,000 characters or fewer" });
  }

  const result = db.insert(documents).values({
    userId: req.session.userId,
    name,
    path: path || null,
    content,
  }).returning().get();

  return res.status(201).json(result);
});

// PUT /api/documents/:id — update document content
router.put("/:id", (req, res) => {
  const { name, path, content } = req.body;

  const [existing] = db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.id, parseInt(req.params.id)), eq(documents.userId, req.session.userId)))
    .limit(1)
    .all();

  if (!existing) return res.status(404).json({ error: "Document not found" });

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (path !== undefined) updates.path = path;
  if (content !== undefined) updates.content = content;
  updates.updatedAt = sql`datetime('now')`;

  // Include userId in WHERE to prevent IDOR — only the owner can update
  db.update(documents)
    .set(updates)
    .where(and(eq(documents.id, parseInt(req.params.id)), eq(documents.userId, req.session.userId)))
    .run();

  return res.json({ ok: true, id: parseInt(req.params.id) });
});

// DELETE /api/documents/:id — remove document
router.delete("/:id", (req, res) => {
  const result = db
    .delete(documents)
    .where(and(eq(documents.id, parseInt(req.params.id)), eq(documents.userId, req.session.userId)))
    .run();

  if (result.changes === 0) return res.status(404).json({ error: "Document not found" });
  return res.json({ ok: true });
});

export default router;
