// ─── server/youtrack.js — Server-side YouTrack API helper ────────
// Used by agent ingest routes for server-to-server API calls.
// Auth: YOUTRACK_TOKEN env var (permanent token — never per-user).
// Does NOT use browser proxy paths or window.location.

const YOUTRACK_BASE = (process.env.YOUTRACK_URL || "https://bitacora.youtrack.cloud").replace(/\/+$/, "") + "/api";
const PROJECT_ID    = "0-1"; // BIT project internal id

// ─── Priority mapping ─────────────────────────────────────────────
// Ingest values: low | normal | high | critical
// YouTrack values: Minor | Normal | Major | Critical | Show-stopper
const PRIORITY_MAP = {
  low:      "Minor",
  normal:   "Normal",
  high:     "Major",
  critical: "Critical",
};

function sanitizePriority(value) {
  if (!value) return "Normal";
  return PRIORITY_MAP[value.toLowerCase()] || "Normal";
}

function ytHeaders(token) {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// ─── createIssue ─────────────────────────────────────────────────
// Returns the created issue object with at least { id, idReadable }.
export async function createIssue({ summary, description, priority }) {
  const token = process.env.YOUTRACK_TOKEN;
  if (!token) throw new Error("YOUTRACK_TOKEN is not set");

  const payload = {
    project: { id: PROJECT_ID },
    summary,
    description: description || "",
    customFields: [
      {
        name: "Priority",
        $type: "SingleEnumIssueCustomField",
        value: { name: sanitizePriority(priority) },
      },
    ],
  };

  const res = await fetch(`${YOUTRACK_BASE}/issues?fields=id,idReadable,summary`, {
    method: "POST",
    headers: ytHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description || err.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── updateIssue ─────────────────────────────────────────────────
// issueId: the internal YouTrack id (e.g. "2-123"), not idReadable.
export async function updateIssue(issueId, { summary, description }) {
  const token = process.env.YOUTRACK_TOKEN;
  if (!token) throw new Error("YOUTRACK_TOKEN is not set");

  const payload = {};
  if (summary     !== undefined) payload.summary     = summary;
  if (description !== undefined) payload.description = description;

  const res = await fetch(`${YOUTRACK_BASE}/issues/${issueId}?fields=id,idReadable,summary`, {
    method: "POST",
    headers: ytHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description || err.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}
