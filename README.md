# Creator AI Telegram Bot

Cloudflare-native AI Content Factory for Telegram. The current implementation follows the project’s Final T3 UX and architecture.

## Implemented Final T3 MVP

- **Telegram navigation:** a six-button inline `/start` menu plus Telegram Bot Menu commands. There is no persistent Reply Keyboard.
- **Post Maker:** turn an idea into a post; configure platform, style and length.
- **Script Maker:** create short-video scripts with platform, style and duration settings.
- **Repurpose:** submit one text message (up to 4,000 characters) or one PDF, DOC or TXT document (up to 5 MB and up to 20,000 extracted text characters). Choose any combination of Telegram post, Instagram caption, TikTok script, YouTube Shorts script, 5 Hooks, CTA or a 7-day Content Plan.
- **Content Plan:** create seven days of ideas, goals, formats, hooks, angles, main thoughts and CTAs. A plan is not seven fully generated posts; generating content for a day is a separate paid operation.
- **My Style:** analyze 5–20 writing examples and save a compact Style Profile for supported text-generation operations.
- **History:** save results explicitly, reopen them, copy them, continue working or delete them.
- **Tariffs and Credits:** FREE, CREATOR and PRO tariffs; 50/100/250/500-credit packs; Telegram Stars checkout.
- **Results:** copy, edit, request another variant and explicitly save to History. A single Working Message is edited during generation and becomes the result.
- **Credits and billing:** configurable operation prices, credit reservation, charge on successful generation, refund on AI failure, independent billing for Repurpose outputs and an auditable credit ledger.
- **Admin Panel:** configure tariff, credit-pack, AI-operation and Repurpose-output prices; view user/generation statistics and AI cost in money; find users by Telegram ID and grant tariffs or credits.
- **Async processing:** Telegram webhook, D1 Job state, Cloudflare Queues, AI Worker/Provider layer, output validation and normalization, and a separate delivery queue with retry handling.
- **Source storage:** temporary Repurpose files are stored in R2 and cleaned up by scheduled maintenance.
- **AI:** OpenAI Responses API with structured JSON-schema output, configurable model routing/costs, output validation, controlled retries and internal token/cost tracking.
- **Localization:** Russian and English interface, Bot Menu commands and AI conversation language.

## Deliberately outside the current MVP

- Automatic publishing to external social networks.
- A full Telegram Mini App or web dashboard.
- Teams, client API access and complex analytics.
- A full video editor, automatic video cutting or an FFmpeg-based Shorts rendering pipeline.
- Recurring automatic Telegram Stars subscription charging.

## Cloudflare resources

- **D1:** `creator-ai-db`
- **AI Queue:** `creator-ai-jobs`
- **Delivery Queue:** `creator-ai-deliveries`
- **R2:** `creator-ai-files`

The worker also has an hourly scheduled maintenance trigger. Queue dead-letter queues must be created/configured in Cloudflare to match `wrangler.jsonc`.

## Development and verification

```bash
npm install
npm run typecheck
npm test
npm run dev
```

Apply D1 migrations locally or remotely with:

```bash
npm run db:migrate:local
npm run db:migrate:remote
```

## Deployment

```bash
npm run deploy
```

Secrets and environment-specific configuration are supplied through Cloudflare bindings/environment variables and must not be committed to Git.
