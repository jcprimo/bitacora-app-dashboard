// ─── constants/prompts.js — AI Prompts & Templates ──────────────
// System prompts sent to Claude for AI-assisted ticket generation,
// placeholder text for each agent's input field, and structured
// Markdown templates for the no-API "Template Generate" fallback.
//
// CONTEXT is prepended to every agent prompt. It tells Claude about
// the Bitacora app, its dual compliance requirements, and forces
// JSON-only output (no markdown fencing).

const CONTEXT = `You work on Bitacora, a bilingual (English/Spanish) iOS app for student behavioral incident reporting used by teachers, principals, and school administrators in US and Mexico school systems.

Dual compliance: FERPA (US) + LFPDPPP (Mexico).
Stack: Swift/SwiftUI, MVVM, Core Data.
Users: teachers, principals, school admins.
Markets: US K-12 + Mexico escuelas.

IMPORTANT: Respond ONLY with a valid JSON object. No markdown fencing, no explanation.`;

export const PROMPTS = {
  pm: `${CONTEXT}\nYou are the PM Agent. Generate a YouTrack ticket:\n{"summary":"title under 80 chars","description":"## User Story\\nAs a [teacher|principal|admin],\\nI want to [action],\\nSo that [outcome].\\n\\n## Acceptance Criteria\\n- [ ] criterion 1\\n- [ ] criterion 2\\n\\n## Bilingual Impact\\n[EN/ES considerations]\\n\\n## Compliance\\n**FERPA:** [Yes/No]\\n**LFPDPPP:** [Yes/No]","priority":"Normal","ferpa_risk":false,"lfpdppp_risk":false,"estimated_effort":"M"}`,
  ios: `${CONTEXT}\nYou are the iOS Senior Developer Agent. Generate a YouTrack ticket:\n{"summary":"title under 80 chars","description":"## Task\\n[what to build/fix]\\n\\n## Technical Requirements\\n- Swift/SwiftUI details\\n- Architecture (MVVM)\\n- Data layer (Core Data, API)\\n\\n## Done When\\n- [ ] Code reviewed\\n- [ ] XCTests passing\\n- [ ] Localization (EN+ES)\\n- [ ] Accessibility verified\\n\\n## Compliance\\n**FERPA:** [Yes/No]\\n**LFPDPPP:** [Yes/No]","priority":"Normal","ferpa_risk":false,"lfpdppp_risk":false,"estimated_effort":"M"}`,
  ux: `${CONTEXT}\nYou are the UX/UI Agent. Generate a YouTrack ticket:\n{"summary":"title under 80 chars","description":"## Design Task\\n**Persona:** [Teacher|Principal|Admin]\\n**Device:** [iPhone|iPad|Both]\\n\\n**Problem:**\\n[pain point]\\n\\n**Deliverables:**\\n- [ ] Wireframe\\n- [ ] Hi-fi (Light+Dark)\\n- [ ] Component spec\\n- [ ] Bilingual layout review (ES ~30% longer)\\n\\n**Accessibility:** WCAG 2.1 AA, VoiceOver, Dynamic Type\\n\\n## Compliance\\n**FERPA:** [Yes/No]\\n**LFPDPPP:** [Yes/No]","priority":"Normal","ferpa_risk":false,"lfpdppp_risk":false,"estimated_effort":"M"}`,
  qa: `${CONTEXT}\nYou are the QA Agent. Generate a YouTrack ticket:\n{"summary":"title under 80 chars","description":"## Bug Report\\n**Env:** [Staging|Dev|TestFlight]\\n**Device:** [model, iOS version]\\n**Language:** [EN|ES|Both]\\n\\n**Steps:**\\n1. step\\n2. step\\n\\n**Expected:** [should happen]\\n**Actual:** [happened]\\n\\n**Roles Affected:** [Teacher|Principal|Admin|All]\\n**RBAC:** [Pass/Fail]\\n**Blocking Release:** [Yes/No]\\n\\n## Compliance\\n**FERPA:** [Yes/No]\\n**LFPDPPP:** [Yes/No]","priority":"Major","ferpa_risk":false,"lfpdppp_risk":false,"estimated_effort":"S"}`,
  data: `${CONTEXT}\nYou are the Data Agent. Generate a YouTrack ticket:\n{"summary":"title under 80 chars","description":"## Analytics Task\\n**Objective:** [what to measure]\\n\\n**Events:**\\n- event_name: description (educator IDs only)\\n\\n**FERPA Boundary:** [no student PII]\\n**LFPDPPP Boundary:** [Mexico data handling]\\n\\n**Output:** [dashboard/report]\\n**Vendor:** [tool — must have DPA]","priority":"Normal","ferpa_risk":false,"lfpdppp_risk":false,"estimated_effort":"M"}`,
  security: `${CONTEXT}\nYou are the Security Agent. Generate a YouTrack ticket:\n{"summary":"title under 80 chars","description":"## Security Finding\\n**Risk:** [Critical|High|Medium|Low]\\n\\n**FERPA:** [implication]\\n**LFPDPPP:** [implication]\\n\\n**Component:** [affected]\\n**Data Classification:** [Education Record|Directory Info|Behavioral|Non-PII]\\n\\n**Remediation:**\\n1. step\\n2. step\\n\\n**Verification:**\\n- [ ] Security re-review\\n- [ ] No PII in logs\\n- [ ] DPA/Aviso current\\n- [ ] AES-256 + TLS 1.2+","priority":"Critical","ferpa_risk":true,"lfpdppp_risk":true,"estimated_effort":"M"}`,
  gtm: `${CONTEXT}\nYou are the GTM Agent. Generate a YouTrack ticket:\n{"summary":"title under 80 chars","description":"## GTM Task\\n**Market:** [US|Mexico|Both]\\n**Audience:** [Teacher|Principal|Admin|IT|SEP]\\n\\n**Message (EN):** [value prop]\\n**Message (ES):** [value prop]\\n\\n**Deliverables:**\\n- [ ] item 1\\n- [ ] item 2\\n\\n**Compliance Badges:** FERPA [Y/N] LFPDPPP [Y/N]\\n**Launch Window:** [timing]","priority":"Normal","ferpa_risk":false,"lfpdppp_risk":false,"estimated_effort":"M"}`,
  cs: `${CONTEXT}\nYou are the CS Agent. Generate a YouTrack ticket:\n{"summary":"title under 80 chars","description":"## CS Task\\n**Segment:** [Teacher|Principal|Admin]\\n**Market:** [US|Mexico|Both]\\n**Language:** [EN|ES|Bilingual]\\n\\n**Problem/Opportunity:** [description]\\n**Action:** [what CS will do]\\n**Docs Update:** [Yes/No — EN, ES, or both]\\n**Churn Risk:** [High|Medium|Low|None]\\n\\n**Compliance:** No student PII: [Confirmed]","priority":"Normal","ferpa_risk":false,"lfpdppp_risk":false,"estimated_effort":"S"}`,
};

