// ─── server/index.js — Express Entry Point ──────────────────────
// Serves the React SPA (dist/) and API routes.
// Replaces nginx for both static serving and API proxying.

import "dotenv/config";
import express from "express";
import session from "express-session";
import connectSqlite3 from "connect-sqlite3";
import helmet from "helmet";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

// ─── Database init (creates tables on first run) ─────────────────
import { sqlite } from "./db.js";
import { requireAuth } from "./middleware/auth.js";

// ─── Routes ──────────────────────────────────────────────────────
import authRoutes from "./routes/auth.js";
import credentialsRoutes from "./routes/credentials.js";
import documentsRoutes from "./routes/documents.js";
import usageRoutes from "./routes/usage.js";
import qaRoutes from "./routes/qa.js";
import proxyRoutes from "./routes/proxy.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;

// ─── Run migrations (create tables) ─────────────────────────────
function runMigrations() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      email      TEXT UNIQUE NOT NULL,
      password   TEXT NOT NULL,
      name       TEXT,
      role       TEXT DEFAULT 'member',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS credentials (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      service    TEXT NOT NULL,
      token_enc  TEXT NOT NULL,
      iv         TEXT NOT NULL,
      tag        TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_cred_user_svc ON credentials(user_id, service);

    CREATE TABLE IF NOT EXISTS documents (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      name       TEXT NOT NULL,
      path       TEXT,
      content    TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_usage (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id),
      agent         TEXT NOT NULL,
      provider      TEXT NOT NULL,
      input_tokens  INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cost_usd      REAL DEFAULT 0,
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS qa_test_cases (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL REFERENCES users(id),
      file_name    TEXT,
      test_id      TEXT NOT NULL,
      category     TEXT,
      test_name    TEXT,
      description  TEXT,
      priority     TEXT,
      status       TEXT DEFAULT 'Not Started',
      ferpa_flag   TEXT,
      ticket_id    TEXT,
      ticket_stage TEXT,
      data_json    TEXT,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agent_jobs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      agent_type  TEXT NOT NULL,
      status      TEXT DEFAULT 'queued',
      input_json  TEXT NOT NULL,
      result_json TEXT,
      ticket_id   TEXT,
      started_at  TEXT,
      finished_at TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agent_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id     INTEGER NOT NULL REFERENCES agent_jobs(id),
      level      TEXT DEFAULT 'info',
      message    TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  console.log("✓ Database migrations complete");
}

runMigrations();

// ─── Security headers ────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // SPA handles its own CSP
}));

// ─── Body parsing ────────────────────────────────────────────────
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: false }));

// ─── Sessions (SQLite-backed) ────────────────────────────────────
const SQLiteStore = connectSqlite3(session);
const dataDir = resolve(__dirname, "..", "data");

app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.db",
      dir: dataDir,
    }),
    name: "bitacora.sid",
    secret: process.env.SESSION_SECRET || "bitacora-dev-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

// ─── API Routes ──────────────────────────────────────────────────
// Auth routes — public (login, register, setup-status)
app.use("/api/auth", authRoutes);

// Protected routes — require session
app.use("/api/credentials", requireAuth, credentialsRoutes);
app.use("/api/documents", requireAuth, documentsRoutes);
app.use("/api/usage", requireAuth, usageRoutes);
app.use("/api/qa", requireAuth, qaRoutes);
app.use("/api", requireAuth, proxyRoutes);

// ─── Static files (React SPA) ───────────────────────────────────
const distDir = resolve(__dirname, "..", "dist");

if (existsSync(distDir)) {
  // Serve static assets with caching
  app.use(
    express.static(distDir, {
      maxAge: "30d",
      immutable: true,
      index: false, // handle index.html via fallback
    })
  );

  // SPA fallback — all non-API, non-file routes serve index.html
  app.get("/{*path}", (_req, res) => {
    res.sendFile(resolve(distDir, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.json({
      status: "API running",
      message: "No dist/ found. Run 'npm run build' first.",
    });
  });
}

// ─── Start ───────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✓ Bitacora server running on http://localhost:${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`  Database: ${resolve(dataDir, "bitacora.db")}`);
});
