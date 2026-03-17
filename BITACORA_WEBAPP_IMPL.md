# Bitacora Web Viewer -- Implementation Plan

**Date:** 2026-03-13
**Author:** JC Primo (Founder/Architect) + Claude (Pair Programmer)
**Status:** CONDITIONAL GO -- Pending founder decisions on open questions
**Reviewed by:** Product Manager Agent, Engineering Mentor Agent

---

## TL;DR -- What This Plan Is About

### The Problem

Right now, Bitacora lives entirely on the teacher's iPhone. Every student incident -- the voice recording, the AI-generated report, the severity tags, the transcript -- is stored locally on that one device. If a principal wants to review incidents across their school, they have to borrow the teacher's phone. If a teacher wants to prepare for a parent meeting at home, they need the same iPhone they used at school. There is no way to view this data from a computer, a tablet, or any other device.

### The Solution

We are building a **web viewer** -- a simple, secure website where teachers and principals can log in from any browser and **view** (not edit) the incident records that were created on the iOS app. Think of it like a read-only dashboard. The teacher still records incidents on their iPhone during class, but now that data syncs to the cloud, and anyone with the right permissions can pull it up from a laptop at home, a desktop in the principal's office, or a shared computer in the teachers' lounge.

### How It Works (In Plain Terms)

1. **The iPhone stays the boss.** Teachers continue recording incidents on iOS exactly as they do today. Nothing changes about the recording workflow, AI transcription, or manual mode. The iOS app is the only place where data is created or edited.

2. **Data syncs to the cloud.** After saving an incident, the iOS app pushes it to a cloud database (Supabase -- a managed service that gives us a PostgreSQL database, user authentication, and file storage in one place). If the teacher is offline, the sync queues up and completes automatically when internet returns.

3. **The web viewer reads from the cloud.** Teachers and principals log in with email and password. Teachers see their own students and incidents. Principals see everything across their school. Nobody can edit or delete anything from the web -- it is purely for viewing, filtering, searching, and exporting.

4. **Audio recordings are streamable.** The original voice recordings sync to cloud storage and can be played back directly in the browser. Audio files are never publicly accessible -- each playback request generates a temporary link that expires in 60 seconds.

### Who Uses What

| Person | Tool | What They Can Do |
|---|---|---|
| Teacher (in class) | iPhone -- iOS app | Record incidents, add students, edit reports, use AI or manual mode |
| Teacher (at home) | Browser -- Web viewer | View their incidents, filter by student/severity/date, export PDF, play audio |
| Principal (in office) | Browser -- Web viewer | View all incidents across their school, filter by teacher/grade/severity, export CSV |
| Admin | Browser -- Web viewer | Everything a principal can do, plus invite new teachers to the system |

### What About Privacy?

