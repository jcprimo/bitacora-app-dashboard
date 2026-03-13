// ─── utils/colors.js — Badge Color Maps ─────────────────────────
// Maps Bitacora's custom field values to hex colors for inline
// badges on the Board and Detail views. These must stay in sync
// with the valid values defined in youtrack.js (PRIORITIES, STAGES).

// Returns a hex color for a given priority level
export function priorityColor(p) {
  switch (p) {
    case "Show-stopper": return "#ef4444";
    case "Critical": return "#f87171";
    case "Major": return "#f59e0b";
    case "Normal": return "#7c6aff";
    case "Minor": return "#64748b";
    default: return "#7c6aff";
  }
}

// Returns a hex color for a given workflow stage
export function stageColor(s) {
  switch (s) {
    case "Backlog": return "#64748b";
    case "Develop": return "#7c6aff";
    case "Review": return "#f59e0b";
    case "Test": return "#8b5cf6";
    case "Staging": return "#06b6d4";
    case "Done": return "#34d399";
    default: return "#64748b";
  }
}
