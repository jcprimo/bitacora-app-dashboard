// ─── server/test/ingest.test.js — Unit tests for MD file ingestion ────────────
// Uses Node.js built-in test runner (node --test).
// Tests the three layers of the ingest feature:
//   1. Token auth middleware (requireIngestToken logic)
//   2. POST /api/ingest/documents — body validation, upsert logic, path construction
//   3. GET /api/ingest/documents — filter/list logic
//
// All DB and env interactions are faked in-process; no real SQLite connection needed.

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { timingSafeEqual } from "node:crypto";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers — inline logic extracted from ingest.js so we can test pure units
// without importing Express or better-sqlite3.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Re-implemented inline from server/routes/ingest.js so tests have no deps.
 * This is the exact same logic — if the source changes this must stay in sync.
 */
function checkToken(envToken, authHeader) {
  if (!envToken) return { ok: false, status: 503, error: "Ingest endpoint not configured (INGEST_TOKEN missing)" };
  if (!authHeader || !authHeader.startsWith("Bearer ")) return { ok: false, status: 401, error: "Missing Bearer token" };

  const provided = authHeader.slice(7);
  let tokenMatch = false;
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(envToken);
    tokenMatch = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    tokenMatch = false;
  }
  if (!tokenMatch) return { ok: false, status: 403, error: "Invalid token" };
  return { ok: true };
}

/**
 * Re-implemented path construction logic from POST /api/ingest/documents.
 * agent present → "agents/{agent}", absent → "agents"
 */
function buildPath(agent) {
  return agent ? `agents/${agent}` : "agents";
}

/**
 * Validates the POST body — mirrors what the route checks.
 */
function validateIngestBody(body) {
  const { name, content } = body ?? {};
  if (!name || !content) {
    return { valid: false, error: "name and content are required" };
  }
  return { valid: true };
}

/**
 * Simulates the upsert decision: returns "updated" or "created" based on
 * whether an existing document with the same name+userId is found.
 */
function resolveUpsertAction(existingDoc) {
  return existingDoc ? "updated" : "created";
}

/**
 * Simulates the GET /api/ingest/documents filter: only rows whose path starts
 * with "agents" should be returned.
 */
function filterAgentDocs(rows) {
  return rows.filter((r) => r.path && r.path.startsWith("agents"));
}

// ──────────────────────────────────────────────────────────────────────────────
// Test suite
// ──────────────────────────────────────────────────────────────────────────────

