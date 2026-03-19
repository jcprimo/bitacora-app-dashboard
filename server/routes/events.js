// ─── server/routes/events.js — SSE Event Stream ──────────────────
// GET /api/events — opens a Server-Sent Events stream for the browser.
// Auth: session (same as other protected routes).
//
// The browser keeps this connection open. When agents push documents or
// tickets via /api/ingest/*, the server broadcasts an "ingest" event here
// and the dashboard refreshes automatically.

import { Router } from "express";
import { addClient, removeClient } from "../sse.js";

const router = Router();

// GET /api/events
router.get("/", (req, res) => {
  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  // Disable buffering in nginx/Caddy (if any intermediate proxy is configured)
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Send an initial comment to confirm the connection
  res.write(": connected\n\n");

  // Register this client
  addClient(res);

  // Keep-alive ping every 25 seconds to prevent proxy timeouts
  const keepAlive = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(keepAlive);
      removeClient(res);
    }
  }, 25_000);

  // Clean up when the browser closes the tab or navigates away
  req.on("close", () => {
    clearInterval(keepAlive);
    removeClient(res);
  });
});

export default router;
