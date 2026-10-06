import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
};

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  telegramId: text("telegram_id").notNull().unique(),
  username: text("username"),
  firstName: text("first_name"),
  language: text("language").notNull().default("ru"),
  plan: text("plan").notNull().default("free"),
  creditsBalance: integer("credits_balance").notNull().default(0),
  creditsResetAt: integer("credits_reset_at", { mode: "timestamp_ms" }),
  notificationsEnabled: integer("notifications_enabled", { mode: "boolean" }).notNull().default(true),
  termsAcceptedAt: integer("terms_accepted_at", { mode: "timestamp_ms" }),
  ...timestamps,
});

export const userSessions = sqliteTable("user_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().unique(),
  flow: text("flow").notNull(),
  step: text("step").notNull(),
  draftJson: text("draft_json"),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  styleProfileJson: text("style_profile_json"),
  ...timestamps,
});

export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  parentJobId: integer("parent_job_id"),
  type: text("type").notNull(),
  status: text("status").notNull(),
  inputJson: text("input_json"),
  outputJson: text("output_json"),
  inputFileId: integer("input_file_id"),
  outputFileId: integer("output_file_id"),
  provider: text("provider"),
  model: text("model"),
  tokensInput: integer("tokens_input"),
  tokensOutput: integer("tokens_output"),
  costUsdMicros: integer("cost_usd_micros"),
  creditsReserved: integer("credits_reserved").notNull().default(0),
  creditsCharged: integer("credits_charged").notNull().default(0),
  attempts: integer("attempts").notNull().default(0),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  telegramChatId: text("telegram_chat_id"),
  telegramMessageId: integer("telegram_message_id"),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  isSaved: integer("is_saved", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  startedAt: integer("started_at", { mode: "timestamp_ms" }),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
});

export const files = sqliteTable("files", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  jobId: integer("job_id"),
  storageType: text("storage_type").notNull(),
  telegramFileId: text("telegram_file_id"),
  telegramFileUniqueId: text("telegram_file_unique_id"),
  r2Key: text("r2_key"),
  mimeType: text("mime_type"),
  fileName: text("file_name"),
  sizeBytes: integer("size_bytes"),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  isSaved: integer("is_saved", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const creditLedger = sqliteTable("credit_ledger", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  delta: integer("delta").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  reason: text("reason").notNull(),
  jobId: integer("job_id"),
  paymentId: integer("payment_id"),
  adminId: integer("admin_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const pricing = sqliteTable("pricing", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  type: text("type").notNull(),
  creditsCost: integer("credits_cost"),
  starsPrice: integer("stars_price"),
  includedCredits: integer("included_credits"),
  durationDays: integer("duration_days"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  updatedBy: integer("updated_by"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const subscriptions = sqliteTable("subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  plan: text("plan").notNull(),
  provider: text("provider").notNull(),
  starsAmount: integer("stars_amount"),
  status: text("status").notNull(),
  currentPeriodStart: integer("current_period_start", { mode: "timestamp_ms" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  telegramPaymentChargeId: text("telegram_payment_charge_id"),
  invoicePayload: text("invoice_payload"),
  isRecurring: integer("is_recurring", { mode: "boolean" }).notNull().default(false),
  canceledAt: integer("canceled_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  provider: text("provider").notNull(),
  kind: text("kind").notNull(),
  telegramPaymentChargeId: text("telegram_payment_charge_id").unique(),
  invoicePayload: text("invoice_payload").unique(),
  currency: text("currency").notNull(),
  starsAmount: integer("stars_amount").notNull(),
  status: text("status").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  refundedAt: integer("refunded_at", { mode: "timestamp_ms" }),
});

export const adminAuditLog = sqliteTable("admin_audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  adminUserId: integer("admin_user_id").notNull(),
  action: text("action").notNull(),
  targetUserId: integer("target_user_id"),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  oldValueJson: text("old_value_json"),
  newValueJson: text("new_value_json"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
