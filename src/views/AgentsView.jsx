// ─── views/AgentsView.jsx — Agent Control Panel ──────────────────
// Dispatch agent jobs, view live logs, review results.
// Three panels: dispatch form | job list | live terminal.

import { useState, useRef, useEffect, useMemo } from "react";
import { AGENTS } from "../constants/agents";
import { fetchIssues, getCustomFieldValue } from "../youtrack";

// Full PE team roster available for dispatch
const DISPATCH_AGENTS = [
  { id: "baal",                label: "baal",            color: "#22d3ee", group: "engineering", desc: "Full-stack" },
  { id: "beast",               label: "beast",           color: "#34d399", group: "engineering", desc: "iOS / Swift" },
  { id: "qa-testing",          label: "qa-testing",      color: "#f59e0b", group: "engineering", desc: "QA & testing" },
  { id: "hades",               label: "hades",           color: "#a78bfa", group: "security",    desc: "Pen testing" },
  { id: "matute",              label: "matute",          color: "#ef4444", group: "security",    desc: "Red team" },
  { id: "security-compliance", label: "sec-compliance",  color: "#f97316", group: "security",    desc: "FERPA / LFPDPPP" },
  { id: "ux-ui-designer",      label: "ux-designer",     color: "#ec4899", group: "design",      desc: "UI & research" },
  { id: "lucifer",             label: "lucifer",         color: "#7c6aff", group: "business",    desc: "Product mgmt" },
  { id: "data-analytics",      label: "data-analytics",  color: "#8b5cf6", group: "business",    desc: "Analytics" },
  { id: "engineer-mentor",     label: "eng-mentor",      color: "#06b6d4", group: "business",    desc: "Mentorship" },
  { id: "customer-success",    label: "cust-success",    color: "#10b981", group: "business",    desc: "CS & retention" },
  { id: "gtm-agent",           label: "gtm",             color: "#f59e0b", group: "business",    desc: "Growth" },
];

const AGENT_GROUPS = [
  { label: "Engineering", agents: DISPATCH_AGENTS.filter((a) => a.group === "engineering") },
  { label: "Security",    agents: DISPATCH_AGENTS.filter((a) => a.group === "security") },
  { label: "Design",      agents: DISPATCH_AGENTS.filter((a) => a.group === "design") },
  { label: "Business",    agents: DISPATCH_AGENTS.filter((a) => a.group === "business") },
];

const PROJECTS = [
  { id: "bitacora-app-dashboard", label: "Dashboard" },
  { id: "bitacora-app-ios",       label: "iOS" },
  { id: "primo-engineering",      label: "Portfolio" },
  { id: "primo-engineering-team", label: "Team" },
];

const STATUS_COLORS = {
  queued:    "var(--text-muted)",
  running:   "var(--accent-cyan)",
  done:      "var(--accent-green)",
  failed:    "var(--accent-red, #ef4444)",
  cancelled: "var(--text-dim)",
};

