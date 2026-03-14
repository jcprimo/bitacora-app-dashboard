// ─── server/routes/usage.js — AI Usage Tracking ─────────────────
import { Router } from "express";
import { db } from "../db.js";
import { aiUsage } from "../schema.js";
import { eq, sql, desc } from "drizzle-orm";

const router = Router();

// GET /api/usage — usage history + aggregates
router.get("/", (req, res) => {
  const userId = req.session.userId;
  const limit = parseInt(req.query.limit) || 50;

  // Aggregates
  const [agg] = db
    .select({
      totalRequests: sql`count(*)`.as("totalRequests"),
      totalInputTokens: sql`coalesce(sum(${aiUsage.inputTokens}), 0)`.as("totalInputTokens"),
      totalOutputTokens: sql`coalesce(sum(${aiUsage.outputTokens}), 0)`.as("totalOutputTokens"),
      totalCost: sql`coalesce(sum(${aiUsage.costUsd}), 0)`.as("totalCost"),
    })
    .from(aiUsage)
    .where(eq(aiUsage.userId, userId))
    .all();

  // Recent history
  const history = db
    .select()
    .from(aiUsage)
    .where(eq(aiUsage.userId, userId))
    .orderBy(desc(aiUsage.createdAt))
    .limit(limit)
    .all();

  return res.json({
    totalRequests: agg.totalRequests,
    totalInputTokens: agg.totalInputTokens,
    totalOutputTokens: agg.totalOutputTokens,
    totalCostUsd: agg.totalCost,
    history,
  });
});

// POST /api/usage — record new AI request
router.post("/", (req, res) => {
  const { agent, provider, inputTokens, outputTokens, costUsd } = req.body;

  if (!agent || !provider) {
    return res.status(400).json({ error: "Agent and provider are required" });
  }

  const result = db.insert(aiUsage).values({
    userId: req.session.userId,
    agent,
    provider,
    inputTokens: inputTokens || 0,
    outputTokens: outputTokens || 0,
    costUsd: costUsd || 0,
  }).returning().get();

  return res.status(201).json(result);
});

// DELETE /api/usage — reset all usage data for current user
router.delete("/", (req, res) => {
  db.delete(aiUsage).where(eq(aiUsage.userId, req.session.userId)).run();
  return res.json({ ok: true });
});

export default router;
