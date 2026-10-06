# Creator AI Telegram Bot

Cloudflare-native Telegram AI Content Factory.

## Current MVP

- Telegram webhook protected by a required `TELEGRAM_WEBHOOK_SECRET`
- Persistent bottom navigation keyboard + inline configuration flows
- Post Maker: topic → platform/style/length → async generation
- Script Maker: topic → platform/style/duration → async generation
- Content Plan: topic → goal/platform/style → 7-day plan with per-day creation
- Repurpose: text material → Telegram/Instagram/TikTok/YouTube + hooks/CTA/weekly plan
- Post result actions: regenerate, strengthen hook, shorten, convert to script, native copy
- History with saved completed jobs
- D1 users/sessions/jobs/credit ledger/payments/subscriptions
- Cloudflare Queue async processing, retries and dead-letter queue
- OpenAI Responses API with strict JSON Schema structured outputs
- Credits reservation/refund with ledger entries tied to real job IDs
- Telegram Stars (XTR) purchase flow with pre-checkout validation
- GitHub Actions typecheck + tests

## Intentionally not in this MVP

- Telegram media/document/audio/video ingestion for Repurpose
- R2 file storage binding
- Voice/style profile analysis (UI placeholder only)
- Full admin UI
- Automatic posting to social networks
- Containers/FFmpeg Shorts Factory
- Recurring Stars subscriptions

## Cloudflare resources

- D1: `creator-ai-db`
- Queue: `creator-ai-jobs`
- Queue DLQ: `creator-ai-jobs-dlq`
- R2: `creator-ai-files` (bind later when the bucket exists)

## Required secrets

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `OPENAI_API_KEY`

Model/config variables are intentionally supplied separately so model IDs are not hard-coded into the application.

## Development

```bash
npm install
npm run typecheck
npm test
npm run dev
```

## Deployment

```bash
npm run db:migrate:remote
npm run deploy
```

Secrets are stored through Cloudflare Worker secrets and are never committed to Git.
