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
  const loadingIdRef = useRef(null);

  // ─── Fetch document index on mount ──────────────────────────────
  useEffect(() => {
    fetch(API, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        setIndex(rows);
        if (rows.length > 0) setActiveFileId(rows[0].id);
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, []);

  // ─── Lazy-load content when activeFileId changes ────────────────
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
  }, [activeFileId]);

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

    for (const file of mdFiles) {
      const content = await file.text();
      const name = file.name;
      const path = file.webkitRelativePath || file.name;

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
    contentLoading: contentLoading || initialLoading,
  };
}
