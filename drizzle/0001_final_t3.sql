CREATE TABLE IF NOT EXISTS admin_users (user_id INTEGER PRIMARY KEY,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at INTEGER NOT NULL,updated_by INTEGER);
CREATE TABLE IF NOT EXISTS sources (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,type TEXT NOT NULL,original_name TEXT,mime_type TEXT,size_bytes INTEGER,extracted_text TEXT,analysis_json TEXT,r2_key TEXT,expires_at INTEGER,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS style_profiles (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,profile_json TEXT NOT NULL,is_active INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS content_plans (id INTEGER PRIMARY KEY AUTOINCREMENT,job_id INTEGER NOT NULL,user_id INTEGER NOT NULL,source_id INTEGER,topic TEXT NOT NULL,goal TEXT NOT NULL,platform TEXT NOT NULL,style TEXT NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS content_plan_days (id INTEGER PRIMARY KEY AUTOINCREMENT,plan_id INTEGER NOT NULL,position INTEGER NOT NULL,day TEXT NOT NULL,title TEXT NOT NULL,goal TEXT NOT NULL,format TEXT NOT NULL,hook TEXT NOT NULL,angle TEXT NOT NULL,main_thought TEXT NOT NULL,cta TEXT NOT NULL,status TEXT NOT NULL DEFAULT '○',job_id INTEGER,result_id INTEGER,updated_at INTEGER NOT NULL,UNIQUE(plan_id,position));
CREATE TABLE IF NOT EXISTS job_results (id INTEGER PRIMARY KEY AUTOINCREMENT,job_id INTEGER NOT NULL,user_id INTEGER NOT NULL,result_type TEXT NOT NULL,position INTEGER NOT NULL,status TEXT NOT NULL,content_json TEXT,credits_reserved INTEGER NOT NULL DEFAULT 0,credits_charged INTEGER NOT NULL DEFAULT 0,telegram_chat_id TEXT,telegram_message_id INTEGER,error_code TEXT,error_message TEXT,created_at INTEGER NOT NULL,completed_at INTEGER);
CREATE TABLE IF NOT EXISTS job_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT,job_id INTEGER NOT NULL,attempt_no INTEGER NOT NULL,status TEXT NOT NULL,provider TEXT,model TEXT,input_tokens INTEGER,output_tokens INTEGER,cost_usd_micros INTEGER,duration_ms INTEGER,prompt_version TEXT,error_code TEXT,error_message TEXT,created_at INTEGER NOT NULL,started_at INTEGER,completed_at INTEGER,UNIQUE(job_id,attempt_no));
CREATE TABLE IF NOT EXISTS deliveries (id INTEGER PRIMARY KEY AUTOINCREMENT,result_id INTEGER NOT NULL,user_id INTEGER NOT NULL,position INTEGER NOT NULL,chat_id TEXT NOT NULL,message_id INTEGER,status TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,next_retry_at INTEGER,last_error TEXT,created_at INTEGER NOT NULL,sent_at INTEGER,UNIQUE(result_id));
CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,result_id INTEGER NOT NULL,expires_at INTEGER,created_at INTEGER NOT NULL,UNIQUE(user_id,result_id));
CREATE TABLE IF NOT EXISTS credit_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,type TEXT NOT NULL,delta INTEGER NOT NULL,balance_after INTEGER NOT NULL,job_id INTEGER,payment_id INTEGER,admin_id INTEGER,reference TEXT,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS update_receipts (update_id TEXT PRIMARY KEY,created_at INTEGER NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS ux_jobs_idempotency ON jobs(user_id,idempotency_key);
CREATE INDEX IF NOT EXISTS idx_jobs_active_user ON jobs(user_id,status);
CREATE INDEX IF NOT EXISTS idx_results_job ON job_results(job_id,status);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status,next_retry_at);
CREATE INDEX IF NOT EXISTS idx_sources_expiry ON sources(expires_at);
CREATE INDEX IF NOT EXISTS idx_history_expiry ON history(expires_at);
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON credit_transactions(reference);
INSERT OR IGNORE INTO settings(key,value,updated_at) VALUES
('job_max_attempts','3',unixepoch()*1000),
('source_text_chars','4000',unixepoch()*1000),
('source_file_bytes','5242880',unixepoch()*1000),
('source_extracted_chars','20000',unixepoch()*1000),
('rate_limit_post','10',unixepoch()*1000),
('rate_limit_script','10',unixepoch()*1000),
('rate_limit_repurpose','5',unixepoch()*1000),
('rate_limit_content_plan','5',unixepoch()*1000),
('delivery_max_attempts','5',unixepoch()*1000),
('delivery_backoff_seconds','[15,60,300,900,3600]',unixepoch()*1000),
('history_duration_free','7',unixepoch()*1000),
('history_duration_creator','30',unixepoch()*1000),
('history_duration_pro','90',unixepoch()*1000),
('model_routes','{"post":"fast","script":"smart","content_plan":"smart","source_analysis":"smart","repurpose_telegram":"fast","repurpose_instagram":"fast","repurpose_tiktok":"smart","repurpose_youtube":"smart","repurpose_hooks":"fast","repurpose_cta":"fast","repurpose_plan":"smart","style_profile":"smart"}',unixepoch()*1000),
('model_costs','{}',unixepoch()*1000);
INSERT OR IGNORE INTO pricing(key,type,credits_cost,stars_price,included_credits,duration_days,is_active,created_at,updated_at) VALUES
('post_edit','feature',1,NULL,NULL,NULL,1,unixepoch()*1000,unixepoch()*1000),
('post_variant','feature',1,NULL,NULL,NULL,1,unixepoch()*1000,unixepoch()*1000),
('script_edit','feature',2,NULL,NULL,NULL,1,unixepoch()*1000,unixepoch()*1000),
('script_variant','feature',2,NULL,NULL,NULL,1,unixepoch()*1000,unixepoch()*1000),
('content_plan_variant','feature',5,NULL,NULL,NULL,1,unixepoch()*1000,unixepoch()*1000),
('style_profile','feature',3,NULL,NULL,NULL,1,unixepoch()*1000,unixepoch()*1000),
('repurpose_telegram','feature',1,NULL,NULL,NULL,1,unixepoch()*1000,unixepoch()*1000),
('repurpose_instagram','feature',1,NULL,NULL,NULL,1,unixepoch()*1000,unixepoch()*1000),
('repurpose_tiktok','feature',1,NULL,NULL,NULL,1,unixepoch()*1000,unixepoch()*1000),
('repurpose_youtube','feature',1,NULL,NULL,NULL,1,unixepoch()*1000,unixepoch()*1000),
('repurpose_hooks','feature',1,NULL,NULL,NULL,1,unixepoch()*1000,unixepoch()*1000),
('repurpose_cta','feature',1,NULL,NULL,NULL,1,unixepoch()*1000,unixepoch()*1000),
('repurpose_plan','feature',1,NULL,NULL,NULL,1,unixepoch()*1000,unixepoch()*1000),
('credits_50','credit_package',NULL,49,50,NULL,1,unixepoch()*1000,unixepoch()*1000),
('credits_100','credit_package',NULL,89,100,NULL,1,unixepoch()*1000,unixepoch()*1000),
('credits_250','credit_package',NULL,199,250,NULL,1,unixepoch()*1000,unixepoch()*1000),
('credits_500','credit_package',NULL,349,500,NULL,1,unixepoch()*1000,unixepoch()*1000);
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN tariff_id INTEGER;
ALTER TABLE users ADD COLUMN generation_lock_job_id INTEGER;
ALTER TABLE user_sessions ADD COLUMN working_message_id INTEGER;
ALTER TABLE user_sessions ADD COLUMN working_chat_id TEXT;
ALTER TABLE user_sessions ADD COLUMN active_job_id INTEGER;
ALTER TABLE jobs ADD COLUMN source_id INTEGER;
ALTER TABLE jobs ADD COLUMN selected_outputs_json TEXT;
ALTER TABLE jobs ADD COLUMN context_json TEXT;
ALTER TABLE jobs ADD COLUMN idempotency_key TEXT;
ALTER TABLE jobs ADD COLUMN style_profile_id INTEGER;
ALTER TABLE jobs ADD COLUMN prompt_version TEXT;
ALTER TABLE jobs ADD COLUMN result_id INTEGER;
ALTER TABLE payments ADD COLUMN product_key TEXT;
ALTER TABLE history ADD COLUMN deleted_at INTEGER;

ALTER TABLE files ADD COLUMN source_id INTEGER;
ALTER TABLE history ADD COLUMN result_type TEXT;
ALTER TABLE history ADD COLUMN title TEXT;
