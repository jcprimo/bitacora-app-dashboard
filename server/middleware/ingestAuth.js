// ─── server/middleware/ingestAuth.js — Bearer Token Auth ─────────
// Validates the Authorization: Bearer $INGEST_TOKEN header.
// Used by ingest routes and the agent-facing tickets endpoint.
// Uses timingSafeEqual to prevent timing attacks.

import { timingSafeEqual } from "crypto";

export function requireIngestToken(req, res, next) {
  const token = process.env.INGEST_TOKEN;
  if (!token) {
    return res.status(503).json({ error: "Ingest endpoint not configured (INGEST_TOKEN missing)" });
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Bearer token" });
  }

  const provided = header.slice(7);
  let tokenMatch = false;
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(token);
    tokenMatch = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    tokenMatch = false;
  }

  if (!tokenMatch) {
    return res.status(403).json({ error: "Invalid token" });
  }

  next();
}
