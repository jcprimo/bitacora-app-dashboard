// ─── App.jsx — Application Shell ────────────────────────────────
// Root component for Bitacora App Dashboard.
//
// Auth flow:
//   1. On mount, useAuth checks /api/auth/me for an active session
//   2. If no users exist → shows SetupView (first-run admin creation)
//   3. If not authenticated → shows LoginView
//   4. If authenticated → shows the main dashboard
//
// Views:  board | create | qa | docs | agents | usage | detail
// State:  all app state lives in custom hooks; this file only wires
//         them together and renders the active view.

import { useState, useCallback, useRef } from "react";
import "./App.css";

// ─── Constants ──────────────────────────────────────────────────
import { AGENTS } from "./constants/agents";

// ─── Hooks ──────────────────────────────────────────────────────
import { useAuth } from "./hooks/useAuth";
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
import { useIngestEvents } from "./hooks/useIngestEvents";
import { useAgentJobs } from "./hooks/useAgentJobs";
import { useVisitedTickets } from "./hooks/useVisitedTickets";
import { useVisitedDocs } from "./hooks/useVisitedDocs";

// ─── UI Components ──────────────────────────────────────────────
import Toast from "./components/Toast";
import Header from "./components/Header";
import SettingsModal from "./components/SettingsModal";

// ─── Views ──────────────────────────────────────────────────────
import LoginView from "./views/LoginView";
import BoardView from "./views/BoardView";
import CreateView from "./views/CreateView";
import UsageView from "./views/UsageView";
import DetailView from "./views/DetailView";
import QATrackerView from "./views/QATrackerView";
import MarkdownView from "./views/MarkdownView";
import AgentsView from "./views/AgentsView";

// ═══════════════════════════════════════════════════════════════════
export default function App() {
  // ─── Authentication ────────────────────────────────────────────
  const auth = useAuth();

  // ─── Theme (available on login screen too) ─────────────────────
  const { theme, toggleTheme } = useTheme();

  // ─── Auth loading state ────────────────────────────────────────
  if (auth.loading) {
    return (
      <div className="auth-loading">
        <div className="spinner" style={{ width: 24, height: 24 }} />
        <div className="auth-loading-text">Loading...</div>
      </div>
    );
  }

  // ─── Not authenticated → show login or setup ───────────────────
  if (!auth.user) {
    return (
      <LoginView
        needsSetup={auth.needsSetup}
        login={auth.login}
        register={auth.register}
        error={auth.error}
        clearError={auth.clearError}
      />
    );
  }

  // ─── Authenticated → render dashboard ──────────────────────────
  return <Dashboard auth={auth} theme={theme} toggleTheme={toggleTheme} />;
}

// ═══════════════════════════════════════════════════════════════════
// Dashboard — the main app, only rendered when authenticated.
// Separated to keep hook calls unconditional within this component.
// ═══════════════════════════════════════════════════════════════════
function Dashboard({ auth, theme, toggleTheme }) {
  // YouTrack auth — in Express proxy mode, credentials are server-side.
  // We use "server-managed" as a truthy placeholder so the UI knows a token
  // may exist. In dev mode, falls back to localStorage / env var.
  const isExpressProxy = window.location.port !== "5173";
  const [token, setToken] = useState(() => {
    if (isExpressProxy) return "server-managed";
    return localStorage.getItem("bitacora-yt-token") || import.meta.env.VITE_YT_TOKEN || "";
  });
  // Active tab: "board" | "create" | "usage" | "detail"
  const [view, setView] = useState("board");

  // ─── Hook composition ──────────────────────────────────────────
  const { toast, showToast } = useToast();
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
  const agentJobs = useAgentJobs();

  // ─── New ticket tracking (SSE) ──────────────────────────────────
  // When the SSE ingest fires a "ticket" event we mark those IDs as "new"
  // so BoardView can show a visual badge. Each ID is cleared when the user
  // clicks the card. A 5-minute auto-clear prevents stale highlights.
  const [newTicketIds, setNewTicketIds] = useState(() => new Set());
  const newTicketTimers = useRef({});

  const clearNewTicket = useCallback((id) => {
    if (newTicketTimers.current[id]) {
      clearTimeout(newTicketTimers.current[id]);
      delete newTicketTimers.current[id];
    }
    setNewTicketIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleTicketIngest = useCallback((payload) => {
    // Refresh the board first
    loadIssues();
    // Mark this ticket as new if we have an ID to identify it
    const id = payload.id || payload.ticketId;
    if (!id) return;
    setNewTicketIds((prev) => new Set([...prev, id]));
    // Auto-clear after 5 minutes
    if (newTicketTimers.current[id]) clearTimeout(newTicketTimers.current[id]);
    newTicketTimers.current[id] = setTimeout(() => clearNewTicket(id), 5 * 60 * 1000);
  }, [loadIssues, clearNewTicket]);

  // ─── Live ingest events (SSE) ───────────────────────────────────
  // When agents push documents or tickets via /api/ingest/*, the server
  // broadcasts an SSE event and we refresh the relevant data automatically.
  useIngestEvents({
    onDocument: md.refreshIndex,
    onTicket: handleTicketIngest,
  });

  // ─── Visited ticket tracking ─────────────────────────────────────
  // Tracks which tickets the user has clicked. Persisted to localStorage.
  // Pre-existing tickets are seeded as visited on first load so only
  // genuinely new tickets appear highlighted.
  const { visitedTicketIds, markVisited } = useVisitedTickets(issues);
  const { visitedDocIds, markDocVisited } = useVisitedDocs(md.files);

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
        user={auth.user}
        onLogout={auth.logout}
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
          className={`step-btn ${view === "agents" ? "active" : ""}`}
          onClick={() => setView("agents")}
          style={{ borderBottom: view === "agents" ? "2px solid var(--accent-cyan)" : "2px solid transparent" }}
        >
          ⚡ Agents{agentJobs.jobs.filter((j) => j.status === "running").length > 0 ? ` (${agentJobs.jobs.filter((j) => j.status === "running").length})` : ""}
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
          newTicketIds={newTicketIds}
          clearNewTicket={clearNewTicket}
          visitedTicketIds={visitedTicketIds}
          markVisited={markVisited}
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
          visitedDocIds={visitedDocIds}
          markDocVisited={markDocVisited}
        />
      )}

      {view === "agents" && (
        <AgentsView
          jobs={agentJobs.jobs}
          loading={agentJobs.loading}
          activeJob={agentJobs.activeJob}
          activeJobId={agentJobs.activeJobId}
          setActiveJobId={agentJobs.setActiveJobId}
          activeJobLogs={agentJobs.activeJobLogs}
          dispatching={agentJobs.dispatching}
          dispatch={agentJobs.dispatch}
          cancel={agentJobs.cancel}
          retry={agentJobs.retry}
          showToast={showToast}
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
