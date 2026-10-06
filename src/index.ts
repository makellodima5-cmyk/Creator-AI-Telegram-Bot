import { Hono } from "hono";
import type { AppEnv } from "./env";

type QueueJobMessage = {
  jobId: number;
};

const app = new Hono<AppEnv>();

app.get("/", (c) =>
  c.json({
    ok: true,
    service: "creator-ai-telegram-bot",
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<QueueJobMessage>): Promise<void> {
    for (const message of batch.messages) {
      console.log("Queue job received", {
        messageId: message.id,
        jobId: message.body.jobId,
      });
    }
  },
} satisfies ExportedHandler<AppEnv["Bindings"], Error>;