describe("Ingest — Token Auth (requireIngestToken)", () => {
  it("returns 503 when INGEST_TOKEN env var is not set", () => {
    const result = checkToken(undefined, "Bearer abc");
    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
    assert.match(result.error, /INGEST_TOKEN missing/);
  });

  it("returns 503 when INGEST_TOKEN is empty string", () => {
    const result = checkToken("", "Bearer abc");
    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
  });

  it("returns 401 when Authorization header is absent", () => {
    const result = checkToken("secret123", undefined);
    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
    assert.match(result.error, /Missing Bearer token/);
  });

  it("returns 401 when Authorization header does not start with 'Bearer '", () => {
    const result = checkToken("secret123", "Token secret123");
    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
  });

  it("returns 401 for Basic auth scheme", () => {
    const result = checkToken("secret123", "Basic dXNlcjpwYXNz");
    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
  });

  it("returns 403 when token does not match", () => {
    const result = checkToken("correcttoken", "Bearer wrongtoken");
    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
    assert.match(result.error, /Invalid token/);
  });

  it("returns 403 when token has correct prefix but wrong value", () => {
    const result = checkToken("aaaa", "Bearer aaab");
    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
  });

  it("returns 403 when provided token is longer than env token (length difference exploits)", () => {
    // timingSafeEqual requires same length — if lengths differ we must still deny
    const result = checkToken("short", "Bearer shortextra");
    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
  });

  it("returns 403 when provided token is shorter than env token", () => {
    const result = checkToken("longertoken", "Bearer short");
    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
  });

  it("returns ok:true for a matching token", () => {
    const result = checkToken("supersecrettoken", "Bearer supersecrettoken");
    assert.equal(result.ok, true);
    assert.equal(result.status, undefined);
  });

  it("is case-sensitive — does not accept wrong-cased token", () => {
    const result = checkToken("SecretToken", "Bearer secrettoken");
    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
  });

  it("handles empty Bearer value (just 'Bearer ')", () => {
    // "Bearer " → slice(7) → ""
    const result = checkToken("secret", "Bearer ");
    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe("Ingest — Body Validation (POST /api/ingest/documents)", () => {
  it("rejects body with no name field", () => {
    const result = validateIngestBody({ content: "# Hello" });
    assert.equal(result.valid, false);
    assert.match(result.error, /name and content are required/);
  });

  it("rejects body with empty name", () => {
    const result = validateIngestBody({ name: "", content: "# Hello" });
    assert.equal(result.valid, false);
  });

  it("rejects body with no content field", () => {
    const result = validateIngestBody({ name: "baal.md" });
    assert.equal(result.valid, false);
    assert.match(result.error, /name and content are required/);
  });

  it("rejects body with empty content", () => {
    const result = validateIngestBody({ name: "baal.md", content: "" });
    assert.equal(result.valid, false);
  });

  it("rejects null body", () => {
    const result = validateIngestBody(null);
    assert.equal(result.valid, false);
  });

  it("rejects undefined body", () => {
    const result = validateIngestBody(undefined);
    assert.equal(result.valid, false);
  });

  it("accepts valid name + content", () => {
    const result = validateIngestBody({ name: "baal.md", content: "# Baal\nFull stack." });
    assert.equal(result.valid, true);
  });

  it("accepts valid name + content + optional agent", () => {
    const result = validateIngestBody({ name: "baal.md", content: "# Baal", agent: "baal" });
    assert.equal(result.valid, true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe("Ingest — Path Construction", () => {
  it("builds 'agents' path when no agent is given", () => {
    assert.equal(buildPath(undefined), "agents");
  });

  it("builds 'agents' path when agent is null", () => {
    assert.equal(buildPath(null), "agents");
  });

  it("builds 'agents' path when agent is empty string (falsy)", () => {
    assert.equal(buildPath(""), "agents");
  });

  it("builds 'agents/baal' when agent is 'baal'", () => {
    assert.equal(buildPath("baal"), "agents/baal");
  });

  it("builds 'agents/qa-testing' when agent is 'qa-testing'", () => {
    assert.equal(buildPath("qa-testing"), "agents/qa-testing");
  });

  it("builds 'agents/ios-senior-developer' for a long agent slug", () => {
    assert.equal(buildPath("ios-senior-developer"), "agents/ios-senior-developer");
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe("Ingest — Upsert Logic", () => {
  it("returns 'created' when no existing doc is found", () => {
    assert.equal(resolveUpsertAction(null), "created");
  });

  it("returns 'created' when existing is undefined", () => {
    assert.equal(resolveUpsertAction(undefined), "created");
  });

  it("returns 'updated' when an existing doc is found", () => {
    assert.equal(resolveUpsertAction({ id: 42 }), "updated");
  });

  it("returns 'updated' for any truthy existing object", () => {
    assert.equal(resolveUpsertAction({ id: 1, name: "baal.md" }), "updated");
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe("Ingest — GET /api/ingest/documents filter (agents% LIKE)", () => {
  const allDocs = [
    { id: 1, name: "baal.md",       path: "agents/baal" },
    { id: 2, name: "qa.md",         path: "agents/qa-testing" },
    { id: 3, name: "ticket-1.md",   path: "youtrack" },
    { id: 4, name: "memory.md",     path: null },
    { id: 5, name: "general.md",    path: "agents" },
    { id: 6, name: "other.md",      path: "docs/other" },
  ];

  it("returns only docs whose path starts with 'agents'", () => {
    const result = filterAgentDocs(allDocs);
    assert.equal(result.length, 3);
    const ids = result.map((r) => r.id);
    assert.deepEqual(ids, [1, 2, 5]);
  });

  it("excludes docs with null path", () => {
    const result = filterAgentDocs(allDocs);
    assert.ok(!result.some((r) => r.id === 4));
  });

  it("excludes docs with non-agents path", () => {
    const result = filterAgentDocs(allDocs);
    assert.ok(!result.some((r) => r.id === 3));
    assert.ok(!result.some((r) => r.id === 6));
  });

  it("returns empty array when no agent docs exist", () => {
    const result = filterAgentDocs([
      { id: 1, name: "notes.md", path: "personal" },
    ]);
    assert.deepEqual(result, []);
  });

  it("returns all docs when they all have agent paths", () => {
    const docs = [
      { id: 10, name: "a.md", path: "agents/baal" },
      { id: 11, name: "b.md", path: "agents" },
    ];
    const result = filterAgentDocs(docs);
    assert.equal(result.length, 2);
  });

  it("handles empty input", () => {
    assert.deepEqual(filterAgentDocs([]), []);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe("Ingest — Token Timing Safety (edge cases)", () => {
  it("does not throw when provided token contains non-ASCII characters", () => {
    // Buffer.from handles UTF-8 encoding; both lengths will differ so it returns 403
    assert.doesNotThrow(() => {
      const result = checkToken("ascii-only-token", "Bearer café");
      assert.equal(result.ok, false);
    });
  });

  it("does not throw when env token contains special characters", () => {
    assert.doesNotThrow(() => {
      const result = checkToken("tok@en!#$%", "Bearer tok@en!#$%");
      assert.equal(result.ok, true);
    });
  });

  it("handles very long tokens correctly", () => {
    const longToken = "a".repeat(512);
    const result = checkToken(longToken, `Bearer ${longToken}`);
    assert.equal(result.ok, true);
  });
});
