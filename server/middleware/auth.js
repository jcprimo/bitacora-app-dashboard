// ─── server/middleware/auth.js — Session Auth Middleware ─────────
// Checks for an active session. Returns 401 if not authenticated.
// Used on all /api/* routes except /api/auth/login and /api/auth/register.

import { db } from "../db.js";
import { users } from "../schema.js";
import { eq } from "drizzle-orm";

/**
 * Require authenticated session.
 */
export function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: "Not authenticated" });
}

/**
 * Require admin role — re-fetches role from DB to prevent stale session privilege.
 */
export function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(403).json({ error: "Admin access required" });
  }

  const [user] = db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, req.session.userId))
    .limit(1)
    .all();

  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  return next();
}
