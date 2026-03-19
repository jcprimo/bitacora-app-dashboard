// ─── server/test/tickets.test.js — Integration tests for Tickets API ─────────
// Uses Node.js built-in test runner (node --test).
//
// Tests both the write path (POST /api/ingest/tickets) and the read path
// (GET /api/tickets and GET /api/tickets/:id), including:
//   - Auth enforcement (401 / 403 / 200)
//   - CRUD: create → 201, upsert → 200
//   - Filter validation (400 on invalid enum values)
//   - Body validation (400 on bad/missing fields)
//
// Strategy:
//   - An in-memory SQLite DB is used — no production data is touched.
//   - TEST_DB_PATH=:memory: is set before any dynamic imports so db.js
//     opens an ephemeral database for this process only.
//   - YouTrack sync is automatically skipped because YOUTRACK_TOKEN is
//     not set in the test environment.
//   - SSE broadcast() is a no-op (no connected clients in tests).
//   - The Express app is assembled inline from the same route modules
//     used in production — this is a true integration test of the HTTP layer.

// ── Env must be set before any import that loads db.js ──────────────────────
process.env.TEST_DB_PATH = ":memory:";
process.env.INGEST_TOKEN = "test-token-abc123";
// Prevent production env checks from failing
process.env.NODE_ENV = "test";
// Silence the session secret warning
process.env.SESSION_SECRET = "test-session-secret-not-used";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

// ── Dynamic imports ensure env vars are set before module evaluation ─────────
// db.js reads TEST_DB_PATH at module load time; dynamic import() runs after
// the synchronous process.env assignments above.
const { sqlite } = await import("../db.js");
const { default: ingestRoutes } = await import("../routes/ingest.js");
const { default: ticketsRoutes } = await import("../routes/tickets.js");
const { default: express } = await import("express");

// ── Build a minimal test Express app ────────────────────────────────────────
function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/ingest", ingestRoutes);
  app.use("/api/tickets", ticketsRoutes);
  return app;
}

