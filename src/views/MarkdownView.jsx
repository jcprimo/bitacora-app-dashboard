// ─── views/MarkdownView.jsx — Markdown Reader ───────────────────
// Two-panel layout: file list sidebar + rendered Markdown content.
// Supports drag-and-drop, file upload, and persists files in
// localStorage. Re-importing the same filename updates its content
// for live-update workflows (edit in editor → drag back in).

import { useRef, useState, useCallback, useMemo } from "react";
import { renderMarkdown } from "../utils/markdownParser";

export default function MarkdownView({
  files, activeFile, activeFileId, setActiveFileId,
  importFile, importFiles, removeFile,
}) {
  const fileInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleFileSelect = (e) => {
    const selected = e.target.files;
    if (selected?.length) importFiles(selected);
    e.target.value = "";
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragging(false);
    const dropped = e.dataTransfer.files;
    if (dropped?.length) importFiles(dropped);
  }, [importFiles]);

  const handleDragOver = useCallback((e) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDragEnter = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current += 1;
    if (dragCounter.current === 1) setDragging(true);
  }, []);
  const handleDragLeave = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setDragging(false);
  }, []);

  const dropZoneProps = {
    onDrop: handleDrop,
    onDragOver: handleDragOver,
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
  };

  // Memoize rendered HTML to avoid re-parsing on every render
  const renderedHtml = useMemo(
    () => activeFile ? renderMarkdown(activeFile.content) : "",
    [activeFile]
  );

  // Hidden file input (shared)
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept=".md"
      multiple
      onChange={handleFileSelect}
      style={{ display: "none" }}
    />
  );

  // ─── Empty state ──────────────────────────────────────────────────
  if (files.length === 0) {
    return (
      <div className="animate-fade">
        {fileInput}
        <div
          className={`content-panel md-dropzone ${dragging ? "md-dropzone-active" : ""}`}
          style={{ padding: "3rem 2rem", textAlign: "center" }}
          {...dropZoneProps}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>{dragging ? "📥" : "📖"}</div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
            {dragging ? "Drop Markdown files here" : "Markdown Reader"}
          </h2>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", maxWidth: 420, margin: "0 auto 1.5rem" }}>
            {dragging
              ? "Release to import"
              : "Drag & drop .md files here, or click below to browse. Files persist across sessions."}
          </p>
          {!dragging && (
            <button
              className="btn-generate"
              onClick={() => fileInputRef.current?.click()}
              style={{
                maxWidth: 280,
                margin: "0 auto",
                background: "var(--md-accent-bg)",
                borderColor: "var(--md-accent-border)",
                color: "var(--md-accent)",
              }}
            >
              📂 Import .md Files
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── Loaded state: sidebar + reader ───────────────────────────────
  return (
    <div className="animate-fade md-layout" {...dropZoneProps}>
      {dragging && (
        <div className="qa-drop-overlay">
          <div className="md-drop-overlay-content">
            <span style={{ fontSize: "1.5rem" }}>📥</span>
            <span>Drop .md files to add</span>
          </div>
        </div>
      )}

      {fileInput}

      {/* Sidebar — file list */}
      <aside className="md-sidebar">
        <div className="md-sidebar-header">
          <span className="md-sidebar-title">Files</span>
          <button
            className="md-add-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Add .md files"
          >
            +
          </button>
        </div>
        <div className="md-file-list">
          {files.map((f) => (
            <div
              key={f.id}
              className={`md-file-item ${f.id === activeFileId ? "md-file-active" : ""}`}
              onClick={() => setActiveFileId(f.id)}
            >
              <div className="md-file-info">
                <span className="md-file-name">{f.name}</span>
                <span className="md-file-path" title={f.path}>{f.path}</span>
              </div>
              <button
                className="md-file-remove"
                onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                title="Remove file"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Reader — rendered Markdown */}
      <main className="md-reader">
        {activeFile ? (
          <>
            <div className="md-reader-header">
              <span className="md-reader-filename">{activeFile.name}</span>
              <span className="md-reader-meta">
                {new Date(activeFile.updatedAt).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              </span>
            </div>
            <article
              className="md-content"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          </>
        ) : (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
            Select a file from the sidebar
          </div>
        )}
      </main>
    </div>
  );
}
