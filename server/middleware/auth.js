// ─── server/middleware/auth.js — Session Auth Middleware ─────────
// Checks for an active session. Returns 401 if not authenticated.
// Used on all /api/* routes except /api/auth/login and /api/auth/register.

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
 * Require admin role.
 */
export function requireAdmin(req, res, next) {
  if (req.session && req.session.role === "admin") {
    return next();
  }
  return res.status(403).json({ error: "Admin access required" });
}
