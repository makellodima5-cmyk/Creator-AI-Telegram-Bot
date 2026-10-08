-- Final T3 forward migration 0003
CREATE UNIQUE INDEX IF NOT EXISTS ux_transactions_reference ON credit_transactions(reference);
ALTER TABLE admin_audit_log ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS ux_admin_audit_idempotency ON admin_audit_log(idempotency_key);
