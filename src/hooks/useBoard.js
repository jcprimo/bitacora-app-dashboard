// ─── hooks/useBoard.js — Issue List & Filtering ─────────────────
// Fetches issues from YouTrack project BIT, supports free-text
// filtering, and auto-loads on mount when a token is available.
// Default query: "project: BIT sort by: updated desc" (top 50).

import { useState, useCallback, useEffect } from "react";
import { fetchIssues } from "../youtrack";

export function useBoard(token) {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterQuery, setFilterQuery] = useState("");

  const loadIssues = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const q = filterQuery.trim()
        ? `project: BIT ${filterQuery}`
        : "project: BIT sort by: updated desc";
      const data = await fetchIssues(token, { query: q, top: 50 });
      setIssues(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, filterQuery]);

  useEffect(() => {
    if (token) loadIssues();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  return { issues, loading, error, filterQuery, setFilterQuery, loadIssues };
}
