import { eq } from "drizzle-orm";
import { jobs, userSessions } from "../../db/schema";
import { createDb } from "../../db/client";
import { OpenAIProvider } from "../../ai/openai";
import { editMessageText } from "../../telegram/api";
import { mainMenu, repurposeResult } from "../../telegram/keyboards";
import { refundCredits } from "../../billing/credits";
import type { Bindings } from "../../env";
import type { RepurposeJobInput } from "../types";

export async function handleRepurposeJob(env: Bindings, jobId: number) {
  const db = createDb(env);
  const job = await db.select().from(jobs).where(eq(jobs.id, jobId)).get();
  if (!job || job.status === "completed" || job.status === "failed") return;
  if (!env.OPENAI_API_KEY || !env.OPENAI_MODEL_FAST) throw new Error("openai_not_configured");

  await db.update(jobs).set({
    status: "processing",
    startedAt: job.startedAt ?? new Date(),
    attempts: (job.attempts ?? 0) + 1,
  }).where(eq(jobs.id, jobId));

  try {
    const result = await new OpenAIProvider(env.OPENAI_API_KEY, env.OPENAI_MODEL_FAST)
      .createRepurpose(JSON.parse(job.inputJson ?? "{}") as RepurposeJobInput);

    await db.update(jobs).set({
      status: "completed",
      outputJson: JSON.stringify(result.output),
      provider: "openai",
      model: result.model,
      tokensInput: result.inputTokens,
      tokensOutput: result.outputTokens,
      creditsCharged: job.creditsReserved,
      creditsReserved: 0,
      completedAt: new Date(),
    }).where(eq(jobs.id, jobId));

    if (job.telegramChatId && job.telegramMessageId) {
      await editMessageText(env, job.telegramChatId, job.telegramMessageId, summary(result.output), repurposeResult(jobId));
      await db.update(userSessions).set({
        flow: "ui",
        step: "result",
        draftJson: JSON.stringify({ kind: "result", messageId: job.telegramMessageId, jobId }),
        updatedAt: new Date(),
      }).where(eq(userSessions.userId, job.userId));
    }
  } catch (error) {
    if (job.creditsReserved > 0) await refundCredits(env, job.userId, job.creditsReserved, job.id);
    await db.update(jobs).set({
      status: "failed",
      creditsReserved: 0,
      errorMessage: error instanceof Error ? error.message : "unknown_error",
      completedAt: new Date(),
    }).where(eq(jobs.id, jobId));

    if (job.telegramChatId && job.telegramMessageId) {
      await editMessageText(env, job.telegramChatId, job.telegramMessageId, "❌ Не удалось переработать материал.\n\nCredits возвращены.", mainMenu);
      await db.update(userSessions).set({
        flow: "ui",
        step: "menu",
        draftJson: JSON.stringify({ kind: "menu", messageId: job.telegramMessageId }),
        updatedAt: new Date(),
      }).where(eq(userSessions.userId, job.userId));
    }
    throw error;
  }
}

function summary(o: any) {
  return `♻️ Готово ✅

Из одного материала создано:

📱 Telegram-пост
📸 Instagram caption
🎵 TikTok script
▶️ YouTube Shorts script
🔥 5 Hooks
🎯 CTA
📅 Контент на 7 дней

Нажми кнопку ниже, чтобы открыть нужный результат.`;
}
