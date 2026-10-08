-- Final T3 forward migration 0002
ALTER TABLE users ADD COLUMN last_seen_at INTEGER;
UPDATE users SET last_seen_at=updated_at WHERE last_seen_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_users_user ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_job_attempts_job ON job_attempts(job_id,attempt_no);
CREATE INDEX IF NOT EXISTS idx_job_results_user_created ON job_results(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_user_created ON history(user_id,created_at DESC);
