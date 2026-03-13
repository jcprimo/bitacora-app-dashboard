// ─── App.jsx — Application Shell ────────────────────────────────
// Root component for Bitacora YouTrack Integration.
// Composes hooks for state, components for UI chrome, and views for
// each tab (Board, Create, AI Usage, Detail).
//
// Views:  board | create | usage | detail
// State:  all app state lives in custom hooks; this file only wires
//         them together and renders the active view.

import { useState } from "react";
import "./App.css";

// ─── Constants ──────────────────────────────────────────────────
import { AGENTS } from "./constants/agents";

// ─── Hooks ──────────────────────────────────────────────────────
import { useToast } from "./hooks/useToast";
import { useTheme } from "./hooks/useTheme";
import { useBoard } from "./hooks/useBoard";
import { useSettings } from "./hooks/useSettings";
import { useCreateTicket } from "./hooks/useCreateTicket";
import { useIssueDetail } from "./hooks/useIssueDetail";
import { useAnthropicUsage } from "./hooks/useAnthropicUsage";
import { useOpenAIUsage } from "./hooks/useOpenAIUsage";

// ─── UI Components ──────────────────────────────────────────────
import Toast from "./components/Toast";
import Header from "./components/Header";
import SettingsModal from "./components/SettingsModal";

// ─── Views ──────────────────────────────────────────────────────
import BoardView from "./views/BoardView";
import CreateView from "./views/CreateView";
import UsageView from "./views/UsageView";
import DetailView from "./views/DetailView";

