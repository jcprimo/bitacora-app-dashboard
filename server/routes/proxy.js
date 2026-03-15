// ─── server/routes/proxy.js — Server-Side API Proxying ──────────
// Proxies requests to YouTrack, OpenAI, and Anthropic APIs.
// API keys are decrypted from the DB — never exposed to the browser.
//
// Important: Express 5 with {*path} only captures the path segment,
// NOT the query string. We extract the query string from req.originalUrl
// to forward it correctly to the upstream API.

import { Router } from "express";
import { getUserToken } from "./credentials.js";

const router = Router();

/**
 * Extract query string from req.originalUrl.
 * req.originalUrl = "/openai/v1/organization/costs?start_time=123&bucket_width=1d"
 * Returns: "?start_time=123&bucket_width=1d" or ""
 */
function extractQueryString(req) {
  const idx = req.originalUrl.indexOf("?");
  return idx !== -1 ? req.originalUrl.slice(idx) : "";
}

/**
 * Safely read the response body — handles JSON and non-JSON responses.
 * Prevents crashes when upstream returns HTML error pages or empty bodies.
 */
async function safeResponseForward(response, res) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await response.json();
    return res.status(response.status).json(data);
  }

  // Non-JSON response — forward as text but wrap in JSON for consistency
  const text = await response.text();
  if (response.ok) {
    return res.status(response.status).send(text);
  }
  return res.status(response.status).json({
    error: `Upstream returned ${response.status}: ${text.slice(0, 200)}`,
  });
}

// ─── YouTrack proxy: /api/yt/* → YouTrack REST API ──────────────
const YOUTRACK_URL = process.env.YOUTRACK_URL || "https://bitacora.youtrack.cloud";

router.all("/yt/{*path}", async (req, res) => {
  const token = getUserToken(req.session.userId, "youtrack");
  if (!token) {
    return res.status(400).json({ error: "YouTrack token not configured. Add it in Settings." });
  }

  // Express 5 {*path} returns an array of path segments, not a string
  const ytPath = Array.isArray(req.params.path) ? req.params.path.join("/") : req.params.path;
  const qs = extractQueryString(req);
  const url = `${YOUTRACK_URL}/api/${ytPath}${qs}`;

  try {
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };
    if (req.body && Object.keys(req.body).length > 0) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method: req.method,
      headers,
      body: ["POST", "PUT", "PATCH"].includes(req.method) ? JSON.stringify(req.body) : undefined,
    });

    return await safeResponseForward(response, res);
  } catch (err) {
    console.error("YouTrack proxy error:", err.message);
    return res.status(502).json({ error: `YouTrack request failed: ${err.message}` });
  }
});

// ─── OpenAI proxy: /api/openai/* → OpenAI API ───────────────────
router.all("/openai/{*path}", async (req, res) => {
  const token = getUserToken(req.session.userId, "openai");
  if (!token) {
    return res.status(400).json({ error: "OpenAI API key not configured. Add it in Settings." });
  }

  // Express 5 {*path} returns an array of path segments, not a string
  const openaiPath = Array.isArray(req.params.path) ? req.params.path.join("/") : req.params.path;
  const qs = extractQueryString(req);
  const url = `https://api.openai.com/${openaiPath}${qs}`;

  try {
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };
    if (req.body && Object.keys(req.body).length > 0) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method: req.method,
      headers,
      body: ["POST", "PUT", "PATCH"].includes(req.method) ? JSON.stringify(req.body) : undefined,
    });

    return await safeResponseForward(response, res);
  } catch (err) {
    console.error("OpenAI proxy error:", err.message);
    return res.status(502).json({ error: `OpenAI request failed: ${err.message}` });
  }
});

// ─── Anthropic proxy: /api/anthropic/messages → Anthropic API ───
router.post("/anthropic/messages", async (req, res) => {
  const token = getUserToken(req.session.userId, "anthropic");
  if (!token) {
    return res.status(400).json({ error: "Anthropic API key not configured. Add it in Settings." });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": token,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });

    return await safeResponseForward(response, res);
  } catch (err) {
    console.error("Anthropic proxy error:", err.message);
    return res.status(502).json({ error: `Anthropic request failed: ${err.message}` });
  }
});

export default router;