// ── Create + teardown the tickets table in the in-memory DB ─────────────────
function createTicketsTable() {
  sqlite.exec(`
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
}

function dropTicketsTable() {
  sqlite.exec("DROP TABLE IF EXISTS tickets;");
}

// ── HTTP helper ──────────────────────────────────────────────────────────────
// Wraps Node's http.request in a promise so tests stay clean.
// Returns { status, body } where body is parsed JSON.
function request(server, method, path, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const port = addr.port;

    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const opts = {
      hostname: "127.0.0.1",
      port,
      path,
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
        ...(payload !== undefined ? { "Content-Length": Buffer.byteLength(payload) } : {}),
      },
    };

    const req = http.request(opts, (res) => {
      let raw = "";
      res.on("data", (chunk) => { raw += chunk; });
      res.on("end", () => {
        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = raw; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });

    req.on("error", reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

// ── Auth header helpers ──────────────────────────────────────────────────────
const VALID_AUTH   = { Authorization: "Bearer test-token-abc123" };
const INVALID_AUTH = { Authorization: "Bearer wrong-token" };

// ── Test suite ───────────────────────────────────────────────────────────────

let server;
let app;

// Shared before/after: start the HTTP server once for all suites
before(() => {
  createTicketsTable();
  app = buildTestApp();
  server = http.createServer(app);
  return new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
});

after(() => {
  dropTicketsTable();
  return new Promise((resolve, reject) => {
    server.close((err) => { if (err) reject(err); else resolve(); });
  });
});

// ── Auth tests ───────────────────────────────────────────────────────────────

describe("GET /api/tickets — auth", () => {
  it("returns 401 without any Authorization header", async () => {
    const res = await request(server, "GET", "/api/tickets");
    assert.equal(res.status, 401);
    assert.ok(res.body.error, "should include an error field");
  });

  it("returns 403 with an invalid token", async () => {
    const res = await request(server, "GET", "/api/tickets", { headers: INVALID_AUTH });
    assert.equal(res.status, 403);
    assert.ok(res.body.error, "should include an error field");
  });

  it("returns 200 with a valid token", async () => {
    const res = await request(server, "GET", "/api/tickets", { headers: VALID_AUTH });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body), "response should be an array");
  });
});

// ── CRUD tests ───────────────────────────────────────────────────────────────

describe("POST /api/ingest/tickets — create and upsert", () => {
  it("creates a new ticket — returns 201 with { ok, id, action: 'created' }", async () => {
    const res = await request(server, "POST", "/api/ingest/tickets", {
      headers: VALID_AUTH,
      body: { title: "Test ticket alpha", priority: "high", type: "bug" },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.ok, true);
    assert.equal(typeof res.body.id, "number");
    assert.equal(res.body.action, "created");
  });

  it("upserts the same ticket by title — returns 200 with { ok, id, action: 'updated' }", async () => {
    // Same title as above → should update
    const res = await request(server, "POST", "/api/ingest/tickets", {
      headers: VALID_AUTH,
      body: { title: "Test ticket alpha", priority: "normal" },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(typeof res.body.id, "number");
    assert.equal(res.body.action, "updated");
  });
});

describe("GET /api/tickets — list and single", () => {
  // Insert a known ticket before these tests so we have stable data
  let createdId;

  before(async () => {
    const res = await request(server, "POST", "/api/ingest/tickets", {
      headers: VALID_AUTH,
      body: { title: "Stable ticket for list tests", status: "open", type: "feature", source: "baal" },
    });
    createdId = res.body.id;
  });

  it("GET /api/tickets returns an array including the created ticket", async () => {
    const res = await request(server, "GET", "/api/tickets", { headers: VALID_AUTH });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    const ids = res.body.map((t) => t.id);
    assert.ok(ids.includes(createdId), `expected id ${createdId} in list, got: ${ids.join(", ")}`);
  });

  it("GET /api/tickets/:id returns a single ticket", async () => {
    const res = await request(server, "GET", `/api/tickets/${createdId}`, { headers: VALID_AUTH });
    assert.equal(res.status, 200);
    assert.equal(res.body.id, createdId);
    assert.equal(res.body.title, "Stable ticket for list tests");
  });

  it("GET /api/tickets/:id with nonexistent id → 404", async () => {
    const res = await request(server, "GET", "/api/tickets/999999", { headers: VALID_AUTH });
    assert.equal(res.status, 404);
    assert.ok(res.body.error, "should include an error field");
  });
});

// ── Filter tests ─────────────────────────────────────────────────────────────

describe("GET /api/tickets — filter by status", () => {
  it("returns 200 with filtered results for status=open", async () => {
    const res = await request(server, "GET", "/api/tickets?status=open", { headers: VALID_AUTH });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    // All returned tickets should have status 'open'
    for (const ticket of res.body) {
      assert.equal(ticket.status, "open", `expected all tickets to have status=open, got: ${ticket.status}`);
    }
  });

  it("returns 400 for status=invalid", async () => {
    const res = await request(server, "GET", "/api/tickets?status=invalid", { headers: VALID_AUTH });
    assert.equal(res.status, 400);
    assert.ok(res.body.error, "should include an error field");
  });

  it("returns 400 for priority=invalid", async () => {
    const res = await request(server, "GET", "/api/tickets?priority=invalid", { headers: VALID_AUTH });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  it("returns 400 for type=invalid", async () => {
    const res = await request(server, "GET", "/api/tickets?type=invalid", { headers: VALID_AUTH });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });
});

// ── Validation tests (POST /api/ingest/tickets) ──────────────────────────────

describe("POST /api/ingest/tickets — body validation", () => {
  it("returns 400 for empty title string", async () => {
    const res = await request(server, "POST", "/api/ingest/tickets", {
      headers: VALID_AUTH,
      body: { title: "" },
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  it("returns 400 for whitespace-only title", async () => {
    const res = await request(server, "POST", "/api/ingest/tickets", {
      headers: VALID_AUTH,
      body: { title: "   " },
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  it("returns 400 for missing title (no key in body)", async () => {
    const res = await request(server, "POST", "/api/ingest/tickets", {
      headers: VALID_AUTH,
      body: { description: "No title provided" },
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  it("returns 400 for title exceeding 255 characters", async () => {
    const longTitle = "x".repeat(256);
    const res = await request(server, "POST", "/api/ingest/tickets", {
      headers: VALID_AUTH,
      body: { title: longTitle },
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  it("returns 400 for invalid status", async () => {
    const res = await request(server, "POST", "/api/ingest/tickets", {
      headers: VALID_AUTH,
      body: { title: "Valid title", status: "pending" },
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  it("returns 400 for invalid priority", async () => {
    const res = await request(server, "POST", "/api/ingest/tickets", {
      headers: VALID_AUTH,
      body: { title: "Valid title", priority: "urgent" },
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  it("returns 400 for invalid type", async () => {
    const res = await request(server, "POST", "/api/ingest/tickets", {
      headers: VALID_AUTH,
      body: { title: "Valid title", type: "epic" },
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  it("accepts a fully populated valid ticket", async () => {
    const res = await request(server, "POST", "/api/ingest/tickets", {
      headers: VALID_AUTH,
      body: {
        title: "Full ticket payload test",
        description: "A detailed description",
        status: "in-progress",
        priority: "critical",
        type: "feature",
        source: "baal",
        assignee: "jc",
      },
    });
    // May be 201 (new) or 200 (if somehow the title exists) — either is valid creation/update
    assert.ok([200, 201].includes(res.status), `expected 200 or 201, got ${res.status}`);
    assert.equal(res.body.ok, true);
  });
});

// ── DELETE tests ──────────────────────────────────────────────────────────────

describe("DELETE /api/tickets/:id", () => {
  let ticketId;

  before(async () => {
    const res = await request(server, "POST", "/api/ingest/tickets", {
      headers: VALID_AUTH,
      body: { title: "Ticket to delete", type: "task", source: "qa-testing" },
    });
    ticketId = res.body.id;
  });

  it("returns 401 without auth", async () => {
    const res = await request(server, "DELETE", `/api/tickets/${ticketId}`);
    assert.equal(res.status, 401);
  });

  it("returns 404 for nonexistent ticket", async () => {
    const res = await request(server, "DELETE", "/api/tickets/999999", { headers: VALID_AUTH });
    assert.equal(res.status, 404);
  });

  it("returns 400 for invalid id", async () => {
    const res = await request(server, "DELETE", "/api/tickets/abc", { headers: VALID_AUTH });
    assert.equal(res.status, 400);
  });

  it("deletes an existing ticket — returns { ok, id, action: 'deleted' }", async () => {
    const res = await request(server, "DELETE", `/api/tickets/${ticketId}`, { headers: VALID_AUTH });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.id, ticketId);
    assert.equal(res.body.action, "deleted");
  });

  it("returns 404 when trying to delete the same ticket again", async () => {
    const res = await request(server, "DELETE", `/api/tickets/${ticketId}`, { headers: VALID_AUTH });
    assert.equal(res.status, 404);
  });

  it("deleted ticket no longer appears in GET /api/tickets", async () => {
    const res = await request(server, "GET", "/api/tickets", { headers: VALID_AUTH });
    assert.equal(res.status, 200);
    const ids = res.body.map((t) => t.id);
    assert.ok(!ids.includes(ticketId), `deleted ticket ${ticketId} should not be in list`);
  });
});