const STATUS_LABELS = {
  queued:    "Queued",
  running:   "Running",
  done:      "Done",
  failed:    "Failed",
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
  token,
}) {
  const [agentId, setAgentId]               = useState(DISPATCH_AGENTS[0].id);
  const [repo, setRepo]                     = useState(PROJECTS[0].id);
  const [prompt, setPrompt]                 = useState("");
  const [ticketId, setTicketId]             = useState("");
  const [openTickets, setOpenTickets]       = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [agentDropdownOpen, setAgentDropdownOpen]     = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const terminalRef = useRef(null);

  // Fetch open tickets from YouTrack for the dropdown
  useEffect(() => {
    if (!token) return;
    setTicketsLoading(true);
    fetchIssues(token, { query: "project: BIT #Unresolved sort by: updated desc", top: 100 })
      .then((issues) => setOpenTickets(issues))
      .catch(() => setOpenTickets([]))
      .finally(() => setTicketsLoading(false));
  }, [token]);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [activeJobLogs]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(".dispatch-trigger")) {
        setAgentDropdownOpen(false);
        setProjectDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ─── Dispatch handler ─────────────────────────────────────────
  const handleDispatch = async () => {
    if (!prompt.trim()) return;
    try {
      await dispatch({
        agentType: agentId,
        repo,
        prompt: prompt.trim(),
        ticketId: ticketId || undefined,
      });
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

  const selectedAgent   = DISPATCH_AGENTS.find((a) => a.id === agentId);
  const selectedProject = PROJECTS.find((p) => p.id === repo);

  return (
    <div className="animate-fade">
      <div className="view-header">
        <h1 className="view-title">Agents</h1>
        <p className="view-desc">Dispatch AI agents to work on tasks across your projects.</p>
      </div>
    <div className="agents-layout">
      {/* Left: Dispatch + Job List */}
      <div className="agents-left-col">
        {/* Dispatch Form */}
        <div className="dispatch-panel">
          <div className="dispatch-title">Dispatch</div>

          {/* 1 — Agent + Project dropdowns */}
          <div className="dispatch-trigger-row">
            {/* Agent trigger */}
            <div className="dispatch-trigger">
              <button
                type="button"
                className={`dispatch-trigger-btn${agentDropdownOpen ? " dispatch-trigger-btn--open" : ""}`}
                onClick={() => {
                  setAgentDropdownOpen((v) => !v);
                  setProjectDropdownOpen(false);
                }}
              >
                <span
                  className="agent-dot"
                  style={{ background: selectedAgent?.color || "#7c6aff" }}
                />
                <span className="dispatch-trigger-label">{selectedAgent?.label || "Agent"}</span>
                <svg
                  className={`dispatch-trigger-chevron${agentDropdownOpen ? " dispatch-trigger-chevron--open" : ""}`}
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {agentDropdownOpen && (
                <div className="dispatch-dropdown dispatch-dropdown--agent">
                  {AGENT_GROUPS.map((group) => (
                    <div key={group.label}>
                      <div className="dispatch-dropdown-group">{group.label}</div>
                      {group.agents.map((agent) => (
                        <button
                          key={agent.id}
                          type="button"
                          className={`dispatch-dropdown-item${agentId === agent.id ? " dispatch-dropdown-item--active" : ""}`}
                          onClick={() => {
                            setAgentId(agent.id);
                            setAgentDropdownOpen(false);
                          }}
                        >
                          <span
                            className="agent-dot"
                            style={{ background: agent.color }}
                          />
                          <span className="dispatch-dropdown-item-label">{agent.label}</span>
                          <span className="dispatch-dropdown-item-desc">{agent.desc}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Project trigger */}
            <div className="dispatch-trigger">
              <button
                type="button"
                className={`dispatch-trigger-btn${projectDropdownOpen ? " dispatch-trigger-btn--open" : ""}`}
                onClick={() => {
                  setProjectDropdownOpen((v) => !v);
                  setAgentDropdownOpen(false);
                }}
              >
                <span className="dispatch-trigger-label">{selectedProject?.label || "Project"}</span>
                <svg
                  className={`dispatch-trigger-chevron${projectDropdownOpen ? " dispatch-trigger-chevron--open" : ""}`}
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {projectDropdownOpen && (
                <div className="dispatch-dropdown dispatch-dropdown--project">
                  {PROJECTS.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      className={`dispatch-dropdown-item${repo === project.id ? " dispatch-dropdown-item--active" : ""}`}
                      onClick={() => {
                        setRepo(project.id);
                        setProjectDropdownOpen(false);
                      }}
                    >
                      <span className="dispatch-dropdown-item-label">{project.label}</span>
                      <span className="dispatch-dropdown-item-desc">{project.id}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2 — Ticket dropdown (only when tickets exist) */}
          {(openTickets.length > 0 || ticketsLoading) && (
            <select
              className="dispatch-select"
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              disabled={ticketsLoading}
            >
              <option value="">
                {ticketsLoading ? "Loading tickets..." : "— No ticket —"}
              </option>
              {openTickets.map((issue) => {
                getCustomFieldValue(issue, "Stage");
                const summary = issue.summary || "";
                const label = `${issue.idReadable} — ${summary.length > 50 ? summary.slice(0, 50) + "…" : summary}`;
                return (
                  <option key={issue.id} value={issue.idReadable}>
                    {label}
                  </option>
                );
              })}
            </select>
          )}

          {/* 3 — Prompt textarea */}
          <textarea
            className="dispatch-textarea"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={`What should ${selectedAgent?.label || "the agent"} do?`}
            rows={5}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleDispatch();
            }}
          />

          {/* 4 — Dispatch button */}
          <button
            type="button"
            onClick={handleDispatch}
            disabled={dispatching || !prompt.trim()}
            className="dispatch-submit"
            style={
              dispatching || !prompt.trim()
                ? undefined
                : { background: selectedAgent?.color || "var(--accent-indigo)" }
            }
          >
            {dispatching ? "Dispatching..." : "Dispatch"}
          </button>
          <div className="dispatch-hint">Cmd+Enter to dispatch</div>
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
            const dispatchAgent = DISPATCH_AGENTS.find((a) => a.id === job.agentType);
            const legacyAgent = AGENTS.find((a) => a.id === job.agentType);
            const agentColor = dispatchAgent?.color || legacyAgent?.color || "var(--accent-indigo)";
            const agentIcon  = legacyAgent?.icon || "●";
            const isActive = job.id === activeJobId;
            return (
              <div
                key={job.id}
                className="job-item"
                onClick={() => setActiveJobId(job.id)}
                style={{
                  border: isActive
                    ? `1px solid ${agentColor}`
                    : "1px solid var(--border-subtle)",
                  background: isActive
                    ? `${agentColor}08`
                    : "transparent",
                }}
              >
                <div className="job-item-header">
                  <span className="job-item-agent" style={{ color: agentColor }}>
                    {agentIcon} {job.agentType} #{job.id}
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
