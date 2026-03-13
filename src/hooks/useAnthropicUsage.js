// ─── hooks/useAnthropicUsage.js — Client-Side AI Spend Tracker ──
// Tracks Anthropic API usage entirely in localStorage (no server).
// Every AI Generate call records input/output tokens, and this hook
// derives total spend, budget percentage, and over-budget status.
//
// Persists to localStorage key: "bitacora-ai-usage"
// Keeps last 50 request entries in history.
//
// Also manages user-set credit balance and monthly budget alert.
// NOTE: Anthropic has no billing API, so creditBalance must be
// entered manually from console.anthropic.com/settings/billing.

import { useState, useCallback } from "react";

export function useAnthropicUsage(showToast) {
  // Hydrate from localStorage on mount, with safe defaults
  const [aiUsage, setAiUsage] = useState(() => {
    const defaults = {
      totalInputTokens: 0, totalOutputTokens: 0, totalRequests: 0,
      history: [], budgetUsd: null, creditBalance: null,
    };
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem("bitacora-ai-usage")) };
    } catch { return defaults; }
  });

  // Called after each successful AI Generate with the API response's usage object
  const recordUsage = useCallback((usage, agent, model) => {
    setAiUsage((prev) => {
      const entry = {
        ts: Date.now(),
        agent,
        model,
        inputTokens: usage.input_tokens || 0,
        outputTokens: usage.output_tokens || 0,
        cacheCreation: usage.cache_creation_input_tokens || 0,
        cacheRead: usage.cache_read_input_tokens || 0,
      };
      const updated = {
        ...prev,
        totalInputTokens: prev.totalInputTokens + entry.inputTokens,
        totalOutputTokens: prev.totalOutputTokens + entry.outputTokens,
        totalRequests: prev.totalRequests + 1,
        history: [entry, ...prev.history].slice(0, 50),
      };
      localStorage.setItem("bitacora-ai-usage", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const resetUsage = useCallback(() => {
    const fresh = { totalInputTokens: 0, totalOutputTokens: 0, totalRequests: 0, history: [], budgetUsd: aiUsage.budgetUsd };
    setAiUsage(fresh);
    localStorage.setItem("bitacora-ai-usage", JSON.stringify(fresh));
    showToast("Usage stats reset");
  }, [aiUsage.budgetUsd, showToast]);

  const setBudget = useCallback((val) => {
    setAiUsage((prev) => {
      const updated = { ...prev, budgetUsd: val || null };
      localStorage.setItem("bitacora-ai-usage", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const setCreditBalance = useCallback((val) => {
    setAiUsage((prev) => {
      const updated = { ...prev, creditBalance: val || null };
      localStorage.setItem("bitacora-ai-usage", JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Cost calculation (Claude Sonnet 4: $3/MTok in, $15/MTok out)
  const totalSpendUsd = (aiUsage.totalInputTokens * 3 + aiUsage.totalOutputTokens * 15) / 1_000_000;
  const budgetPct = aiUsage.budgetUsd ? Math.min((totalSpendUsd / aiUsage.budgetUsd) * 100, 100) : null;
  const overBudget = aiUsage.budgetUsd && totalSpendUsd >= aiUsage.budgetUsd;

  return {
    aiUsage, recordUsage, resetUsage, setBudget, setCreditBalance,
    totalSpendUsd, budgetPct, overBudget,
  };
}
