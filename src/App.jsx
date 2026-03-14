// ─── App.jsx — Application Shell ────────────────────────────────
// Root component for Bitacora YouTrack Integration.
// Composes hooks for state, components for UI chrome, and views for
// each tab (Board, Create, AI Usage, Detail).
//
// Views:  board | create | qa | docs | usage | detail
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
import { useQATracker } from "./hooks/useQATracker";
import { useMarkdownReader } from "./hooks/useMarkdownReader";

// ─── UI Components ──────────────────────────────────────────────
import Toast from "./components/Toast";
import Header from "./components/Header";
import SettingsModal from "./components/SettingsModal";

// ─── Views ──────────────────────────────────────────────────────
import BoardView from "./views/BoardView";
import CreateView from "./views/CreateView";
import UsageView from "./views/UsageView";
import DetailView from "./views/DetailView";
import QATrackerView from "./views/QATrackerView";
import MarkdownView from "./views/MarkdownView";

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
  const qa = useQATracker(token, showToast, loadIssues, detail.openDetail);
  const md = useMarkdownReader(showToast);

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
      <nav className="nav-tabs">
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
          className={`step-btn ${view === "qa" ? "active" : ""}`}
          onClick={() => setView("qa")}
          style={{ borderBottom: view === "qa" ? "2px solid var(--qa-accent)" : "2px solid transparent" }}
        >
          🧪 QA Tracker
        </button>
        <button
          className={`step-btn ${view === "docs" ? "active" : ""}`}
          onClick={() => setView("docs")}
          style={{ borderBottom: view === "docs" ? "2px solid var(--md-accent)" : "2px solid transparent" }}
        >
          📖 Docs{md.files.length > 0 ? ` (${md.files.length})` : ""}
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

      {view === "qa" && (
        <QATrackerView
          testCases={qa.testCases}
          csvHeaders={qa.csvHeaders}
          fileName={qa.fileName}
          importError={qa.importError}
          columnVisibility={qa.columnVisibility}
          visibleColumns={qa.visibleColumns}
          toggleColumn={qa.toggleColumn}
          searchQuery={qa.searchQuery}
          setSearchQuery={qa.setSearchQuery}
          categoryFilter={qa.categoryFilter}
          setCategoryFilter={qa.setCategoryFilter}
          priorityFilter={qa.priorityFilter}
          setPriorityFilter={qa.setPriorityFilter}
          statusFilter={qa.statusFilter}
          setStatusFilter={qa.setStatusFilter}
          categories={qa.categories}
          priorities={qa.priorities}
          statuses={qa.statuses}
          filteredCases={qa.filteredCases}
          pagedCases={qa.pagedCases}
          currentPage={qa.currentPage}
          totalPages={qa.totalPages}
          goToPage={qa.goToPage}
          ticketState={qa.ticketState}
          actionLoading={qa.actionLoading}
          createBugTicket={qa.createBugTicket}
          startDevelopment={qa.startDevelopment}
          copyContextBundle={qa.copyContextBundle}
          copyLaunchCommand={qa.copyLaunchCommand}
          viewTicket={qa.viewTicket}
          importCSV={qa.importCSV}
        />
      )}

      {view === "docs" && (
        <MarkdownView
          files={md.files}
          activeFile={md.activeFile}
          activeFileId={md.activeFileId}
          setActiveFileId={md.setActiveFileId}
          importFile={md.importFile}
          importFiles={md.importFiles}
          removeFile={md.removeFile}
          contentLoading={md.contentLoading}
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
          comments={detail.comments}
          commentsLoading={detail.commentsLoading}
          postComment={detail.postComment}
        />
      )}

      {/* Footer */}
      <footer className="footer">
        <span className="footer-text">Bitacora App Dashboard — #OpsLife</span>
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
