// ─── hooks/useMarkdownReader.js — Markdown File Manager ──────────
// Manages a collection of Markdown files with lazy content loading.
//
// Storage strategy (split for performance):
//   - "bitacora-md-index"          → file metadata array (no content)
//   - "bitacora-md-content-{id}"   → raw Markdown string per file
//
// Only the active file's content is loaded into memory at a time.
// Switching files triggers a lazy load from localStorage.

import { useState, useCallback, useEffect, useRef } from "react";

const INDEX_KEY = "bitacora-md-index";
const CONTENT_PREFIX = "bitacora-md-content-";
const LEGACY_KEY = "bitacora-md-files";

// ─── Storage helpers ─────────────────────────────────────────────

function loadIndex() {
  try {
    const stored = localStorage.getItem(INDEX_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* fall through */ }
  return null;
}

function migrateFromLegacy() {
  try {
    const stored = localStorage.getItem(LEGACY_KEY);
    if (!stored) return [];
    const files = JSON.parse(stored);
    // Split: save each file's content separately, build index
    const index = files.map(({ content, ...meta }) => {
      localStorage.setItem(CONTENT_PREFIX + meta.id, content);
      return meta;
    });
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
    localStorage.removeItem(LEGACY_KEY);
    return index;
  } catch { /* fall through */ }
  return [];
}

function initIndex() {
  return loadIndex() ?? migrateFromLegacy();
}

function saveIndex(entries) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(entries));
}

function saveContent(id, content) {
  localStorage.setItem(CONTENT_PREFIX + id, content);
}

function loadContent(id) {
  return localStorage.getItem(CONTENT_PREFIX + id) || "";
}

function removeContent(id) {
  localStorage.removeItem(CONTENT_PREFIX + id);
}

// ═════════════════════════════════════════════════════════════════

export function useMarkdownReader(showToast) {
  const [index, setIndex] = useState(initIndex);
  const [activeFileId, setActiveFileId] = useState(() => index[0]?.id ?? null);
  const [activeContent, setActiveContent] = useState("");
  const [contentLoading, setContentLoading] = useState(false);
  const loadingIdRef = useRef(null);

  // Lazy-load content when activeFileId changes
  useEffect(() => {
    if (!activeFileId) {
      setActiveContent("");
      return;
    }
    setContentLoading(true);
    loadingIdRef.current = activeFileId;

    // Defer to next frame so the loading overlay paints first
    const raf = requestAnimationFrame(() => {
      const content = loadContent(activeFileId);
      // Guard against stale loads if user switched files quickly
      if (loadingIdRef.current === activeFileId) {
        setActiveContent(content);
        setContentLoading(false);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [activeFileId]);

  // Build the activeFile object for the view (metadata + content)
  const activeFile = activeFileId
    ? { ...index.find((f) => f.id === activeFileId), content: activeContent }
    : null;

  // File list for sidebar (metadata only — lightweight)
  const files = index;

  // Import a single .md file
  const importFile = useCallback(async (file) => {
    const content = await file.text();
    const name = file.name;
    const path = file.webkitRelativePath || file.name;
    const now = Date.now();

    setIndex((prev) => {
      const existing = prev.find((f) => f.name === name);
      let next;
      let targetId;
      if (existing) {
        next = prev.map((f) =>
          f.id === existing.id ? { ...f, path, updatedAt: now } : f
        );
        targetId = existing.id;
        saveContent(existing.id, content);
        showToast(`Updated ${name}`);
      } else {
        const id = `md-${now}`;
        next = [...prev, { id, name, path, addedAt: now, updatedAt: now }];
        targetId = id;
        saveContent(id, content);
        showToast(`Added ${name}`);
      }
      saveIndex(next);
      setTimeout(() => setActiveFileId(targetId), 0);
      return next;
    });
  }, [showToast]);

  // Import multiple files — batched
  const importFiles = useCallback(async (fileList) => {
    const mdFiles = Array.from(fileList).filter((f) => f.name.endsWith(".md"));
    if (mdFiles.length === 0) return;

    const entries = await Promise.all(
      mdFiles.map(async (file) => ({
        name: file.name,
        path: file.webkitRelativePath || file.name,
        content: await file.text(),
      }))
    );

    const now = Date.now();
    setIndex((prev) => {
      let next = [...prev];
      let lastId = null;
      entries.forEach((entry, i) => {
        const existing = next.find((f) => f.name === entry.name);
        if (existing) {
          next = next.map((f) =>
            f.id === existing.id
              ? { ...f, path: entry.path, updatedAt: now + i }
              : f
          );
          saveContent(existing.id, entry.content);
          lastId = existing.id;
        } else {
          const id = `md-${now + i}`;
          next.push({ id, name: entry.name, path: entry.path, addedAt: now + i, updatedAt: now + i });
          saveContent(id, entry.content);
          lastId = id;
        }
      });
      saveIndex(next);
      if (lastId) setTimeout(() => setActiveFileId(lastId), 0);
      return next;
    });
    showToast(`Imported ${entries.length} file${entries.length > 1 ? "s" : ""}`);
  }, [showToast]);

  // Remove a file
  const removeFile = useCallback((fileId) => {
    setIndex((prev) => {
      const next = prev.filter((f) => f.id !== fileId);
      saveIndex(next);
      removeContent(fileId);
      if (fileId === activeFileId) {
        setActiveFileId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
    showToast("File removed");
  }, [activeFileId, showToast]);

  return {
    files,
    activeFile: contentLoading ? null : activeFile,
    activeFileId,
    setActiveFileId,
    importFile,
    importFiles,
    removeFile,
    contentLoading,
  };
}
