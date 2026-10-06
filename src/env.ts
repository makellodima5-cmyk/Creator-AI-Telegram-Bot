export type Bindings = {
  DB: D1Database;
  AI_QUEUE: Queue;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  AI_PROVIDER?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL_FAST?: string;
  OPENAI_MODEL_SMART?: string;
  OPENAI_TRANSCRIBE_MODEL?: string;
  OPENAI_IMAGE_MODEL?: string;
  TERMS_URL?: string;
  PRIVACY_URL?: string;
  SUPPORT_USERNAME?: string;
  ADMIN_TELEGRAM_IDS?: string;
  MAX_INPUT_CHARS?: string;
  MAX_UPLOAD_BYTES?: string;
  JOB_MAX_ATTEMPTS?: string;
};

export type AppEnv = {
  Bindings: Bindings;
};
