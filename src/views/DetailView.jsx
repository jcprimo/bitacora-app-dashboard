// ─── views/DetailView.jsx — Single Issue Editor ─────────────────
// Opened from BoardView by clicking an issue card. Provides:
//   - Editable summary and description fields
//   - Inline Stage and Priority dropdowns (instant YouTrack update)
//   - Copy JSON for agent handoff
//   - Lightweight comment thread synced with YouTrack
//   - Delete with two-step confirmation

import { useState } from "react";
import { getCustomFieldValue, formatDate, STAGES, PRIORITIES } from "../youtrack";
import { copyToClipboard } from "../utils/clipboard";
import { renderMarkdown } from "../utils/markdownParser";
import { stageColor, priorityColor, getColorShades } from "../utils/colors";

// ─── Custom pill selector ─────────────────────────────────────────
// Replaces native <select> with clickable pills matching board style
function PillSelector({ label, options, value, onChange, colorFn, disabled }) {
  return (
    <div className="pill-selector-wrap">
      <div className="review-field-label">{label}</div>
      <div className="pill-selector-pills">
        {options.map((opt) => {
          const isActive = opt === value;
          const color = colorFn(opt);
          const shades = getColorShades(color);
          return (
            <button
              key={opt}
              type="button"
              className="pill-selector-btn"
              onClick={() => !disabled && onChange(opt)}
              style={{
                fontWeight: isActive ? 700 : 500,
                border: `1px solid ${isActive ? shades.border : "var(--border-subtle)"}`,
                background: isActive ? shades.bg : "transparent",
                color: isActive ? color : "var(--text-muted)",
              }}
            >
              {isActive ? "✓ " : ""}{opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Comment timestamp helper ─────────────────────────────────────
function commentTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function DetailView({
  activeIssue, editFields, setEditFields,
  actionLoading, confirmDelete, setConfirmDelete,
  saveEdit, changeField, handleDelete,
  setView, showToast,
  comments, commentsLoading, postComment,
}) {
  const [newComment, setNewComment] = useState("");
  const [descView, setDescView] = useState("preview");

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    await postComment(newComment);
    setNewComment("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handlePostComment();
    }
  };

  return (
    <div className="animate-fade">
      <button type="button" className="btn-back" onClick={() => setView("board")} style={{ marginBottom: "1rem" }}>← Back to Board</button>
      <div className="content-panel" style={{ padding: "1.5rem" }}>
        <div className="detail-header">
          <span className="detail-issue-id">{activeIssue.idReadable}</span>
          <div className="detail-spacer" />
          <span className="detail-timestamps">
            Created {formatDate(activeIssue.created)} · Updated {formatDate(activeIssue.updated)}
          </span>
        </div>

        <div className="review-field">
          <div className="review-field-label">Summary</div>
          <input className="review-input" value={editFields.summary}
            onChange={(e) => setEditFields((f) => ({ ...f, summary: e.target.value }))} />
        </div>

        <div className="review-meta" style={{ flexDirection: "column", gap: "0.75rem" }}>
          <PillSelector
            label="Stage"
            options={STAGES}
            value={getCustomFieldValue(activeIssue, "Stage") || "Backlog"}
            onChange={(v) => changeField(activeIssue.idReadable, "Stage", v)}
            colorFn={stageColor}
            disabled={!!actionLoading}
          />
          <PillSelector
            label="Priority"
            options={PRIORITIES}
            value={getCustomFieldValue(activeIssue, "Priority") || "Normal"}
            onChange={(v) => changeField(activeIssue.idReadable, "Priority", v)}
            colorFn={priorityColor}
            disabled={!!actionLoading}
          />
        </div>

        <div className="review-field">
          <div className="desc-field-header">
            <div className="review-field-label" style={{ marginBottom: 0 }}>Description</div>
            <div className="desc-view-tabs">
              <button
                type="button"
                className={`desc-view-tab${descView === "preview" ? " desc-view-tab-active" : ""}`}
                onClick={() => setDescView("preview")}
              >
                Preview
              </button>
              <button
                type="button"
                className={`desc-view-tab${descView === "raw" ? " desc-view-tab-active" : ""}`}
                onClick={() => setDescView("raw")}
              >
                Raw
              </button>
            </div>
          </div>
          {descView === "preview" ? (
            <div
              className="md-content desc-preview"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(editFields.description) }}
            />
          ) : (
            <textarea className="review-textarea" style={{ minHeight: 260 }}
              value={editFields.description}
              onChange={(e) => setEditFields((f) => ({ ...f, description: e.target.value }))} />
          )}
        </div>

        <div className="action-bar">
          <button
            type="button"
            className="btn-back"
            title="Copy ticket as JSON for agent handoff"
            onClick={() => copyToClipboard({
              id: activeIssue.idReadable,
              summary: editFields.summary,
              description: editFields.description,
              stage: getCustomFieldValue(activeIssue, "Stage"),
              priority: getCustomFieldValue(activeIssue, "Priority"),
              created: formatDate(activeIssue.created),
              updated: formatDate(activeIssue.updated),
            }, `${activeIssue.idReadable} JSON`, showToast)}
            style={{ color: "var(--accent-cyan)", borderColor: "rgba(34,211,238,0.3)" }}
          >
            📋 Copy JSON
          </button>
          <button type="button" className="btn-ship" onClick={saveEdit} disabled={actionLoading === "save"}
            style={{ flex: 1, background: "rgba(124,106,255,0.15)", borderColor: "rgba(124,106,255,0.5)", color: "var(--accent-indigo)" }}>
            {actionLoading === "save" ? <><span className="spinner" /> Saving...</> : "💾 Save Changes"}
          </button>
          {!confirmDelete ? (
            <button type="button" className="btn-back" style={{ color: "var(--accent-red)", borderColor: "rgba(248,113,113,0.3)" }}
              onClick={() => setConfirmDelete(true)}>🗑 Delete</button>
          ) : (
            <div className="detail-confirm-delete">
              <span className="detail-confirm-text">Confirm?</span>
              <button type="button" className="btn-back"
                style={{ color: "var(--accent-red)", borderColor: "rgba(248,113,113,0.5)", background: "rgba(248,113,113,0.08)" }}
                onClick={handleDelete} disabled={actionLoading === "delete"}>
                {actionLoading === "delete" ? "Deleting..." : "Yes, delete"}
              </button>
              <button type="button" className="btn-back" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Comments Section ─────────────────────────────────────── */}
      <div className="detail-comments">
        <div className="detail-comments-header">
          <span className="detail-comments-title">
            Comments {!commentsLoading && comments.length > 0 && `(${comments.length})`}
          </span>
        </div>

        {commentsLoading ? (
          <div className="detail-comments-loading">
            <span className="spinner" /> Loading comments...
          </div>
        ) : comments.length === 0 ? (
          <div className="detail-comments-empty">
            <span className="detail-comments-empty-icon">💬</span>
            <span className="detail-comments-empty-text">No comments yet</span>
            <span className="detail-comments-empty-hint">Start a discussion about this ticket</span>
          </div>
        ) : (
          <div className="detail-comments-list">
            {comments.map((c) => (
              <div key={c.id} className="detail-comment">
                <div className="detail-comment-meta">
                  <span className="detail-comment-author">
                    {c.author?.name || c.author?.login || "Unknown"}
                  </span>
                  <span className="detail-comment-time">{commentTime(c.created)}</span>
                </div>
                <div
                  className="detail-comment-text md-content"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(c.text) }}
                />
              </div>
            ))}
          </div>
        )}

        {/* New comment input */}
        <div className="detail-comment-input-row">
          <textarea
            className="detail-comment-textarea"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment..."
            rows={2}
          />
          <button
            type="button"
            className="detail-comment-submit"
            onClick={handlePostComment}
            disabled={!newComment.trim() || actionLoading === "comment"}
          >
            {actionLoading === "comment" ? <span className="spinner" /> : "Send"}
          </button>
        </div>
        <div className="detail-comment-hint">⌘+Enter to send</div>
      </div>
    </div>
  );
}
