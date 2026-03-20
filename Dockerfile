# ── Build stage — compile React frontend ─────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# ── Production stage — Node.js server + Claude CLI ───────────────
FROM node:22-alpine

# Native modules (better-sqlite3, sqlite3) need build tools to compile
# Git + gh CLI needed for worktree operations and PR creation
# Bash needed for Claude CLI
RUN apk add --no-cache python3 make g++ git github-cli bash curl

WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts=false

# Clean up build tools to keep image small
RUN apk del python3 make g++

# Install Claude CLI
RUN npm install -g @anthropic-ai/claude-code

RUN mkdir -p /app/data /repos

# Create a dedicated non-root user for spawning claude CLI.
# Express stays as root (needs /app/data write access).
# claude -p --dangerously-skip-permissions refuses to run as root.
RUN addgroup -S agentgroup && adduser -S agent -G agentgroup
RUN mkdir -p /home/agent/.claude && \
    # Point agent's claude config dir at root's so mounted agents are visible.
    # docker-compose mounts agents at /root/.claude/agents (read-only).
    # The agent user inherits the same definitions via this symlink.
    ln -s /root/.claude/agents /home/agent/.claude/agents && \
    chown -R agent:agentgroup /home/agent /repos

# Configure git to use GITHUB_TOKEN for HTTPS clone/push auth.
# The token is injected at runtime via environment variable.
# This script runs at container start to set up the credential helper
# for both root (Express worktree ops) and agent user (claude spawns).
RUN printf '#!/bin/sh\n\
if [ -n "$GITHUB_TOKEN" ]; then\n\
  git config --global credential.helper "!f() { echo username=x-access-token; echo password=$GITHUB_TOKEN; }; f"\n\
  git config --global user.name "bitacora-agent"\n\
  git config --global user.email "agent@bitacora.cloud"\n\
  su -s /bin/sh agent -c '\''git config --global credential.helper "!f() { echo username=x-access-token; echo password=$GITHUB_TOKEN; }; f"; git config --global user.name bitacora-agent; git config --global user.email agent@bitacora.cloud'\''\n\
fi\n\
exec "$@"\n' > /entrypoint.sh && chmod +x /entrypoint.sh

EXPOSE 8080
ENV NODE_ENV=production
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server/index.js"]
