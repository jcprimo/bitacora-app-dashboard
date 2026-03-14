# Bitacora Auth — Testing Plan & Login Guide

## TL;DR

Phase 2 adds session-based authentication to the dashboard. First visit shows a setup screen to create the admin account. After that, users see a login screen. Once signed in, the dashboard works exactly as before — all existing views, tabs, and features remain unchanged. Sign out is in the header.

---

## Prerequisites

```bash
cd bitacora-app-dashboard

# 1. Install dependencies
npm install

# 2. Create your .env file
cp .env.example .env

# 3. Generate an encryption key and paste it into .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# → Edit .env → set ENCRYPTION_KEY=<paste the 64-char hex string>

# 4. Build the frontend + start the server
npm run build && npm start
```

The server starts at **http://localhost:8080**.

---

## Step-by-Step: First Login

### 1. Open the Dashboard

Navigate to `http://localhost:8080` in your browser.

You'll see the **"Create Admin Account"** screen — this only appears once, when the database has no users.

### 2. Create Your Admin Account

Fill in the form:

| Field | Required | Notes |
|-------|----------|-------|
| **Name** | No | Display name shown in the header |
| **Email** | Yes | Used for login — pick something memorable |
| **Password** | Yes | Minimum 8 characters |
| **Confirm Password** | Yes | Must match |

Click **"Create Admin Account"**.

You're automatically signed in and redirected to the dashboard.

### 3. You're In

The dashboard loads with all tabs: Board, Create, QA Tracker, Docs, AI Usage.

Your name appears in the top-right header next to the **"Sign out"** button.

### 4. Returning Visits

On subsequent visits, you'll see the **"Sign In"** screen instead. Enter the email and password you chose during setup.

Sessions last **7 days** — you won't need to sign in again unless you explicitly sign out or the session expires.

---

## Testing Checklist

### Auth Flow

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | Navigate to `http://localhost:8080` with fresh DB | "Create Admin Account" setup screen appears |
| 2 | Submit with empty email | Validation error: "Email and password are required" |
| 3 | Submit with password < 8 chars | Validation error: "Password must be at least 8 characters" |
| 4 | Submit with mismatched passwords | Validation error: "Passwords do not match" |
| 5 | Submit valid setup form | Account created, auto-login, dashboard loads |
| 6 | Reload the page | Dashboard loads (session persists) |
| 7 | Click "Sign out" in the header | Redirected to Sign In screen |
| 8 | Sign in with correct credentials | Dashboard loads |
| 9 | Sign in with wrong password | Error: "Invalid credentials" |
| 10 | Sign in with nonexistent email | Error: "Invalid credentials" (same message — no user enumeration) |

### Regression — Dashboard Features

After signing in, verify all existing features still work:

| # | Test | Expected Result |
|---|------|-----------------|
| 11 | Click Board tab | Issue list loads (if YouTrack token configured) |
| 12 | Click Create tab | 3-step wizard appears with agent selector sidebar |
| 13 | Click QA Tracker tab | CSV import drop zone or table if data exists |
| 14 | Click Docs tab | Markdown reader / import screen |
| 15 | Click AI Usage tab | Anthropic/OpenAI sub-tabs with stats |
| 16 | Open Settings (click connection badge) | Settings modal opens with credential fields |
| 17 | Save a YouTrack token in Settings | Token persists, Board tab can load issues |
| 18 | Toggle light/dark mode | Theme switches correctly |
| 19 | Resize to iPhone 16 width (393px) | Login screen, header, nav, and all views responsive |

### Security

| # | Test | Expected Result |
|---|------|-----------------|
| 20 | Open DevTools → Network tab on login | Session cookie has `HttpOnly` flag |
| 21 | Try `/api/documents` in new incognito window | Returns `401 Not authenticated` |
| 22 | Try `/api/credentials` in new incognito window | Returns `401 Not authenticated` |
| 23 | Rapid-fire 6 login attempts with wrong password | Rate limited after 5 attempts |

---

## Troubleshooting

| Issue | Solution |
|-------|---------|
| "Unable to connect to server" on login | Server not running. Run `npm run build && npm start` |
| ENCRYPTION_KEY error on server start | Generate a key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and set it in `.env` |
| Login works but dashboard is blank | Run `npm run build` before `npm start` — the server serves from `dist/` |
| Session expired unexpectedly | Sessions last 7 days. Check that `SESSION_SECRET` hasn't changed in `.env` |
| "Cannot find module" errors | Run `npm install` to install server dependencies |

---

## Architecture Notes (for collaborators)

### Files Added / Modified in Phase 2

| File | What it does |
|------|-------------|
| `src/hooks/useAuth.js` | Checks session on mount, provides login/logout/register |
| `src/views/LoginView.jsx` | Login + Setup form with glass-morphism UI |
| `src/App.jsx` | Auth gate wrapping the dashboard; split into `App` + `Dashboard` |
| `src/components/Header.jsx` | Added user name + sign out button |
| `src/App.css` | Login screen styles + responsive mobile styles |
| `server/middleware/rateLimiter.js` | In-memory rate limiting for auth endpoints |

### How Auth Works

```
Browser loads /              → Express serves index.html (SPA)
React mounts                 → useAuth calls GET /api/auth/setup-status
  needsSetup=true?           → render SetupView (create admin)
  needsSetup=false?          → useAuth calls GET /api/auth/me
    200?                     → render Dashboard (authenticated)
    401?                     → render LoginView (sign in)
Login form submit            → POST /api/auth/login → session cookie set
Dashboard renders            → all /api/* calls include session cookie
Sign out clicked             → POST /api/auth/logout → cookie cleared
```

### Session Details

- Cookie name: `bitacora.sid`
- Storage: SQLite (`data/sessions.db`)
- TTL: 7 days (refreshed on activity)
- Flags: `httpOnly`, `secure` (prod), `sameSite: strict`
