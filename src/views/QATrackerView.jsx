// ─── views/QATrackerView.jsx — QA Test Case Tracker ──────────────
// Displays imported CSV test cases in a filterable, paginated table
// with modular column visibility. Each row has an action button:
//   - "Create Bug" → creates a YouTrack ticket
//   - "Start Dev"  → transitions the ticket to Develop stage
//   - "In Dev"     → ticket already in development (read-only)
//
// CSV data persists in localStorage across rebuilds/refreshes.
// Ticket state is correlated by Test_ID — duplicates are prevented.
// Filters use pill/chip toggles instead of dropdowns.

import { useRef, useState, useCallback } from "react";
import { QA_COLUMNS } from "../constants/qaColumns";
import { priorityColor } from "../utils/colors";

// ─── Priority badge color for CSV priorities (High, Critical, etc.)
function qaPriorityColor(p) {
  switch (p) {
    case "Critical": return "#ef4444";
    case "High":     return "#f59e0b";
    case "Medium":   return "#10b981";
    case "Low":      return "#64748b";
    default:         return priorityColor(p);
  }
}

// ─── Status badge color
function statusColor(s) {
  switch (s) {
    case "Not Started": return "#64748b";
    case "In Progress": return "#10b981";
    case "Passed":      return "#34d399";
    case "Failed":      return "#f87171";
    case "Blocked":     return "#f59e0b";
    default:            return "#64748b";
  }
}

// Fix 6: non-color indicators for QA status
function statusLabel(s) {
  switch (s) {
    case "Passed":      return "✓ Passed";
    case "Failed":      return "✗ Failed";
    case "Not Started": return "— Not Run";
    case "Blocked":     return "⟳ Blocked";
    default:            return s;
  }
}

// ─── Category color — consistent hues for each category
const CATEGORY_COLORS = {
  Onboarding:           "#10b981",
  "Recording-AI":       "#059669",
  "Recording-Manual":   "#047857",
  "AI Review":          "#0d9488",
  "Offline Queue":      "#d97706",
  "Student Management": "#34d399",
  "Report Management":  "#06b6d4",
  Navigation:           "#6ee7b7",
  Settings:             "#64748b",
  "Data Persistence":   "#f59e0b",
  Accessibility:        "#a78bfa",
  Localization:         "#14b8a6",
  Performance:          "#ef4444",
  "Security/Privacy":   "#f87171",
  Regression:           "#475569",
};

function categoryColor(cat) {
  return CATEGORY_COLORS[cat] || "#10b981";
}

// ─── FERPA flag color
function ferpaColor(flag) {
  return flag === "Yes" ? "#f87171" : "#64748b";
}