// ═══════════════════════════════════════════════════════════════════
export default function App() {
  // YouTrack auth — persisted in localStorage, falls back to env var
  const [token, setToken] = useState(localStorage.getItem("bitacora-yt-token") || import.meta.env.VITE_YT_TOKEN || "");
  // Active tab: "board" | "create" | "usage" | "detail"
  const [view, setView] = useState("board");

  // ─── Hook composition ──────────────────────────────────────────
  const { toast, showToast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const { issues, loading, error, filterQuery, setFilterQuery, loadIssues } = useBoard(token);
  const settings = useSettings(token, setToken, showToast, loadIssues);

  // Currently selected agent for ticket creation (PM, iOS, QA, etc.)
  const [selectedAgent, setSelectedAgent] = useState(AGENTS[0]);

  const create = useCreateTicket(token, showToast, loadIssues);
  const detail = useIssueDetail(token, showToast, loadIssues, setView);
  const anthropic = useAnthropicUsage(showToast);
  const openai = useOpenAIUsage();

  // Anthropic + OpenAI total for the sidebar spend widget
  const combinedSpend = anthropic.totalSpendUsd + openai.openaiTotalSpend;

  const resetCreate = () => {
    create.resetCreate();
  };

  // ═════════════════════════════════════════════════════════════
  return (
    <div className="app-shell">
      <Toast toast={toast} />

      <Header
        token={token}
        theme={theme}
        toggleTheme={toggleTheme}
        openSettings={settings.openSettings}
      />

      <SettingsModal
        showSettings={settings.showSettings}
        setShowSettings={settings.setShowSettings}
        settingsForm={settings.settingsForm}
        setSettingsForm={settings.setSettingsForm}
        saveSettings={settings.saveSettings}
      />

      {/* Nav */}
      <nav style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
        <button
          className={`step-btn ${view === "board" ? "active" : ""}`}
          onClick={() => setView("board")}
          style={{ borderBottom: view === "board" ? "2px solid var(--accent-indigo)" : "2px solid transparent" }}
        >
          📋 Board
        </button>
        <button
          className={`step-btn ${view === "create" ? "active" : ""}`}
          onClick={() => { setView("create"); resetCreate(); }}
          style={{ borderBottom: view === "create" ? "2px solid var(--accent-indigo)" : "2px solid transparent" }}
        >
          ＋ Create
        </button>
        <button
          className={`step-btn ${view === "usage" ? "active" : ""}`}
          onClick={() => setView("usage")}
          style={{ borderBottom: view === "usage" ? "2px solid var(--accent-cyan)" : "2px solid transparent" }}
        >
          📊 AI Usage
        </button>
        {view === "detail" && (
          <button className="step-btn active" style={{ borderBottom: "2px solid var(--accent-indigo)" }}>
            🔎 {detail.activeIssue?.idReadable}
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button className="step-btn" onClick={loadIssues} disabled={loading} style={{ opacity: loading ? 0.5 : 1 }}>
          {loading ? "↻ Loading..." : "↻ Refresh"}
        </button>
      </nav>

      {!token && (
        <div className="compliance-alert ferpa" style={{ marginBottom: "1rem", cursor: "pointer" }} onClick={settings.openSettings}>
          🔑 No YouTrack token configured — click here or the "Not Connected" badge to set one.
        </div>
      )}
      {error && <div className="error-banner" style={{ marginBottom: "1rem" }}>{error}</div>}

      {view === "board" && (
        <BoardView
          issues={issues}
          loading={loading}
          filterQuery={filterQuery}
          setFilterQuery={setFilterQuery}
          loadIssues={loadIssues}
          openDetail={detail.openDetail}
          changeField={detail.changeField}
        />
      )}

      {view === "create" && (
        <CreateView
          selectedAgent={selectedAgent}
          setSelectedAgent={setSelectedAgent}
          rawInput={create.rawInput}
          setRawInput={create.setRawInput}
          isGenerating={create.isGenerating}
          draft={create.draft}
          setDraft={create.setDraft}
          createStep={create.createStep}
          setCreateStep={create.setCreateStep}
          aiError={create.aiError}
          actionLoading={create.actionLoading}
          hasAIKey={create.hasAIKey}
          resetCreate={resetCreate}
          generateWithAI={create.generateWithAI}
          generateFromTemplate={create.generateFromTemplate}
          submitTicket={create.submitTicket}
          showToast={showToast}
          recordUsage={anthropic.recordUsage}
          token={token}
          aiUsage={anthropic.aiUsage}
          totalSpendUsd={anthropic.totalSpendUsd}
          budgetPct={anthropic.budgetPct}
          overBudget={anthropic.overBudget}
          combinedSpend={combinedSpend}
          openaiTotalSpend={openai.openaiTotalSpend}
          setView={setView}
          loadIssues={loadIssues}
        />
      )}

      {view === "usage" && (
        <UsageView
          aiUsage={anthropic.aiUsage}
          totalSpendUsd={anthropic.totalSpendUsd}
          budgetPct={anthropic.budgetPct}
          overBudget={anthropic.overBudget}
          resetUsage={anthropic.resetUsage}
          setBudget={anthropic.setBudget}
          setCreditBalance={anthropic.setCreditBalance}
          openaiKey={openai.openaiKey}
          hasOpenAIKey={openai.hasOpenAIKey}
          usageTab={openai.usageTab}
          setUsageTab={openai.setUsageTab}
          openaiUsage={openai.openaiUsage}
          openaiLoading={openai.openaiLoading}
          openaiError={openai.openaiError}
          openaiDateRange={openai.openaiDateRange}
          setOpenaiDateRange={openai.setOpenaiDateRange}
          loadOpenaiUsage={openai.loadOpenaiUsage}
          openaiTotalSpend={openai.openaiTotalSpend}
          combinedSpend={combinedSpend}
          openSettings={settings.openSettings}
        />
      )}

      {view === "detail" && detail.activeIssue && (
        <DetailView
          activeIssue={detail.activeIssue}
          editFields={detail.editFields}
          setEditFields={detail.setEditFields}
          actionLoading={detail.actionLoading}
          confirmDelete={detail.confirmDelete}
          setConfirmDelete={detail.setConfirmDelete}
          saveEdit={detail.saveEdit}
          changeField={detail.changeField}
          handleDelete={detail.handleDelete}
          setView={setView}
          showToast={showToast}
        />
      )}

      {/* Footer */}
      <footer className="footer">
        <span className="footer-text">Bitacora Agent Team → YouTrack</span>
        <div className="footer-badges">
          <span className="footer-badge" style={{ color: "var(--accent-green)", borderColor: "rgba(52,211,153,0.2)", background: "rgba(52,211,153,0.04)" }}>
            Bilingual EN/ES
          </span>
          <span className="footer-badge" style={{ color: "var(--text-dim)", borderColor: "var(--border-subtle)" }}>
            {issues.length} issues
          </span>
        </div>
      </footer>
    </div>
  );
}
