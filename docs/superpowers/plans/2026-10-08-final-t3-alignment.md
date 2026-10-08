# Final T3 Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Creator AI repository into complete behavioral, UX, billing, data-model, queue, localization, and admin-panel alignment with the Final T3 specification and the latest user-approved copy.

**Architecture:** Keep the existing Cloudflare Workers + D1 + Queues + R2 + provider-abstraction architecture. Correct the Telegram UX/navigation and message lifecycle, make pricing/credits/idempotency/locks authoritative in D1, and keep AI generation/delivery separated. Add only forward D1 migrations.

**Tech Stack:** Cloudflare Workers, Hono, D1/SQLite, R2, Queues, Telegram Bot API, OpenAI Responses API, TypeScript, Vitest, Wrangler.

**Spec:** Project source `FINAL T3 — ЕДИНАЯ СПЕЦИФИКАЦИЯ ПРОЕКТА` and latest `Creator_AI_сообщения(1).txt`, with later explicit UX clarifications from the user.

## Global Constraints

- Permanent Reply Keyboard is absent; Telegram Bot Menu is global navigation.
- /start has exactly six inline actions in three rows.
- All keyboards are at most three rows.
- Working Message is edited through progress stages and becomes the final result.
- Paid generation shows `💳 Стоимость генерации: {cost} 🔹` before Create.
- Repurpose uses seven independent outputs with independently configured prices summed before Create.
- Repurpose accepts one text message <=4000 chars or one PDF/DOC/TXT <=5 MB and <=20000 extracted chars.
- Credits are reserved before AI work and charged/refunded according to Job/Result outcome.
- Retry after final AI failure creates a new Job; active generation cannot be cancelled.
- History is explicit user save, not Memory.
- Style Profile is compact and old examples are not resent on every generation.
- User language changes interface, system messages, and AI conversation language.
- Admin authorization is server-side and admin actions are idempotent/audited.
- User must not see internal stack traces, job IDs, model IDs, token counts, provider errors, or internal prompts.
- Existing applied migrations are not rewritten; new schema changes are forward-only.

## Review Focus

- Duplicate Create/Retry/payment/delivery must not double-charge or double-execute.
- Repurpose partial success must charge successful outputs and refund failed outputs independently.
- Working Message ownership must remain correct when multiple Repurpose Results are delivered.
- Language changes must affect subsequent Menu commands and all user-facing copy.
- Oversized/unsupported Repurpose documents must fail before credit reservation and generation.

---

### Task 1: Final Telegram keyboards and copy

**Files:**
- Modify: `src/telegram/keyboards.ts`
- Modify: `src/text.ts`
- Test: `tests/post-flow.test.ts`

**Interfaces:**
- Produces exact keyboard contracts used by webhook/admin flows.
- Produces localized copy helpers consumed by webhook and runner.

- [ ] Write failing tests for six-button /start, no Reply Keyboard export, max-three-row config/Repurpose keyboards, exact result/Settings/Tariffs/Credits controls, and exact key copy lines.
- [ ] Run the focused tests and observe expected failures.
- [ ] Implement the final keyboards/copy.
- [ ] Re-run focused tests until green, then run the full suite.
- [ ] Commit.

### Task 2: Telegram Menu and navigation lifecycle

**Files:**
- Modify: `src/telegram/api.ts`
- Modify: `src/telegram/webhook.ts`
- Modify: `src/index.ts`
- Test: `tests/telegram-navigation.test.ts`

**Interfaces:**
- `setMyCommands`, `setChatMenuButton`.
- Localized user/admin command registration.
- No persistent Reply Keyboard message.

- [ ] Write failing tests for command sets, language-specific menu setup, /start single-message behavior, Back-to-Menu behavior, and lock-allowed actions.
- [ ] Run tests and confirm failures.
- [ ] Implement Menu setup and navigation.
- [ ] Run focused and full suite.
- [ ] Commit.

### Task 3: Working Message, Jobs, credits, and Repurpose execution

**Files:**
- Modify: `src/jobs/create.ts`
- Modify: `src/jobs/runner.ts`
- Modify: `src/jobs/delivery.ts`
- Modify: `src/billing/credits.ts`
- Modify: `src/jobs/day-engine.ts`
- Modify: `src/jobs/plan-store.ts`
- Test: `tests/job-lifecycle.test.ts`

**Interfaces:**
- One Job per AI operation.
- One Working Message per active single-output generation.
- Repurpose Result rows are independently charged/refunded/delivered.
- Price locked in Job at Create.
- Generation Lock persists through the full Repurpose Job lifecycle.

- [ ] Write failing tests for exact success/failure credit lifecycle, Working Message becomes Result, delivery separation, Repurpose partial result accounting, and non-cancellable active jobs.
- [ ] Run focused tests and confirm failures.
- [ ] Implement minimal fixes.
- [ ] Run focused and full suite.
- [ ] Commit.

### Task 4: Source limits and Style Profile mechanics

**Files:**
- Modify: `src/files/source.ts`
- Modify: `src/jobs/runner.ts`
- Modify: `src/telegram/webhook.ts`
- Test: `tests/source-style.test.ts`

**Interfaces:**
- Source validation before paid operation.
- Style collection: 5 minimum, 20 maximum, continuous collection after Add Example.
- Style Profile replaces previous active profile.

- [ ] Write failing tests for source type/size/extracted limits and 5/20 style collection states.
- [ ] Run tests and confirm failures.
- [ ] Implement validation and collection state transitions.
- [ ] Run focused and full suite.
- [ ] Commit.

### Task 5: Admin Panel, configurable pricing, statistics, and grants

**Files:**
- Modify: `src/admin.ts`
- Modify: `src/telegram/webhook.ts`
- Test: `tests/admin.test.ts`

**Interfaces:**
- Prices: tariffs, credit packs, AI operations, Repurpose outputs.
- Statistics: users/new/active, generations/success/errors, credits, AI Cost money, revenue where measurable.
- User search by Telegram ID, grant tariff, grant credits including Other amount.
- Audited, idempotent mutations and ledger entries.

- [ ] Write failing tests for server-side auth, price mutation audit, user lookup, tariff grant, credit grant, and duplicate grant protection.
- [ ] Run tests and confirm failures.
- [ ] Implement Admin Panel.
- [ ] Run focused and full suite.
- [ ] Commit.

### Task 6: D1 schema parity and forward migration

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0002_final_t3_alignment.sql`
- Modify: `README.md`
- Test: `tests/migration.test.ts`

**Interfaces:**
- Drizzle schema matches runtime D1 schema.
- Forward migration adds missing columns/indexes only.
- README describes the Final T3 state, not legacy Reply Keyboard/placeholder features.

- [ ] Write failing migration/schema parity tests.
- [ ] Run them and confirm failures.
- [ ] Add the forward migration and align schema.
- [ ] Apply migrations locally and run typecheck/full suite.
- [ ] Commit.

### Task 7: Integration verification and release

**Files:**
- Modify only as required by review.
- Test: all project tests and CI.

- [ ] Run typecheck.
- [ ] Run all tests.
- [ ] Review the full branch against the Final T3 checklist and the five Review Focus cases.
- [ ] Fix all Critical/Important findings with RED→GREEN tests and a final green suite.
- [ ] Create PR to `main`.
- [ ] Wait for CI green; inspect any failed job logs and fix on the branch.
- [ ] Merge the PR to `main`.
- [ ] Re-check `main` commit and combined CI status.
