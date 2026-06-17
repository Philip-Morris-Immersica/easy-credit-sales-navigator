import {
  pgTable,
  pgEnum,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  real,
  jsonb,
  primaryKey,
  index,
  vector,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", ["user", "admin", "it"]);
export const botKindEnum = pgEnum("bot_kind", ["simulation", "consultant"]);
export const convStatusEnum = pgEnum("conv_status", [
  "active",
  "completed",
  "abandoned",
]);
export const messageRoleEnum = pgEnum("message_role", [
  "system",
  "user",
  "assistant",
]);

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("password_hash"),
  role: roleEnum("role").notNull().default("user"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  lastActiveAt: timestamp("last_active_at", { mode: "date" }),
});

// ─── Auth.js adapter tables ───────────────────────────────────────────────────

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [primaryKey({ columns: [table.provider, table.providerAccountId] })]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })]
);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
  usedAt: timestamp("used_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// ─── Bots ─────────────────────────────────────────────────────────────────────

export const bots = pgTable("bots", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  key: varchar("key", { length: 100 }).notNull().unique(),
  kind: botKindEnum("kind").notNull(),
  title: text("title").notNull(),
  direction: varchar("direction", { length: 50 }),
  systemPrompt: text("system_prompt").notNull().default(""),
  analysisPrompt: text("analysis_prompt"),
  welcomeMessage: text("welcome_message").notNull().default(""),
  model: varchar("model", { length: 100 }).notNull().default("gpt-4.1-mini"),
  temperature: real("temperature").notNull().default(0.7),
  maxTokens: integer("max_tokens").notNull().default(2000),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

// ─── Conversations ────────────────────────────────────────────────────────────

export const conversations = pgTable(
  "conversations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    botId: text("bot_id")
      .notNull()
      .references(() => bots.id),
    kind: botKindEnum("kind").notNull(),
    language: varchar("language", { length: 10 }).notNull().default("bg"),
    status: convStatusEnum("status").notNull().default("active"),
    title: text("title"),
    startedAt: timestamp("started_at", { mode: "date" }).notNull().defaultNow(),
    lastActivityAt: timestamp("last_activity_at", { mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("conv_user_idx").on(table.userId),
    index("conv_bot_idx").on(table.botId),
    index("conv_status_idx").on(table.status),
  ]
);

// ─── Messages ─────────────────────────────────────────────────────────────────

export const messages = pgTable(
  "messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    model: varchar("model", { length: 100 }),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    cost: real("cost"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("msg_conv_idx").on(table.conversationId)]
);

// ─── Analyses ─────────────────────────────────────────────────────────────────

export const analyses = pgTable("analyses", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  conversationId: text("conversation_id")
    .notNull()
    .unique()
    .references(() => conversations.id, { onDelete: "cascade" }),
  botId: text("bot_id")
    .notNull()
    .references(() => bots.id),
  overallScore: real("overall_score"),
  criteria: jsonb("criteria"),
  strengths: text("strengths").array(),
  improvements: text("improvements").array(),
  summary: text("summary"),
  rawJson: jsonb("raw_json"),
  model: varchar("model", { length: 100 }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// ─── Knowledge Chunks (pgvector) ──────────────────────────────────────────────

export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    source: varchar("source", { length: 50 }).notNull().default("tree"),
    slugPath: text("slug_path"),
    title: text("title"),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("kc_source_idx").on(table.source)]
);

// ─── Model Pricing ────────────────────────────────────────────────────────────

export const modelPricing = pgTable("model_pricing", {
  model: varchar("model", { length: 100 }).primaryKey(),
  inputPer1k: real("input_per_1k").notNull().default(0),
  outputPer1k: real("output_per_1k").notNull().default(0),
});

// ─── Audit Log ────────────────────────────────────────────────────────────────

export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    actorId: text("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 100 }).notNull(),
    target: text("target"),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("audit_actor_idx").on(table.actorId)]
);

// ─── Type exports ─────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Bot = typeof bots.$inferSelect;
export type NewBot = typeof bots.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Analysis = typeof analyses.$inferSelect;
export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;
export type ModelPricing = typeof modelPricing.$inferSelect;
export type AuditLogEntry = typeof auditLog.$inferSelect;
