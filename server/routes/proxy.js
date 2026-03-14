// ─── server/routes/proxy.js — Server-Side API Proxying ──────────
// Proxies requests to YouTrack, OpenAI, and Anthropic APIs.
// API keys are decrypted from the DB — never exposed to the browser.

import { Router } from "express";
import { getUserToken } from "./credentials.js";

const router = Router();

// ─── YouTrack proxy: /api/yt/* → YouTrack REST API ──────────────
const YOUTRACK_URL = process.env.YOUTRACK_URL || "https://bitacora.youtrack.cloud";

router.all("/yt/{*path}", async (req, res) => {
  const token = getUserToken(req.session.userId, "youtrack");
  if (!token) {
    return res.status(400).json({ error: "YouTrack token not configured. Add it in Settings." });
  }

  const ytPath = req.params.path;
  const qs = req._parsedUrl?.search || "";
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

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      return res.status(response.status).json(data);
    }
    const text = await response.text();
    return res.status(response.status).send(text);
  } catch (err) {
    console.error("YouTrack proxy error:", err.message);
    return res.status(502).json({ error: "YouTrack request failed" });
  }
});

// ─── OpenAI proxy: /api/openai/* → OpenAI API ───────────────────
router.all("/openai/{*path}", async (req, res) => {
  const token = getUserToken(req.session.userId, "openai");
  if (!token) {
    return res.status(400).json({ error: "OpenAI API key not configured. Add it in Settings." });
  }

  const openaiPath = req.params.path;
  const qs = req._parsedUrl?.search || "";
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

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error("OpenAI proxy error:", err.message);
    return res.status(502).json({ error: "OpenAI request failed" });
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

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error("Anthropic proxy error:", err.message);
    return res.status(502).json({ error: "Anthropic request failed" });
  }
});

export default router;
