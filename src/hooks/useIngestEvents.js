// ─── hooks/useIngestEvents.js — SSE Auto-refresh ─────────────────
// Opens a Server-Sent Events connection to /api/events.
// When agents push documents or tickets via the ingest API, the server
// broadcasts an "ingest" event and this hook calls the relevant refresh
// callbacks — no manual page reload required.
//
// Reconnects automatically on connection drop (EventSource built-in
// behaviour with exponential back-off handled by the browser).
//
// onDocument(payload) — called when a document ingest event arrives
// onTicket(payload)   — called when a ticket ingest event arrives

import { useEffect, useRef } from "react";

export function useIngestEvents({ onDocument, onTicket }) {
  // Stable refs so the effect closure always sees the latest callbacks
  // without needing to re-open the SSE connection on every render.
  const onDocumentRef = useRef(onDocument);
  const onTicketRef   = useRef(onTicket);

  useEffect(() => {
    onDocumentRef.current = onDocument;
  }, [onDocument]);

  useEffect(() => {
    onTicketRef.current = onTicket;
  }, [onTicket]);

  useEffect(() => {
    const es = new EventSource("/api/events", { withCredentials: true });

    es.addEventListener("ingest", (e) => {
      let payload;
      try {
        payload = JSON.parse(e.data);
      } catch {
        return;
      }

      if (payload.type === "document" && onDocumentRef.current) {
        onDocumentRef.current(payload);
      } else if (payload.type === "ticket" && onTicketRef.current) {
        onTicketRef.current(payload);
      }
    });

    es.onerror = () => {
      // EventSource handles reconnection automatically.
      // No action needed here — the browser will retry.
    };

    return () => {
      es.close();
    };
  }, []); // Empty deps: open once per mount, stable via refs
}
