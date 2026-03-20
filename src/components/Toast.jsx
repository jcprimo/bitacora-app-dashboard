// ─── components/Toast.jsx — Notification Banner ─────────────────
// Fixed-position toast that appears top-right. Renders nothing when
// toast is null. Auto-dismissed by useToast after 3.5s.
// Props: { toast: { msg: string, type: "success"|"error" } | null }

export default function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`animate-fade toast ${toast.type === "error" ? "toast-error" : "toast-success"}`}>
      {toast.type === "error" ? "✕ " : "✓ "}{toast.msg}
    </div>
  );
}
