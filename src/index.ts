import { Hono } from "hono";
import type { AppEnv } from "./env";

const app = new Hono<AppEnv>();

app.get("/", (c) =>
  c.json({
    ok: true,
    service: "creator-ai-telegram-bot",
  }),
);

app.get("/health", (c) =>
  c.json({
    ok: true,
  }),
);

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<unknown>, env: AppEnv["Bindings"]): Promise<void> {
    for (const message of batch.messages) {
      console.log("Queue job received", {
        messageId: message.id,
        body: message.body,
      });
    }
  },
};
