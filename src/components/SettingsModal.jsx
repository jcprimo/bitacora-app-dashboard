// ─── components/SettingsModal.jsx — Runtime Credential Editor ────
// Overlay modal for updating YouTrack token, Anthropic API key, and
// OpenAI Admin API key at runtime. Saves to localStorage — no
// restart required. Opened by clicking the "BIT Connected" badge.
//
// All buttons use type="button" explicitly to prevent browser
// form validation from triggering on credential inputs.
// Inputs use type="text" with CSS masking to avoid pattern errors.

import { useState } from "react";

export default function SettingsModal({ showSettings, setShowSettings, settingsForm, setSettingsForm, saveSettings }) {
  const [showTokens, setShowTokens] = useState({
    token: false,
    anthropicKey: false,
    openaiKey: false,
  });

  if (!showSettings) return null;

  const toggleVisibility = (field) => {
    setShowTokens((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <div className="settings-overlay" onClick={() => setShowSettings(false)}>
      <div className="settings-modal animate-fade" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div>
            <div style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>Connection Settings</div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginTop: "0.15rem" }}>Configure your YouTrack and AI credentials</div>
          </div>
          <button
            type="button"
            onClick={() => setShowSettings(false)}
            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "var(--text-xl)", cursor: "pointer", padding: "0.25rem" }}
          >
            ✕
          </button>
        </div>

        <div className="settings-field">
          <label className="settings-label">YouTrack Token</label>
          <div className="settings-input-wrap">
            <input
              className={`settings-input ${!showTokens.token ? "settings-input-masked" : ""}`}
              type="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              data-lpignore="true"
              data-1p-ignore
              value={settingsForm.token}
              onChange={(e) => setSettingsForm((f) => ({ ...f, token: e.target.value }))}
              placeholder="perm-..."
            />
            <button
              type="button"
              className="settings-toggle-btn"
              onClick={() => toggleVisibility("token")}
              title={showTokens.token ? "Hide" : "Show"}
            >
              {showTokens.token ? "Hide" : "Show"}
            </button>
          </div>
          <div className="settings-hint">
            Generate at YouTrack → Profile → Authentication → New Token
          </div>
        </div>

        <div className="settings-field">
          <label className="settings-label">Anthropic API Key <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>(optional)</span></label>
          <div className="settings-input-wrap">
            <input
              className={`settings-input ${!showTokens.anthropicKey ? "settings-input-masked" : ""}`}
              type="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              data-lpignore="true"
              data-1p-ignore
              value={settingsForm.anthropicKey}
              onChange={(e) => setSettingsForm((f) => ({ ...f, anthropicKey: e.target.value }))}
              placeholder="sk-ant-api03-..."
            />
            <button
              type="button"
              className="settings-toggle-btn"
              onClick={() => toggleVisibility("anthropicKey")}
              title={showTokens.anthropicKey ? "Hide" : "Show"}
            >
              {showTokens.anthropicKey ? "Hide" : "Show"}
            </button>
          </div>
          <div className="settings-hint">
            For AI-assisted ticket generation. Without it, use Template Generate.
          </div>
        </div>

        <div className="settings-field">
          <label className="settings-label">OpenAI API Key <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>(optional)</span></label>
          <div className="settings-input-wrap">
            <input
              className={`settings-input ${!showTokens.openaiKey ? "settings-input-masked" : ""}`}
              type="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              data-lpignore="true"
              data-1p-ignore
              value={settingsForm.openaiKey}
              onChange={(e) => setSettingsForm((f) => ({ ...f, openaiKey: e.target.value }))}
              placeholder="sk-..."
            />
            <button
              type="button"
              className="settings-toggle-btn"
              onClick={() => toggleVisibility("openaiKey")}
              title={showTokens.openaiKey ? "Hide" : "Show"}
            >
              {showTokens.openaiKey ? "Hide" : "Show"}
            </button>
          </div>
          <div className="settings-hint">
            For OpenAI usage & balance tracking (Whisper, GPT-4o-mini).
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
          <button
            type="button"
            className="btn-ship"
            onClick={saveSettings}
            style={{ background: "rgba(52,211,153,0.12)", borderColor: "rgba(52,211,153,0.4)", color: "var(--accent-green)" }}
          >
            Save Settings
          </button>
          <button type="button" className="btn-back" onClick={() => setShowSettings(false)}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
