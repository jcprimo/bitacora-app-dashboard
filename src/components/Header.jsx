// ─── components/Header.jsx — App Header Bar ─────────────────────
// Contains: app title, FERPA/LFPDPPP compliance badges with hover
// tooltips (including official links), connection status badge
// (click to open Settings), light/dark theme toggle, and user
// menu with logout button.

export default function Header({ token, theme, toggleTheme, openSettings, user, onLogout }) {
  return (
    <header className="header">
      <div className="header-left">
        <div className="header-icon" style={{ background: "linear-gradient(135deg, #7c6aff20, #7c6aff08)", border: "1px solid #7c6aff40" }}>
          <img src="/bitacora-icon.png" alt="Bitacora" style={{ width: "100%", height: "100%", borderRadius: "inherit", objectFit: "cover" }} />
        </div>
        <div>
          <div className="header-title">Bitacora App Dashboard</div>
          <div className="header-subtitle">#OpsLife — Agent Pipeline</div>
        </div>
      </div>
      <div className="header-badge">
        <div className="badge-tooltip-wrap">
          <span className="compliance-badge" style={{ color: "#7c6aff", borderColor: "rgba(124,106,255,0.3)", background: "rgba(124,106,255,0.06)", cursor: "help" }}>FERPA</span>
          <div className="badge-tooltip">
            <div className="badge-tooltip-title">Family Educational Rights and Privacy Act</div>
            <div className="badge-tooltip-body">
              US federal law protecting the privacy of student education records. Applies to all schools receiving federal funding. Bitacora enforces FERPA by ensuring no student PII is exposed in logs, analytics, or third-party integrations.
            </div>
            <a className="badge-tooltip-link" href="https://www2.ed.gov/policy/gen/guid/fpco/ferpa/index.html" target="_blank" rel="noopener noreferrer">
              Learn more at ed.gov →
            </a>
          </div>
        </div>
        <div className="badge-tooltip-wrap">
          <span className="compliance-badge" style={{ color: "#f59e0b", borderColor: "rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.06)", cursor: "help" }}>LFPDPPP</span>
          <div className="badge-tooltip">
            <div className="badge-tooltip-title">Ley Federal de Proteccion de Datos Personales en Posesion de los Particulares</div>
            <div className="badge-tooltip-body">
              Mexico's federal data protection law governing the processing of personal data by private entities. Requires an Aviso de Privacidad (privacy notice) and explicit consent. Bitacora enforces LFPDPPP for schools operating in Mexico.
            </div>
            <a className="badge-tooltip-link" href="https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf" target="_blank" rel="noopener noreferrer">
              Learn more at diputados.gob.mx →
            </a>
          </div>
        </div>
        {token && (
          <span
            className="compliance-badge bit-connected"
            style={{ color: "#34d399", borderColor: "rgba(52,211,153,0.3)", background: "rgba(52,211,153,0.06)", cursor: "pointer" }}
            onClick={openSettings}
            title="Click to edit connection settings"
          >
            ● BIT Connected
          </span>
        )}
        {!token && (
          <span
            className="compliance-badge bit-connected"
            style={{ color: "var(--accent-red)", borderColor: "rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.06)", cursor: "pointer" }}
            onClick={openSettings}
            title="Click to configure connection"
          >
            ● Not Connected
          </span>
        )}
        <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
        {user && (
          <div className="user-menu">
            <span className="user-name">{user.name || user.email}</span>
            <button className="logout-btn" onClick={onLogout} title="Sign out">
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
