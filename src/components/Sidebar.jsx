// ─── components/Sidebar.jsx — Sidebar Navigation ─────────────────
// Desktop: fixed left sidebar with grouped nav items.
// Mobile: slide-in overlay triggered by hamburger in MobileTopBar.
//
// Props:
//   view           — active view string
//   setView        — view setter
//   onNavItem      — called after nav item click (used to close mobile overlay)
//   mobileOpen     — whether mobile overlay is visible
//   closeMobile    — close mobile overlay
//   theme          — "dark" | "light"
//   toggleTheme    — fn
//   openSettings   — fn
//   onLogout       — fn
//   user           — auth user object
//   token          — YouTrack token (for connection badge)
//   loading        — board loading state (for refresh badge)
//   loadIssues     — fn to refresh issues
//   agentJobCount  — number of running agent jobs (for badge)
//   docCount       — number of indexed docs (for badge)
//   resetCreate    — fn to reset create form when navigating to create

const NAV_GROUPS = [
  {
    label: "Work",
    items: [
      { id: "board",  emoji: "📋", label: "Board" },
      { id: "create", emoji: "✏️",  label: "Create" },
    ],
  },
  {
    label: "Quality",
    items: [
      { id: "qa",    emoji: "🧪", label: "QA Tracker" },
    ],
  },
  {
    label: "Operations",
    items: [
      { id: "agents", emoji: "😈", label: "Agents" },
      { id: "docs",   emoji: "📚", label: "Docs" },
    ],
  },
  {
    label: "Analytics",
    items: [
      { id: "usage", emoji: "📊", label: "AI Usage" },
    ],
  },
];

export default function Sidebar({
  view,
  setView,
  onNavItem,
  mobileOpen,
  closeMobile,
  theme,
  toggleTheme,
  openSettings,
  onLogout,
  user,
  token,
  loading,
  loadIssues,
  agentJobCount = 0,
  docCount = 0,
  resetCreate,
}) {
  function handleNav(id) {
    if (id === "create") resetCreate?.();
    setView(id);
    onNavItem?.();
  }

  function getBadge(id) {
    if (id === "agents" && agentJobCount > 0) return agentJobCount;
    if (id === "docs" && docCount > 0) return docCount;
    return null;
  }

  const sidebarContent = (
    <div className="sidebar-inner">
      {/* ─── Logo / App title ─────────────────────────────────────── */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <img src="/bitacora-icon.png" alt="Bitacora" className="sidebar-logo-img" />
        </div>
        <div>
          <div className="sidebar-logo-title">Bitacora</div>
          <div className="sidebar-logo-subtitle">#OpsLife</div>
        </div>
      </div>

      {/* ─── Nav groups ───────────────────────────────────────────── */}
      <nav className="sidebar-nav" aria-label="Main navigation">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="sidebar-group">
            <div className="sidebar-group-label">{group.label}</div>
            {group.items.map((item) => {
              const badge = getBadge(item.id);
              const isActive = view === item.id || (view === "detail" && item.id === "board");
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`sidebar-nav-item${isActive ? " sidebar-nav-item--active" : ""}`}
                  onClick={() => handleNav(item.id)}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="sidebar-nav-emoji" aria-hidden="true">{item.emoji}</span>
                  <span className="sidebar-nav-label">{item.label}</span>
                  {badge != null && (
                    <span className="sidebar-nav-badge">{badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ─── Bottom actions ────────────────────────────────────────── */}
      <div className="sidebar-bottom">
        <button
          type="button"
          className="sidebar-action-btn"
          onClick={loadIssues}
          disabled={loading}
          title="Refresh board"
        >
          <span aria-hidden="true">{loading ? "⟳" : "↻"}</span>
          <span className="sidebar-action-label">{loading ? "Refreshing…" : "Refresh"}</span>
        </button>

        <button
          type="button"
          className="sidebar-action-btn"
          onClick={openSettings}
          title="Settings"
        >
          <span aria-hidden="true">⚙️</span>
          <span className="sidebar-action-label">Settings</span>
          {!token && <span className="sidebar-nav-badge sidebar-nav-badge--warn">!</span>}
        </button>

        <button
          type="button"
          className="sidebar-action-btn"
          onClick={toggleTheme}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          <span aria-hidden="true">{theme === "dark" ? "☀️" : "🌙"}</span>
          <span className="sidebar-action-label">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
        </button>

        {user && (
          <div className="sidebar-user">
            <span className="sidebar-user-name">{user.name || user.email}</span>
            <button
              type="button"
              className="sidebar-logout-btn"
              onClick={onLogout}
              title="Sign out"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ─── Desktop sidebar (always visible ≥ 768px) ─────────────── */}
      <aside className="sidebar-rail" aria-label="Sidebar">
        {sidebarContent}
      </aside>

      {/* ─── Mobile overlay ───────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={closeMobile}
          aria-label="Close navigation"
          role="button"
          tabIndex={-1}
        />
      )}
      <aside
        className={`sidebar-rail sidebar-rail--mobile${mobileOpen ? " sidebar-rail--open" : ""}`}
        aria-label="Sidebar"
        aria-hidden={!mobileOpen}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
