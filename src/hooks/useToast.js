// ─── hooks/useToast.js — Toast Notification State ───────────────
// Provides a showToast(msg, type?) function and the current toast
// value. Toasts auto-dismiss after 3.5 seconds.
// Types: "success" (default, green) | "error" (red)

import { useState, useCallback } from "react";

export function useToast() {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  return { toast, showToast };
}
