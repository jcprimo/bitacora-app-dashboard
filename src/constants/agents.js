// ─── constants/agents.js — Agent Team Definitions ───────────────
// The 8 specialized agents that power Bitacora's ticket pipeline.
// Each agent has a unique system prompt (see prompts.js), default
// priority, and color used throughout the UI.
//
// To add an agent: add an entry here AND a matching key in PROMPTS,
// getPlaceholder, and getTemplates (all in prompts.js).

export const AGENTS = [
  { id: "pm", label: "PM Agent", icon: "🧠", color: "#7c6aff", defaultPriority: "Normal", desc: "Strategy & orchestration" },
  { id: "ios", label: "iOS Sr. Developer", icon: "📱", color: "#34d399", defaultPriority: "Normal", desc: "Swift/SwiftUI engineering" },
  { id: "ux", label: "UX/UI Agent", icon: "🎨", color: "#ec4899", defaultPriority: "Normal", desc: "Design & accessibility" },
  { id: "qa", label: "QA Agent", icon: "🔍", color: "#f59e0b", defaultPriority: "Major", desc: "Quality assurance & testing" },
  { id: "data", label: "Data Agent", icon: "📊", color: "#8b5cf6", defaultPriority: "Normal", desc: "Analytics & measurement" },
  { id: "security", label: "Security Agent", icon: "🔒", color: "#ef4444", defaultPriority: "Critical", desc: "FERPA + LFPDPPP compliance" },
  { id: "gtm", label: "GTM Agent", icon: "📣", color: "#06b6d4", defaultPriority: "Normal", desc: "Growth & positioning" },
  { id: "cs", label: "CS Agent", icon: "🗣️", color: "#f97316", defaultPriority: "Normal", desc: "Retention & bilingual support" },
];

// T-shirt sizing for estimated effort on tickets
export const EFFORTS = ["S", "M", "L", "XL"];
