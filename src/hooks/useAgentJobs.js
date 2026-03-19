// ─── hooks/useAgentJobs.js — Agent Job Management ─────────────────
// Provides job list, dispatch, cancel, retry, and live log streaming.
// Subscribes to SSE for real-time job status + log updates.

import { useState, useEffect, useCallback, useRef } from "react";

export function useAgentJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeJobId, setActiveJobId] = useState(null);
  const [activeJobLogs, setActiveJobLogs] = useState([]);
  const [dispatching, setDispatching] = useState(false);

  // ─── Fetch jobs ───────────────────────────────────────────────
  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch (err) {
      console.error("Failed to load jobs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Fetch single job + logs ──────────────────────────────────
  const loadJobDetail = useCallback(async (jobId) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setActiveJobLogs(data.logs || []);
        // Update this job in the list
        setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...data, logs: undefined } : j)));
      }
    } catch (err) {
      console.error("Failed to load job detail:", err);
    }
  }, []);

  // ─── Dispatch a new job ───────────────────────────────────────
  const dispatch = useCallback(async ({ agentType, repo, prompt, ticketId }) => {
    setDispatching(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentType, repo, prompt, ticketId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Dispatch failed");
      }
      const job = await res.json();
      setJobs((prev) => [job, ...prev]);
      setActiveJobId(job.id);
      setActiveJobLogs([]);
      return job;
    } finally {
      setDispatching(false);
    }
  }, []);

  // ─── Cancel a job ─────────────────────────────────────────────
  const cancel = useCallback(async (jobId) => {
    const res = await fetch(`/api/jobs/${jobId}/cancel`, {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) {
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: "cancelled" } : j)));
    }
  }, []);

  // ─── Retry a job ──────────────────────────────────────────────
  const retry = useCallback(async (jobId) => {
    const res = await fetch(`/api/jobs/${jobId}/retry`, {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) {
      const newJob = await res.json();
      setJobs((prev) => [newJob, ...prev]);
      setActiveJobId(newJob.id);
      setActiveJobLogs([]);
    }
  }, []);

  // ─── SSE subscription for live updates ────────────────────────
  useEffect(() => {
    const es = new EventSource("/api/events", { withCredentials: true });

    es.addEventListener("job", (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.action === "created") {
          setJobs((prev) => {
            if (prev.some((j) => j.id === payload.job.id)) return prev;
            return [payload.job, ...prev];
          });
        } else if (payload.action === "updated" && payload.job) {
          setJobs((prev) => prev.map((j) => (j.id === payload.job.id ? payload.job : j)));
        } else if (payload.action === "cancelled") {
          setJobs((prev) => prev.map((j) => (j.id === payload.jobId ? { ...j, status: "cancelled" } : j)));
        }
      } catch { /* ignore parse errors */ }
    });

    es.addEventListener("job-log", (e) => {
      try {
        const payload = JSON.parse(e.data);
        setActiveJobLogs((prev) => {
          // Only append if this log is for the active job
          // We check inside the setter to avoid stale closure issues
          return [...prev, payload];
        });
      } catch { /* ignore */ }
    });

    return () => es.close();
  }, []);

  // Filter logs to only show active job's logs
  const filteredLogs = activeJobId
    ? activeJobLogs.filter((log) => log.jobId === activeJobId)
    : [];

  // Load jobs on mount
  useEffect(() => { loadJobs(); }, [loadJobs]);

  // Load detail when active job changes
  useEffect(() => {
    if (activeJobId) loadJobDetail(activeJobId);
  }, [activeJobId, loadJobDetail]);

  const activeJob = jobs.find((j) => j.id === activeJobId) || null;

  return {
    jobs,
    loading,
    activeJob,
    activeJobId,
    setActiveJobId,
    activeJobLogs: filteredLogs,
    dispatching,
    dispatch,
    cancel,
    retry,
    loadJobs,
  };
}