// Returns agent-specific placeholder text for the Create view textarea
export function getPlaceholder(id) {
  const p = {
    pm: "Describe a feature need, priority decision, or user story...\n\nEx: \"Teachers need to log behavior incidents with severity and photo attachments\"",
    ios: "Describe a feature to build or bug to fix...\n\nEx: \"Build incident report form: severity picker, student selector, notes, photo\"",
    ux: "Describe a design need or usability issue...\n\nEx: \"Design the incident creation flow for iPhone — fast, one-handed\"",
    qa: "Describe a bug or test scenario...\n\nEx: \"Teacher can see students from another class in the selector dropdown\"",
    data: "What do you want to measure?\n\nEx: \"Track behavior log creation funnel: where do teachers drop off?\"",
    security: "Describe a security concern or compliance need...\n\nEx: \"Review new OpenAI integration for auto-categorizing incidents\"",
    gtm: "Describe a marketing or launch task...\n\nEx: \"App Store listing copy for Mexico launch (Spanish)\"",
    cs: "Describe a support or retention task...\n\nEx: \"Bilingual onboarding email sequence for new teacher signups\"",
  };
  return p[id] || "Describe your task...";
}

// Generates pre-filled Markdown templates per agent (no API call needed).
// Used by the "Template Generate" button as a free alternative to AI Generate.
// Each template mirrors the structure of the corresponding AI prompt.
export function getTemplates(input) {
  return {
    pm: {
      summary: input.length > 80 ? input.slice(0, 77) + "..." : input,
      description: `## User Story\nAs a [teacher | principal | admin],\nI want to ${input},\nSo that [define the outcome].\n\n## Acceptance Criteria\n- [ ] [Define criterion 1]\n- [ ] [Define criterion 2]\n- [ ] [Define criterion 3]\n\n## Bilingual Impact\n[Does this need EN/ES support?]\n\n## Compliance\n**FERPA:** [Yes/No — explain]\n**LFPDPPP:** [Yes/No — explain]\n\n## Notes\n${input}`,
    },
    ios: {
      summary: input.length > 80 ? input.slice(0, 77) + "..." : input,
      description: `## Task\n${input}\n\n## Technical Requirements\n- [ ] Swift/SwiftUI implementation\n- [ ] Architecture: MVVM\n- [ ] Data layer: [Core Data / API]\n\n## Done When\n- [ ] Code reviewed\n- [ ] XCTests passing\n- [ ] Localization added (EN + ES)\n- [ ] Accessibility verified (VoiceOver)\n- [ ] QA Agent sign-off\n\n## Compliance\n**FERPA:** [Yes/No]\n**LFPDPPP:** [Yes/No]`,
    },
    ux: {
      summary: input.length > 80 ? input.slice(0, 77) + "..." : input,
      description: `## Design Task\n**Persona:** [Teacher | Principal | Admin]\n**Device:** [iPhone | iPad | Both]\n\n**Problem:**\n${input}\n\n**Deliverables:**\n- [ ] Lo-fi wireframe\n- [ ] Hi-fi spec (Light + Dark mode)\n- [ ] Component spec for iOS developer\n- [ ] Bilingual layout review (ES text ~30% longer)\n\n**Accessibility:**\n- WCAG 2.1 AA\n- VoiceOver labels\n- Dynamic Type support\n\n## Compliance\n**FERPA:** [Yes/No]\n**LFPDPPP:** [Yes/No]`,
    },
    qa: {
      summary: input.length > 80 ? input.slice(0, 77) + "..." : input,
      description: `## QA Task\n${input}\n\n**Environment:** [Staging | Dev | TestFlight]\n**Device:** [iPhone model, iOS version]\n**Language:** [EN | ES | Both]\n\n## Test Scenarios\n- [ ] [Define test case 1]\n- [ ] [Define test case 2]\n- [ ] [Define test case 3]\n\n**User Journeys to Cover:**\n- [ ] Teacher flow\n- [ ] Principal flow\n- [ ] Admin flow\n\n**Roles Affected:** [Teacher | Principal | Admin | All]\n**RBAC Boundary Test:** [Define scope]\n**Blocking Release:** [Yes/No]\n\n## Compliance\n**FERPA:** [Yes/No]\n**LFPDPPP:** [Yes/No]\n\n## Notes\n[Leave room for edits as test scenarios are refined]`,
    },
    data: {
      summary: input.length > 80 ? input.slice(0, 77) + "..." : input,
      description: `## Analytics Task\n**Objective:**\n${input}\n\n**Events to Track:**\n- [ ] event_name: [description — educator IDs only]\n\n**FERPA Boundary:** No student PII in event properties\n**LFPDPPP Boundary:** [Mexico data handling]\n\n**Output:** [Dashboard / Report]\n**Vendor:** [Tool — must have DPA]`,
    },
    security: {
      summary: input.length > 80 ? input.slice(0, 77) + "..." : input,
      description: `## Security / Compliance Review\n**Risk Level:** [Critical | High | Medium | Low]\n\n**Context:**\n${input}\n\n**FERPA Implication:** [Explain]\n**LFPDPPP Implication:** [Explain]\n\n**Affected Component:** [Define]\n**Data Classification:** [Education Record | Directory Info | Behavioral | Non-PII]\n\n**Remediation:**\n1. [Step 1]\n2. [Step 2]\n\n**Verification:**\n- [ ] Security Agent re-review\n- [ ] No PII in logs or analytics\n- [ ] DPA/Aviso de Privacidad current\n- [ ] AES-256 + TLS 1.2+`,
    },
    gtm: {
      summary: input.length > 80 ? input.slice(0, 77) + "..." : input,
      description: `## GTM Task\n**Market:** [US | Mexico | Both]\n**Audience:** [Teacher | Principal | Admin | IT]\n\n**Context:**\n${input}\n\n**Message (EN):** [Value prop in English]\n**Message (ES):** [Value prop in Spanish]\n\n**Deliverables:**\n- [ ] [Deliverable 1]\n- [ ] [Deliverable 2]\n\n**Compliance Badges:** FERPA [Y/N] · LFPDPPP [Y/N]\n**Launch Window:** [Timing]`,
    },
    cs: {
      summary: input.length > 80 ? input.slice(0, 77) + "..." : input,
      description: `## CS Task\n**Segment:** [Teacher | Principal | Admin]\n**Market:** [US | Mexico | Both]\n**Language:** [EN | ES | Bilingual]\n\n**Problem/Opportunity:**\n${input}\n\n**Proposed Action:** [What CS will do]\n**Docs Update Needed:** [Yes/No — EN, ES, or both]\n**Churn Risk:** [High | Medium | Low | None]\n\n**Compliance:** No student PII: [Confirmed]`,
    },
  };
}
