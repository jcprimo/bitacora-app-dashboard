// ─── views/BoardView.jsx — Issue List & Filter ──────────────────
// Displays all Bitacora issues in a vertical list. Each card shows
// the issue ID, summary, Stage/Priority badges, and last updated time.
// Supports free-text YouTrack query filtering (e.g. "priority: Critical").
// Click a card → opens DetailView. Stage dropdown allows inline updates.

import { getCustomFieldValue, formatDate, STAGES } from "../youtrack";
import { priorityColor, stageColor } from "../utils/colors";

export default function BoardView({ issues, loading, filterQuery, setFilterQuery, loadIssues, openDetail, changeField }) {
  return (
    <div className="animate-fade">
      <div className="board-filter-bar">
        <input
          className="config-input"
          style={{ flex: 1, fontSize: "0.78rem", padding: "0.55rem 0.85rem", borderRadius: "var(--radius-md)" }}
          placeholder="Filter Bitacora: priority: Critical  or  Stage: Develop  or  free text..."
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && loadIssues()}
        />
        <button className="btn btn-config" style={{ padding: "0.55rem 1rem", width: "auto" }} onClick={loadIssues}>
          Search
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {issues.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-dim)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📭</div>
            <div style={{ fontSize: "0.82rem" }}>No issues in Bitacora</div>
            <div style={{ fontSize: "0.7rem", marginTop: "0.25rem" }}>Create your first ticket to get started</div>
          </div>
        )}

        {issues.map((issue) => {
          const priority = getCustomFieldValue(issue, "Priority");
          const stage = getCustomFieldValue(issue, "Stage");
          return (
            <div
              key={issue.id}
              className="panel"
              style={{ padding: "0.85rem 1rem", cursor: "pointer", borderColor: "var(--border-subtle)" }}
              onClick={() => openDetail(issue)}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-medium)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                <span style={{
                  fontSize: "0.68rem", fontWeight: 700, fontFamily: "var(--font-mono)",
                  color: "var(--accent-indigo)", minWidth: "58px", paddingTop: "2px",
                }}>
                  {issue.idReadable}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>
                    {issue.summary}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
                    {stage && (
                      <span style={{
                        fontSize: "0.58rem", fontWeight: 700, padding: "0.15rem 0.45rem",
                        borderRadius: 10, background: `${stageColor(stage)}15`,
                        color: stageColor(stage), border: `1px solid ${stageColor(stage)}30`,
                      }}>{stage}</span>
                    )}
                    {priority && (
                      <span style={{
                        fontSize: "0.58rem", fontWeight: 700, padding: "0.15rem 0.45rem",
                        borderRadius: 10, background: `${priorityColor(priority)}15`,
                        color: priorityColor(priority), border: `1px solid ${priorityColor(priority)}30`,
                      }}>{priority}</span>
                    )}
                    <span style={{ fontSize: "0.58rem", color: "var(--text-dim)" }}>
                      {formatDate(issue.updated || issue.created)}
                    </span>
                  </div>
                </div>
                <select
                  className="review-select"
                  style={{ fontSize: "0.62rem", padding: "0.25rem 0.4rem", minWidth: 90 }}
                  value={stage || "Backlog"}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => { e.stopPropagation(); changeField(issue.idReadable, "Stage", e.target.value); }}
                >
                  {STAGES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
