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
import { requireAuth, requireAdmin } from "./middleware/auth.js";
import { rateLimit } from "./middleware/rateLimiter.js";

// ─── Routes ──────────────────────────────────────────────────────
import authRoutes from "./routes/auth.js";
import credentialsRoutes from "./routes/credentials.js";
import documentsRoutes from "./routes/documents.js";
import usageRoutes from "./routes/usage.js";
import qaRoutes from "./routes/qa.js";
import proxyRoutes from "./routes/proxy.js";
import ingestRoutes from "./routes/ingest.js";
import ticketsRoutes from "./routes/tickets.js";
import visitedTicketsRoutes from "./routes/visitedTickets.js";
import visitedDocsRoutes from "./routes/visitedDocs.js";
import eventsRoutes from "./routes/events.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === "production";

// ─── Session secret warning (all environments) ──────────────────
const DEFAULT_SECRET = "bitacora-dev-secret-change-in-production";
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === DEFAULT_SECRET) {
  console.warn("[SECURITY] SESSION_SECRET is using the insecure default. Set a strong random value in .env.");
}

// ─── Production env validation (fail-fast) ──────────────────────
if (isProduction) {
  const missing = [];
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === "bitacora-dev-secret-change-in-production") {
    missing.push("SESSION_SECRET (must be a strong random string, not the default)");
  }
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) {
    missing.push("ENCRYPTION_KEY (must be a 64-char hex string — generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\")");
  }
  if (missing.length > 0) {
    console.error("🚨 MATUTE — Production security check FAILED:");
    missing.forEach((m) => console.error(`   ✗ ${m}`));
    console.error("\n   Server cannot start with insecure defaults in production.");
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 8080;

// ─── Trust reverse proxy (Caddy) ────────────────────────────────
// Caddy proxies HTTPS → HTTP to Express on localhost:8080.
// Without this, Express sees all connections as HTTP and refuses to
// set Secure cookies (which require HTTPS). Setting trust proxy = 1
// tells Express to read Caddy's X-Forwarded-Proto header, so it
// knows the original connection was HTTPS.
if (isProduction) {
  app.set("trust proxy", 1);
}

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
    CREATE UNIQUE INDEX IF NOT EXISTS idx_doc_user_name ON documents(user_id, name);

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

    CREATE TABLE IF NOT EXISTS tickets (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      title        TEXT NOT NULL,
      description  TEXT,
      status       TEXT DEFAULT 'open',
      priority     TEXT DEFAULT 'normal',
      type         TEXT DEFAULT 'task',
      source       TEXT,
      assignee     TEXT,
      youtrack_id  TEXT,
      created_at   TEXT DEFAULT (datetime('now')),
      updated_at   TEXT DEFAULT (datetime('now'))
    );
  `);

  // Additive migrations — safe to re-run (ALTER TABLE IF NOT EXISTS not available in SQLite,
  // so we wrap each in a try/catch and ignore "duplicate column" errors).
  const addColumnIfMissing = (table, column, definition) => {
    try {
      sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
    } catch {
      // Column already exists — ignore
    }
  };
  addColumnIfMissing("users", "visited_ticket_ids", "TEXT DEFAULT '[]'");
  addColumnIfMissing("users", "visited_doc_ids",    "TEXT DEFAULT '[]'");

  console.log("✓ Database migrations complete");
}

runMigrations();

// ─── Security headers ────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // inline styles used by the SPA
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: [
        "'self'",
        // Allow server-side proxy targets (via /api/* — never direct from browser)
        // These are kept here as documentation; actual requests go through /api/*
      ],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      ...(isProduction ? { upgradeInsecureRequests: [] } : {}),
    },
  },
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

// ─── Health Check (public, no auth) ─────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ─── API Routes ──────────────────────────────────────────────────
// Auth routes — public (login, register, setup-status)
app.use("/api/auth", authRoutes);

// Ingest routes — token-auth (agents push markdown plans here)
const ingestLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,             // 60 requests per minute per IP
  message: "Too many ingest requests. Please slow down.",
});
app.use("/api/ingest", ingestLimiter, ingestRoutes);

// Tickets routes — token-auth (agents read/query open tickets)
app.use("/api/tickets", ticketsRoutes);

// SSE event stream — session-auth, used by the browser for live updates
app.use("/api/events", requireAuth, eventsRoutes);

// Visited tickets — session-auth (tracks which tickets a user has seen, cross-device)
app.use("/api/visited-tickets", requireAuth, visitedTicketsRoutes);

// Visited docs — session-auth (tracks which markdown docs a user has opened, cross-device)
app.use("/api/visited-docs", requireAuth, visitedDocsRoutes);

// Protected routes — require session
// Credential management (storing/deleting API keys) is admin-only
app.use("/api/credentials", requireAuth, requireAdmin, credentialsRoutes);
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
