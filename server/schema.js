// ─── server/schema.js — Drizzle ORM Schema ──────────────────────
// Defines all database tables for Bitacora App Dashboard.
// SQLite via better-sqlite3 + Drizzle ORM.

import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── Users & Auth ────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  password: text("password").notNull(), // bcrypt hash
  name: text("name"),
  role: text("role").default("member"), // 'admin' | 'member'
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// ─── Encrypted API Credentials ───────────────────────────────────
export const credentials = sqliteTable(
  "credentials",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    service: text("service").notNull(), // 'youtrack' | 'anthropic' | 'openai'
    tokenEnc: text("token_enc").notNull(), // AES-256-GCM encrypted
    iv: text("iv").notNull(),
    tag: text("tag").notNull(), // GCM auth tag
    createdAt: text("created_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex("idx_cred_user_svc").on(table.userId, table.service),
  ]
);

// ─── Markdown Documents ──────────────────────────────────────────
export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  path: text("path"),
  content: text("content").notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// ─── AI Usage Tracking ───────────────────────────────────────────
export const aiUsage = sqliteTable("ai_usage", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  agent: text("agent").notNull(),
  provider: text("provider").notNull(), // 'anthropic' | 'openai'
  inputTokens: integer("input_tokens").default(0),
  outputTokens: integer("output_tokens").default(0),
  costUsd: real("cost_usd").default(0),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ─── QA Test Cases ───────────────────────────────────────────────
export const qaTestCases = sqliteTable("qa_test_cases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  fileName: text("file_name"),
  testId: text("test_id").notNull(),
  category: text("category"),
  testName: text("test_name"),
  description: text("description"),
  priority: text("priority"),
  status: text("status").default("Not Started"),
  ferpaFlag: text("ferpa_flag"),
  ticketId: text("ticket_id"),
  ticketStage: text("ticket_stage"),
  dataJson: text("data_json"), // full CSV row as JSON
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ─── Agent Jobs (Phase 3 — orchestration) ────────────────────────
export const agentJobs = sqliteTable("agent_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  agentType: text("agent_type").notNull(),
  status: text("status").default("queued"), // queued | running | done | failed
  inputJson: text("input_json").notNull(),
  resultJson: text("result_json"),
  ticketId: text("ticket_id"),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ─── Agent Logs (Phase 3) ────────────────────────────────────────
export const agentLogs = sqliteTable("agent_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id").notNull().references(() => agentJobs.id),
  level: text("level").default("info"),
  message: text("message").notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});
