// ─── hooks/useSettings.js — Runtime Credential Management ───────
// Manages the Settings modal state. Credentials can be set at runtime
// via the UI without restarting the dev server.
//
// Persists to localStorage:
//   bitacora-yt-token      — YouTrack permanent token
//   bitacora-anthropic-key — Anthropic API key (optional)
//   bitacora-openai-key    — OpenAI Admin API key (optional)
//
// Falls back to Vite env vars (VITE_YT_TOKEN, VITE_ANTHROPIC_KEY,
// VITE_OPENAI_KEY) when no localStorage value exists.

import { useState } from "react";

export function useSettings(token, setToken, showToast, loadIssues) {
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    token: "",
    anthropicKey: "",
    openaiKey: "",
  });

  const openSettings = () => {
    setSettingsForm({
      token: token,
      anthropicKey: localStorage.getItem("bitacora-anthropic-key") || import.meta.env.VITE_ANTHROPIC_KEY || "",
      openaiKey: localStorage.getItem("bitacora-openai-key") || import.meta.env.VITE_OPENAI_KEY || "",
    });
    setShowSettings(true);
  };

  const saveSettings = () => {
    if (settingsForm.token.trim()) {
      localStorage.setItem("bitacora-yt-token", settingsForm.token.trim());
      setToken(settingsForm.token.trim());
    }
    if (settingsForm.anthropicKey.trim()) {
      localStorage.setItem("bitacora-anthropic-key", settingsForm.anthropicKey.trim());
    } else {
      localStorage.removeItem("bitacora-anthropic-key");
    }
    if (settingsForm.openaiKey.trim()) {
      localStorage.setItem("bitacora-openai-key", settingsForm.openaiKey.trim());
    } else {
      localStorage.removeItem("bitacora-openai-key");
    }
    setShowSettings(false);
    showToast("Settings saved");
    loadIssues();
  };

  return { showSettings, setShowSettings, settingsForm, setSettingsForm, openSettings, saveSettings };
}
