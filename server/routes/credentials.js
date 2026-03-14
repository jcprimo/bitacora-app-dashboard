// ─── server/routes/credentials.js — Encrypted Token CRUD ────────
import { Router } from "express";
import { db } from "../db.js";
import { credentials } from "../schema.js";
import { encrypt, decrypt } from "../middleware/encrypt.js";
import { eq, and } from "drizzle-orm";

const router = Router();
const VALID_SERVICES = ["youtrack", "anthropic", "openai"];

// GET /api/credentials — list configured services (no raw tokens)
router.get("/", (req, res) => {
  const rows = db
    .select({ service: credentials.service, createdAt: credentials.createdAt })
    .from(credentials)
    .where(eq(credentials.userId, req.session.userId))
    .all();

  // Return which services are configured, not the actual tokens
  const configured = {};
  for (const svc of VALID_SERVICES) {
    const row = rows.find((r) => r.service === svc);
    configured[svc] = row ? { configured: true, since: row.createdAt } : { configured: false };
  }

  return res.json(configured);
});

// PUT /api/credentials/:service — store or update encrypted token
router.put("/:service", (req, res) => {
  const { service } = req.params;
  if (!VALID_SERVICES.includes(service)) {
    return res.status(400).json({ error: `Invalid service. Must be one of: ${VALID_SERVICES.join(", ")}` });
  }

  const { token } = req.body;
  if (!token || !token.trim()) {
    return res.status(400).json({ error: "Token is required" });
  }

  const { encrypted, iv, tag } = encrypt(token.trim());

  // Upsert: delete existing then insert
  db.delete(credentials)
    .where(and(eq(credentials.userId, req.session.userId), eq(credentials.service, service)))
    .run();

  db.insert(credentials).values({
    userId: req.session.userId,
    service,
    tokenEnc: encrypted,
    iv,
    tag,
  }).run();

  return res.json({ ok: true, service });
});

// DELETE /api/credentials/:service — remove token
router.delete("/:service", (req, res) => {
  const { service } = req.params;
  if (!VALID_SERVICES.includes(service)) {
    return res.status(400).json({ error: `Invalid service. Must be one of: ${VALID_SERVICES.join(", ")}` });
  }

  db.delete(credentials)
    .where(and(eq(credentials.userId, req.session.userId), eq(credentials.service, service)))
    .run();

  return res.json({ ok: true, service });
});

/**
 * Helper: decrypt a user's token for a given service.
 * Used by proxy routes — not exposed as an endpoint.
 */
export function getUserToken(userId, service) {
  const [row] = db
    .select()
    .from(credentials)
    .where(and(eq(credentials.userId, userId), eq(credentials.service, service)))
    .limit(1)
    .all();

  if (!row) return null;
  return decrypt({ encrypted: row.tokenEnc, iv: row.iv, tag: row.tag });
}

export default router;
