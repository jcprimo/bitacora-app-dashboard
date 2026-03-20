// ─── views/MarkdownView.jsx — Markdown Reader ───────────────────
// Drawer-first layout: reader fills full width by default.
// A "Files (N)" button in the reader header opens a slide-in overlay
// drawer from the left with a backdrop — on all screen sizes.
//
// The permanent sidebar and resize handle have been removed in favor
// of the drawer paradigm exclusively.

import { useRef, useState, useCallback, useEffect } from "react";
import { renderMarkdown } from "../utils/markdownParser";

export default function MarkdownView({
  files, activeFile, activeFileId, setActiveFileId,
  importFile, importFiles, removeFile, contentLoading,
  visitedDocIds = new Set(), markDocVisited = () => {},
}) {
  const fileInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

  // Deferred markdown rendering — parse off the main paint
  const [renderedHtml, setRenderedHtml] = useState("");
  const [rendering, setRendering] = useState(false);

  // ─── Drawer state ─────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer and select a file
  const handleFileSelect = useCallback((id) => {
    setActiveFileId(id);
    markDocVisited(id);
    setDrawerOpen(false);
  }, [setActiveFileId, markDocVisited]);

  // ─── Markdown rendering ────────────────────────────────────────
  const activeContent = activeFile?.content ?? "";

  useEffect(() => {
    if (!activeContent) {
      setRenderedHtml("");
      setRendering(false);
      return;
    }
    setRendering(true);
    const raf = requestAnimationFrame(() => {
      setRenderedHtml(renderMarkdown(activeContent));
      setRendering(false);
    });
    return () => cancelAnimationFrame(raf);
  }, [activeContent]);

  const isLoading = contentLoading || rendering;

  // ─── File input handlers ───────────────────────────────────────
  const handleFileInputChange = (e) => {
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

  // Hidden file input (shared)
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept=".md"
      multiple
      onChange={handleFileInputChange}
      style={{ display: "none" }}
    />
  );

  // ─── File list (rendered inside the drawer) ────────────────────
  const fileList = (
    <>
      <div className="md-sidebar-header">
        <span className="md-sidebar-title">Files ({files.length})</span>
        <div className="md-sidebar-header-actions">
          <button
            type="button"
            className="md-add-btn"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Add .md files"
            title="Add .md files"
          >
            +
          </button>
        </div>
      </div>
      <div className="md-file-list md-file-list-scroll">
        {files.map((f) => {
          const isVisited = visitedDocIds.has(Number(f.id));
          return (
            <div
              key={f.id}
              className={`md-file-item ${f.id === activeFileId ? "md-file-active" : ""} ${!isVisited ? "md-file-unvisited" : ""}`}
              onClick={() => handleFileSelect(f.id)}
            >
              <div className="md-file-info">
                <span className="md-file-name">{f.name}</span>
                <span className="md-file-path" title={f.path}>{f.path}</span>
              </div>
              <button
                type="button"
                className="md-file-remove"
                onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                title="Remove file"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </>
  );

  // ─── Empty state ───────────────────────────────────────────────
  if (files.length === 0) {
    return (
      <div className="animate-fade" style={{ flex: 1, display: "flex", flexDirection: "column", padding: "2rem" }}>
        {fileInput}
        <div
          className={`content-panel md-dropzone ${dragging ? "md-dropzone-active" : ""}`}
          style={{ padding: "3rem 2rem", textAlign: "center", flex: 1 }}
          {...dropZoneProps}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>{dragging ? "📥" : "📖"}</div>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
            {dragging ? "Drop Markdown files here" : "Markdown Reader"}
          </h2>
          <p style={{ fontSize: "var(--text-base)", color: "var(--text-muted)", maxWidth: 420, margin: "0 auto 1.5rem" }}>
            {dragging
              ? "Release to import"
              : "Drag & drop .md files here, or click below to browse. Files persist across sessions."}
          </p>
          {!dragging && (
            <button
              type="button"
              className="btn-generate"
              onClick={() => fileInputRef.current?.click()}
              style={{
                maxWidth: 280,
                margin: "0 auto",
                background: "var(--accent-indigo-bg)",
                borderColor: "var(--accent-indigo-border)",
                color: "var(--accent-indigo)",
              }}
            >
              📂 Import .md Files
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── Loaded state: drawer + full-width reader ──────────────────
  return (
    <div className="animate-fade" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="view-header">
        <h1 className="view-title">Docs</h1>
        <p className="view-desc">Browse and read agent-generated reports, plans, and documentation.</p>
      </div>
      <div
        className="md-layout-flex"
        {...dropZoneProps}
      >
        {dragging && (
          <div className="qa-drop-overlay">
            <div className="md-drop-overlay-content">
              <span style={{ fontSize: "1.5rem" }}>📥</span>
              <span>Drop .md files to add</span>
            </div>
          </div>
        )}

        {fileInput}

        {/* ── Backdrop ────────────────────────────────────────────── */}
        <div
          className={`md-mobile-overlay-backdrop${drawerOpen ? " md-mobile-overlay-backdrop--open" : ""}`}
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />

        {/* ── File drawer ─────────────────────────────────────────── */}
        <div
          className={`md-mobile-file-drawer${drawerOpen ? " md-mobile-file-drawer--open" : ""}`}
          role="dialog"
          aria-label="File list"
        >
          {fileList}
        </div>

        {/* ── Reader panel ────────────────────────────────────────── */}
        <main className="md-reader" style={{ flex: 1, minWidth: 0 }}>
          {isLoading ? (
            <div className="md-loading-overlay">
              <div className="md-loading-modal">
                <div className="md-loading-spinner" />
                <span className="md-loading-text">Rendering document...</span>
              </div>
            </div>
          ) : activeFile ? (
            <>
              <div className="md-reader-header">
                <button
                  type="button"
                  className="md-mobile-files-btn"
                  onClick={() => setDrawerOpen(true)}
                  aria-label="Open file list"
                >
                  ☰ Files ({files.length})
                </button>
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
            <div className="md-reader-select-hint">
              <div style={{ display: "flex", justifyContent: "center" }}>
                <button type="button" className="md-mobile-files-btn" onClick={() => setDrawerOpen(true)}>
                  ☰ Open Files
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
