// ─── components/MobileTopBar.jsx — Mobile Top Bar ────────────────
// Shown only on mobile (< 768px). Contains the hamburger button
// that opens the sidebar overlay and the app title.

export default function MobileTopBar({ onOpenMenu }) {
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
    </div>
  );
}
