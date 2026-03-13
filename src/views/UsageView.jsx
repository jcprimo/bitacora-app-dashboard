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
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
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
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", alignSelf: "center" }}>
          Combined: <strong style={{ color: "var(--accent-green)", fontFamily: "var(--font-mono)" }}>${combinedSpend.toFixed(4)}</strong>
        </div>
      </div>

      {/* ─── OpenAI Tab ─── */}
      {usageTab === "openai" && (
        <div className="animate-fade">
          {/* Console Links Bar */}
          <div style={{
            display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap",
            padding: "0.65rem 0.85rem", background: "rgba(16,163,127,0.06)", borderRadius: "var(--radius-md)",
            border: "1px solid rgba(16,163,127,0.15)", alignItems: "center",
          }}>
            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>OpenAI Console:</span>
            <a href={OPENAI_USAGE_URL} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: "0.68rem", color: "#10a37f", textDecoration: "none", fontWeight: 600 }}>
              Usage Dashboard
            </a>
            <span style={{ color: "var(--border-medium)" }}>|</span>
            <a href={OPENAI_BILLING_URL} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: "0.68rem", color: "#10a37f", textDecoration: "none", fontWeight: 600 }}>
              Billing
            </a>
            <span style={{ color: "var(--border-medium)" }}>|</span>
            <a href={OPENAI_ADMIN_KEYS_URL} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: "0.68rem", color: "#10a37f", textDecoration: "none", fontWeight: 600 }}>
              Admin Keys
            </a>
          </div>

          {!hasOpenAIKey ? (
            <div className="panel" style={{ textAlign: "center", padding: "3rem" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🔑</div>
              <div style={{ fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.35rem" }}>No OpenAI API key configured</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.75rem", lineHeight: 1.6 }}>
                The OpenAI Usage API requires an <strong>Admin key</strong> (<code style={{ fontSize: "0.65rem", background: "var(--bg-input)", padding: "1px 4px", borderRadius: 3 }}>sk-admin-*</code>).
                <br />Standard project keys (<code style={{ fontSize: "0.65rem", background: "var(--bg-input)", padding: "1px 4px", borderRadius: 3 }}>sk-proj-*</code>) don't have access to usage data.
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
                    <br />The Usage & Costs API only works with <strong>Admin keys</strong> (<code style={{ fontSize: "0.65rem", background: "var(--bg-input)", padding: "1px 4px", borderRadius: 3 }}>sk-admin-*</code>).
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-dim)", marginBottom: "1rem", lineHeight: 1.6 }}>
                    <strong>How to get an Admin key:</strong><br />
                    1. Go to <a href={OPENAI_ADMIN_KEYS_URL} target="_blank" rel="noopener noreferrer" style={{ color: "#10a37f" }}>platform.openai.com/settings/organization/admin-keys</a><br />
                    2. Click "Create new admin key"<br />
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
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap" }}>
                <div style={{ fontSize: "0.68rem", color: "var(--text-dim)" }}>Date range:</div>
                <input
                  className="settings-input"
                  type="date"
                  value={openaiDateRange.startDate}
                  onChange={(e) => setOpenaiDateRange((r) => ({ ...r, startDate: e.target.value }))}
                  style={{ fontSize: "0.72rem", padding: "0.4rem 0.6rem", width: 150 }}
                />
                <span style={{ color: "var(--text-dim)", fontSize: "0.68rem" }}>to</span>
                <input
                  className="settings-input"
                  type="date"
                  value={openaiDateRange.endDate}
                  onChange={(e) => setOpenaiDateRange((r) => ({ ...r, endDate: e.target.value }))}
                  style={{ fontSize: "0.72rem", padding: "0.4rem 0.6rem", width: 150 }}
                />
                <button
                  className="btn-back"
                  onClick={loadOpenaiUsage}
                  disabled={openaiLoading}
                  style={{ fontSize: "0.72rem", padding: "0.4rem 1rem" }}
                >
                  {openaiLoading ? "Loading..." : "Fetch"}
                </button>
              </div>

              {openaiError && (
                <div style={{
                  marginBottom: "1rem", padding: "0.6rem 0.85rem", borderRadius: "var(--radius-md)",
                  background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)",
                  fontSize: "0.72rem", color: "var(--accent-red)", lineHeight: 1.5,
                }}>
                  <strong>Error:</strong> {openaiError}
                </div>
              )}

              {/* Stats Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.85rem", marginBottom: "1.5rem" }}>
                <div className="panel" style={{ textAlign: "center", padding: "1.25rem 1rem" }}>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#10a37f", fontFamily: "var(--font-mono)" }}>
                    ${openaiTotalSpend.toFixed(4)}
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Total Spent</div>
                </div>
                <div className="panel" style={{ textAlign: "center", padding: "1.25rem 1rem" }}>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>
                    {openaiUsage?.modelTotals?.["whisper-1"] != null
                      ? `$${openaiUsage.modelTotals["whisper-1"].toFixed(4)}`
                      : "—"
                    }
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Whisper Usage</div>
                </div>
                <div className="panel" style={{ textAlign: "center", padding: "1.25rem 1rem" }}>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--accent-green)", fontFamily: "var(--font-mono)" }}>
                    {openaiUsage?.modelTotals?.["gpt-4o-mini"] != null
                      ? `$${openaiUsage.modelTotals["gpt-4o-mini"].toFixed(4)}`
                      : "—"
                    }
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>GPT-4o-mini Usage</div>
                </div>
                <div className="panel" style={{ textAlign: "center", padding: "1.25rem 1rem" }}>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--accent-amber)", fontFamily: "var(--font-mono)" }}>
                    {openaiUsage?.dailyBreakdown?.length > 0
                      ? `$${(openaiTotalSpend / openaiUsage.dailyBreakdown.length).toFixed(4)}`
                      : "—"
                    }
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Daily Average</div>
                </div>
              </div>

              {/* Model Breakdown Table */}
              {openaiUsage?.modelTotals && Object.keys(openaiUsage.modelTotals).length > 0 && (
                <div className="panel" style={{ marginBottom: "1.5rem" }}>
                  <div className="panel-label" style={{ color: "#10a37f" }}>Model Breakdown</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <th style={{ textAlign: "left", padding: "0.5rem 0.6rem", color: "var(--text-dim)", fontWeight: 600, fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>Model</th>
                          <th style={{ textAlign: "right", padding: "0.5rem 0.6rem", color: "var(--text-dim)", fontWeight: 600, fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>Cost</th>
                          <th style={{ textAlign: "right", padding: "0.5rem 0.6rem", color: "var(--text-dim)", fontWeight: 600, fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>% of Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(openaiUsage.modelTotals)
                          .sort(([, a], [, b]) => b - a)
                          .map(([model, cost]) => (
                            <tr key={model} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                              <td style={{ padding: "0.5rem 0.6rem", color: "var(--text-secondary)", fontWeight: 500 }}>
                                <span style={{
                                  display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                                  background: getModelColor(model), marginRight: "0.5rem", verticalAlign: "middle",
                                }} />
                                {model}
                              </td>
                              <td style={{ padding: "0.5rem 0.6rem", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--accent-green)", fontWeight: 600 }}>
                                ${cost.toFixed(4)}
                              </td>
                              <td style={{ padding: "0.5rem 0.6rem", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
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
                        <div key={day.date} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ fontSize: "0.6rem", fontFamily: "var(--font-mono)", color: "var(--text-dim)", minWidth: 72 }}>
                            {day.date}
                          </span>
                          <div style={{ flex: 1, height: 16, borderRadius: 3, overflow: "hidden", display: "flex", background: "var(--bg-input)" }}>
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
                          <span style={{ fontSize: "0.6rem", fontFamily: "var(--font-mono)", color: "var(--accent-green)", minWidth: 58, textAlign: "right" }}>
                            ${day.total.toFixed(4)}
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                  {/* Legend */}
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.75rem", paddingTop: "0.6rem", borderTop: "1px solid var(--border-subtle)" }}>
                    {Object.keys(openaiUsage.modelTotals).map((model) => (
                      <div key={model} style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.58rem", color: "var(--text-muted)" }}>
                        <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: getModelColor(model) }} />
                        {model}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!openaiUsage && !openaiLoading && !openaiError && (
                <div className="panel" style={{ textAlign: "center", padding: "3rem" }}>
                  <div style={{ fontSize: "1.5rem", marginBottom: "0.4rem" }}>📊</div>
                  <div style={{ fontSize: "0.78rem" }}>Click Fetch to load OpenAI usage data</div>
                </div>
              )}

              {openaiUsage && !openaiUsage.dailyBreakdown?.length && !openaiLoading && (
                <div className="panel" style={{ textAlign: "center", padding: "2rem" }}>
                  <div style={{ fontSize: "1.5rem", marginBottom: "0.4rem" }}>📭</div>
                  <div style={{ fontSize: "0.78rem" }}>No usage data for this period</div>
                  <div style={{ fontSize: "0.65rem", marginTop: "0.2rem", color: "var(--text-dim)" }}>Try adjusting the date range</div>
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
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.25rem" }}>Credit balance</div>
        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "1.25rem", lineHeight: 1.5 }}>
          Your credit balance is consumed by AI ticket generation. Set your starting balance from the{" "}
          <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noopener noreferrer"
            style={{ color: "var(--accent-indigo)", textDecoration: "none" }}>Anthropic Console</a>{" "}
          to track remaining credits here.
        </div>

        <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
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
          <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", justifyContent: "center", gap: "0.85rem" }}>
            <div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-dim)", marginBottom: "0.35rem" }}>
                {remaining != null ? "Starting balance" : "Enter your balance from console.anthropic.com/settings/billing"}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <div style={{ position: "relative", flex: 1, maxWidth: 200 }}>
                  <span style={{
                    position: "absolute", left: "0.65rem", top: "50%", transform: "translateY(-50%)",
                    color: "var(--text-dim)", fontSize: "0.82rem", fontWeight: 600, pointerEvents: "none",
                  }}>$</span>
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

            <div style={{
              display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.65rem 0.85rem",
              background: "var(--bg-input)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)",
            }}>
              <span style={{ fontSize: "0.85rem" }}>{overBudget ? "🔴" : aiUsage.budgetUsd ? "🟢" : "⚪"}</span>
              <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.85rem", marginBottom: "1.5rem" }}>
        <div className="panel" style={{ textAlign: "center", padding: "1.25rem 1rem" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--accent-indigo)", fontFamily: "var(--font-mono)" }}>
            {aiUsage.totalRequests}
          </div>
          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Total Requests</div>
        </div>
        <div className="panel" style={{ textAlign: "center", padding: "1.25rem 1rem" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--accent-green)", fontFamily: "var(--font-mono)" }}>
            {(aiUsage.totalInputTokens + aiUsage.totalOutputTokens).toLocaleString()}
          </div>
          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Total Tokens</div>
        </div>
        <div className="panel" style={{ textAlign: "center", padding: "1.25rem 1rem" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: overBudget ? "var(--accent-red)" : "var(--accent-amber)", fontFamily: "var(--font-mono)" }}>
            ${totalSpendUsd.toFixed(4)}
          </div>
          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Total Spent</div>
        </div>
        <div className="panel" style={{ textAlign: "center", padding: "1.25rem 1rem" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>
            {aiUsage.totalRequests > 0
              ? `$${(totalSpendUsd / aiUsage.totalRequests).toFixed(4)}`
              : "—"
            }
          </div>
          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Avg Cost / Request</div>
        </div>
      </div>

      {/* Budget + Token Breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
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
              <button onClick={resetUsage} className="btn-back" style={{ fontSize: "0.68rem", padding: "0.4rem 0.75rem" }}>
                Reset Stats
              </button>
            )}
          </div>
          {aiUsage.budgetUsd && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--text-muted)", marginBottom: "0.35rem" }}>
                <span>${totalSpendUsd.toFixed(4)} used</span>
                <span>${aiUsage.budgetUsd.toFixed(2)} limit</span>
              </div>
              <div style={{ width: "100%", height: "8px", borderRadius: "4px", background: "var(--bg-input)", overflow: "hidden" }}>
                <div style={{
                  width: `${budgetPct}%`, height: "100%", borderRadius: "4px",
                  background: budgetPct > 90 ? "var(--accent-red)" : budgetPct > 70 ? "var(--accent-amber)" : "var(--accent-green)",
                  transition: "width 0.4s ease",
                }} />
              </div>
              <div style={{ fontSize: "0.6rem", color: "var(--text-dim)", marginTop: "0.35rem", textAlign: "right" }}>
                {budgetPct.toFixed(1)}% used
              </div>
            </>
          )}
        </div>

        {/* Token breakdown */}
        <div className="panel">
          <div className="panel-label" style={{ color: "var(--accent-cyan)" }}>Token Breakdown</div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 2 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Input tokens</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{aiUsage.totalInputTokens.toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Output tokens</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{aiUsage.totalOutputTokens.toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border-subtle)", paddingTop: "0.3rem", marginTop: "0.2rem" }}>
              <span>Input cost</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>${(aiUsage.totalInputTokens * 3 / 1_000_000).toFixed(4)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Output cost</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>${(aiUsage.totalOutputTokens * 15 / 1_000_000).toFixed(4)}</span>
            </div>
          </div>
          <div style={{ marginTop: "0.5rem", fontSize: "0.58rem", color: "var(--text-dim)" }}>
            Claude Sonnet 4 · $3/MTok in · $15/MTok out
          </div>
        </div>
      </div>

      {/* Request History */}
      <div className="panel">
        <div className="panel-label" style={{ color: "var(--accent-indigo)" }}>Request History</div>
        {aiUsage.history.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-dim)" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.4rem" }}>📭</div>
            <div style={{ fontSize: "0.78rem" }}>No AI requests yet</div>
            <div style={{ fontSize: "0.65rem", marginTop: "0.2rem" }}>Generate a ticket with AI to start tracking</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <th style={{ textAlign: "left", padding: "0.5rem 0.6rem", color: "var(--text-dim)", fontWeight: 600, fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>Time</th>
                  <th style={{ textAlign: "left", padding: "0.5rem 0.6rem", color: "var(--text-dim)", fontWeight: 600, fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>Agent</th>
                  <th style={{ textAlign: "right", padding: "0.5rem 0.6rem", color: "var(--text-dim)", fontWeight: 600, fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>In</th>
                  <th style={{ textAlign: "right", padding: "0.5rem 0.6rem", color: "var(--text-dim)", fontWeight: 600, fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>Out</th>
                  <th style={{ textAlign: "right", padding: "0.5rem 0.6rem", color: "var(--text-dim)", fontWeight: 600, fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {aiUsage.history.map((h, i) => {
                  const cost = (h.inputTokens * 3 + h.outputTokens * 15) / 1_000_000;
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td style={{ padding: "0.5rem 0.6rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: "0.65rem" }}>
                        {new Date(h.ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td style={{ padding: "0.5rem 0.6rem", color: "var(--text-secondary)", fontWeight: 500 }}>{h.agent}</td>
                      <td style={{ padding: "0.5rem 0.6rem", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{h.inputTokens.toLocaleString()}</td>
                      <td style={{ padding: "0.5rem 0.6rem", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{h.outputTokens.toLocaleString()}</td>
                      <td style={{ padding: "0.5rem 0.6rem", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--accent-green)", fontWeight: 600 }}>${cost.toFixed(4)}</td>
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
