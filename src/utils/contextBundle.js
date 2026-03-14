// ─── utils/contextBundle.js — Agent Context Bundle Builder ───────
// Builds a structured prompt for the qa-testing agent, scoped to a
// specific test case. Used by Option A (clipboard handoff) to give
// the agent everything it needs to start working immediately.
//
// The bundle includes:
//   - Test case details (from CSV row)
//   - YouTrack ticket reference
//   - Category-specific iOS source file paths
//   - Branch naming convention
//   - Existing test file references

import { getFilesForCategory, EXISTING_TESTS } from "../constants/qaFileMap";

/**
 * Convert a test case title to a kebab-case branch suffix.
 * e.g. "First launch shows onboarding on fresh install" → "first-launch-shows-onboarding"
 */
function toBranchSlug(title) {
  return (title || "untitled")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 50)
    .replace(/-$/, "");
}

/**
 * Build the full context bundle for a test case.
 * @param {Object} testCase — row from the CSV
 * @param {string} ticketId — YouTrack ticket ID (e.g. "BIT-42")
 * @returns {string} — ready-to-paste prompt for Claude Code
 */
export function buildContextBundle(testCase, ticketId) {
  const testId = testCase.Test_ID;
  const category = testCase.Category || "Unknown";
  const branchName = `test/${testId}-${toBranchSlug(testCase.Title)}`;
  const files = getFilesForCategory(category);

  const bundle = `# QA Test Case: ${testId}
## YouTrack Ticket: ${ticketId}

### Test Case Details
- **Title:** ${testCase.Title || "—"}
- **Category:** ${category}
- **Priority:** ${testCase.Priority || "—"}
- **Language Scope:** ${testCase.Language_Scope || "—"}
- **School System:** ${testCase.School_System_Scope || "—"}
- **Test Type:** ${testCase.Test_Type || "—"}
- **FERPA Flag:** ${testCase.FERPA_Flag || "—"}
- **Status:** ${testCase.Status || "—"}

### Description
${testCase.Description || "—"}

### Steps to Reproduce
${testCase.Steps || "—"}

### Expected Result
${testCase.Expected_Result || "—"}

### Branch Strategy
- Branch from: \`develop\`
- Branch name: \`${branchName}\`
- PR target: \`develop\`
- Commit prefix: \`test(${testId}):\`

### Relevant Source Files
${files.length > 0
    ? files.map((f) => `- \`${f}\``).join("\n")
    : "- No specific files mapped for this category. Explore the codebase."}

### Existing Test Files (reference)
${EXISTING_TESTS.map((f) => `- \`${f}\``).join("\n")}

### Instructions
1. Read the relevant source files listed above
2. Create or update XCTest cases for this test scenario
3. Follow the test case format from the qa-testing agent guidelines
4. Test both EN and ES if Language_Scope is "Both"
5. Test both US and MX school systems if School_System_Scope is "Both"
6. Commit with message: \`test(${testId}): ${testCase.Title || "add test case"}\`
7. Push and create a PR targeting \`develop\``;

  return bundle;
}

/**
 * Build a shell command to launch Claude Code with the context.
 * @param {Object} testCase — row from the CSV
 * @param {string} ticketId — YouTrack ticket ID
 * @param {string} repoPath — absolute path to the iOS repo
 * @returns {string} — shell command
 */
export function buildLaunchCommand(testCase, ticketId, repoPath = "~/Experiments/Repos/student-reports-ios") {
  const context = buildContextBundle(testCase, ticketId);
  // Escape single quotes for shell
  const escaped = context.replace(/'/g, "'\\''");
  return `cd ${repoPath} && claude --agent qa-testing '${escaped}'`;
}
