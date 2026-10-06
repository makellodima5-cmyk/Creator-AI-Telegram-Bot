CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL UNIQUE,
  username TEXT,
  first_name TEXT,
  language TEXT NOT NULL DEFAULT 'ru',
  plan TEXT NOT NULL DEFAULT 'free',
  credits_balance INTEGER NOT NULL DEFAULT 0,
  credits_reset_at INTEGER,
  notifications_enabled INTEGER NOT NULL DEFAULT 1,
  terms_accepted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  flow TEXT NOT NULL,
  step TEXT NOT NULL,
  draft_json TEXT,
  expires_at INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  style_profile_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  parent_job_id INTEGER,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  input_json TEXT,
  output_json TEXT,
  input_file_id INTEGER,
  output_file_id INTEGER,
  provider TEXT,
  model TEXT,
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_usd_micros INTEGER,
  credits_reserved INTEGER NOT NULL DEFAULT 0,
  credits_charged INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  telegram_chat_id TEXT,
  telegram_message_id INTEGER,
  expires_at INTEGER,
  is_saved INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER
);

CREATE TABLE files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  job_id INTEGER,
  storage_type TEXT NOT NULL,
  telegram_file_id TEXT,
  telegram_file_unique_id TEXT,
  r2_key TEXT,
  mime_type TEXT,
  file_name TEXT,
  size_bytes INTEGER,
  expires_at INTEGER,
  is_saved INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE credit_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason TEXT NOT NULL,
  job_id INTEGER,
  payment_id INTEGER,
  admin_id INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE pricing (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  credits_cost INTEGER,
  stars_price INTEGER,
  included_credits INTEGER,
  duration_days INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_by INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  plan TEXT NOT NULL,
  provider TEXT NOT NULL,
  stars_amount INTEGER,
  status TEXT NOT NULL,
  current_period_start INTEGER,
  expires_at INTEGER,
  telegram_payment_charge_id TEXT,
  invoice_payload TEXT,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  canceled_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  kind TEXT NOT NULL,
  telegram_payment_charge_id TEXT UNIQUE,
  invoice_payload TEXT UNIQUE,
  currency TEXT NOT NULL,
  stars_amount INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  refunded_at INTEGER
);

CREATE TABLE admin_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  target_user_id INTEGER,
  entity_type TEXT,
  entity_id INTEGER,
  old_value_json TEXT,
  new_value_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_jobs_user_created ON jobs(user_id, created_at DESC);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_files_user_created ON files(user_id, created_at DESC);
CREATE INDEX idx_ledger_user_created ON credit_ledger(user_id, created_at DESC);
CREATE INDEX idx_subscriptions_user_status ON subscriptions(user_id, status);
CREATE INDEX idx_payments_user_created ON payments(user_id, created_at DESC);
CREATE INDEX idx_admin_audit_created ON admin_audit_log(created_at DESC);

-- Seed is idempotent and can be changed later through Admin Panel.
INSERT OR IGNORE INTO pricing
  (key, type, credits_cost, stars_price, included_credits, duration_days, is_active, created_at, updated_at)
VALUES
  ('post', 'feature', 1, NULL, NULL, NULL, 1, unixepoch() * 1000, unixepoch() * 1000),
  ('script', 'feature', 2, NULL, NULL, NULL, 1, unixepoch() * 1000, unixepoch() * 1000),
  ('repurpose', 'feature', 3, NULL, NULL, NULL, 1, unixepoch() * 1000, unixepoch() * 1000),
  ('content_plan', 'feature', 5, NULL, NULL, NULL, 1, unixepoch() * 1000, unixepoch() * 1000),
  ('image', 'feature', 5, NULL, NULL, NULL, 0, unixepoch() * 1000, unixepoch() * 1000),
  ('free', 'plan', NULL, 0, 10, 30, 1, unixepoch() * 1000, unixepoch() * 1000),
  ('creator', 'plan', NULL, 99, 100, 30, 1, unixepoch() * 1000, unixepoch() * 1000),
  ('pro', 'plan', NULL, 299, 500, 30, 1, unixepoch() * 1000, unixepoch() * 1000);
