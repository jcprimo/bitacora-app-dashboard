// ─── components/Toast.jsx — Notification Banner ─────────────────
// Fixed-position toast that appears top-right. Renders nothing when
// toast is null. Auto-dismissed by useToast after 3.5s.
// Props: { toast: { msg: string, type: "success"|"error" } | null }

export default function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="animate-fade" style={{
      position: "fixed", top: 16, right: 16, zIndex: 999,
      padding: "0.6rem 1.1rem", borderRadius: "var(--radius-md)",
      fontSize: "var(--text-sm)", fontWeight: 600,
      background: toast.type === "error" ? "rgba(248,113,113,0.12)" : "rgba(52,211,153,0.12)",
      border: `1px solid ${toast.type === "error" ? "rgba(248,113,113,0.3)" : "rgba(52,211,153,0.3)"}`,
      color: toast.type === "error" ? "var(--accent-red)" : "var(--accent-green)",
      backdropFilter: "blur(12px)",
    }}>
      {toast.type === "error" ? "✕ " : "✓ "}{toast.msg}
    </div>
  );
}
