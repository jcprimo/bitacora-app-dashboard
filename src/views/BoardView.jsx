// ─── views/BoardView.jsx — Issue List & Filter ──────────────────
// Displays all Bitacora issues in a vertical list. Each card shows
// the issue ID, summary, Stage/Priority badges, and last updated time.
// Supports free-text YouTrack query filtering and client-side pill
// filters for Stage and Priority. "Done" tickets are hidden by default
// with a toggle to reveal them.
// Click a card → opens DetailView. Stage dropdown allows inline updates.

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { getCustomFieldValue, formatDate, STAGES, PRIORITIES } from "../youtrack";
import { priorityColor, stageColor, getColorShades } from "../utils/colors";

export default function BoardView({ issues, loading, filterQuery, setFilterQuery, loadIssues, openDetail, changeField, newTicketIds, clearNewTicket, visitedTicketIds, markVisited }) {
  // ─── Client-side filters ───────────────────────────────────────
  const [stageFilter, setStageFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [hideDone, setHideDone] = useState(true);

  // ─── Sort state ────────────────────────────────────────────────
  const [sortDir, setSortDir] = useState("desc");
  const toggleSort = () => setSortDir((d) => (d === "desc" ? "asc" : "desc"));

  // ─── Inline search toggle ──────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(!!filterQuery);
  const searchInputRef = useRef(null);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    // defer focus until after the input becomes visible
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, []);

  const closeSearch = useCallback(() => {
    if (filterQuery) return; // keep open when there's an active query
    setSearchOpen(false);
  }, [filterQuery]);

  const clearSearch = useCallback(() => {
    setFilterQuery("");
    setSearchOpen(false);
    searchInputRef.current?.blur();
  }, [setFilterQuery]);

  // "/" shortcut to open search (only when not focused on another input)
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== "/") return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      openSearch();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [openSearch]);

  const doneCount = useMemo(
    () => issues.filter((i) => getCustomFieldValue(i, "Stage") === "Done").length,
    [issues]
  );

  const filteredIssues = useMemo(() => {
    const filtered = issues.filter((issue) => {
      const stage = getCustomFieldValue(issue, "Stage");
      const priority = getCustomFieldValue(issue, "Priority");
      if (hideDone && stage === "Done") return false;
      if (stageFilter !== "All" && stage !== stageFilter) return false;
      if (priorityFilter !== "All" && priority !== priorityFilter) return false;
      return true;
    });
    filtered.sort((a, b) => {
      const numA = parseInt((a.idReadable || "").replace(/\D/g, ""), 10) || 0;
      const numB = parseInt((b.idReadable || "").replace(/\D/g, ""), 10) || 0;
      return sortDir === "desc" ? numB - numA : numA - numB;
    });
    return filtered;
  }, [issues, stageFilter, priorityFilter, hideDone, sortDir]);

  const activeFilterCount =
    (stageFilter !== "All" ? 1 : 0) +
    (priorityFilter !== "All" ? 1 : 0);

  return (
    <div className="animate-fade">
      {/* Pill filters */}
      <div className="board-pills">
        {/* Stage filter — inline search toggle lives at the end of this row */}
        <div className="board-pill-row">
          <span className="board-pill-label">Stage</span>
          <div className="board-pill-group">
            {["All", ...STAGES].map((s) => {
              const isActive = s === stageFilter;
              const color = s === "All" ? "var(--text-secondary)" : stageColor(s);
              const shades = s === "All" ? null : getColorShades(color);
              return (
                <button
                  key={s}
                  type="button"
                  className={`board-pill ${isActive ? "board-pill-active" : ""}`}
                  onClick={() => setStageFilter(s)}
                  style={isActive ? {
                    color,
                    borderColor: shades ? shades.border : color + "60",
                    background: shades ? shades.bg : color + "14",
                  } : undefined}
                >
                  {isActive ? "✓ " : ""}{s}
                </button>
              );
            })}
          </div>

          {/* Inline search toggle — right-anchored */}
          <div className="board-search-wrap">
            <input
              ref={searchInputRef}
              type="text"
              className={`board-search-input${searchOpen ? " board-search-input--open" : ""}`}
              placeholder="YouTrack query…"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") loadIssues();
                if (e.key === "Escape") closeSearch();
              }}
              onBlur={() => closeSearch()}
              aria-label="Search issues"
            />
            {filterQuery && searchOpen && (
              <button
                type="button"
                className="board-search-clear"
                onMouseDown={(e) => e.preventDefault()} // prevent blur before click
                onClick={clearSearch}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
            <button
              type="button"
              className={`board-search-toggle${searchOpen ? " board-search-toggle--active" : ""}`}
              onClick={searchOpen ? loadIssues : openSearch}
              title={searchOpen ? "Search (Enter)" : "Search (/)"}
              aria-label="Toggle search"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.6"/>
                <line x1="9.9" y1="9.9" x2="14" y2="14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Sort button */}
          <button
            type="button"
            className="board-sort-btn"
            onClick={toggleSort}
            title={`Sort by ticket # — currently ${sortDir === "desc" ? "newest first" : "oldest first"}`}
          >
            # {sortDir === "desc" ? "↓" : "↑"}
          </button>
        </div>

        {/* Priority filter */}
        <div className="board-pill-row">
          <span className="board-pill-label">Priority</span>
          <div className="board-pill-group">
            {["All", ...PRIORITIES].map((p) => {
              const isActive = p === priorityFilter;
              const color = p === "All" ? "var(--text-secondary)" : priorityColor(p);
              const shades = p === "All" ? null : getColorShades(color);
              return (
                <button
                  key={p}
                  type="button"
                  className={`board-pill ${isActive ? "board-pill-active" : ""}`}
                  onClick={() => setPriorityFilter(p)}
                  style={isActive ? {
                    color,
                    borderColor: shades ? shades.border : color + "60",
                    background: shades ? shades.bg : color + "14",
                  } : undefined}
                >
                  {isActive ? "✓ " : ""}{p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Done toggle + clear */}
        <div className="board-pill-row">
          <button
            type="button"
            className={`board-pill ${!hideDone ? "board-pill-active" : ""}`}
            onClick={() => setHideDone((v) => !v)}
            style={!hideDone ? {
              color: stageColor("Done"),
              borderColor: getColorShades(stageColor("Done")).border,
              background: getColorShades(stageColor("Done")).bg,
            } : undefined}
          >
            {!hideDone ? "✓ " : ""}{hideDone ? `Show Done (${doneCount})` : `Showing Done (${doneCount})`}
          </button>
          {activeFilterCount > 0 && (
            <button
              type="button"
              className="board-pill board-pill-clear"
              onClick={() => { setStageFilter("All"); setPriorityFilter("All"); }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Issue count */}
      <div className="board-count">
        {filteredIssues.length} of {issues.length} tickets
        {hideDone && doneCount > 0 && (
          <span className="board-count-hidden"> · {doneCount} done hidden</span>
        )}
      </div>

      {/* Issue list */}
      <div className="board-list">
        {filteredIssues.length === 0 && !loading && (
          <div className="board-empty-state">
            <div className="board-empty-icon">
              {issues.length > 0 ? "🔍" : "📭"}
            </div>
            <div className="board-empty-msg">
              {issues.length > 0 ? "No tickets match the current filters" : "No issues in Bitacora"}
            </div>
            {issues.length > 0 && (
              <button
                type="button"
                className="board-clear-btn"
                onClick={() => { setStageFilter("All"); setPriorityFilter("All"); setHideDone(false); }}
              >
                Clear all filters
              </button>
            )}
            {issues.length === 0 && (
              <div className="board-empty-hint">Create your first ticket to get started</div>
            )}
          </div>
        )}

        {filteredIssues.map((issue) => {
          const priority = getCustomFieldValue(issue, "Priority");
          const stage = getCustomFieldValue(issue, "Stage");
          const isNew = newTicketIds && newTicketIds.has(issue.id);
          const isUnvisited = visitedTicketIds ? !visitedTicketIds.has(issue.id) : false;
          return (
            <div
              key={issue.id}
              className={`panel${isNew ? " board-card-new" : ""}${isUnvisited ? " board-card-unvisited" : ""}`}
              style={{
                padding: "0.85rem 1rem",
                cursor: "pointer",
                borderColor: isNew ? "var(--accent-indigo)" : isUnvisited ? "var(--accent-amber-border)" : "var(--border-subtle)",
              }}
              onClick={() => {
                clearNewTicket && clearNewTicket(issue.id);
                markVisited && markVisited(issue.id);
                openDetail(issue);
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = isNew ? "var(--accent-indigo)" : isUnvisited ? "var(--accent-amber)" : "var(--border-medium)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = isNew ? "var(--accent-indigo)" : isUnvisited ? "var(--accent-amber-border)" : "var(--border-subtle)")}
            >
              <div className="board-card-inner">
                <div className="board-card-id-col">
                  <span className="board-card-id">{issue.idReadable}</span>
                  {isNew && <span className="board-new-badge">NEW</span>}
                </div>
                <div className="board-card-body">
                  <div className="board-card-summary">{issue.summary}</div>
                  <div className="board-card-badges">
                    {stage && (() => {
                      const sc = stageColor(stage);
                      const ss = getColorShades(sc);
                      return (
                        <span className="issue-badge" style={{ background: ss.bg, color: sc, border: `1px solid ${ss.border}` }}>
                          {stage}
                        </span>
                      );
                    })()}
                    {priority && (() => {
                      const pc = priorityColor(priority);
                      const ps = getColorShades(pc);
                      return (
                        <span className="issue-badge" style={{ background: ps.bg, color: pc, border: `1px solid ${ps.border}` }}>
                          {priority}
                        </span>
                      );
                    })()}
                    <span className="board-card-date">
                      {formatDate(issue.updated || issue.created)}
                    </span>
                  </div>
                </div>
                <select
                  className="review-select"
                  style={{ fontSize: "var(--text-xs)", padding: "0.25rem 0.4rem", minWidth: 90 }}
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
