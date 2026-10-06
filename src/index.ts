import { Hono } from "hono";
import type { AppEnv } from "./env";
import { handleWebhook } from "./telegram/webhook";
import { consumeJobs } from "./jobs/consumer";

const app = new Hono<AppEnv>();
app.get("/", (c) => c.json({ ok: true, service: "creator-ai-telegram-bot" }));
app.get("/health", (c) => c.json({ ok: true }));
app.post("/telegram/webhook", async (c) => {
  const secret = c.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && c.req.header("X-Telegram-Bot-Api-Secret-Token") !== secret) return c.json({ ok: false }, 401);
  const update = await c.req.json();
  c.executionCtx.waitUntil(handleWebhook(c.env, update));
  return c.json({ ok: true });
});
export default { fetch: app.fetch, queue: consumeJobs } satisfies ExportedHandler<AppEnv["Bindings"], Error>;
