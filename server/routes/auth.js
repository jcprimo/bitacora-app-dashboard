// ─── server/routes/auth.js — Login / Logout / Register ──────────
import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import { users } from "../schema.js";
import { eq, count } from "drizzle-orm";

const router = Router();
const SALT_ROUNDS = 12;

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const [user] = db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1).all();
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    req.session.userId = user.id;
    req.session.role = user.role;

    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    res.clearCookie("bitacora.sid");
    return res.json({ ok: true });
  });
});

// GET /api/auth/me — current session user
router.get("/me", (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const [user] = db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    role: users.role,
  }).from(users).where(eq(users.id, req.session.userId)).limit(1).all();

  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "User not found" });
  }

  return res.json(user);
});

// POST /api/auth/register — create user
// First user becomes admin automatically. After that, admin-only.
router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    // Check if this is the first user (auto-admin)
    const [{ total }] = db.select({ total: count() }).from(users).all();
    const isFirstUser = total === 0;

    // If not first user, require admin session
    if (!isFirstUser && req.session?.role !== "admin") {
      return res.status(403).json({ error: "Admin access required to register new users" });
    }

    // Check for existing email
    const [existing] = db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase())).limit(1).all();
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const role = isFirstUser ? "admin" : "member";

    const result = db.insert(users).values({
      email: email.toLowerCase(),
      password: hash,
      name: name || null,
      role,
    }).returning({ id: users.id, email: users.email, name: users.name, role: users.role }).get();

    // Auto-login on registration
    req.session.userId = result.id;
    req.session.role = result.role;

    return res.status(201).json(result);
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/setup-status — check if any users exist (public)
router.get("/setup-status", (_req, res) => {
  const [{ total }] = db.select({ total: count() }).from(users).all();
  return res.json({ needsSetup: total === 0 });
});

export default router;
