// ─── hooks/useVisitedDocs.js ──────────────────────────────────────
// Tracks which markdown documents the user has clicked/opened.
// Source of truth: server-side (tied to user session) so state syncs
// across devices. localStorage is used as a write-through cache for
// instant UI response before the network round-trip completes.
//
// Seeding logic (avoids "everything is new" on first visit):
//   - On first ever load with no server state and no localStorage,
//     we seed the visited set with all currently loaded doc IDs.
//     This means pre-existing docs start as "visited"; only
//     genuinely new ones will be unvisited.

import { useState, useCallback, useEffect, useRef } from "react";

const LS_KEY = "bitacora-visited-docs";

function readFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(Number)) : null;
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
    const res = await fetch("/api/visited-docs", { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.visitedDocIds) ? new Set(data.visitedDocIds.map(Number)) : null;
  } catch {
    return null;
  }
}

async function postVisitedToServer(ids) {
  try {
    await fetch("/api/visited-docs", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docIds: ids }),
    });
  } catch {
    // network error — localStorage already has the update, will resync on next load
  }
}

export function useVisitedDocs(docs) {
  // Initialise from localStorage immediately for instant render
  const [visited, setVisited] = useState(() => readFromStorage() ?? null);
  const seeded = useRef(visited !== null);
  const serverSynced = useRef(false);

  // On mount: fetch server state and merge with localStorage.
  useEffect(() => {
    let cancelled = false;
    fetchServerVisited().then((serverSet) => {
      if (cancelled) return;
      if (serverSet === null) {
        serverSynced.current = true;
        return;
      }
      serverSynced.current = true;
      setVisited((prev) => {
        const local = prev ?? new Set();
        const merged = new Set([...serverSet, ...local]);
        writeToStorage(merged);
        return merged;
      });
    });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Seed with all current doc IDs on first ever load (no stored state).
  useEffect(() => {
    if (seeded.current) return;
    if (!docs || docs.length === 0) return;

    const stored = readFromStorage();
    if (stored !== null) {
      setVisited(stored);
      seeded.current = true;
      return;
    }

    const initial = new Set(docs.map((d) => Number(d.id)));
    writeToStorage(initial);
    setVisited(initial);
    seeded.current = true;

    postVisitedToServer([...initial]);
  }, [docs]);

  const markDocVisited = useCallback((id) => {
    const numId = Number(id);
    setVisited((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(numId)) return prev; // no change needed
      next.add(numId);
      writeToStorage(next);
      postVisitedToServer([numId]);
      return next;
    });
  }, []);

  return {
    visitedDocIds: visited ?? new Set(),
    markDocVisited,
    isSeeded: seeded.current,
  };
}