This is the biggest change in the plan. Moving student data from a single phone to the cloud triggers legal requirements under **FERPA** (US student privacy law) and **LFPDPPP** (Mexico's data protection law). The plan accounts for this with:

- **Row-Level Security** -- The database itself enforces that a teacher at School A literally cannot query School B's data, even if there is a bug in the web app.
- **Encryption** -- All data encrypted at rest (AES-256) and in transit (TLS 1.2+).
- **Access logging** -- Every time someone views an incident, plays audio, or exports data, it is recorded in an audit log.
- **Signed audio URLs** -- Audio files are never on a public link. Each playback generates a temporary 60-second URL.
- **School data purge** -- If a school leaves the platform, all their data (including audio) can be permanently deleted.

Schools will need to sign a Data Processing Agreement (DPA) before their data goes to the cloud.

### The Tech Stack (For the Technically Curious)

- **Backend:** Supabase (PostgreSQL database + authentication + file storage + row-level security)
- **Web Viewer:** React 18 with TypeScript, built with Vite, styled with Tailwind CSS
- **iOS Sync:** New `CloudSyncService` in the existing iOS app, modeled after the offline queue system already in place
- **Repos:** Two separate repos -- the iOS app stays in this repo; the web viewer + backend get their own repo (`reporta-web`)

### Timeline

The plan spans **10 weeks** across 6 phases:

| Phase | Weeks | What Happens |
|---|---|---|
| 0. Compliance review | Week 0 | Security review, data residency decision, privacy docs drafted |
| 1. Backend + auth | Weeks 1-2 | Database, user roles, row-level security, first school account |
| 2. iOS sync | Weeks 3-4 | Teacher login on iOS, incidents push to cloud, offline queue |
| 3. Web viewer | Weeks 5-7 | Login page, incident list, filters, student directory, audio playback |
| 4. Export + compliance | Week 8 | PDF/CSV export, access logging, data deletion tools |
| 5. Launch prep | Weeks 9-10 | Data backfill, QA, legal review, soft launch with pilot school |

### What Needs to Be Decided Before We Start

There are 11 open questions in section 11 of this document. The three most urgent:

1. **Where does the data live?** US-East is recommended (covers both US and Mexico), but Mexico schools may require disclosure of cross-border data transfer.
2. **Do we launch for US schools, Mexico schools, or both?** Both is ideal since the data model supports it, but doubles the compliance paperwork.
3. **Who creates school accounts?** For early access, the founder provisions them manually. A self-serve admin panel comes later.

### One Rule to Remember

**The iOS app is the only writer.** If we ever find ourselves adding a "save" or "edit" button to the web viewer, we should stop and question the architecture. Keeping the web viewer read-only is not a limitation -- it is a deliberate design choice that prevents sync conflicts and keeps the system simple enough for a small team to maintain.

---

## 1. Product Vision

The Bitacora Web Viewer gives teachers and principals secure, browser-based access to incident records created on the iOS app -- so they can review student behavioral history, prepare for parent meetings, and generate reports from any device without needing an iPhone in hand.

It is the first step toward multi-stakeholder visibility while keeping the source of truth -- voice recording and incident creation -- exclusively on the iOS app where teachers work mid-lesson.

---

## 2. System Architecture

```
[iPhone -- iOS App]  -->  pushes data  -->  [Cloud Backend]  -->  serves data  -->  [Web Viewer]
    writes only                             source of truth                        reads only
```

**The iOS app is the only writer.** The web viewer is a read-only window. This constraint eliminates sync conflicts and keeps the system manageable for a small team.

### Stack Decisions

| Component | Choice | Reason |
|---|---|---|
| Backend | Supabase (PostgreSQL + Auth + Storage + RLS) | One service: DB, auth, file storage, row-level security. FERPA-acceptable. Swift SDK for iOS. |
| Web framework | Vite + React 18 + TypeScript | CRA is unmaintained. No SSR needed -- Vite is fast and lightweight. |
| Server state | TanStack Query | Superior filter/cache keying for search + filter combinations. |
| Routing | React Router v6 | Standard, not overkill for a read-only viewer. |
| Styling | Tailwind CSS | Consistency with existing web prototype. |
| iOS sync | Push on save + offline queue | Mirrors existing `OfflineQueueManager` pattern. |
| Auth | Supabase Auth (invite-only, email/password) | No public self-signup. Admin invites teachers. |
| Audio storage | Supabase Storage, signed URLs (60s expiry) | Student voice data never publicly accessible. |
| Tenancy | Row-Level Security + app-level checks | Defense in depth -- DB refuses cross-school queries even if app has a bug. |

---

## 3. Repo Strategy

**Two repos + shared types package.** The iOS app is Swift and cannot consume a JS/TS monorepo package. The web + backend live together.

```
reporta-ios/              (existing -- this repo, unchanged)
reporta-web/              (new -- web viewer + Supabase config)
  ├── apps/web/           Vite + React web viewer
  ├── packages/shared/    TypeScript types (IncidentDTO, StudentDTO, etc.)
  └── supabase/           Migrations, RLS policies, Edge Functions
```

The `shared` package types mirror the iOS Swift model raw values exactly -- `Report.category` stores `"Disruptive Behavior"`, `Report.severity` stores `"HIGH"`. No translation needed.

---

## 4. Data Model

Multi-tenant schema supporting both US (K-12) and Mexico (grado/grupo/turno) school systems.

```sql
-- Multi-tenant anchor
create table schools (
    id              uuid primary key default gen_random_uuid(),
    name            text not null,
    school_system   text not null check (school_system in ('US', 'MX')),
    country         text not null,
    created_at      timestamptz default now()
);

-- Auth users extended with role and school
create table profiles (
    id          uuid primary key references auth.users(id) on delete cascade,
    school_id   uuid not null references schools(id),
    name        text not null,
    role        text not null check (role in ('teacher', 'principal', 'admin')),
    created_at  timestamptz default now()
);

-- Students
create table students (
    id              text primary key,       -- preserve iOS IDGenerator values
    school_id       uuid not null references schools(id),
    name            text not null,
    grade           text not null,
    "group"         text,                   -- MX only: 'A'-'E', null for US
    turno           text,                   -- MX only: 'matutino'/'vespertino', null for US
    folder_id       text not null,
    incident_count  int not null default 0,
    last_incident   timestamptz,
    created_at      timestamptz not null,
    created_by      uuid references profiles(id)
);

-- Incidents (maps directly to iOS Report model)
create table incidents (
    id                  text primary key,       -- preserve iOS IDGenerator values
    student_id          text not null references students(id),
    school_id           uuid not null references schools(id),  -- denormalized for RLS
    created_by          uuid not null references profiles(id),
    student_name        text not null,          -- denormalized (matches iOS)
    student_grade       text not null,
    student_group       text,                   -- MX only
    category            text not null,          -- IncidentCategory rawValue
    severity            text not null check (severity in ('LOW', 'HIGH', 'CRITICAL')),
    location            text,
    witnesses           text,
    title               text not null,
    description         text not null default '',
    transcript          text not null default '',
    audio_duration      int not null default 0,
    audio_size          int not null default 0,
    audio_filename      text,                   -- Supabase Storage path
    incident_date       timestamptz not null,
    created_at          timestamptz not null,
    updated_at          timestamptz not null,
    status              text not null default 'draft',
    follow_up_required  boolean not null default false,
    parent_notified     boolean not null default false
);

-- Access log (FERPA/LFPDPPP requirement)
create table access_log (
    id          bigint generated always as identity primary key,
    user_id     uuid not null references profiles(id),
    action      text not null,      -- 'view_incident', 'view_student', 'export_pdf', 'export_csv', 'play_audio'
    resource_id text,               -- incident or student ID
    filters     jsonb,              -- active filters at time of action (for export auditing)
    ip_address  inet,
    created_at  timestamptz default now()
);
```

### Row-Level Security

```sql
-- Teachers see only their school's data
create policy "read_own_school" on incidents
    for select using (
        school_id = (select school_id from profiles where id = auth.uid())
    );

-- Teachers can insert only to their own school
create policy "insert_own_school" on incidents
    for insert with check (
        school_id = (select school_id from profiles where id = auth.uid())
        and created_by = auth.uid()
    );

-- Same pattern applied to students table
```

---

## 5. iOS Sync Mechanism

Extends the existing `OfflineQueueManager` pattern -- NWPathMonitor, persistent queue, retry on reconnect.

### SwiftData Changes

Add two fields to `Report`:

```swift
@Model final class Report {
    // ... existing fields ...
    var syncedAt: Date?                     // nil = not yet synced
    var syncStatus: String = "pending"      // "pending" | "synced" | "failed"
}
```

### Sync Flow

```
User taps Save
    |
    +-- SwiftData.insert(report) -- local save, instant
    |
    +-- if authenticated + network available:
    |       upload audio to Supabase Storage (audio/{school_id}/{incident_id}.m4a)
    |       POST incident to Supabase REST API
    |       mark report as synced (syncedAt = now, syncStatus = "synced")
    |
    +-- if offline or unauthenticated:
            enqueue to SyncQueue
            when NWPathMonitor fires: flush queue
```

**Conflict resolution:** iOS is the only writer. No web edits means no merge conflicts. Last-write-wins on `updatedAt` for edits.

---

## 6. Web Viewer Structure

```
reporta-web/apps/web/src/
  ├── api/              TanStack Query hooks (useIncidents, useStudents, etc.)
  ├── components/       Shared UI (SeverityBadge, IncidentCard, FilterChips, etc.)
  ├── pages/
  │   ├── LoginPage.tsx
  │   ├── DashboardPage.tsx
  │   ├── StudentsPage.tsx
  │   ├── StudentDetailPage.tsx
  │   ├── IncidentDetailPage.tsx
  │   └── ExportPage.tsx
  ├── lib/
  │   ├── supabase.ts       createClient singleton
  │   ├── auth.ts            useSession, useUser hooks
  │   └── accessLog.ts       audit logging helper
  └── types/                 imported from packages/shared
```

### Routes

```
/login              LoginPage
/                   DashboardPage (incident summary, recent activity)
/students           StudentsPage (directory with incident counts)
/students/:id       StudentDetailPage (student + their incidents)
/incidents/:id      IncidentDetailPage (full report + audio playback)
```

All routes except `/login` are wrapped in a `ProtectedLayout` that checks `supabase.auth.getSession()`.

---

## 7. Authentication & Authorization

### Three Roles

| Role | Sees | Can Do |
|---|---|---|
| Teacher | Own students + incidents at their school | View, filter, export |
| Principal | All teachers' incidents at their school | View, filter, export |
| Admin | Everything at their school | View, filter, export, invite teachers |

### Provisioning Flow

1. Founder/admin creates a school and admin account (initially manual)
2. Admin invites teachers by email (`supabase.auth.admin.inviteUserByEmail`)
3. Teacher receives email, sets password, profile auto-linked to school
4. Teacher logs into iOS app with same credentials -- JWT stored in Keychain

### iOS Auth

```swift
let session = try await supabase.auth.signIn(email: email, password: password)
// JWT stored by supabase-swift; subsequent API calls include it automatically
```

---

## 8. Compliance Requirements

### FERPA (US)

| Requirement | Implementation |
|---|---|
| Data Processing Agreement | Supabase provides FERPA-compliant DPA. Schools sign before onboarding. |
| Encryption at rest | Supabase PostgreSQL + Storage: AES-256 default. |
| Encryption in transit | TLS 1.2+ enforced. No HTTP fallback. |
| Access logging | `access_log` table records every view, export, and audio playback. |
| Minimum necessary | RLS ensures teachers see only their school's data. |
| Data breach notification | Documented incident response plan required before launch. |
| Data deletion | "School data purge" admin function: deletes all school records + audio. |

### LFPDPPP (Mexico)

| Requirement | Implementation |
|---|---|
| Aviso de Privacidad | Spanish-language privacy notice displayed before data collection. |
| Parental consent | Schools must collect consent from parents/tutors. Provide consent template. |
| ARCO rights | Support Access, Rectification, Cancellation, Opposition within 20 business days. Admin function to export/delete a student's complete record. |
| Data transfer disclosure | Aviso must disclose that data moves from phone to cloud (international transfer if US-hosted). |
| Security measures | Document administrative, physical, and technical measures per INAI guidelines. |

### Cross-Cutting

- Audio files: private storage, signed URLs (60s expiry), encrypted at rest
- Session security: HTTP-only secure cookies, 30-minute inactivity timeout
- Password policy: minimum 8 characters, breached password check
- No "remember me" for MVP given PII sensitivity

---

## 9. Phased Roadmap

### Phase 0: Compliance & Architecture Review (Week 0)

- [ ] Security-compliance review of full architecture
- [ ] Data residency decision (Supabase region)
- [ ] FERPA data flow document
- [ ] LFPDPPP Aviso de Privacidad draft
- [ ] Founder decisions on open questions (section 11)

**Gate:** Cannot proceed to Phase 1 without this sign-off.

### Phase 1: Backend Foundation + Auth (Weeks 1-2)

- [ ] Create Supabase project (chosen region)
- [ ] Set up Auth (email/password, invite-only)
- [ ] Create role model (teacher, principal, admin)
- [ ] Run schema SQL (schools, profiles, students, incidents, access_log)
- [ ] Implement RLS policies
- [ ] Test RLS with real role scenarios (teacher can't see other schools, principal sees all teachers)
- [ ] Create first school + admin account manually

**Deliverable:** Working database with auth, accessible via Supabase Studio.

### Phase 2: iOS Auth + Sync (Weeks 3-4)

- [ ] Add `supabase-swift` package to Xcode project
- [ ] Add `syncedAt: Date?` and `syncStatus: String` to SwiftData `Report` model
- [ ] Build login screen in iOS Settings (email/password, JWT to Keychain)
- [ ] Build `CloudSyncService` mirroring `OfflineQueueManager` pattern
- [ ] On report save: attempt cloud push, fall back to sync queue
- [ ] Audio upload to Supabase Storage (`audio/{school_id}/{incident_id}.m4a`)
- [ ] Verify iOS app works identically when Supabase is unreachable (offline-first preserved)

**Deliverable:** Teachers' new reports appear in Supabase. iOS app still fully functional offline.

### Phase 3: Web Viewer MVP (Weeks 5-7)

- [ ] `create vite@latest` with React + TypeScript template
- [ ] Install: `@supabase/supabase-js`, `@tanstack/react-query`, `react-router-dom`, `tailwindcss`
- [ ] Login page (email/password, bilingual EN/ES)
- [ ] Dashboard (recent incidents summary)
- [ ] Incident list with filters (student, category, severity, date range, turno for MX)
- [ ] Incident detail view (all fields, read-only)
- [ ] Student directory (name, grade, group, incident count, last incident)
- [ ] Student detail (student info + filtered incident list)
- [ ] Audio playback via signed URLs
- [ ] Access logging on every view/export/playback action
- [ ] Bilingual UI (EN/ES toggle)
- [ ] Deploy to Vercel or Netlify

**Deliverable:** Principals and teachers can log in and view incidents from a browser.

### Phase 4: Export + Polish (Week 8)

- [ ] PDF export per student (server-side via Supabase Edge Function)
- [ ] CSV export with active filters (server-side, no transcript/audio to limit PII)
- [ ] Export audit logging (who exported, when, what filters)
- [ ] ARCO rights tooling: admin can export/delete all data for a specific student
- [ ] School data purge function (admin)

**Deliverable:** Export and compliance tooling complete.

### Phase 5: Backfill + Launch Prep (Week 9-10)

- [ ] Build one-time migration script: export SwiftData via `ExportService` → import JSON to Supabase
- [ ] Conflict resolution for backfill (deduplicate by incident ID)
- [ ] QA sign-off on full flow (iOS sync → web viewer → export)
- [ ] FERPA DPA template finalized
- [ ] Aviso de Privacidad finalized (legal review)
- [ ] Terms of Service (EN + ES)
- [ ] Incident response plan documented
- [ ] Soft launch with pilot school(s)

**Deliverable:** Production-ready system with compliance documentation.

---

## 10. MVP Scope Table

| Feature | Web Viewer MVP | iOS-Only | Deferred |
|---|:-:|:-:|:-:|
| View incident list + detail | IN | -- | -- |
| Filter/search incidents | IN | -- | -- |
| Student directory (read-only) | IN | -- | -- |
| Teacher login (email/password) | IN | -- | -- |
| Principal login (school-wide) | IN | -- | -- |
| Audio playback (streaming) | IN | -- | -- |
| PDF export (per student) | IN | -- | -- |
| CSV export (filtered) | IN | -- | -- |
| Bilingual UI (EN/ES) | IN | -- | -- |
| Access logging | IN | -- | -- |
| ARCO rights tooling | IN | -- | -- |
| Voice recording | -- | STAYS | -- |
| AI transcription (Whisper) | -- | STAYS | -- |
| AI extraction (GPT-4o Mini) | -- | STAYS | -- |
| Create/edit/delete incidents | -- | STAYS | -- |
| Add/edit/delete students | -- | STAYS | -- |
| On-device NER fallback | -- | STAYS | -- |
| Onboarding / profile setup | -- | STAYS | -- |
| Real-time notifications | -- | -- | DEFERRED |
| Parent portal | -- | -- | DEFERRED |
| District / multi-school dashboard | -- | -- | DEFERRED |
| Analytics / trend visualization | -- | -- | DEFERRED |
| Web-based incident editing | -- | -- | DEFERRED |
| Offline web viewer | -- | -- | DEFERRED |
| Admin panel (user management UI) | -- | -- | DEFERRED |
| MFA / 2-factor authentication | -- | -- | DEFERRED |

---

## 11. Open Questions -- Founder Decisions Required

### Must Answer Before Phase 0

| # | Question | Options | PM Recommendation |
|---|---|---|---|
| 1 | **Data residency region** | US-East (covers both markets) vs. separate US + MX regions | US-East with LFPDPPP cross-border transfer disclosure. Separate MX region adds cost and complexity. |
| 2 | **MVP launch market** | US-only, MX-only, or both | Both -- the data model supports it and the 10-week timeline accounts for it. |
| 3 | **Who creates school accounts?** | Self-serve, admin invites, founder provisions manually | Manual provisioning for early access. Build admin panel later. |

### Must Answer Before Phase 2

| # | Question | Options | PM Recommendation |
|---|---|---|---|
| 4 | **Sync trigger** | Auto on save, manual push, or both | Auto with user consent toggle in iOS Settings. MX consent laws favor explicit control. |
| 5 | **Historical data backfill** | All existing incidents, or only new ones going forward | All existing -- the web viewer's value is proportional to data available. |
| 6 | **Audio sync** | Sync M4A files to cloud, or keep iOS-only | Sync -- audio playback on web is a key user story for parent meetings. Budget for storage costs. |

### Can Answer Before Launch

| # | Question | Options | PM Recommendation |
|---|---|---|---|
| 7 | **Pricing model** | Free for all iOS users, per-school subscription, freemium | Free for MVP / early access. Monetize after product-market fit. |
| 8 | **Data retention** | Fixed period, school-configurable, indefinite | 3 years default, school-configurable. Auto-archive after retention period. |
| 9 | **OpenAI API key** | Each teacher provides own, or Bitacora provides shared | Keep teacher-provided for now. Shared key changes cost model significantly. |
| 10 | **Legal counsel** | FERPA attorney (US), LFPDPPP attorney (MX) | Required before launch. Privacy policy and DPA templates need legal review. |
| 11 | **Target launch date** | August 2026 (aligns with both US and MX school year) | Yes -- 10 weeks of dev starting April puts us at mid-June for soft launch, August for GA. |

---

## 12. Key Files for Sync Implementation

These existing iOS files inform the backend work:

| File | Relevance |
|---|---|
| `Services/OfflineQueueManager.swift` | Pattern to clone for cloud sync (NWPathMonitor, JSON queue, retry) |
| `Services/ExportService.swift` | JSON field names become the API wire format |
| `Models/Report.swift` | Add `syncedAt` and `syncStatus` fields here |
| `Models/Student.swift` | Maps directly to `students` table schema |
| `Services/APIKeyManager.swift` | UserDefaults pattern to replace with Keychain for auth JWT |
| `Utilities/StudentSearchFrequency.swift` | Stays iOS-only, not synced |

---

## 13. Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| Sync reliability | 99%+ of incidents synced within 5 minutes of creation | `syncStatus` field monitoring |
| Web viewer uptime | 99.9% | Supabase status + Vercel/Netlify monitoring |
| Page load time | < 2 seconds for incident list (50 records) | Lighthouse + Web Vitals |
| Auth security | 0 unauthorized data access incidents | RLS + access log auditing |
| Teacher adoption | 50%+ of iOS users link their web account within 30 days | Profile creation tracking |
| Data compliance | 100% of schools have signed DPA before data sync enabled | Manual tracking |

---

## 14. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Supabase outage blocks iOS sync | Low | Medium | iOS app works fully offline; sync queue retries automatically |
| FERPA/LFPDPPP legal review delays launch | Medium | High | Start legal review in Phase 0, parallel to development |
| Audio storage costs exceed budget | Medium | Medium | Monitor storage, implement retention policy, compress M4A files |
| Teacher resistance to cloud sync | Medium | Medium | Make sync opt-in with clear privacy explanation in both languages |
| Mexico network constraints (slow/intermittent) | High | Medium | iOS offline-first preserved; web viewer requires internet (documented limitation) |

---

*This plan was reviewed against the PM prioritization framework (Educator Impact 30%, Dual-Market Compatibility 25%, Compliance Risk 20%, Technical Complexity 15%, Time to Market 10%) and scored 3.45/5.0 -- viable with the Phase 0 compliance gate and reordered phases addressing the identified gaps.*
