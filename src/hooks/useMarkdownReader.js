// ─── hooks/useMarkdownReader.js — Markdown File Manager ──────────
// Manages a collection of Markdown files: import, persist, select,
// and remove. Files are stored in localStorage with their content,
// filename, and original file path (for live-update reference).
//
// localStorage key: "bitacora-md-files"

import { useState, useCallback, useMemo } from "react";

const STORAGE_KEY = "bitacora-md-files";

/**
 * File entry shape:
 * {
 *   id:        string  — unique ID (timestamp-based)
 *   name:      string  — file name (e.g. "README.md")
 *   path:      string  — original file path (from File.webkitRelativePath or name)
 *   content:   string  — raw Markdown content
 *   addedAt:   number  — timestamp when first imported
 *   updatedAt: number  — timestamp of last re-import
 * }
 */

function loadFiles() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* fall through */ }
  return [];
}

function saveFiles(files) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
}

export function useMarkdownReader(showToast) {
  const [files, setFiles] = useState(loadFiles);
  const [activeFileId, setActiveFileId] = useState(() => {
    const loaded = loadFiles();
    return loaded.length > 0 ? loaded[0].id : null;
  });

  // Currently selected file
  const activeFile = useMemo(
    () => files.find((f) => f.id === activeFileId) || null,
    [files, activeFileId]
  );

  // Import a .md file — if same name exists, update its content
  const importFile = useCallback(async (file) => {
    const content = await file.text();
    const name = file.name;
    const path = file.webkitRelativePath || file.name;
    const now = Date.now();

    setFiles((prev) => {
      const existing = prev.find((f) => f.name === name);
      let next;
      if (existing) {
        // Update existing file's content
        next = prev.map((f) =>
          f.id === existing.id
            ? { ...f, content, path, updatedAt: now }
            : f
        );
        showToast(`Updated ${name}`);
      } else {
        // Add new file
        const entry = { id: `md-${now}`, name, path, content, addedAt: now, updatedAt: now };
        next = [...prev, entry];
        showToast(`Added ${name}`);
      }
      saveFiles(next);
      // Auto-select the imported file
      const target = next.find((f) => f.name === name);
      if (target) setTimeout(() => setActiveFileId(target.id), 0);
      return next;
    });
  }, [showToast]);

  // Import multiple files at once
  const importFiles = useCallback(async (fileList) => {
    for (const file of fileList) {
      if (file.name.endsWith(".md")) {
        await importFile(file);
      }
    }
  }, [importFile]);

  // Remove a file from the collection
  const removeFile = useCallback((fileId) => {
    setFiles((prev) => {
      const next = prev.filter((f) => f.id !== fileId);
      saveFiles(next);
      // If we removed the active file, select the first remaining
      if (fileId === activeFileId) {
        setActiveFileId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
    showToast("File removed");
  }, [activeFileId, showToast]);

  return {
    files,
    activeFile,
    activeFileId,
    setActiveFileId,
    importFile,
    importFiles,
    removeFile,
  };
}
