// ─── views/MarkdownView.jsx — Markdown Reader ───────────────────
// Two-panel layout: file list sidebar + rendered Markdown content.
// Content is lazy-loaded per file. A loading overlay displays while
// the file is being read from storage and parsed.
// Panels are resizable via a drag handle between sidebar and reader.

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

  // ─── Resizable sidebar ─────────────────────────────────────────
  // sidebarWidth is in pixels; user drags the handle to resize.
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isDraggingHandle = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const layoutRef = useRef(null);

  const onHandleMouseDown = useCallback((e) => {
    e.preventDefault();
    isDraggingHandle.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = sidebarWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [sidebarWidth]);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isDraggingHandle.current) return;
      const delta = e.clientX - dragStartX.current;
      const newWidth = Math.max(140, Math.min(420, dragStartWidth.current + delta));
      setSidebarWidth(newWidth);
      if (sidebarCollapsed) setSidebarCollapsed(false);
    };
    const onMouseUp = () => {
      if (!isDraggingHandle.current) return;
      isDraggingHandle.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [sidebarCollapsed]);

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

  // ─── Loaded state: sidebar + resize handle + reader ───────────────
  return (
    <div
      ref={layoutRef}
      className="animate-fade md-layout-flex"
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

      {/* Sidebar — file list */}
      <aside
        className="md-sidebar"
        style={{ width: sidebarCollapsed ? 0 : sidebarWidth, minWidth: sidebarCollapsed ? 0 : 140, flexShrink: 0 }}
      >
        {!sidebarCollapsed && (
          <>
            <div className="md-sidebar-header">
              <span className="md-sidebar-title">Files ({files.length})</span>
              <div style={{ display: "flex", gap: "0.3rem" }}>
                <button
                  type="button"
                  className="md-add-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Add .md files"
                >
                  +
                </button>
              </div>
            </div>
            {/* File list — sidebar scrolls when list overflows sidebar height */}
            <div className="md-file-list md-file-list-scroll">
              {files.map((f) => {
                const isVisited = visitedDocIds.has(Number(f.id));
                return (
                <div
                  key={f.id}
                  className={`md-file-item ${f.id === activeFileId ? "md-file-active" : ""} ${!isVisited ? "md-file-unvisited" : ""}`}
                  onClick={() => { setActiveFileId(f.id); markDocVisited(f.id); }}
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
        )}
      </aside>

      {/* Drag handle + collapse toggle */}
      <div className="md-resize-handle" onMouseDown={onHandleMouseDown}>
        <button
          type="button"
          className="md-collapse-btn"
          onClick={() => setSidebarCollapsed((v) => !v)}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? "›" : "‹"}
        </button>
      </div>

      {/* Reader — rendered Markdown */}
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
