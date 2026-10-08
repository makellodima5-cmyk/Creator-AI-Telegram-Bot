-- Final T3 forward migration 0003
CREATE UNIQUE INDEX IF NOT EXISTS ux_transactions_reference ON credit_transactions(reference);
ALTER TABLE admin_audit_log ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS ux_admin_audit_idempotency ON admin_audit_log(idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS ux_job_results_job_position ON job_results(job_id,position);

INSERT OR IGNORE INTO pricing(key,type,credits_cost,stars_price,included_credits,duration_days,is_active,created_at,updated_at) VALUES
('edit','feature',1,NULL,NULL,NULL,1,unixepoch()*1000,unixepoch()*1000),
('other_variant','feature',1,NULL,NULL,NULL,1,unixepoch()*1000,unixepoch()*1000);
