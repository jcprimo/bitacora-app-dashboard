// ─── utils/clipboard.js — JSON Copy Helper ──────────────────────
// Serializes any object to pretty-printed JSON and copies it to the
// system clipboard. Used by the "Copy JSON" buttons in Create and
// Detail views for agent handoff workflows.

export function copyToClipboard(data, label, showToast) {
  const json = JSON.stringify(data, null, 2);
  navigator.clipboard.writeText(json).then(() => {
    showToast(`${label} copied to clipboard`);
  }).catch(() => {
    showToast("Copy failed — check browser permissions", "error");
  });
}
