// ─── hooks/useVisitedTickets.js ───────────────────────────────────
// Tracks which board tickets the user has clicked/visited.
// Source of truth: server-side (tied to user session) so state syncs
// across devices. localStorage is used as a write-through cache for
// instant UI response before the network round-trip completes.
//
// Seeding logic (avoids "everything is new" on first visit):
//   - On first ever load with no server state and no localStorage,
//     we seed the visited set with all currently loaded issue IDs.
//     This means pre-existing tickets start as "visited"; only
//     genuinely new ones will be unvisited.
//   - The seed is written once to both server and localStorage.

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

async function fetchServerVisited() {
  try {
    const res = await fetch("/api/visited-tickets", { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.visitedTicketIds) ? new Set(data.visitedTicketIds) : null;
  } catch {
    return null;
  }
}

async function postVisitedToServer(ids) {
  try {
    await fetch("/api/visited-tickets", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketIds: ids }),
    });
  } catch {
    // network error — localStorage already has the update, will resync on next load
  }
}

export function useVisitedTickets(issues) {
  // Initialise from localStorage immediately for instant render
  const [visited, setVisited] = useState(() => readFromStorage() ?? null);
  const seeded = useRef(visited !== null);
  // Track whether the server sync has completed at least once
  const serverSynced = useRef(false);

  // On mount: fetch server state and merge with localStorage.
  // Server wins for IDs it knows about; localStorage adds any optimistic
  // additions made offline that haven't reached the server yet.
  useEffect(() => {
    let cancelled = false;
    fetchServerVisited().then((serverSet) => {
      if (cancelled) return;
      if (serverSet === null) {
        // Server unreachable — fall back to localStorage-only mode
        serverSynced.current = true;
        return;
      }
      serverSynced.current = true;
      setVisited((prev) => {
        // Merge: union of server state and any local cache
        const local = prev ?? new Set();
        const merged = new Set([...serverSet, ...local]);
        writeToStorage(merged);
        return merged;
      });
    });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Once issues arrive and we have no stored state at all (neither server
  // nor localStorage), seed visited with all current IDs so pre-existing
  // tickets don't show as unvisited.
  useEffect(() => {
    if (seeded.current) return;
    if (!issues || issues.length === 0) return;

    // Re-check storage in case another tab wrote since mount
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

    // Push seed to server so other devices see pre-existing tickets as visited
    postVisitedToServer([...initial]);
  }, [issues]);

  const markVisited = useCallback((id) => {
    setVisited((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) return prev; // no change needed
      next.add(id);
      writeToStorage(next);
      // Async server write — fire and forget
      postVisitedToServer([id]);
      return next;
    });
  }, []);

  // Expose a stable empty Set while seeding so callers don't need null checks.
  return {
    visitedTicketIds: visited ?? new Set(),
    markVisited,
    isSeeded: seeded.current,
  };
}
