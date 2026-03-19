// ─── hooks/useVisitedTickets.js ───────────────────────────────────
// Tracks which board tickets the user has clicked/visited.
// Persisted in localStorage so state survives page reloads.
//
// Seeding logic (avoids "everything is new" on first visit):
//   - On first ever load (no localStorage entry), we immediately seed
//     the visited set with all currently loaded issue IDs. This means
//     pre-existing tickets start as "visited"; only genuinely new ones
//     (arriving via SSE or loaded for the first time) will be unvisited.
//   - The seed is written once. Subsequent loads read from storage.

import { useState, useCallback, useEffect, useRef } from "react";

const LS_KEY = "bitacora-visited-tickets";

function readFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : null;
  } catch {
    return null;
  }
}

function writeToStorage(set) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...set]));
  } catch {
    // quota exceeded — silently ignore
  }
}

export function useVisitedTickets(issues) {
  // null means "not seeded yet" — we wait until issues are loaded
  const [visited, setVisited] = useState(() => readFromStorage() ?? null);
  const seeded = useRef(visited !== null);

  // Once issues arrive and we have no stored state, seed visited with all
  // current IDs so pre-existing tickets don't show as unvisited.
  useEffect(() => {
    if (seeded.current) return;
    if (!issues || issues.length === 0) return;

    // Double-check storage (another tab may have written since mount)
    const stored = readFromStorage();
    if (stored !== null) {
      setVisited(stored);
      seeded.current = true;
      return;
    }

    const initial = new Set(issues.map((i) => i.id));
    writeToStorage(initial);
    setVisited(initial);
    seeded.current = true;
  }, [issues]);

  const markVisited = useCallback((id) => {
    setVisited((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) return prev; // no change needed
      next.add(id);
      writeToStorage(next);
      return next;
    });
  }, []);

  // Expose a stable empty Set while seeding so callers don't need null checks.
  // After seeding, all current tickets are in `visited` so none show as new.
  return {
    visitedTicketIds: visited ?? new Set(),
    markVisited,
    isSeeded: seeded.current,
  };
}
