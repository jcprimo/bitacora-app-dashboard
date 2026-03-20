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
    <div className="animate-fade" style={{ display: "flex", gap: "var(--space-4)", height: "calc(100vh - 180px)", minHeight: 500 }}>
      {/* ─── Left: Dispatch + Job List ──────────────────────────── */}
      <div style={{ width: 360, flexShrink: 0, display: "flex", flexDirection: "column", gap: "var(--space-4)", overflow: "hidden" }}>
        {/* Dispatch Form */}
        <div style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-4)",
        }}>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, marginBottom: "var(--space-3)", color: "var(--text-primary)" }}>
            Dispatch Agent
          </div>

          {/* Agent selector */}
          <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-3)", flexWrap: "wrap" }}>
            {CODE_AGENTS.map((agent) => (
              <button
                key={agent.id}
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
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 10px",
              fontSize: "var(--text-xs)",
              background: "var(--bg-input, var(--bg-card))",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-primary)",
              marginBottom: "var(--space-3)",
            }}
          >
            {REPOS.map((r) => (
              <option key={r.id} value={r.id}>{r.icon} {r.label}</option>
            ))}
          </select>

          {/* Ticket ID (optional) */}
          <input
            type="text"
            placeholder="Ticket ID (optional, e.g. BIT-37)"
            value={ticketId}
            onChange={(e) => setTicketId(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 10px",
              fontSize: "var(--text-xs)",
              background: "var(--bg-input, var(--bg-card))",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-primary)",
              marginBottom: "var(--space-3)",
              boxSizing: "border-box",
            }}
          />

          {/* Prompt */}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={`What should ${selectedAgent?.id || "the agent"} do?`}
            rows={4}
            style={{
              width: "100%",
              padding: "8px 10px",
              fontSize: "var(--text-xs)",
              fontFamily: "inherit",
              background: "var(--bg-input, var(--bg-card))",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-primary)",
              resize: "vertical",
              marginBottom: "var(--space-3)",
              boxSizing: "border-box",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleDispatch();
            }}
          />

          <button
            onClick={handleDispatch}
            disabled={dispatching || !prompt.trim()}
            style={{
              width: "100%",
              padding: "8px",
              fontSize: "var(--text-sm)",
              fontWeight: 700,
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: selectedAgent?.color || "var(--accent-indigo)",
              color: "#000",
              cursor: dispatching || !prompt.trim() ? "not-allowed" : "pointer",
              opacity: dispatching || !prompt.trim() ? 0.5 : 1,
            }}
          >
            {dispatching ? "Dispatching..." : "Dispatch"}
          </button>
        </div>

        {/* Job List */}
        <div style={{
          flex: 1,
          overflow: "auto",
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-3)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>
              Jobs ({filteredJobs.length})
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "2px 8px",
                fontSize: "var(--text-xs)",
                background: "transparent",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-muted)",
              }}
            >
              <option value="all">All</option>
              <option value="running">Running</option>
              <option value="queued">Queued</option>
              <option value="done">Done</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {loading && <div style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)", padding: "var(--space-4)", textAlign: "center" }}>Loading...</div>}

          {!loading && filteredJobs.length === 0 && (
            <div style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)", padding: "var(--space-4)", textAlign: "center" }}>
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
                onClick={() => setActiveJobId(job.id)}
                style={{
                  padding: "8px 10px",
                  marginBottom: "var(--space-2)",
                  borderRadius: "var(--radius-sm)",
                  border: isActive ? `1px solid ${agent?.color || "var(--accent-indigo)"}` : "1px solid var(--border-subtle)",
                  background: isActive ? `${agent?.color || "var(--accent-indigo)"}08` : "transparent",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                  <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: agent?.color || "var(--text-primary)" }}>
                    {agent?.icon} {job.agentType} #{job.id}
                  </span>
                  <span style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                    padding: "1px 6px",
                    borderRadius: "var(--radius-sm)",
                    color: STATUS_COLORS[job.status] || "var(--text-muted)",
                    border: `1px solid ${STATUS_COLORS[job.status] || "var(--border-subtle)"}`,
                  }}>
                    {STATUS_LABELS[job.status] || job.status}
                  </span>
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {input?.repo || "—"} {job.ticketId ? `• ${job.ticketId}` : ""}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-dim)", marginTop: 2 }}>
                  {formatTime(job.createdAt)}
                  {job.finishedAt && ` • ${elapsed(job.startedAt, job.finishedAt)}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Right: Live Terminal + Actions ─────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-3)", overflow: "hidden" }}>
        {/* Job header */}
        {activeJob && (
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "var(--space-3) var(--space-4)",
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg)",
          }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                Job #{activeJob.id}
              </span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginLeft: "var(--space-3)" }}>
                {activeJob.agentType} • {safeParseJson(activeJob.inputJson)?.repo}
                {activeJob.ticketId ? ` • ${activeJob.ticketId}` : ""}
              </span>
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              {activeJob.status === "running" && (
                <button onClick={() => cancel(activeJob.id)} className="step-btn" style={{ fontSize: "var(--text-xs)", color: "var(--accent-red, #ef4444)" }}>
                  Stop
                </button>
              )}
              {["failed", "cancelled"].includes(activeJob.status) && (
                <button onClick={() => retry(activeJob.id)} className="step-btn" style={{ fontSize: "var(--text-xs)", color: "var(--accent-cyan)" }}>
                  Retry
                </button>
              )}
              {activeJob.status === "done" && safeParseJson(activeJob.resultJson)?.diff && (
                <button onClick={() => showToast("Review modal coming soon", "info")} className="step-btn" style={{ fontSize: "var(--text-xs)", color: "var(--accent-green)" }}>
                  Review Changes
                </button>
              )}
            </div>
          </div>
        )}

        {/* Terminal */}
        <div
          ref={terminalRef}
          style={{
            flex: 1,
            background: "#0d1117",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-3)",
            fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontSize: "var(--text-xs)",
            lineHeight: 1.6,
            overflow: "auto",
            color: "#c9d1d9",
          }}
        >
          {!activeJobId && (
            <div style={{ color: "#484f58", padding: "var(--space-4)", textAlign: "center" }}>
              Select a job or dispatch an agent to see live output here.
            </div>
          )}

          {activeJobId && activeJobLogs.length === 0 && (
            <div style={{ color: "#484f58" }}>
              {activeJob?.status === "queued" ? "Waiting for agent to start..." : "No logs yet."}
            </div>
          )}

          {activeJobLogs.map((log, i) => (
            <div key={i} style={{ color: log.level === "error" ? "#f85149" : "#c9d1d9", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              <span style={{ color: "#484f58", marginRight: 8, userSelect: "none" }}>
                {formatLogTime(log.ts || log.createdAt)}
              </span>
              {log.message}
            </div>
          ))}

          {activeJob?.status === "running" && (
            <div style={{ color: "var(--accent-cyan)", animation: "pulse 1.5s infinite" }}>
              ▋
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function safeParseJson(str) {
  try { return JSON.parse(str); } catch { return null; }
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
