// ─── views/LoginView.jsx — Authentication Screen ─────────────────
// Three modes:
//   1. needsSetup=true  → first-run admin creation
//   2. mode="login"     → sign in with existing account
//   3. mode="signup"    → self-registration for new engineers
//
// Uses the same glass-morphism style as the rest of the dashboard.
// Fully responsive for iPhone 16 (393px) and desktop.

import { useState } from "react";

export default function LoginView({ needsSetup, login, register, error, clearError }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);

  const displayError = error || localError;

  const handleLogin = async (e) => {
    e.preventDefault();
    setLocalError(null);
    if (!email.trim() || !password) {
      setLocalError("Email and password are required");
      return;
    }
    setSubmitting(true);
    await login(email.trim(), password);
    setSubmitting(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLocalError(null);
    if (!email.trim() || !password) {
      setLocalError("Email and password are required");
      return;
    }
    if (password.length < 8) {
      setLocalError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setLocalError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    await register(email.trim(), password, name.trim() || null);
    setSubmitting(false);
  };

  const handleInputChange = () => {
    if (displayError) {
      clearError();
      setLocalError(null);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setLocalError(null);
    clearError();
    setPassword("");
    setConfirmPassword("");
  };

  // ─── Shared registration form (used by both setup and signup) ───
  const registrationForm = (
    <form onSubmit={handleRegister} className="login-form">
      <div className="login-field">
        <label className="login-label">Name</label>
        <input
          className="login-input"
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); handleInputChange(); }}
          placeholder="Your name (optional)"
          autoComplete="name"
        />
      </div>

      <div className="login-field">
        <label className="login-label">Email</label>
        <input
          className="login-input"
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); handleInputChange(); }}
          placeholder={needsSetup ? "admin@yourcompany.com" : "you@yourcompany.com"}
          autoComplete="email"
          required
          autoFocus
        />
      </div>

      <div className="login-field">
        <label className="login-label">Password</label>
        <input
          className="login-input"
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); handleInputChange(); }}
          placeholder="Minimum 8 characters"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>

      <div className="login-field">
        <label className="login-label">Confirm Password</label>
        <input
          className="login-input"
          type="password"
          value={confirmPassword}
          onChange={(e) => { setConfirmPassword(e.target.value); handleInputChange(); }}
          placeholder="Re-enter your password"
          autoComplete="new-password"
          required
        />
      </div>

      {displayError && (
        <div className="login-error">{displayError}</div>
      )}

      <button
        type="submit"
        className="login-submit"
        disabled={submitting}
      >
        {submitting ? (
          <><span className="spinner" /> {needsSetup ? "Creating account..." : "Creating account..."}</>
        ) : (
          needsSetup ? "Create Admin Account" : "Create Account"
        )}
      </button>
    </form>
  );

  return (
    <div className="login-screen">
      <div className="login-card animate-fade">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">📋</div>
          <div className="login-logo-title">Bitacora</div>
          <div className="login-logo-subtitle">App Dashboard</div>
        </div>

        {needsSetup ? (
          <>
            {/* ─── First-Run Setup ──────────────────────────────── */}
            <div className="login-heading">Create Admin Account</div>
            <p className="login-description">
              Welcome to Bitacora. Create your admin account to get started.
              This will be the primary account for managing the dashboard.
            </p>
            {registrationForm}
          </>
        ) : mode === "signup" ? (
          <>
            {/* ─── Sign Up ──────────────────────────────────────── */}
            <div className="login-heading">Create Account</div>
            <p className="login-description">
              Sign up to get your own dashboard access. You can configure
              your API keys after logging in.
            </p>
            {registrationForm}
            <div className="login-switch">
              Already have an account?{" "}
              <button className="login-switch-btn" onClick={() => switchMode("login")}>
                Sign in
              </button>
            </div>
          </>
        ) : (
          <>
            {/* ─── Login ────────────────────────────────────────── */}
            <div className="login-heading">Sign In</div>
            <p className="login-description">
              Enter your credentials to access the dashboard.
            </p>

            <form onSubmit={handleLogin} className="login-form">
              <div className="login-field">
                <label className="login-label">Email</label>
                <input
                  className="login-input"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); handleInputChange(); }}
                  placeholder="you@yourcompany.com"
                  autoComplete="email"
                  required
                  autoFocus
                />
              </div>

              <div className="login-field">
                <label className="login-label">Password</label>
                <input
                  className="login-input"
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); handleInputChange(); }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
              </div>

              {displayError && (
                <div className="login-error">{displayError}</div>
              )}

              <button
                type="submit"
                className="login-submit"
                disabled={submitting}
              >
                {submitting ? (
                  <><span className="spinner" /> Signing in...</>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <div className="login-switch">
              Don't have an account?{" "}
              <button className="login-switch-btn" onClick={() => switchMode("signup")}>
                Sign up
              </button>
            </div>
          </>
        )}

        <div className="login-footer">
          Bitacora App Dashboard — #OpsLife
        </div>
      </div>
    </div>
  );
}
