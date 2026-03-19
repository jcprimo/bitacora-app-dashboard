// ─── server/sse.js — In-process SSE Broadcaster ──────────────────
// Maintains a set of active SSE client response streams.
// Call broadcast(event, data) from any route to push an event to all
// currently connected browser tabs.
//
// This is intentionally simple: single-process, in-memory.
// No Redis pub/sub needed — this dashboard runs on a single VPS process.

const clients = new Set();

/**
 * Register a response stream as an SSE client.
 * The caller is responsible for setting the correct headers before calling
 * this function and for removing the client on close.
 *
 * @param {import("express").Response} res
 */
export function addClient(res) {
  clients.add(res);
}

/**
 * Remove a response stream (on connection close / error).
 *
 * @param {import("express").Response} res
 */
export function removeClient(res) {
  clients.delete(res);
}

/**
 * Broadcast an SSE event to all connected clients.
 *
 * @param {string} event  — SSE event name (e.g. "ingest")
 * @param {object} data   — JSON-serialisable payload
 */
export function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      // Client disconnected mid-write — remove it
      clients.delete(res);
    }
  }
}

/**
 * Returns the number of currently connected SSE clients.
 * Useful for health checks and debug logging.
 */
export function clientCount() {
  return clients.size;
}
