// ─── views/AgentsView.jsx — Agent Control Panel ──────────────────
// Dispatch agent jobs, view live logs, review results.
// Three panels: dispatch form | job list | live terminal.

import { useState, useRef, useEffect, useMemo } from "react";
import { AGENTS } from "../constants/agents";

// Only code-producing agents can be dispatched
const CODE_AGENTS = AGENTS.filter((a) => ["baal", "ios", "qa", "security"].includes(a.id));

const REPOS = [
  { id: "bitacora-app-dashboard", label: "Dashboard", icon: "🖥️" },
  { id: "bitacora-app-ios", label: "iOS App", icon: "📱" },
  { id: "primo-engineering", label: "primo.engineering", icon: "🌐" },
];

const STATUS_COLORS = {
  queued: "var(--text-muted)",
  running: "var(--accent-cyan)",
  done: "var(--accent-green)",
  failed: "var(--accent-red, #ef4444)",
  cancelled: "var(--text-dim)",
};

const STATUS_LABELS = {
  queued: "Queued",
  running: "Running",
  done: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};

export default function AgentsView({
  jobs,
  loading,
  activeJob,
  activeJobId,
  setActiveJobId,
  activeJobLogs,
  dispatching,
  dispatch,
  cancel,
  retry,
  showToast,
}) {
  const [agentType, setAgentType] = useState(CODE_AGENTS[0].id);
  const [repo, setRepo] = useState(REPOS[0].id);
  const [prompt, setPrompt] = useState("");
  const [ticketId, setTicketId] = useState("");
  const terminalRef = useRef(null);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [activeJobLogs]);

  // ─── Dispatch handler ─────────────────────────────────────────
  const handleDispatch = async () => {
    if (!prompt.trim()) return;
    try {
      await dispatch({ agentType, repo, prompt: prompt.trim(), ticketId: ticketId.trim() || undefined });
      setPrompt("");
      setTicketId("");
      showToast("Job dispatched", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  // ─── Filter state ─────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState("all");
  const filteredJobs = useMemo(() => {
    if (statusFilter === "all") return jobs;
    return jobs.filter((j) => j.status === statusFilter);
  }, [jobs, statusFilter]);

  const selectedAgent = CODE_AGENTS.find((a) => a.id === agentType);

  return (
    <div className="animate-fade agents-layout">
      {/* Left: Dispatch + Job List */}
      <div className="agents-left-col">
        {/* Dispatch Form */}
        <div className="dispatch-panel">
          <div className="dispatch-title">Dispatch Agent</div>

          {/* Agent selector */}
          <div className="agent-selector">
            {CODE_AGENTS.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => setAgentType(agent.id)}
                style={{
                  padding: "4px 10px",
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  borderRadius: "var(--radius-sm)",
                  border: agentType === agent.id ? `2px solid ${agent.color}` : "1px solid var(--border-subtle)",
                  background: agentType === agent.id ? `${agent.color}15` : "transparent",
                  color: agentType === agent.id ? agent.color : "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                {agent.icon} {agent.id}
              </button>
            ))}
          </div>

          {/* Repo selector */}
          <select
            className="dispatch-select"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
          >
            {REPOS.map((r) => (
              <option key={r.id} value={r.id}>{r.icon} {r.label}</option>
            ))}
          </select>

          {/* Ticket ID (optional) */}
          <input
            type="text"
            className="dispatch-input"
            placeholder="Ticket ID (optional, e.g. BIT-37)"
            value={ticketId}
            onChange={(e) => setTicketId(e.target.value)}
          />

          {/* Prompt */}
          <textarea
            className="dispatch-textarea"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={`What should ${selectedAgent?.id || "the agent"} do?`}
            rows={4}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleDispatch();
            }}
          />

          <button
            type="button"
            onClick={handleDispatch}
            disabled={dispatching || !prompt.trim()}
            className="dispatch-submit"
            style={{ background: selectedAgent?.color || "var(--accent-indigo)" }}
          >
            {dispatching ? "Dispatching..." : "Dispatch"}
          </button>
        </div>

        {/* Job List */}
        <div className="job-list-panel">
          <div className="job-list-header">
            <span className="job-list-title">Jobs ({filteredJobs.length})</span>
            <select
              className="job-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="running">Running</option>
              <option value="queued">Queued</option>
              <option value="done">Done</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {loading && <div className="job-empty">Loading...</div>}

          {!loading && filteredJobs.length === 0 && (
            <div className="job-empty">
              No jobs yet. Dispatch an agent to get started.
            </div>
          )}

          {filteredJobs.map((job) => {
            const input = safeParseJson(job.inputJson);
            const agent = AGENTS.find((a) => a.id === job.agentType);
            const isActive = job.id === activeJobId;
            return (
              <div
                key={job.id}
                className="job-item"
                onClick={() => setActiveJobId(job.id)}
                style={{
                  border: isActive
                    ? `1px solid ${agent?.color || "var(--accent-indigo)"}`
                    : "1px solid var(--border-subtle)",
                  background: isActive
                    ? `${agent?.color || "var(--accent-indigo)"}08`
                    : "transparent",
                }}
              >
                <div className="job-item-header">
                  <span className="job-item-agent" style={{ color: agent?.color || "var(--text-primary)" }}>
                    {agent?.icon} {job.agentType} #{job.id}
                  </span>
                  <span
                    className="job-status-badge"
                    style={{
                      color: STATUS_COLORS[job.status] || "var(--text-muted)",
                      border: `1px solid ${STATUS_COLORS[job.status] || "var(--border-subtle)"}`,
                    }}
                  >
                    {STATUS_LABELS[job.status] || job.status}
                  </span>
                </div>
                <div className="job-item-repo">
                  {input?.repo || "—"} {job.ticketId ? `• ${job.ticketId}` : ""}
                </div>
                <div className="job-item-time">
                  {formatTime(job.createdAt)}
                  {job.finishedAt && ` • ${elapsed(job.startedAt, job.finishedAt)}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Live Terminal + Actions */}
      <div className="agents-right-col">
        {/* Job header */}
        {activeJob && (
          <div className="job-header-panel">
            <div>
              <span className="job-header-title">Job #{activeJob.id}</span>
              <span className="job-header-meta">
                {activeJob.agentType} • {safeParseJson(activeJob.inputJson)?.repo}
                {activeJob.ticketId ? ` • ${activeJob.ticketId}` : ""}
              </span>
            </div>
            <div className="job-header-actions">
              {activeJob.status === "running" && (
                <button
                  type="button"
                  onClick={() => cancel(activeJob.id)}
                  className="step-btn"
                  style={{ fontSize: "var(--text-xs)", color: "var(--accent-red, #ef4444)" }}
                >
                  Stop
                </button>
              )}
              {["failed", "cancelled"].includes(activeJob.status) && (
                <button
                  type="button"
                  onClick={() => retry(activeJob.id)}
                  className="step-btn"
                  style={{ fontSize: "var(--text-xs)", color: "var(--accent-cyan)" }}
                >
                  Retry
                </button>
              )}
              {activeJob.status === "done" && safeParseJson(activeJob.resultJson)?.diff && (
                <button
                  type="button"
                  onClick={() => showToast("Review modal coming soon", "info")}
                  className="step-btn"
                  style={{ fontSize: "var(--text-xs)", color: "var(--accent-green)" }}
                >
                  Review Changes
                </button>
              )}
            </div>
          </div>
        )}

        {/* Terminal */}
        <div ref={terminalRef} className="agent-terminal">
          {!activeJobId && (
            <div className="terminal-placeholder">
              Select a job or dispatch an agent to see live output here.
            </div>
          )}

          {activeJobId && activeJobLogs.length === 0 && (
            <div style={{ color: "#484f58" }}>
              {activeJob?.status === "queued" ? "Waiting for agent to start..." : "No logs yet."}
            </div>
          )}

          {activeJobLogs.map((log, i) => (
            <div
              key={i}
              className={`terminal-log ${log.level === "error" ? "terminal-log-error" : "terminal-log-normal"}`}
            >
              <span className="terminal-log-ts">
                {formatLogTime(log.ts || log.createdAt)}
              </span>
              {log.message}
            </div>
          ))}

          {activeJob?.status === "running" && (
            <div className="terminal-cursor">▋</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function safeParseJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatLogTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function elapsed(start, end) {
  if (!start || !end) return "";
  const ms = new Date(end) - new Date(start);
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}
