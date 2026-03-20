// ─── components/MobileTopBar.jsx — Mobile Top Bar ────────────────
// Shown only on mobile (< 768px). Contains the hamburger button
// that opens the sidebar overlay, the app title, and a theme toggle.

import { Sun, Moon } from "lucide-react";

export default function MobileTopBar({ onOpenMenu, theme, toggleTheme }) {
  return (
    <div className="mobile-topbar">
      <button
        type="button"
        className="mobile-hamburger"
        onClick={onOpenMenu}
        aria-label="Open navigation menu"
        aria-haspopup="true"
      >
        <span className="mobile-hamburger-bar" />
        <span className="mobile-hamburger-bar" />
        <span className="mobile-hamburger-bar" />
      </button>
      <span className="mobile-topbar-title">Bitacora</span>
      {toggleTheme && (
        <button
          type="button"
          className="mobile-theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      )}
    </div>
  );
}
