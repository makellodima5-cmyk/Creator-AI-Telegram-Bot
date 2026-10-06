# Creator AI Telegram Bot

Cloudflare-native Telegram AI Content Factory.

## Current MVP scope

- Telegram bot
- Post Maker
- Script Maker
- Content Repurpose
- Content Plan
- Credits
- Pricing config
- Admin panel foundation
- D1 + Queues
- Optional R2 (not bound until the bucket exists)

## Cloudflare resources

- D1: `creator-ai-db`
- Queue: `creator-ai-jobs`
- R2: `creator-ai-files` (bind later)

## Development

```bash
npm install
npm run dev
npm run typecheck
```

## Deployment

```bash
npm run deploy
```

Secrets/configuration are provided through Cloudflare environment variables and are never committed to Git.
