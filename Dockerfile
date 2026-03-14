# ── Build stage — compile React frontend ─────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Production stage — Node.js server ────────────────────────────
FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev
RUN mkdir -p /app/data
EXPOSE 8080
ENV NODE_ENV=production
CMD ["node", "server/index.js"]
