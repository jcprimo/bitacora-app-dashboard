// ─── server/middleware/rateLimiter.js — Rate Limiting ──────────────
// In-memory sliding-window rate limiter for auth endpoints.
// No external dependency required — uses a simple Map with TTL cleanup.

const attempts = new Map();
const CLEANUP_INTERVAL = 60_000; // Clean expired entries every 60s

// Periodic cleanup of expired entries to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    // Remove entries where all timestamps have expired
    entry.timestamps = entry.timestamps.filter((t) => now - t < entry.windowMs);
    if (entry.timestamps.length === 0) {
      attempts.delete(key);
    }
  }
}, CLEANUP_INTERVAL).unref(); // .unref() so it doesn't keep the process alive

/**
 * Create a rate limiter middleware.
 * @param {object} opts
 * @param {number} opts.windowMs - Time window in milliseconds (default: 15 min)
 * @param {number} opts.max - Max requests per window (default: 10)
 * @param {string} opts.message - Error message on limit exceeded
 * @param {boolean} opts.keyByEmail - Also key by request body email (for login endpoint)
 */
export function rateLimit({ windowMs = 15 * 60 * 1000, max = 10, message = "Too many requests, please try again later", keyByEmail = false } = {}) {
  return (req, res, next) => {
    const now = Date.now();

    // Always apply IP-based limiting
    const ipKey = `ip:${req.ip}:${req.originalUrl}`;
    checkAndRecord(ipKey, windowMs, max, res, message);
    if (res.headersSent) return;

    // Optionally also apply account-based limiting (keyed by email)
    if (keyByEmail) {
      const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase().trim() : null;
      if (email) {
        const emailKey = `email:${email}:${req.originalUrl}`;
        checkAndRecord(emailKey, windowMs, max, res, message);
        if (res.headersSent) return;
      }
    }

    return next();
  };
}

/**
 * Internal helper: check + record a single rate-limit key.
 * Writes a 429 response (with Retry-After) if limit exceeded.
 */
function checkAndRecord(key, windowMs, max, res, message) {
  const now = Date.now();

  if (!attempts.has(key)) {
    attempts.set(key, { timestamps: [], windowMs });
  }

  const entry = attempts.get(key);
  entry.windowMs = windowMs;

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= max) {
    const retryAfter = Math.ceil((entry.timestamps[0] + windowMs - now) / 1000);
    res.set("Retry-After", String(retryAfter));
    res.status(429).json({ error: message });
    return;
  }

  entry.timestamps.push(now);
}
