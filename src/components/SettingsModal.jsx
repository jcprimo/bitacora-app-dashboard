// ─── components/SettingsModal.jsx — Runtime Credential Editor ────
// Overlay modal for updating YouTrack token, Anthropic API key, and
// OpenAI Admin API key at runtime. Saves to localStorage — no
// restart required. Opened by clicking the "BIT Connected" badge.

export default function SettingsModal({ showSettings, setShowSettings, settingsForm, setSettingsForm, saveSettings }) {
  if (!showSettings) return null;
  return (
    <div className="settings-overlay" onClick={() => setShowSettings(false)}>
      <div className="settings-modal animate-fade" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>Connection Settings</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>Configure your YouTrack and AI credentials</div>
          </div>
          <button
            onClick={() => setShowSettings(false)}
            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.2rem", cursor: "pointer", padding: "0.25rem" }}
          >
            ✕
          </button>
        </div>

        <div className="settings-field">
          <label className="settings-label">YouTrack Token</label>
          <input
            className="settings-input"
            type="password"
            value={settingsForm.token}
            onChange={(e) => setSettingsForm((f) => ({ ...f, token: e.target.value }))}
            placeholder="perm-..."
          />
          <div className="settings-hint">
            Generate at YouTrack → Profile → Authentication → New Token
          </div>
        </div>

        <div className="settings-field">
          <label className="settings-label">Anthropic API Key <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>(optional)</span></label>
          <input
            className="settings-input"
            type="password"
            value={settingsForm.anthropicKey}
            onChange={(e) => setSettingsForm((f) => ({ ...f, anthropicKey: e.target.value }))}
            placeholder="sk-ant-api03-..."
          />
          <div className="settings-hint">
            For AI-assisted ticket generation. Without it, use Template Generate.
          </div>
        </div>

        <div className="settings-field">
          <label className="settings-label">OpenAI API Key <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>(optional)</span></label>
          <input
            className="settings-input"
            type="password"
            value={settingsForm.openaiKey}
            onChange={(e) => setSettingsForm((f) => ({ ...f, openaiKey: e.target.value }))}
            placeholder="sk-..."
          />
          <div className="settings-hint">
            For OpenAI usage & balance tracking (Whisper, GPT-4o-mini).
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
          <button
            className="btn-ship"
            onClick={saveSettings}
            style={{ background: "rgba(52,211,153,0.12)", borderColor: "rgba(52,211,153,0.4)", color: "var(--accent-green)" }}
          >
            Save Settings
          </button>
          <button className="btn-back" onClick={() => setShowSettings(false)}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
