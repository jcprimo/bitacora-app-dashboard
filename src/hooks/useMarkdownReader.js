// ─── hooks/useMarkdownReader.js — Markdown File Manager ──────────
// Manages a collection of Markdown files stored in the backend DB.
//
// On mount, fetches the document index from /api/documents (metadata only).
// Content is lazy-loaded per file via /api/documents/:id.
// Import, update, and delete operations go through the REST API so
// documents are accessible from any device (phone, desktop, etc.).

import { useState, useCallback, useEffect, useRef } from "react";

const API = "/api/documents";

// ═════════════════════════════════════════════════════════════════

export function useMarkdownReader(showToast) {
  const [index, setIndex] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [activeContent, setActiveContent] = useState("");
  const [contentLoading, setContentLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  // Incrementing this counter forces a content re-fetch for the active file
  // even when activeFileId hasn't changed (e.g. after an SSE update event).
  const [contentVersion, setContentVersion] = useState(0);
  const loadingIdRef = useRef(null);

  // ─── Fetch document index ────────────────────────────────────────
  // Extracted as a callback so it can be called imperatively (e.g. from
  // the SSE ingest event handler) as well as on mount.
  // Optional payload: { action: "created"|"updated", name } from SSE.
  const refreshIndex = useCallback((payload) => {
    fetch(API, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        setIndex(rows);
        // Only set the active file on first load (when none is selected yet)
        setActiveFileId((prev) => {
          if (prev === null && rows.length > 0) return rows[0].id;
          // If a new doc was created via SSE, auto-select it
          if (payload?.action === "created" && payload?.name) {
            const created = rows.find((f) => f.name === payload.name);
            if (created) return created.id;
          }
          return prev;
        });
        // If the SSE event was an update, force a content re-fetch for the
        // active file (activeFileId didn't change so the effect won't re-run).
        if (payload?.action === "updated") {
          setContentVersion((v) => v + 1);
        }
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, []);

  useEffect(() => {
    refreshIndex();
  }, [refreshIndex]);

  // ─── Lazy-load content when activeFileId changes or content is stale ──
  useEffect(() => {
    if (!activeFileId) {
      setActiveContent("");
      return;
    }
    setContentLoading(true);
    loadingIdRef.current = activeFileId;

    fetch(`${API}/${activeFileId}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((doc) => {
        if (loadingIdRef.current === activeFileId && doc) {
          setActiveContent(doc.content);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (loadingIdRef.current === activeFileId) {
          setContentLoading(false);
        }
      });
  // contentVersion added so an SSE update triggers a re-fetch even when
  // the active file ID hasn't changed.
  }, [activeFileId, contentVersion]);

  // Build the activeFile object for the view (metadata + content)
  const activeFile = activeFileId
    ? { ...index.find((f) => f.id === activeFileId), content: activeContent }
    : null;

  // File list for sidebar (metadata only — lightweight)
  const files = index;

  // ─── Import a single .md file ───────────────────────────────────
  const importFile = useCallback(async (file) => {
    const content = await file.text();
    const name = file.name;
    const path = file.webkitRelativePath || file.name;

    // Check if a file with this name already exists → update it
    const existing = index.find((f) => f.name === name);

    if (existing) {
      const res = await fetch(`${API}/${existing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, path, content }),
      });
      if (res.ok) {
        setIndex((prev) =>
          prev.map((f) =>
            f.id === existing.id ? { ...f, path, updatedAt: new Date().toISOString() } : f
          )
        );
        setActiveFileId(existing.id);
        // Refresh content if this is the active file
        setActiveContent(content);
        showToast(`Updated ${name}`);
      }
    } else {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, path, content }),
      });
      if (res.ok) {
        const created = await res.json();
        setIndex((prev) => [...prev, created]);
        setActiveFileId(created.id);
        setActiveContent(content);
        showToast(`Added ${name}`);
      }
    }
  }, [index, showToast]);

  // ─── Import multiple files — batched ────────────────────────────
  const importFiles = useCallback(async (fileList) => {
    const mdFiles = Array.from(fileList).filter((f) => f.name.endsWith(".md"));
    if (mdFiles.length === 0) return;

    let lastId = null;
    let lastContent = "";
    // Track names created during this batch so we don't double-POST
    // when index state hasn't updated yet between loop iterations.
    const seen = new Map(); // name → created doc

    for (const file of mdFiles) {
      const content = await file.text();
      const name = file.name;
      const path = file.webkitRelativePath || file.name;

      const existing = index.find((f) => f.name === name) || seen.get(name);

      if (existing) {
        const res = await fetch(`${API}/${existing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name, path, content }),
        });
        if (res.ok) {
          setIndex((prev) =>
            prev.map((f) =>
              f.id === existing.id ? { ...f, path, updatedAt: new Date().toISOString() } : f
            )
          );
          lastId = existing.id;
          lastContent = content;
        }
      } else {
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name, path, content }),
        });
        if (res.ok) {
          const created = await res.json();
          setIndex((prev) => [...prev, created]);
          seen.set(name, created);
          lastId = created.id;
          lastContent = content;
        }
      }
    }

    if (lastId) {
      setActiveFileId(lastId);
      setActiveContent(lastContent);
    }
    showToast(`Imported ${mdFiles.length} file${mdFiles.length > 1 ? "s" : ""}`);
  }, [index, showToast]);

  // ─── Remove a file ──────────────────────────────────────────────
  const removeFile = useCallback(async (fileId) => {
    const res = await fetch(`${API}/${fileId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      setIndex((prev) => {
        const next = prev.filter((f) => f.id !== fileId);
        if (fileId === activeFileId) {
          const newActive = next.length > 0 ? next[0].id : null;
          setActiveFileId(newActive);
        }
        return next;
      });
      showToast("File removed");
    }
  }, [activeFileId, showToast]);

  return {
    files,
    activeFile: contentLoading || initialLoading ? null : activeFile,
    activeFileId,
    setActiveFileId,
    importFile,
    importFiles,
    removeFile,
    refreshIndex,
    contentLoading: contentLoading || initialLoading,
  };
}
