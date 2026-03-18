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

// ─── Shade ramp map (Fix 2) ──────────────────────────────────────
// Maps known hex colors to their CSS variable shade names so JSX
// components can use design-system vars instead of hex-alpha hacks.
//
// Usage:
//   const shades = getColorShades('#7c6aff');
//   // → { bg: 'var(--accent-indigo-bg)', border: 'var(--accent-indigo-border)', ... }
//
// Falls back gracefully to inline rgba if the color is not in the map.

const COLOR_SHADE_MAP = {
  // Indigo
  "#7c6aff": "indigo",
  "#5a45d6": "indigo",
  // Green
  "#34d399": "green",
  "#0f8f5e": "green",
  // Red
  "#f87171": "red",
  "#ef4444": "red",
  "#d03040": "red",
  // Amber
  "#fbbf24": "amber",
  "#f59e0b": "amber",
  "#c06a06": "amber",
  // Cyan
  "#22d3ee": "cyan",
  "#06b6d4": "cyan",
  "#0780a0": "cyan",
};

/**
 * Returns CSS variable shade tokens for a given hex color.
 * If the color is not in the map, returns fallback inline rgba values.
 */
export function getColorShades(hex) {
  const normalized = hex.toLowerCase();
  const name = COLOR_SHADE_MAP[normalized];

  if (name) {
    return {
      bg:       `var(--accent-${name}-bg)`,
      bgHover:  `var(--accent-${name}-bg-hover)`,
      border:   `var(--accent-${name}-border)`,
      strong:   `var(--accent-${name}-strong)`,
      text:     `var(--accent-${name}-text)`,
    };
  }

  // Fallback: inline rgba for unmapped colors (e.g. category colors)
  return {
    bg:       hex + "14",
    bgHover:  hex + "26",
    border:   hex + "40",
    strong:   hex,
    text:     hex,
  };
}
