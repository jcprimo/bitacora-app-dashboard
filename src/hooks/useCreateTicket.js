// ─── hooks/useCreateTicket.js — Ticket Creation Pipeline ────────
// Manages the 3-step Create flow: Input → Review → Done.
//
// Three generation modes:
//   1. AI Generate   — calls Anthropic Messages API (Claude Sonnet 4)
//                      with the agent's system prompt; parses JSON response
//   2. Template      — fills a structured Markdown template locally (free)
//   3. Manual        — blank draft for the user to fill in
//
// After generation, the draft can be edited in the Review step before
// shipping to YouTrack via createIssue().
//
// NOTE: The Anthropic call uses "anthropic-dangerous-direct-browser-access"
// header because this is a client-side SPA — no backend proxy for AI calls.

import { useState, useCallback } from "react";
import { createIssue } from "../youtrack";
import { PROMPTS, getTemplates } from "../constants/prompts";

export function useCreateTicket(token, showToast, loadIssues) {
  const [selectedAgent, setSelectedAgent] = useState(null); // managed by App.jsx
  const [rawInput, setRawInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [draft, setDraft] = useState(null);
  const [createStep, setCreateStep] = useState("input");
  const [aiError, setAiError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // Resolve API key: localStorage (runtime setting) → env var → empty
  const anthropicKey = localStorage.getItem("bitacora-anthropic-key") || import.meta.env.VITE_ANTHROPIC_KEY || "";
  const hasAIKey = anthropicKey.length > 0;

  const resetCreate = () => {
    setRawInput("");
    setDraft(null);
    setCreateStep("input");
    setAiError(null);
  };

  const generateWithAI = useCallback(async (agent, recordUsage) => {
    if (!rawInput.trim()) return;
    if (!hasAIKey) {
      showToast("Set VITE_ANTHROPIC_KEY in .env to use AI generation", "error");
      return;
    }
    setIsGenerating(true);
    setAiError(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-dangerous-direct-browser-access": "true",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1200,
          system: PROMPTS[agent.id],
          messages: [{ role: "user", content: rawInput }],
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Anthropic API returned ${res.status}`);
      }

      const data = await res.json();

      if (data.usage) {
        recordUsage(data.usage, agent.label, data.model || "claude-sonnet-4-20250514");
      }

      // Extract text and strip markdown fencing if Claude wraps it
      const text = data.content?.[0]?.text || "";
      const clean = text.replace(/```json|```/g, "").trim();

      if (!clean) throw new Error("AI returned empty response");

      const parsed = JSON.parse(clean);

      if (!parsed.summary) throw new Error("AI response missing summary field");

      setDraft({
        summary: parsed.summary,
        description: parsed.description || "",
        priority: parsed.priority || agent.defaultPriority,
        ferpa_risk: parsed.ferpa_risk || false,
        lfpdppp_risk: parsed.lfpdppp_risk || false,
        estimated_effort: parsed.estimated_effort || "M",
      });
      setCreateStep("review");
    } catch (e) {
      setAiError(e.message);
      showToast("AI failed — use Template Generate instead", "error");
    } finally {
      setIsGenerating(false);
    }
  }, [rawInput, hasAIKey, anthropicKey, showToast]);

  const generateFromTemplate = useCallback((agent) => {
    if (!rawInput.trim()) return;
    const input = rawInput.trim();
    const templates = getTemplates(input);
    const tmpl = templates[agent.id] || { summary: input, description: input };
    setDraft({
      summary: tmpl.summary,
      description: tmpl.description,
      priority: agent.defaultPriority,
      ferpa_risk: false,
      lfpdppp_risk: false,
      estimated_effort: "M",
    });
    setAiError(null);
    setCreateStep("review");
  }, [rawInput]);

  const submitTicket = useCallback(async () => {
    if (!draft || !token) return;
    if (!draft.summary.trim()) {
      showToast("Summary is required", "error");
      return;
    }
    setActionLoading("create");
    try {
      const result = await createIssue(token, {
        summary: draft.summary,
        description: draft.description,
        priority: draft.priority,
      });
      showToast(`${result.idReadable} created`);
      setCreateStep("done");
      setDraft((d) => ({ ...d, createdId: result.idReadable }));
      loadIssues();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setActionLoading(null);
    }
  }, [draft, token, loadIssues, showToast]);

  return {
    rawInput, setRawInput,
    isGenerating, draft, setDraft,
    createStep, setCreateStep,
    aiError, actionLoading,
    hasAIKey, resetCreate,
    generateWithAI, generateFromTemplate, submitTicket,
  };
}
