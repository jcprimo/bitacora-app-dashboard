// ─── YouTrack REST API Service ────────────────────────────────────
// Bitacora project (BIT / 0-1) on bitacora.youtrack.cloud
// Uses Vite dev proxy (/yt-api → https://bitacora.youtrack.cloud/api)

export const config = {
  base: "/yt-api",
  projectId: "0-1",
  projectShort: "BIT",
};

function headers(token) {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// ─── Bitacora Custom Fields Reference ────────────────────────────
// Priority: Show-stopper | Critical | Major | Normal | Minor
// Stage:    Backlog | Develop | Review | Test | Staging | Done
// Assignee: Bitacora Team (optional)
// Note:     No "Type" field exists in this project.

export const STAGES = ["Backlog", "Develop", "Review", "Test", "Staging", "Done"];
export const PRIORITIES = ["Show-stopper", "Critical", "Major", "Normal", "Minor"];

// Map common AI-generated priority names to valid Bitacora values
const PRIORITY_MAP = {
  "show-stopper": "Show-stopper",
  "showstopper": "Show-stopper",
  "critical": "Critical",
  "major": "Major",
  "high": "Major",
  "normal": "Normal",
  "medium": "Normal",
  "minor": "Minor",
  "low": "Minor",
};

function sanitizePriority(value) {
  if (!value) return "Normal";
  if (PRIORITIES.includes(value)) return value;
  return PRIORITY_MAP[value.toLowerCase()] || "Normal";
}

// ─── Issues — List ───────────────────────────────────────────────

export async function fetchIssues(token, { query = "", skip = 0, top = 50 } = {}) {
  const q = query || `project: ${config.projectShort} sort by: updated desc`;
  const fields = [
    "idReadable",
    "id",
    "summary",
    "description",
    "created",
    "updated",
    "resolved",
    "customFields(name,value(name))",
  ].join(",");

  const params = new URLSearchParams({ query: q, fields, $skip: String(skip), $top: String(top) });
  const res = await fetch(`${config.base}/issues?${params}`, { headers: headers(token) });
  if (!res.ok) throw new Error(`Failed to fetch issues: ${res.status}`);
  return res.json();
}

// ─── Issues — Get Single ─────────────────────────────────────────

export async function fetchIssue(token, issueId) {
  const fields = [
    "idReadable",
    "id",
    "summary",
    "description",
    "created",
    "updated",
    "resolved",
    "customFields(name,value(name))",
  ].join(",");

  const res = await fetch(`${config.base}/issues/${issueId}?fields=${fields}`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error(`Failed to fetch issue ${issueId}: ${res.status}`);
  return res.json();
}

// ─── Issues — Create ─────────────────────────────────────────────

export async function createIssue(token, { summary, description, priority }) {
  const payload = {
    project: { id: config.projectId },
    summary,
    description,
    customFields: [
      {
        name: "Priority",
        $type: "SingleEnumIssueCustomField",
        value: { name: sanitizePriority(priority) },
      },
    ],
  };

  const res = await fetch(`${config.base}/issues?fields=idReadable,id,summary`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description || err.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Issues — Update ─────────────────────────────────────────────

export async function updateIssue(token, issueId, { summary, description }) {
  const payload = {};
  if (summary !== undefined) payload.summary = summary;
  if (description !== undefined) payload.description = description;

  const res = await fetch(`${config.base}/issues/${issueId}?fields=idReadable,id,summary`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description || err.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Issues — Update Custom Field (Priority, Stage) ─────────────

export async function updateCustomField(token, issueId, fieldName, valueName) {
  // Stage is a StateBundleElement, Priority is EnumBundleElement
  const $type = fieldName === "Stage"
    ? "StateIssueCustomField"
    : "SingleEnumIssueCustomField";

  const res = await fetch(
    `${config.base}/issues/${issueId}?fields=idReadable,id,summary,customFields(name,value(name))`,
    {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({
        customFields: [
          {
            name: fieldName,
            $type,
            value: { name: valueName },
          },
        ],
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description || err.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Issues — Execute Command (alternative for stage transitions) ─

export async function executeCommand(token, issueId, command) {
  const res = await fetch(`${config.base}/issues/${issueId}/commands`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ query: command }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description || err.error?.message || `HTTP ${res.status}`);
  }
  return true;
}

// ─── Issues — Delete ─────────────────────────────────────────────

export async function deleteIssue(token, issueId) {
  const res = await fetch(`${config.base}/issues/${issueId}`, {
    method: "DELETE",
    headers: headers(token),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description || err.error?.message || `HTTP ${res.status}`);
  }
  return true;
}

// ─── Comments — List ─────────────────────────────────────────────

export async function fetchComments(token, issueId) {
  const fields = "id,text,author(name,login),created,updated";
  const res = await fetch(
    `${config.base}/issues/${issueId}/comments?fields=${fields}&$top=100`,
    { headers: headers(token) }
  );
  if (!res.ok) throw new Error(`Failed to fetch comments: ${res.status}`);
  return res.json();
}

// ─── Comments — Add ──────────────────────────────────────────────

export async function addComment(token, issueId, text) {
  const res = await fetch(
    `${config.base}/issues/${issueId}/comments?fields=id,text,author(name,login),created`,
    {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({ text }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description || err.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Helpers ─────────────────────────────────────────────────────

export function getCustomFieldValue(issue, fieldName) {
  const field = issue.customFields?.find((f) => f.name === fieldName);
  return field?.value?.name || null;
}

export function formatDate(timestamp) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
