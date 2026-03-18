// ─── server/routes/qa.js — QA Test Case CRUD ────────────────────
import { Router } from "express";
import { db } from "../db.js";
import { qaTestCases } from "../schema.js";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

// GET /api/qa/cases — list test cases for current user
router.get("/cases", (req, res) => {
  const rows = db
    .select()
    .from(qaTestCases)
    .where(eq(qaTestCases.userId, req.session.userId))
    .all();

  return res.json(rows);
});

// POST /api/qa/import — bulk import from CSV (JSON array)
router.post("/import", (req, res) => {
  const { fileName, cases } = req.body;
  if (!Array.isArray(cases) || cases.length === 0) {
    return res.status(400).json({ error: "Cases array is required" });
  }
  if (cases.length > 10_000) {
    return res.status(400).json({ error: "Cannot import more than 10,000 cases at once" });
  }
  if (fileName !== undefined && (typeof fileName !== "string" || fileName.length > 255)) {
    return res.status(400).json({ error: "File name must be 255 characters or fewer" });
  }

  const userId = req.session.userId;

  // Clear existing cases for this user before import
  db.delete(qaTestCases).where(eq(qaTestCases.userId, userId)).run();

  // Bulk insert
  const values = cases.map((tc) => ({
    userId,
    fileName: fileName || null,
    testId: tc.Test_ID || tc.test_id || `TC-${Math.random().toString(36).slice(2, 8)}`,
    category: tc.Category || tc.category || null,
    testName: tc.Test_Name || tc.test_name || null,
    description: tc.Description || tc.description || null,
    priority: tc.Priority || tc.priority || null,
    status: tc.Status || tc.status || "Not Started",
    ferpaFlag: tc.FERPA_Flag || tc.ferpa_flag || null,
    ticketId: null,
    ticketStage: null,
    dataJson: JSON.stringify(tc),
  }));

  db.insert(qaTestCases).values(values).run();

  return res.status(201).json({ ok: true, imported: values.length });
});

// PUT /api/qa/cases/:id — update case (status, ticket link)
router.put("/cases/:id", (req, res) => {
  const { status, ticketId, ticketStage } = req.body;

  const [existing] = db
    .select({ id: qaTestCases.id })
    .from(qaTestCases)
    .where(and(eq(qaTestCases.id, parseInt(req.params.id)), eq(qaTestCases.userId, req.session.userId)))
    .limit(1)
    .all();

  if (!existing) return res.status(404).json({ error: "Test case not found" });

  const updates = {};
  if (status !== undefined) updates.status = status;
  if (ticketId !== undefined) updates.ticketId = ticketId;
  if (ticketStage !== undefined) updates.ticketStage = ticketStage;

  db.update(qaTestCases).set(updates).where(and(eq(qaTestCases.id, parseInt(req.params.id)), eq(qaTestCases.userId, req.session.userId))).run();

  return res.json({ ok: true, id: parseInt(req.params.id) });
});

// DELETE /api/qa/cases — clear all cases for current user
router.delete("/cases", (req, res) => {
  db.delete(qaTestCases).where(eq(qaTestCases.userId, req.session.userId)).run();
  return res.json({ ok: true });
});

export default router;
