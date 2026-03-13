// ─── views/DetailView.jsx — Single Issue Editor ─────────────────
// Opened from BoardView by clicking an issue card. Provides:
//   - Editable summary and description fields
//   - Inline Stage and Priority dropdowns (instant YouTrack update)
//   - Copy JSON for agent handoff
//   - Delete with two-step confirmation
// After saving, navigates back to the Board view.

import { getCustomFieldValue, formatDate, STAGES, PRIORITIES } from "../youtrack";
import { copyToClipboard } from "../utils/clipboard";

export default function DetailView({
  activeIssue, editFields, setEditFields,
  actionLoading, confirmDelete, setConfirmDelete,
  saveEdit, changeField, handleDelete,
  setView, showToast,
}) {
  return (
    <div className="animate-fade">
      <button className="btn-back" onClick={() => setView("board")} style={{ marginBottom: "1rem" }}>← Back to Board</button>
      <div className="content-panel" style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent-indigo)" }}>
            {activeIssue.idReadable}
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: "0.62rem", color: "var(--text-dim)" }}>
            Created {formatDate(activeIssue.created)} · Updated {formatDate(activeIssue.updated)}
          </span>
        </div>

        <div className="review-field">
          <div className="review-field-label">Summary</div>
          <input className="review-input" value={editFields.summary}
            onChange={(e) => setEditFields((f) => ({ ...f, summary: e.target.value }))} />
        </div>

        <div className="review-meta">
          <div className="meta-item">
            <div className="review-field-label">Stage</div>
            <select className="review-select"
              value={getCustomFieldValue(activeIssue, "Stage") || "Backlog"}
              onChange={(e) => changeField(activeIssue.idReadable, "Stage", e.target.value)}
              disabled={!!actionLoading}>
              {STAGES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="meta-item">
            <div className="review-field-label">Priority</div>
            <select className="review-select"
              value={getCustomFieldValue(activeIssue, "Priority") || "Normal"}
              onChange={(e) => changeField(activeIssue.idReadable, "Priority", e.target.value)}
              disabled={!!actionLoading}>
              {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div className="review-field">
          <div className="review-field-label">Description</div>
          <textarea className="review-textarea" style={{ minHeight: 260 }}
            value={editFields.description}
            onChange={(e) => setEditFields((f) => ({ ...f, description: e.target.value }))} />
        </div>

        <div className="action-bar">
          <button
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
          <button className="btn-ship" onClick={saveEdit} disabled={actionLoading === "save"}
            style={{ flex: 1, background: "rgba(124,106,255,0.15)", borderColor: "rgba(124,106,255,0.5)", color: "var(--accent-indigo)" }}>
            {actionLoading === "save" ? <><span className="spinner" /> Saving...</> : "💾 Save Changes"}
          </button>
          {!confirmDelete ? (
            <button className="btn-back" style={{ color: "var(--accent-red)", borderColor: "rgba(248,113,113,0.3)" }}
              onClick={() => setConfirmDelete(true)}>🗑 Delete</button>
          ) : (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.68rem", color: "var(--accent-red)", fontWeight: 600 }}>Confirm?</span>
              <button className="btn-back"
                style={{ color: "var(--accent-red)", borderColor: "rgba(248,113,113,0.5)", background: "rgba(248,113,113,0.08)" }}
                onClick={handleDelete} disabled={actionLoading === "delete"}>
                {actionLoading === "delete" ? "Deleting..." : "Yes, delete"}
              </button>
              <button className="btn-back" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
