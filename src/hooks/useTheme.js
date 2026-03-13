// ─── hooks/useTheme.js — Light/Dark Mode ────────────────────────
// Persists theme choice in localStorage ("bitacora-theme") and syncs
// it to the <html data-theme="..."> attribute. CSS in index.css uses
// :root (dark default) and [data-theme="light"] selectors.

import { useState, useEffect } from "react";

export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem("bitacora-theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("bitacora-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, toggleTheme };
}
