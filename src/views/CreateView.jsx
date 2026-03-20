// ─── views/CreateView.jsx — 3-Step Ticket Creation Wizard ───────
// Layout: sidebar (agent selector, token estimate, AI tips, spend
// widget) + main content area with the 3-step flow:
//
//   Step 1 — Input:  textarea + AI Generate / Template / Manual buttons
//   Step 2 — Review: editable draft with priority, effort, compliance flags
//   Step 3 — Done:   success confirmation with "Create Another" option
//
// The sidebar also shows a compact AI spend widget with budget bar.

import { AGENTS, EFFORTS } from "../constants/agents";
import { getPlaceholder } from "../constants/prompts";
import { estimateTokens, estimateCost } from "../constants/pricing";
import { copyToClipboard } from "../utils/clipboard";
import { PRIORITIES } from "../youtrack";
import { getColorShades } from "../utils/colors";

export default function CreateView({
  selectedAgent, setSelectedAgent,
  rawInput, setRawInput,
  isGenerating, draft, setDraft,
  createStep, setCreateStep,
  aiError, actionLoading,
  hasAIKey, resetCreate,
  generateWithAI, generateFromTemplate, submitTicket,
  showToast, recordUsage, token,
  aiUsage, totalSpendUsd, budgetPct, overBudget, combinedSpend, openaiTotalSpend,
  setView, loadIssues,
}) {
  const agentColor = selectedAgent.color;
  const tokenEst = estimateTokens(rawInput);
  const costEst = estimateCost(tokenEst);

  return (
    <div className="main-grid animate-fade">
      <aside className="sidebar">
        {/* Agent selector */}
        <div className="panel">
          <div className="panel-label">Agent Team</div>
          <div className="agent-list">
            {AGENTS.map((agent) => (
              <button
                key={agent.id}
                type="button"
                className={`agent-btn ${selectedAgent.id === agent.id ? "active" : ""}`}
                onClick={() => { setSelectedAgent(agent); resetCreate(); }}
                style={selectedAgent.id === agent.id ? {
                  background: getColorShades(agent.color).bg,
                  borderColor: getColorShades(agent.color).border,
                  color: agent.color,
                } : {}}
              >
                <span className="agent-icon">{agent.icon}</span>
                <span>{agent.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Active agent info */}
        <div className="panel" style={{ borderColor: `${agentColor}20` }}>
          <div className="panel-label" style={{ color: agentColor }}>Active Agent</div>
          <div className="agent-info-name">{selectedAgent.icon} {selectedAgent.label}</div>
          <div className="agent-info-desc">{selectedAgent.desc}</div>
          <div className="agent-tag-row">
            {(() => {
              const agentShades = getColorShades(agentColor);
              return (
                <span
                  className="agent-default-priority"
                  style={{ background: agentShades.bg, color: agentColor, border: `1px solid ${agentShades.border}` }}
                >
                  {selectedAgent.defaultPriority}
                </span>
              );
            })()}
          </div>
        </div>

        {/* Token estimate — only when on input step */}
        {createStep === "input" && (
          <div className="panel" style={{ borderColor: hasAIKey ? "rgba(124,106,255,0.15)" : "rgba(248,113,113,0.15)" }}>
            <div className="panel-label">{hasAIKey ? "AI Token Estimate" : "🔑 AI Not Configured"}</div>
            {!hasAIKey && (
              <div className="ai-unconfigured-msg">
                Add your Anthropic API key to <code style={{ fontSize: "0.6rem", background: "var(--bg-input)", padding: "1px 4px", borderRadius: 3 }}>.env</code>:
                <div className="ai-unconfigured-mono">VITE_ANTHROPIC_KEY=sk-ant-...</div>
                <div className="ai-unconfigured-hint">Then restart the dev server.</div>
              </div>
            )}
            <div className="token-est-rows">
              <div className="token-est-row">
                <span>System prompt</span>
                <span className="token-est-value">~250</span>
              </div>
              <div className="token-est-row">
                <span>Your input</span>
                <span className="token-est-value">~{tokenEst.input - 250}</span>
              </div>
              <div className="token-est-row">
                <span>JSON output (est.)</span>
                <span className="token-est-value">~{tokenEst.output}</span>
              </div>
              <div className="token-est-total">
                <span>Total</span>
                <span className="token-est-total-value">~{tokenEst.total} tokens</span>
              </div>
              <div className="token-est-cost">
                <span>Est. cost</span>
                <span className="token-est-cost-value">${costEst.toFixed(4)}</span>
              </div>
            </div>
            <div style={{
              marginTop: "0.6rem", fontSize: "var(--text-xs)", color: "var(--text-dim)", lineHeight: 1.5,
              borderTop: "1px solid var(--border-subtle)", paddingTop: "0.5rem",
            }}>
              Claude Sonnet 4 · $3/MTok in · $15/MTok out
            </div>
          </div>
        )}

        {/* AI Tips — only when on input step */}
        {createStep === "input" && (
          <div className="panel" style={{ borderColor: "rgba(251,191,36,0.15)" }}>
            <div className="panel-label" style={{ color: "var(--accent-amber)" }}>AI Prompt Tips</div>
            <ul style={{ fontSize: "0.63rem", color: "var(--text-muted)", lineHeight: 1.7, paddingLeft: "1rem", margin: 0 }}>
              <li><strong style={{ color: "var(--text-secondary)" }}>Be specific</strong> — &ldquo;teachers on iPhone need to log incidents in under 30 seconds&rdquo; beats &ldquo;add logging&rdquo;</li>
              <li><strong style={{ color: "var(--text-secondary)" }}>Name the user</strong> — teacher, principal, or admin. The agent tailors the ticket to that persona</li>
              <li><strong style={{ color: "var(--text-secondary)" }}>Mention compliance</strong> — if it touches student data, say so. The agent will flag FERPA/LFPDPPP risks</li>
              <li><strong style={{ color: "var(--text-secondary)" }}>One task per ticket</strong> — &ldquo;build the form AND redesign the dashboard&rdquo; should be two separate tickets</li>
              <li><strong style={{ color: "var(--text-secondary)" }}>Include constraints</strong> — deadlines, device targets (iPhone only?), language requirements (EN, ES, both)</li>
              <li><strong style={{ color: "var(--text-secondary)" }}>Shorter is fine</strong> — even 1-2 sentences work. The agent expands with structure, acceptance criteria, and compliance checks</li>
            </ul>
          </div>
        )}

        {/* AI Usage — compact */}
        <div className="panel" style={{ borderColor: overBudget ? "rgba(248,113,113,0.3)" : "rgba(34,211,238,0.15)" }}>
          <div className="panel-label" style={{ color: overBudget ? "var(--accent-red)" : "var(--accent-cyan)" }}>
            {overBudget ? "Budget Exceeded" : "AI Spend"}
          </div>
          <div className="create-spend-row" style={{ color: overBudget ? "var(--accent-red)" : "var(--accent-green)" }}>
            <span>{aiUsage.totalRequests} requests</span>
            <span style={{ fontFamily: "var(--font-mono)" }}>${combinedSpend.toFixed(4)}</span>
          </div>
          {openaiTotalSpend > 0 && (
            <div className="create-spend-breakdown">
              <span>Anthropic ${totalSpendUsd.toFixed(4)}</span>
              <span>OpenAI ${openaiTotalSpend.toFixed(4)}</span>
            </div>
          )}
          {aiUsage.budgetUsd && (
            <div className="budget-mini-bar-track">
              <div style={{
                width: `${budgetPct}%`, height: "100%", borderRadius: "2px",
                background: budgetPct > 90 ? "var(--accent-red)" : budgetPct > 70 ? "var(--accent-amber)" : "var(--accent-green)",
              }} />
            </div>
          )}
          <button
            type="button"
            className="create-spend-btn"
            onClick={() => setView("usage")}
          >
            View full usage →
          </button>
        </div>
      </aside>

      <main className="content-panel">
        <div className="step-bar">
          {[
            { id: "input", label: "Input", num: "1" },
            { id: "review", label: "Review", num: "2" },
            { id: "done", label: "Shipped", num: "3" },
          ].map((s) => (
            <button
              key={s.id}
              className={`step-btn ${createStep === s.id ? "active" : ""} ${
                (s.id === "input" && createStep !== "input") || (s.id === "review" && createStep === "done") ? "completed" : ""
              }`}
              onClick={() => {
                if (s.id === "input") setCreateStep("input");
                if (s.id === "review" && draft) setCreateStep("review");
              }}
            >
              <span className="step-number">{s.num}</span>
              {s.label}
            </button>
          ))}
        </div>

        <div className="content-area">
          {/* Step 1: Input */}
          {createStep === "input" && (
            <div className="animate-fade">
              <div className="content-label">Describe your task for {selectedAgent.label}</div>
              <textarea
                className="input-textarea"
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder={getPlaceholder(selectedAgent.id)}
              />
              {aiError && (
                <div className="ai-error-banner">
                  <strong>AI Error:</strong> {aiError}
                  <div className="ai-error-hint">
                    Use <strong>Template Generate</strong> instead — no API key needed.
                  </div>
                </div>
              )}
              <div className="create-actions">
                <button
                  type="button"
                  className="btn-generate"
                  onClick={() => generateWithAI(selectedAgent, recordUsage)}
                  disabled={isGenerating || !rawInput.trim() || !hasAIKey}
                  style={{
                    flex: 1,
                    background: !hasAIKey ? "var(--bg-elevated)" : getColorShades(agentColor).bg,
                    borderColor: !hasAIKey ? "var(--border-medium)" : getColorShades(agentColor).border,
                    color: !hasAIKey ? "var(--text-dim)" : agentColor,
                  }}
                >
                  {isGenerating ? (
                    <><span className="spinner" /> Generating with {selectedAgent.label}...</>
                  ) : !hasAIKey ? (
                    "🔑 VITE_ANTHROPIC_KEY not set"
                  ) : (
                    <>{selectedAgent.icon} AI Generate</>
                  )}
                </button>
                <button
                  type="button"
                  className="btn-generate"
                  onClick={() => generateFromTemplate(selectedAgent)}
                  disabled={!rawInput.trim()}
                  style={{
                    flex: 1,
                    background: getColorShades(agentColor).bg,
                    borderColor: getColorShades(agentColor).border,
                    color: agentColor,
                  }}
                >
                  📝 Template Generate
                </button>
                <button
                  type="button"
                  className="btn-generate"
                  onClick={() => {
                    setDraft({
                      summary: "", description: "", priority: selectedAgent.defaultPriority,
                      ferpa_risk: false, lfpdppp_risk: false, estimated_effort: "M",
                    });
                    setCreateStep("review");
                  }}
                  style={{ flex: 0, minWidth: 120, background: "var(--bg-elevated)", borderColor: "var(--border-medium)", color: "var(--text-secondary)" }}
                >
                  Manual
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Review */}
          {createStep === "review" && draft && (
            <div className="animate-fade">
              <div className="content-label">Review & edit before shipping to Bitacora</div>

              {draft.ferpa_risk && (
                <div className="compliance-alert ferpa">🔒 FERPA Risk — Security Agent review required</div>
              )}
              {draft.lfpdppp_risk && (
                <div className="compliance-alert lfpdppp">🛡️ LFPDPPP Risk — Security Agent must review</div>
              )}

              <div className="review-field">
                <div className="review-field-label">Summary *</div>
                <input
                  className="review-input"
                  value={draft.summary}
                  onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
                  placeholder="Ticket title (required)..."
                />
              </div>

              <div className="review-meta">
                <div className="meta-item">
                  <div className="review-field-label">Priority</div>
                  <select className="review-select" value={draft.priority} onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value }))}>
                    {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="meta-item">
                  <div className="review-field-label">Effort</div>
                  <div className="effort-badges">
                    {EFFORTS.map((e) => (
                      <button key={e} type="button" className={`effort-btn ${draft.estimated_effort === e ? "active" : ""}`}
                        onClick={() => setDraft((d) => ({ ...d, estimated_effort: e }))}>{e}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="review-field">
                <div className="review-field-label">Description (Markdown)</div>
                <textarea
                  className="review-textarea"
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  placeholder="Ticket description..."
                />
              </div>

              <div className="action-bar">
                <button type="button" className="btn-back" onClick={() => setCreateStep("input")}>← Back</button>
                <button
                  type="button"
                  className="btn-back"
                  title="Copy ticket as JSON for agent handoff"
                  onClick={() => copyToClipboard({
                    agent: selectedAgent.label,
                    summary: draft.summary,
                    description: draft.description,
                    priority: draft.priority,
                    estimated_effort: draft.estimated_effort,
                    ferpa_risk: draft.ferpa_risk,
                    lfpdppp_risk: draft.lfpdppp_risk,
                  }, "Ticket JSON", showToast)}
                  style={{ color: "var(--accent-cyan)", borderColor: "rgba(34,211,238,0.3)" }}
                >
                  📋 Copy JSON
                </button>
                <button
                  type="button"
                  className="btn-ship"
                  onClick={submitTicket}
                  disabled={actionLoading === "create" || !draft.summary.trim() || !token}
                  style={{
                    background: getColorShades(agentColor).bg,
                    borderColor: getColorShades(agentColor).border,
                    color: agentColor,
                  }}
                >
                  {actionLoading === "create" ? <><span className="spinner" /> Creating...</> : "🚀 Ship to Bitacora"}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Done */}
          {createStep === "done" && (
            <div className="success-screen animate-pop">
              <div className="success-check">✓</div>
              <div className="success-title">Ticket Created</div>
              <div className="success-card">
                <div className="success-id">{draft?.createdId}</div>
                <div className="success-summary">{draft?.summary}</div>
              </div>
              <div className="success-agent-credit" style={{ color: agentColor }}>
                {selectedAgent.icon} Created by {selectedAgent.label}
              </div>
              <div className="success-nav">
                <button type="button" className="btn-new-ticket" onClick={resetCreate}>+ Create Another</button>
                <button
                  type="button"
                  className="btn-new-ticket"
                  style={{ background: "rgba(52,211,153,0.1)", borderColor: "rgba(52,211,153,0.3)", color: "var(--accent-green)" }}
                  onClick={() => { setView("board"); loadIssues(); }}
                >
                  ← Back to Board
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
