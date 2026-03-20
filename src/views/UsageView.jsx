// ─── views/UsageView.jsx — AI Spend Dashboard ──────────────────
// Two sub-tabs: Anthropic Claude and OpenAI.
//
// Anthropic tab:
//   - Credit balance card (manually set from Anthropic Console)
//   - Stats grid: total requests, tokens, spend, avg cost/request
//   - Monthly budget with progress bar (green → amber → red)
//   - Token breakdown (input vs output cost)
//   - Full request history table (last 50)
//
// OpenAI tab:
//   - Requires Admin API key (sk-admin-*) — shows guidance if missing
//   - Date range picker → Fetch from OpenAI Costs API
//   - Stats grid, model breakdown table, daily usage bar chart
//   - Links to OpenAI Console (Usage, Billing, Admin Keys)

import { getModelColor, isAdminKey, OPENAI_USAGE_URL, OPENAI_BILLING_URL, OPENAI_ADMIN_KEYS_URL } from "../openai";

export default function UsageView({
  aiUsage, totalSpendUsd, budgetPct, overBudget,
  resetUsage, setBudget, setCreditBalance,
  openaiKey, hasOpenAIKey,
  usageTab, setUsageTab,
  openaiUsage, openaiLoading, openaiError,
  openaiDateRange, setOpenaiDateRange,
  loadOpenaiUsage, openaiTotalSpend, combinedSpend,
  openSettings,
}) {
  const remaining = aiUsage.creditBalance != null ? Math.max(aiUsage.creditBalance - totalSpendUsd, 0) : null;

  return (
    <div className="animate-fade">
      {/* Sub-tabs */}
      <div className="nav-tabs">
        <button
          className={`step-btn ${usageTab === "anthropic" ? "active" : ""}`}
          onClick={() => setUsageTab("anthropic")}
          style={{ borderBottom: usageTab === "anthropic" ? "2px solid var(--accent-indigo)" : "2px solid transparent" }}
        >
          Anthropic Claude
        </button>
        <button
          className={`step-btn ${usageTab === "openai" ? "active" : ""}`}
          onClick={() => { setUsageTab("openai"); if (!openaiUsage && hasOpenAIKey) loadOpenaiUsage(); }}
          style={{ borderBottom: usageTab === "openai" ? "2px solid #10a37f" : "2px solid transparent" }}
        >
          OpenAI
        </button>
        <div className="usage-tab-spacer" />
        <div className="usage-combined-spend">
          Combined: <strong style={{ color: "var(--accent-green)", fontFamily: "var(--font-mono)" }}>${combinedSpend.toFixed(4)}</strong>
        </div>
      </div>

      {/* ─── OpenAI Tab ─── */}
      {usageTab === "openai" && (
        <div className="animate-fade">
          {/* Console Links Bar */}
          <div className="openai-console-bar">
            <span className="openai-console-label">OpenAI Console:</span>
            <a href={OPENAI_USAGE_URL} target="_blank" rel="noopener noreferrer" className="openai-console-link">
              Usage Dashboard
            </a>
            <span className="openai-console-sep">|</span>
            <a href={OPENAI_BILLING_URL} target="_blank" rel="noopener noreferrer" className="openai-console-link">
              Billing
            </a>
            <span className="openai-console-sep">|</span>
            <a href={OPENAI_ADMIN_KEYS_URL} target="_blank" rel="noopener noreferrer" className="openai-console-link">
              Admin Keys
            </a>
          </div>

          {!hasOpenAIKey ? (
            <div className="panel usage-empty-state">
              <div className="usage-empty-icon">🔑</div>
              <div style={{ fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.35rem" }}>No OpenAI API key configured</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.75rem", lineHeight: 1.6 }}>
                The OpenAI Usage API requires an <strong>Admin key</strong> (<code style={{ fontSize: "0.65rem", background: "var(--bg-input)", padding: "1px 4px", borderRadius: 3 }}>sk-admin-*</code>).
                <br />Standard project keys (<code style={{ fontSize: "0.65rem", background: "var(--bg-input)", padding: "1px 4px", borderRadius: 3 }}>sk-proj-*</code>) don&apos;t have access to usage data.
              </div>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
                <button className="btn-back" onClick={openSettings} style={{ color: "var(--accent-indigo)", borderColor: "rgba(124,106,255,0.3)" }}>
                  Open Settings
                </button>
                <a href={OPENAI_ADMIN_KEYS_URL} target="_blank" rel="noopener noreferrer"
                  className="btn-back" style={{ color: "#10a37f", borderColor: "rgba(16,163,127,0.3)", textDecoration: "none" }}>
                  Create Admin Key
                </a>
              </div>
            </div>
          ) : !isAdminKey(openaiKey) ? (
            <div className="panel" style={{ padding: "2rem" }}>
              <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                <div style={{ fontSize: "1.5rem" }}>&#9888;&#65039;</div>
                <div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.35rem" }}>Admin key required</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: "0.75rem" }}>
                    Your current key starts with <code style={{ fontSize: "0.65rem", background: "var(--bg-input)", padding: "1px 4px", borderRadius: 3 }}>{openaiKey.slice(0, 10)}...</code> — this is a standard project key.
                    <br />The Usage &amp; Costs API only works with <strong>Admin keys</strong> (<code style={{ fontSize: "0.65rem", background: "var(--bg-input)", padding: "1px 4px", borderRadius: 3 }}>sk-admin-*</code>).
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-dim)", marginBottom: "1rem", lineHeight: 1.6 }}>
                    <strong>How to get an Admin key:</strong><br />
                    1. Go to <a href={OPENAI_ADMIN_KEYS_URL} target="_blank" rel="noopener noreferrer" style={{ color: "#10a37f" }}>platform.openai.com/settings/organization/admin-keys</a><br />
                    2. Click &ldquo;Create new admin key&rdquo;<br />
                    3. Paste the <code style={{ fontSize: "0.65rem", background: "var(--bg-input)", padding: "1px 4px", borderRadius: 3 }}>sk-admin-...</code> key in Settings
                  </div>
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                    <a href={OPENAI_ADMIN_KEYS_URL} target="_blank" rel="noopener noreferrer"
                      className="btn-back" style={{ color: "#10a37f", borderColor: "rgba(16,163,127,0.3)", textDecoration: "none" }}>
                      Create Admin Key
                    </a>
                    <button className="btn-back" onClick={openSettings} style={{ color: "var(--accent-indigo)", borderColor: "rgba(124,106,255,0.3)" }}>
                      Update Key in Settings
                    </button>
                    <a href={OPENAI_USAGE_URL} target="_blank" rel="noopener noreferrer"
                      className="btn-back" style={{ color: "var(--text-muted)", borderColor: "var(--border-medium)", textDecoration: "none" }}>
                      View usage on OpenAI Console instead
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Date Range Filter */}
              <div className="date-range-row">
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-dim)" }}>Date range:</div>
                <input
                  className="settings-input"
                  type="date"
                  value={openaiDateRange.startDate}
                  onChange={(e) => setOpenaiDateRange((r) => ({ ...r, startDate: e.target.value }))}
                  style={{ fontSize: "var(--text-sm)", padding: "0.4rem 0.6rem", width: 150 }}
                />
                <span style={{ color: "var(--text-dim)", fontSize: "var(--text-xs)" }}>to</span>
                <input
                  className="settings-input"
                  type="date"
                  value={openaiDateRange.endDate}
                  onChange={(e) => setOpenaiDateRange((r) => ({ ...r, endDate: e.target.value }))}
                  style={{ fontSize: "var(--text-sm)", padding: "0.4rem 0.6rem", width: 150 }}
                />
                <button
                  type="button"
                  className="btn-back"
                  onClick={loadOpenaiUsage}
                  disabled={openaiLoading}
                  style={{ fontSize: "var(--text-sm)", padding: "0.4rem 1rem" }}
                >
                  {openaiLoading ? "Loading..." : "Fetch"}
                </button>
              </div>

              {openaiError && (
                <div className="usage-error-banner">
                  <strong>Error:</strong> {openaiError}
                </div>
              )}

              {/* Stats Grid */}
              <div className="stats-grid">
                <div className="panel stat-card">
                  <div className="stat-card-value" style={{ color: "#10a37f" }}>
                    ${openaiTotalSpend.toFixed(4)}
                  </div>
                  <div className="stat-card-label">Total Spent</div>
                </div>
                <div className="panel stat-card">
                  <div className="stat-card-value" style={{ color: "var(--accent-cyan)" }}>
                    {openaiUsage?.modelTotals?.["whisper-1"] != null
                      ? `$${openaiUsage.modelTotals["whisper-1"].toFixed(4)}`
                      : "—"
                    }
                  </div>
                  <div className="stat-card-label">Whisper Usage</div>
                </div>
                <div className="panel stat-card">
                  <div className="stat-card-value" style={{ color: "var(--accent-green)" }}>
                    {openaiUsage?.modelTotals?.["gpt-4o-mini"] != null
                      ? `$${openaiUsage.modelTotals["gpt-4o-mini"].toFixed(4)}`
                      : "—"
                    }
                  </div>
                  <div className="stat-card-label">GPT-4o-mini Usage</div>
                </div>
                <div className="panel stat-card">
                  <div className="stat-card-value" style={{ color: "var(--accent-amber)" }}>
                    {openaiUsage?.dailyBreakdown?.length > 0
                      ? `$${(openaiTotalSpend / openaiUsage.dailyBreakdown.length).toFixed(4)}`
                      : "—"
                    }
                  </div>
                  <div className="stat-card-label">Daily Average</div>
                </div>
              </div>

              {/* Model Breakdown Table */}
              {openaiUsage?.modelTotals && Object.keys(openaiUsage.modelTotals).length > 0 && (
                <div className="panel" style={{ marginBottom: "1.5rem" }}>
                  <div className="panel-label" style={{ color: "#10a37f" }}>Model Breakdown</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <th className="usage-table-header">Model</th>
                          <th className="usage-table-header-right">Cost</th>
                          <th className="usage-table-header-right">% of Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(openaiUsage.modelTotals)
                          .sort(([, a], [, b]) => b - a)
                          .map(([model, cost]) => (
                            <tr key={model} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                              <td className="usage-table-cell" style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
                                <span
                                  className="model-color-dot"
                                  style={{ background: getModelColor(model) }}
                                />
                                {model}
                              </td>
                              <td className="usage-table-cell-right usage-table-cell-mono" style={{ color: "var(--accent-green)", fontWeight: 600 }}>
                                ${cost.toFixed(4)}
                              </td>
                              <td className="usage-table-cell-right usage-table-cell-mono" style={{ color: "var(--text-muted)" }}>
                                {openaiTotalSpend > 0 ? ((cost / openaiTotalSpend) * 100).toFixed(1) : 0}%
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Daily Usage Bars */}
              {openaiUsage?.dailyBreakdown?.length > 0 && (
                <div className="panel">
                  <div className="panel-label" style={{ color: "#10a37f" }}>Daily Usage</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    {(() => {
                      const maxDay = Math.max(...openaiUsage.dailyBreakdown.map((d) => d.total));
                      return openaiUsage.dailyBreakdown.map((day) => (
                        <div key={day.date} className="daily-bar-row">
                          <span className="daily-bar-date">{day.date}</span>
                          <div className="daily-bar-track">
                            {Object.entries(day.models).map(([model, cost]) => (
                              <div
                                key={model}
                                title={`${model}: $${cost.toFixed(4)}`}
                                style={{
                                  width: `${(cost / maxDay) * 100}%`,
                                  height: "100%",
                                  background: getModelColor(model),
                                  opacity: 0.8,
                                }}
                              />
                            ))}
                          </div>
                          <span className="daily-bar-total">${day.total.toFixed(4)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                  {/* Legend */}
                  <div className="daily-bar-legend">
                    {Object.keys(openaiUsage.modelTotals).map((model) => (
                      <div key={model} className="daily-bar-legend-item">
                        <span className="legend-dot" style={{ background: getModelColor(model) }} />
                        {model}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!openaiUsage && !openaiLoading && !openaiError && (
                <div className="panel usage-empty-state">
                  <div className="usage-empty-icon">📊</div>
                  <div className="usage-empty-text">Click Fetch to load OpenAI usage data</div>
                </div>
              )}

              {openaiUsage && !openaiUsage.dailyBreakdown?.length && !openaiLoading && (
                <div className="panel usage-empty-state">
                  <div className="usage-empty-icon">📭</div>
                  <div className="usage-empty-text">No usage data for this period</div>
                  <div className="usage-empty-hint">Try adjusting the date range</div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── Anthropic Tab ─── */}
      {usageTab === "anthropic" && (
        <div>
          {/* Credit Balance Section */}
          <div className="credit-section">
            <div className="credit-section-title">Credit balance</div>
            <div className="credit-section-desc">
              Your credit balance is consumed by AI ticket generation. Set your starting balance from the{" "}
              <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noopener noreferrer"
                style={{ color: "var(--accent-indigo)", textDecoration: "none" }}>Anthropic Console</a>{" "}
              to track remaining credits here.
            </div>

            <div className="credit-row">
              {/* Balance Card */}
              <div className="credit-card">
                {remaining != null ? (
                  <>
                    <div className="credit-card-amount">${remaining.toFixed(2)}</div>
                    <div className="credit-card-label">Remaining Balance</div>
                    {totalSpendUsd > 0 && (
                      <div className="credit-card-pending">${totalSpendUsd.toFixed(4)} spent of ${aiUsage.creditBalance.toFixed(2)}</div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="credit-card-amount" style={{ fontSize: "1.4rem", fontWeight: 500 }}>No balance set</div>
                    <div className="credit-card-label">Enter your balance from the Anthropic Console →</div>
                  </>
                )}
              </div>

              {/* Right side info */}
              <div className="credit-right">
                <div>
                  <div className="credit-balance-note">
                    {remaining != null ? "Starting balance" : "Enter your balance from console.anthropic.com/settings/billing"}
                  </div>
                  <div className="credit-balance-input-row">
                    <div className="credit-balance-input-wrap">
                      <span className="credit-dollar-prefix">$</span>
                      <input
                        className="settings-input"
                        autoFocus={aiUsage.creditBalance == null}
                        type="number" step="0.01" min="0"
                        placeholder="e.g. 4.95"
                        value={aiUsage.creditBalance ?? ""}
                        onChange={(e) => setCreditBalance(e.target.value ? parseFloat(e.target.value) : null)}
                        style={{
                          paddingLeft: "1.5rem", fontSize: "0.82rem",
                          borderColor: aiUsage.creditBalance == null ? "var(--accent-indigo)" : undefined,
                        }}
                      />
                    </div>
                    <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noopener noreferrer"
                      className="btn-back" style={{ fontSize: "0.72rem", textDecoration: "none", padding: "0.5rem 1rem" }}>
                      Buy credits
                    </a>
                  </div>
                </div>

                <div className="budget-status">
                  <span className="budget-status-icon">{overBudget ? "🔴" : aiUsage.budgetUsd ? "🟢" : "⚪"}</span>
                  <div className="budget-status-text">
                    {aiUsage.budgetUsd
                      ? <>Budget alert set at <strong>${aiUsage.budgetUsd.toFixed(2)}</strong>. {overBudget ? "Budget exceeded!" : "Tracking active."}</>
                      : <>Budget alert is <strong>not set</strong>. Set a monthly limit below to get warnings.</>
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="stats-grid">
            <div className="panel stat-card">
              <div className="stat-card-value" style={{ color: "var(--accent-indigo)" }}>
                {aiUsage.totalRequests}
              </div>
              <div className="stat-card-label">Total Requests</div>
            </div>
            <div className="panel stat-card">
              <div className="stat-card-value" style={{ color: "var(--accent-green)" }}>
                {(aiUsage.totalInputTokens + aiUsage.totalOutputTokens).toLocaleString()}
              </div>
              <div className="stat-card-label">Total Tokens</div>
            </div>
            <div className="panel stat-card">
              <div className="stat-card-value" style={{ color: overBudget ? "var(--accent-red)" : "var(--accent-amber)" }}>
                ${totalSpendUsd.toFixed(4)}
              </div>
              <div className="stat-card-label">Total Spent</div>
            </div>
            <div className="panel stat-card">
              <div className="stat-card-value" style={{ color: "var(--accent-cyan)" }}>
                {aiUsage.totalRequests > 0
                  ? `$${(totalSpendUsd / aiUsage.totalRequests).toFixed(4)}`
                  : "—"
                }
              </div>
              <div className="stat-card-label">Avg Cost / Request</div>
            </div>
          </div>

          {/* Budget + Token Breakdown */}
          <div className="budget-grid">
            {/* Budget */}
            <div className="panel">
              <div className="panel-label" style={{ color: "var(--accent-amber)" }}>Monthly Budget</div>
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <span style={{
                    position: "absolute", left: "0.6rem", top: "50%", transform: "translateY(-50%)",
                    color: "var(--text-dim)", fontSize: "0.78rem", fontWeight: 600, pointerEvents: "none",
                  }}>$</span>
                  <input
                    className="settings-input"
                    type="number" step="0.5" min="0"
                    placeholder="No limit"
                    value={aiUsage.budgetUsd ?? ""}
                    onChange={(e) => setBudget(e.target.value ? parseFloat(e.target.value) : null)}
                    style={{ paddingLeft: "1.4rem", fontSize: "0.78rem" }}
                  />
                </div>
                {aiUsage.totalRequests > 0 && (
                  <button type="button" onClick={resetUsage} className="btn-back" style={{ fontSize: "0.68rem", padding: "0.4rem 0.75rem" }}>
                    Reset Stats
                  </button>
                )}
              </div>
              {aiUsage.budgetUsd && (
                <>
                  <div className="budget-bar-labels">
                    <span>${totalSpendUsd.toFixed(4)} used</span>
                    <span>${aiUsage.budgetUsd.toFixed(2)} limit</span>
                  </div>
                  <div className="budget-bar-track">
                    <div style={{
                      width: `${budgetPct}%`, height: "100%", borderRadius: "4px",
                      background: budgetPct > 90 ? "var(--accent-red)" : budgetPct > 70 ? "var(--accent-amber)" : "var(--accent-green)",
                      transition: "width 0.4s ease",
                    }} />
                  </div>
                  <div className="budget-bar-pct-label">{budgetPct.toFixed(1)}% used</div>
                </>
              )}
            </div>

            {/* Token breakdown */}
            <div className="panel">
              <div className="panel-label" style={{ color: "var(--accent-cyan)" }}>Token Breakdown</div>
              <div className="token-breakdown-rows">
                <div className="token-breakdown-row">
                  <span>Input tokens</span>
                  <span className="token-breakdown-value">{aiUsage.totalInputTokens.toLocaleString()}</span>
                </div>
                <div className="token-breakdown-row">
                  <span>Output tokens</span>
                  <span className="token-breakdown-value">{aiUsage.totalOutputTokens.toLocaleString()}</span>
                </div>
                <div className="token-breakdown-total">
                  <span>Input cost</span>
                  <span className="token-breakdown-value">${(aiUsage.totalInputTokens * 3 / 1_000_000).toFixed(4)}</span>
                </div>
                <div className="token-breakdown-row">
                  <span>Output cost</span>
                  <span className="token-breakdown-value">${(aiUsage.totalOutputTokens * 15 / 1_000_000).toFixed(4)}</span>
                </div>
              </div>
              <div className="token-model-note">
                Claude Sonnet 4 · $3/MTok in · $15/MTok out
              </div>
            </div>
          </div>

          {/* Request History */}
          <div className="panel">
            <div className="panel-label" style={{ color: "var(--accent-indigo)" }}>Request History</div>
            {aiUsage.history.length === 0 ? (
              <div className="usage-empty-state" style={{ color: "var(--text-dim)" }}>
                <div className="usage-empty-icon">📭</div>
                <div className="usage-empty-text">No AI requests yet</div>
                <div className="usage-empty-hint">Generate a ticket with AI to start tracking</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <th className="usage-table-header">Time</th>
                      <th className="usage-table-header">Agent</th>
                      <th className="usage-table-header-right">In</th>
                      <th className="usage-table-header-right">Out</th>
                      <th className="usage-table-header-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiUsage.history.map((h, i) => {
                      const cost = (h.inputTokens * 3 + h.outputTokens * 15) / 1_000_000;
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <td className="usage-table-cell usage-table-cell-mono" style={{ color: "var(--text-dim)", fontSize: "0.65rem" }}>
                            {new Date(h.ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="usage-table-cell" style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{h.agent}</td>
                          <td className="usage-table-cell-right usage-table-cell-mono" style={{ color: "var(--text-muted)" }}>{h.inputTokens.toLocaleString()}</td>
                          <td className="usage-table-cell-right usage-table-cell-mono" style={{ color: "var(--text-muted)" }}>{h.outputTokens.toLocaleString()}</td>
                          <td className="usage-table-cell-right usage-table-cell-mono" style={{ color: "var(--accent-green)", fontWeight: 600 }}>${cost.toFixed(4)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
