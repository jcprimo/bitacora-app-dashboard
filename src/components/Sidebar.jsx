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
//   docCount       — number of unread/unvisited docs (for badge)
//   resetCreate    — fn to reset create form when navigating to create

import { useEffect } from "react";
import {
  LayoutDashboard,
  PenSquare,
  FlaskConical,
  Cpu,
  BookOpen,
  BarChart3,
  RefreshCw,
  Settings,
  Sun,
  Moon,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: "Work",
    items: [
      { id: "board",  Icon: LayoutDashboard, label: "Board" },
      { id: "create", Icon: PenSquare,        label: "Create" },
    ],
  },
  {
    label: "Quality",
    items: [
      { id: "qa",    Icon: FlaskConical, label: "QA Tracker" },
    ],
  },
  {
    label: "Operations",
    items: [
      { id: "agents", Icon: Cpu,      label: "Agents" },
      { id: "docs",   Icon: BookOpen, label: "Docs" },
    ],
  },
  {
    label: "Analytics",
    items: [
      { id: "usage", Icon: BarChart3, label: "AI Usage" },
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
  collapsed = false,
  onToggleCollapse,
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

  // BUG-06: Escape key dismisses mobile sidebar
  useEffect(() => {
    if (!mobileOpen) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") closeMobile();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen, closeMobile]);

  const sidebarContent = (
    <div className="sidebar-inner">
      {/* ─── Logo / App title ─────────────────────────────────────── */}
      <div className={`sidebar-logo${collapsed ? " sidebar-logo--collapsed" : ""}`}>
        <div className="sidebar-logo-icon">
          <img src="/bitacora-icon.png" alt="Bitacora" className="sidebar-logo-img" />
        </div>
        {!collapsed && (
          <div>
            <div className="sidebar-logo-title">Bitacora</div>
            <div className="sidebar-logo-subtitle">#OpsLife</div>
          </div>
        )}
        {/* Collapse toggle — desktop only */}
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* ─── Nav groups ───────────────────────────────────────────── */}
      <nav className="sidebar-nav" aria-label="Main navigation">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="sidebar-group">
            {!collapsed && <div className="sidebar-group-label">{group.label}</div>}
            {group.items.map((item) => {
              const badge = getBadge(item.id);
              const isActive = view === item.id || (view === "detail" && item.id === "board");
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`sidebar-nav-item${isActive ? " sidebar-nav-item--active" : ""}${collapsed ? " sidebar-nav-item--icon-only" : ""}`}
                  onClick={() => handleNav(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="sidebar-nav-icon" aria-hidden="true">
                    <item.Icon size={18} />
                  </span>
                  {!collapsed && <span className="sidebar-nav-label">{item.label}</span>}
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
          className={`sidebar-action-btn${collapsed ? " sidebar-action-btn--icon-only" : ""}`}
          onClick={loadIssues}
          disabled={loading}
          title="Refresh board"
        >
          <span className="sidebar-action-icon" aria-hidden="true">
            <RefreshCw size={16} />
          </span>
          {!collapsed && <span className="sidebar-action-label">{loading ? "Refreshing…" : "Refresh"}</span>}
        </button>

        <button
          type="button"
          className={`sidebar-action-btn${collapsed ? " sidebar-action-btn--icon-only" : ""}`}
          onClick={openSettings}
          title="Settings"
        >
          <span className="sidebar-action-icon" aria-hidden="true">
            <Settings size={16} />
          </span>
          {!collapsed && <span className="sidebar-action-label">Settings</span>}
          {!token && <span className="sidebar-nav-badge sidebar-nav-badge--warn">!</span>}
        </button>

        <button
          type="button"
          className={`sidebar-action-btn${collapsed ? " sidebar-action-btn--icon-only" : ""}`}
          onClick={toggleTheme}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          <span className="sidebar-action-icon" aria-hidden="true">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </span>
          {!collapsed && <span className="sidebar-action-label">{theme === "dark" ? "Light mode" : "Dark mode"}</span>}
        </button>

        {user && (
          <div className={`sidebar-user${collapsed ? " sidebar-user--collapsed" : ""}`}>
            {!collapsed && <span className="sidebar-user-name">{user.name || user.email}</span>}
            <button
              type="button"
              className="sidebar-logout-btn"
              onClick={onLogout}
              title="Sign out"
            >
              <LogOut size={16} />
              {!collapsed && <span>Sign out</span>}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ─── Desktop sidebar (always visible ≥ 768px) ─────────────── */}
      <aside
        className={`sidebar-rail${collapsed ? " sidebar-rail--collapsed" : ""}`}
        aria-label="Navigation rail"
      >
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
        aria-label="Navigation menu"
        aria-hidden={!mobileOpen}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
