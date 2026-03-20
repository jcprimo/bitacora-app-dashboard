// ─── server/worktree.js — Git Worktree Manager ───────────────────
// Creates and cleans up git worktrees for agent jobs.
// Each job gets its own branch: agent/<type>/job-<id>
//
// Worktrees are created in /tmp/bitacora-agents/ to keep them out of
// the main repo directory. Cleaned up after job completion.

import { execSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";

// Base directory for worktrees
const WORKTREE_BASE = "/tmp/bitacora-agents";

// Map repo names to clone URLs and local paths.
// Repos are cloned fresh inside the container if not present.
const REPO_BASE = process.env.REPO_BASE_DIR || resolve(process.env.HOME || "/root", "repos");

const REPO_MAP = {
  "bitacora-app-dashboard": {
    path: process.env.REPO_DASHBOARD_PATH || resolve(REPO_BASE, "bitacora-app-dashboard"),
    url: "https://github.com/jcprimo/bitacora-app-dashboard.git",
  },
  "bitacora-app-ios": {
    path: process.env.REPO_IOS_PATH || resolve(REPO_BASE, "bitacora-app-ios"),
    url: "https://github.com/jcprimo/bitacora-app-ios.git",
  },
  "primo-engineering": {
    path: process.env.REPO_PRIMO_PATH || resolve(REPO_BASE, "primo-engineering"),
    url: "https://github.com/jcprimo/primo-engineering.git",
  },
  "primo-engineering-team": {
    path: process.env.REPO_TEAM_PATH || resolve(REPO_BASE, "primo-engineering-team"),
    url: "https://github.com/jcprimo/primo-engineering-team.git",
  },
};

/**
 * Get the local filesystem path for a repo name.
 * Clones the repo fresh if it doesn't exist (ephemeral container model).
 */
export function getRepoPath(repoName) {
  const repo = REPO_MAP[repoName];
  if (!repo) throw new Error(`Unknown repo: ${repoName}`);
  return repo.path;
}

/**
 * Ensure a repo is cloned and up to date.
 * If the repo doesn't exist locally, clone it fresh.
 * If it exists, fetch latest.
 */
export function ensureRepo(repoName) {
  const repo = REPO_MAP[repoName];
  if (!repo) throw new Error(`Unknown repo: ${repoName}`);

  if (!existsSync(repo.path)) {
    // Clone fresh — ephemeral container, always get latest
    execSync(`git clone "${repo.url}" "${repo.path}"`, {
      stdio: "pipe",
      timeout: 120000, // 2 min for large repos
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
  } else {
    // Already cloned — fetch latest
    try {
      execSync("git fetch origin", { cwd: repo.path, stdio: "pipe", timeout: 30000 });
    } catch { /* non-fatal */ }
  }

  return repo.path;
}

/**
 * Create a git worktree for an agent job.
 * Returns { worktreePath, branch }.
 */
export function createWorktree(repoPath, agentType, jobId) {
  if (!existsSync(repoPath)) {
    throw new Error(`Repo not found at ${repoPath}. Did ensureRepo() run first?`);
  }

  const branch = `agent/${agentType}/job-${jobId}`;
  const worktreePath = resolve(WORKTREE_BASE, `${agentType}-job-${jobId}`);

  // Determine the default branch (master or main)
  const defaultBranch = getDefaultBranch(repoPath);

  // Create the worktree with a new branch off the default branch
  execSync(
    `git worktree add "${worktreePath}" -b "${branch}" "origin/${defaultBranch}"`,
    { cwd: repoPath, stdio: "pipe", timeout: 30000 }
  );

  return { worktreePath, branch };
}

/**
 * Clean up a worktree and its branch.
 */
export function cleanupWorktree(worktreePath, branch, repoPath) {
  try {
    if (existsSync(worktreePath)) {
      execSync(`git worktree remove "${worktreePath}" --force`, {
        cwd: repoPath,
        stdio: "pipe",
        timeout: 15000,
      });
    }
  } catch {
    // If worktree remove fails, try manual cleanup
    try {
      execSync(`rm -rf "${worktreePath}"`, { stdio: "pipe" });
      execSync("git worktree prune", { cwd: repoPath, stdio: "pipe" });
    } catch { /* best effort */ }
  }

  // Delete the branch
  try {
    execSync(`git branch -D "${branch}"`, { cwd: repoPath, stdio: "pipe" });
  } catch { /* branch may not exist */ }
}

/**
 * Check if a worktree has uncommitted or committed changes vs its parent.
 */
export function hasChanges(worktreePath) {
  // Check for uncommitted changes
  const status = execSync("git status --porcelain", {
    cwd: worktreePath,
    encoding: "utf-8",
    timeout: 10000,
  }).trim();

  if (status) return true;

  // Check for committed changes vs the branch point
  const log = execSync("git log --oneline origin/HEAD..HEAD 2>/dev/null || git log --oneline -1", {
    cwd: worktreePath,
    encoding: "utf-8",
    timeout: 10000,
  }).trim();

  return log.split("\n").length > 0 && log.length > 0;
}

/**
 * Get the diff of changes on this branch (for the review UI).
 */
export function getBranchDiff(worktreePath, branch) {
  try {
    // Get diff from the branch point
    const diff = execSync("git diff origin/HEAD..HEAD", {
      cwd: worktreePath,
      encoding: "utf-8",
      timeout: 30000,
      maxBuffer: 5 * 1024 * 1024, // 5MB max diff
    });
    return diff;
  } catch {
    return null;
  }
}

/**
 * Push the agent branch to origin and create a PR via gh CLI.
 * Returns the PR URL.
 */
export function createPR(worktreePath, branch, repoPath, { title, body, autoMerge }) {
  // Push the branch
  execSync(`git push origin "${branch}"`, {
    cwd: worktreePath,
    stdio: "pipe",
    timeout: 60000,
  });

  // Create PR via gh CLI
  const defaultBranch = getDefaultBranch(repoPath);
  const prOutput = execSync(
    `gh pr create --base "${defaultBranch}" --head "${branch}" --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"')}"`,
    { cwd: worktreePath, encoding: "utf-8", timeout: 30000 }
  );
  const prUrl = prOutput.trim();

  // Auto-merge if configured
  if (autoMerge) {
    try {
      execSync(`gh pr merge --auto --squash "${prUrl}"`, {
        cwd: worktreePath,
        stdio: "pipe",
        timeout: 30000,
      });
    } catch {
      // Auto-merge may fail if branch protections require reviews
    }
  }

  return prUrl;
}

/**
 * Detect the default branch of a repo.
 */
function getDefaultBranch(repoPath) {
  try {
    const ref = execSync("git symbolic-ref refs/remotes/origin/HEAD", {
      cwd: repoPath,
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    return ref.replace("refs/remotes/origin/", "");
  } catch {
    // Fallback: check if master or main exists
    try {
      execSync("git rev-parse --verify origin/master", { cwd: repoPath, stdio: "pipe" });
      return "master";
    } catch {
      return "main";
    }
  }
}
