#!/usr/bin/env bash
# ─── Matute Secret Scanner ────────────────────────────────────────
# Pre-commit hook that scans staged files for hardcoded secrets.
# Blocks the commit if any matches are found.

set -euo pipefail

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

HEADER="🔒 MATUTE — Pre-commit Secret Scanner"

# Patterns that indicate real secrets (not placeholders or comments)
SECRET_PATTERNS=(
  'sk-ant-api[0-9]+-[A-Za-z0-9_-]{20,}'       # Anthropic API keys
  'sk-[A-Za-z0-9]{20,}'                         # OpenAI API keys
  'perm-[A-Za-z0-9=]+\.[A-Za-z0-9=]+\.[A-Za-z0-9_-]{10,}'  # YouTrack tokens
  'ghp_[A-Za-z0-9]{36,}'                        # GitHub personal tokens
  'gho_[A-Za-z0-9]{36,}'                        # GitHub OAuth tokens
  'AKIA[A-Z0-9]{16}'                            # AWS access key IDs
  'xoxb-[0-9]{10,}-[A-Za-z0-9]{20,}'           # Slack bot tokens
  'xoxp-[0-9]{10,}-[A-Za-z0-9]{20,}'           # Slack user tokens
)

# Files to always skip (binary, lock files, this script itself)
SKIP_PATTERNS='\.png$|\.jpg$|\.jpeg$|\.gif$|\.ico$|\.woff|\.ttf|\.eot$|\.svg$|package-lock\.json$|\.lock$|scan-secrets\.sh$'

# Get staged files (only added/modified, not deleted)
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

FOUND=0

for file in $STAGED_FILES; do
  # Skip binary/lock files
  if echo "$file" | grep -qE "$SKIP_PATTERNS"; then
    continue
  fi

  # Skip if file doesn't exist (edge case)
  if [ ! -f "$file" ]; then
    continue
  fi

  # Get the staged content (not working tree)
  CONTENT=$(git show ":$file" 2>/dev/null || true)
  if [ -z "$CONTENT" ]; then
    continue
  fi

  for pattern in "${SECRET_PATTERNS[@]}"; do
    MATCHES=$(echo "$CONTENT" | grep -nE "$pattern" 2>/dev/null || true)
    if [ -n "$MATCHES" ]; then
      if [ $FOUND -eq 0 ]; then
        echo ""
        echo -e "${RED}${HEADER}${NC}"
        echo -e "${RED}═══════════════════════════════════════════════════${NC}"
        echo ""
      fi
      FOUND=$((FOUND + 1))
      echo -e "${RED}🚨 SECRET DETECTED in ${file}:${NC}"
      echo "$MATCHES" | while IFS= read -r line; do
        LINE_NUM=$(echo "$line" | cut -d: -f1)
        echo -e "   ${YELLOW}Line ${LINE_NUM}: [REDACTED — matches secret pattern]${NC}"
      done
      echo ""
    fi
  done
done

# Also check for .env files being committed
for file in $STAGED_FILES; do
  if echo "$file" | grep -qE '^\.env$|^\.env\.local$|^\.env\.[^e]'; then
    if [ $FOUND -eq 0 ]; then
      echo ""
      echo -e "${RED}${HEADER}${NC}"
      echo -e "${RED}═══════════════════════════════════════════════════${NC}"
      echo ""
    fi
    FOUND=$((FOUND + 1))
    echo -e "${RED}🚨 BLOCKED: Attempting to commit ${file}${NC}"
    echo -e "   ${YELLOW}Environment files must never be committed.${NC}"
    echo -e "   ${YELLOW}Use .env.example for templates instead.${NC}"
    echo ""
  fi
done

if [ $FOUND -gt 0 ]; then
  echo -e "${RED}❌ Commit blocked: ${FOUND} secret(s) or sensitive file(s) detected.${NC}"
  echo -e "${YELLOW}   Fix the issues above, then try again.${NC}"
  echo -e "${YELLOW}   If this is a false positive, use: git commit --no-verify${NC}"
  echo ""
  exit 1
fi

echo -e "${GREEN}🔒 Matute: No secrets detected in staged files.${NC}"
exit 0
