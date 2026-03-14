// ─── hooks/useAuth.js — Session Authentication ──────────────────
// Manages the auth lifecycle for the Bitacora dashboard.
//
// On mount, checks the server session via GET /api/auth/me.
// If authenticated → returns user object.
// If not → returns null (App renders LoginView or SetupView).
//
// Provides login(), logout(), register() actions.
// Also checks /api/auth/setup-status to detect first-run.

import { useState, useEffect, useCallback } from "react";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(false);

  // ─── Check current session on mount ────────────────────────────
  const checkSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // First check if any users exist
      const setupRes = await fetch("/api/auth/setup-status");
      const setupData = await setupRes.json();
      if (setupData.needsSetup) {
        setNeedsSetup(true);
        setUser(null);
        setLoading(false);
        return;
      }
      setNeedsSetup(false);

      // Check active session
      const meRes = await fetch("/api/auth/me");
      if (meRes.ok) {
        const userData = await meRes.json();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // ─── Login with email + password ───────────────────────────────
  const login = useCallback(async (email, password) => {
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return false;
      }
      setUser(data);
      return true;
    } catch {
      setError("Unable to connect to server");
      return false;
    }
  }, []);

  // ─── Register first admin or new member ────────────────────────
  const register = useCallback(async (email, password, name) => {
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed");
        return false;
      }
      setUser(data);
      setNeedsSetup(false);
      return true;
    } catch {
      setError("Unable to connect to server");
      return false;
    }
  }, []);

  // ─── Logout — destroy session ──────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Proceed even if request fails
    }
    setUser(null);
  }, []);

  // ─── Clear error (used when user starts typing) ────────────────
  const clearError = useCallback(() => setError(null), []);

  return {
    user,
    loading,
    error,
    needsSetup,
    login,
    register,
    logout,
    clearError,
  };
}
