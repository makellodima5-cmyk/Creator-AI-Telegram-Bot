# Creator AI Telegram Bot

Cloudflare-native Telegram AI Content Factory.

## Implemented MVP

- Telegram webhook protected by `TELEGRAM_WEBHOOK_SECRET`
- Persistent Telegram navigation keyboard + inline configuration flows
- Post Maker: topic → platform/style/length → async generation
- Script Maker: topic → platform/style/duration → async generation
- Content Plan: topic → goal/platform/style → 7-day plan
- Repurpose: text material → Telegram/Instagram/TikTok/YouTube + hooks/CTA/weekly plan
- Result actions: regenerate, strengthen hook, shorten, convert post to script, history
- D1 users/sessions/jobs/ledger/payments/subscriptions
- Cloudflare Queue async job processing with retries
- OpenAI Responses API with strict JSON Schema structured outputs
- Credits with reservation, refund on failed generation, ledger, and monthly lazy reset
- Telegram Stars (XTR) invoices for Creator, Pro and 50-credit pack
- Telegram payment pre-checkout validation and successful-payment fulfillment
- Basic History, Pricing, Credits, Settings and Style placeholders
- GitHub Actions typecheck + tests

## Not yet in this MVP

- Telegram media/document/audio/video ingestion for Repurpose
- R2 file storage binding
- Voice/style profile analysis
- Full admin UI
- Automatic posting to social networks
- Containers/FFmpeg Shorts Factory
- Recurring Stars subscriptions

## Cloudflare resources

- D1: `creator-ai-db`
- Queue: `creator-ai-jobs`
- R2: `creator-ai-files` (bind when created)

## Development

```bash
npm install
npm run typecheck
npm test
npm run dev
```

## Deployment

```bash
npm run deploy
```

Secrets/configuration are provided through Cloudflare environment variables and are never committed to Git.