// ─── Reusable pill filter row component
function PillFilterRow({ label, items, active, onSelect, colorFn }) {
  return (
    <div className="qa-pill-row">
      <span className="qa-pill-label">{label}</span>
      <div className="qa-pill-group">
        {items.map((item) => {
          const isActive = item === active;
          const color = item === "All" ? "var(--text-secondary)" : (colorFn ? colorFn(item) : "var(--qa-accent)");
          return (
            <button
              key={item}
              className={`qa-pill ${isActive ? "qa-pill-active" : ""}`}
              onClick={() => onSelect(item)}
              style={isActive ? {
                color,
                borderColor: color + "60",
                background: color + "14",
              } : undefined}
            >
              {item}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function QATrackerView({
  testCases, csvHeaders, fileName, importError,
  columnVisibility, visibleColumns, toggleColumn,
  searchQuery, setSearchQuery,
  categoryFilter, setCategoryFilter,
  priorityFilter, setPriorityFilter,
  statusFilter, setStatusFilter,
  categories, priorities, statuses,
  filteredCases, pagedCases,
  currentPage, totalPages, goToPage,
  ticketState, actionLoading,
  createBugTicket, startDevelopment,
  copyContextBundle, copyLaunchCommand, viewTicket,
  importCSV,
}) {
  const fileInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const dragCounter = useRef(0);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) importCSV(file);
    e.target.value = "";
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith(".csv")) {
      importCSV(file);
    }
  }, [importCSV]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (dragCounter.current === 1) setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setDragging(false);
  }, []);

  const dropZoneProps = {
    onDrop: handleDrop,
    onDragOver: handleDragOver,
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
  };

  // Count active filters for the badge
  const activeFilterCount =
    (categoryFilter !== "All" ? 1 : 0) +
    (priorityFilter !== "All" ? 1 : 0) +
    (statusFilter !== "All" ? 1 : 0);

  // ─── Empty state: no CSV loaded ──────────────────────────────────
  if (testCases.length === 0) {
    return (
      <div className="animate-fade">
        <div
          className={`content-panel qa-dropzone ${dragging ? "qa-dropzone-active" : ""}`}
          style={{ padding: "3rem 2rem", textAlign: "center" }}
          {...dropZoneProps}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>{dragging ? "📥" : "🧪"}</div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
            {dragging ? "Drop CSV file here" : "QA Test Case Tracker"}
          </h2>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "1.5rem", maxWidth: 420, margin: "0 auto 1.5rem" }}>
            {dragging
              ? "Release to import test cases"
              : "Drag & drop a CSV file here, or click the button below to browse."}
          </p>
          {!dragging && (
            <p style={{ fontSize: "0.65rem", color: "var(--text-dim)", maxWidth: 480, margin: "0 auto 1.5rem", lineHeight: 1.6 }}>
              Expected columns: <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>Test_ID, Test_Case, Category, Priority, Status, Steps, Expected_Result</span>
            </p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />
          {!dragging && (
            <button
              className="btn-generate"
              onClick={() => fileInputRef.current?.click()}
              style={{
                maxWidth: 280,
                margin: "0 auto",
                background: "var(--qa-accent-bg)",
                borderColor: "var(--qa-accent-border)",
                color: "var(--qa-accent)",
              }}
            >
              📂 Import CSV File
            </button>
          )}
          {importError && (
            <div className="error-banner" style={{ marginTop: "1rem" }}>{importError}</div>
          )}
        </div>
      </div>
    );
  }

  // ─── Loaded state ────────────────────────────────────────────────
  return (
    <div className="animate-fade" {...dropZoneProps}>
      {dragging && (
        <div className="qa-drop-overlay">
          <div className="qa-drop-overlay-content">
            <span style={{ fontSize: "1.5rem" }}>📥</span>
            <span>Drop CSV to import</span>
          </div>
        </div>
      )}

      {/* Toolbar: file info, search, filter toggle, column picker */}
      <div className="qa-toolbar">
        <div className="qa-toolbar-top">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)" }}>
              📄 {fileName}
            </span>
            <span className="footer-badge" style={{
              color: "var(--accent-green)", borderColor: "rgba(52,211,153,0.3)",
              background: "rgba(52,211,153,0.06)"
            }}>
              {filteredCases.length} / {testCases.length} cases
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
            <button
              className="btn-back"
              onClick={() => fileInputRef.current?.click()}
              style={{ fontSize: "0.72rem", padding: "0.35rem 0.75rem" }}
            >
              + Add CSV
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {/* Search */}
            <input
              className="qa-search"
              type="text"
              placeholder="Search test cases..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {/* Filter toggle */}
            <button
              className={`btn-back qa-filter-toggle ${filtersExpanded ? "qa-filter-toggle-active" : ""}`}
              onClick={() => setFiltersExpanded((v) => !v)}
              style={{ fontSize: "0.72rem", padding: "0.4rem 0.75rem", position: "relative" }}
            >
              ⧩ Filters
              {activeFilterCount > 0 && (
                <span className="qa-filter-count">{activeFilterCount}</span>
              )}
            </button>

            {/* Column picker */}
            <details className="qa-col-picker">
              <summary className="btn-back" style={{ fontSize: "0.72rem", padding: "0.4rem 0.75rem", cursor: "pointer", listStyle: "none" }}>
                ⚙ Columns
              </summary>
              <div className="qa-col-dropdown">
                {QA_COLUMNS.filter((col) => csvHeaders.includes(col.id)).map((col) => (
                  <label key={col.id} className="qa-col-option">
                    <input
                      type="checkbox"
                      checked={!!columnVisibility[col.id]}
                      onChange={() => toggleColumn(col.id)}
                    />
                    <span>{col.label}</span>
                  </label>
                ))}
              </div>
            </details>
          </div>
        </div>

        {/* Pill filter rows — collapsible */}
        {filtersExpanded && (
          <div className="qa-pill-filters animate-fade">
            <PillFilterRow
              label="Category"
              items={categories}
              active={categoryFilter}
              onSelect={(v) => { setCategoryFilter(v); goToPage(1); }}
              colorFn={categoryColor}
            />
            <PillFilterRow
              label="Priority"
              items={priorities}
              active={priorityFilter}
              onSelect={(v) => { setPriorityFilter(v); goToPage(1); }}
              colorFn={qaPriorityColor}
            />
            <PillFilterRow
              label="Status"
              items={statuses}
              active={statusFilter}
              onSelect={(v) => { setStatusFilter(v); goToPage(1); }}
              colorFn={statusColor}
            />
            {activeFilterCount > 0 && (
              <button
                className="qa-pill qa-pill-clear"
                onClick={() => {
                  setCategoryFilter("All");
                  setPriorityFilter("All");
                  setStatusFilter("All");
                  goToPage(1);
                }}
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="qa-table-wrap">
        <table className="qa-table">
          <thead>
            <tr>
              {visibleColumns.map((col) => (
                <th key={col.id} style={{ width: col.width !== "auto" ? col.width : undefined }}>
                  {col.label}
                </th>
              ))}
              <th style={{ width: "140px", textAlign: "center" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {pagedCases.map((tc) => {
              const testId = tc.Test_ID;
              const ticket = ticketState[testId];
              const loading = actionLoading[testId];

              return (
                <tr key={testId}>
                  {visibleColumns.map((col) => (
                    <td key={col.id}>
                      {col.id === "Priority" ? (
                        <span className="qa-badge" style={{
                          color: qaPriorityColor(tc[col.id]),
                          borderColor: qaPriorityColor(tc[col.id]) + "40",
                          background: qaPriorityColor(tc[col.id]) + "10",
                        }}>
                          {tc[col.id]}
                        </span>
                      ) : col.id === "Status" ? (
                        <span className="qa-badge" style={{
                          color: statusColor(tc[col.id]),
                          borderColor: statusColor(tc[col.id]) + "40",
                          background: statusColor(tc[col.id]) + "10",
                        }}>
                          {statusLabel(tc[col.id])}
                        </span>
                      ) : col.id === "FERPA_Flag" ? (
                        <span className="qa-badge" style={{
                          color: ferpaColor(tc[col.id]),
                          borderColor: ferpaColor(tc[col.id]) + "40",
                          background: ferpaColor(tc[col.id]) + "10",
                        }}>
                          {tc[col.id]}
                        </span>
                      ) : col.id === "Category" ? (
                        <span className="qa-badge" style={{
                          color: categoryColor(tc[col.id]),
                          borderColor: categoryColor(tc[col.id]) + "40",
                          background: categoryColor(tc[col.id]) + "10",
                          fontSize: "0.7rem",
                        }}>
                          {tc[col.id]}
                        </span>
                      ) : col.id === "Test_ID" ? (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 600, color: "var(--qa-accent)" }}>
                          {tc[col.id]}
                        </span>
                      ) : (
                        <span className="qa-cell-text">{tc[col.id]}</span>
                      )}
                    </td>
                  ))}
                  <td style={{ textAlign: "center" }}>
                    {!ticket ? (
                      <button
                        className="qa-action-btn qa-action-create"
                        onClick={() => createBugTicket(tc)}
                        disabled={!!loading}
                      >
                        {loading === "creating" ? (
                          <><span className="spinner" /> Creating...</>
                        ) : (
                          "+ Create Ticket"
                        )}
                      </button>
                    ) : ticket.stage === "Backlog" ? (
                      <button
                        className="qa-action-btn qa-action-dev"
                        onClick={() => startDevelopment(testId)}
                        disabled={!!loading}
                        title={`Ticket: ${ticket.ticketId}`}
                      >
                        {loading === "transitioning" ? (
                          <><span className="spinner" /> Updating...</>
                        ) : (
                          <>🚀 Start Dev</>
                        )}
                      </button>
                    ) : (
                      <div style={{ display: "flex", gap: "0.3rem", justifyContent: "center" }}>
                        <button
                          className="qa-action-btn qa-action-indev qa-action-clickable"
                          title={`View ${ticket.ticketId} details`}
                          onClick={() => viewTicket(testId)}
                        >
                          ⚡ {ticket.ticketId}
                        </button>
                        <button
                          className="qa-action-btn qa-action-copy"
                          onClick={() => copyContextBundle(testId)}
                          title="Copy agent context bundle"
                        >
                          📋
                        </button>
                        <button
                          className="qa-action-btn qa-action-copy"
                          onClick={() => copyLaunchCommand(testId)}
                          title="Copy Claude Code launch command"
                        >
                          ▶
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="qa-pagination">
          <button
            className="btn-back"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            style={{ fontSize: "0.72rem", padding: "0.35rem 0.65rem" }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="btn-back"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            style={{ fontSize: "0.72rem", padding: "0.35rem 0.65rem" }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
