import { eq } from "drizzle-orm";
import { createDb } from "../db/client";
import { jobs, userSessions } from "../db/schema";
import { ensureUser, reserveCredits } from "../billing/credits";
import { answerCallback, deleteMessage, editMessageText, sendMessage } from "./api";
import { mainMenu, postConfig } from "./keyboards";
import type { Bindings } from "../env";

const defaults = { topic: "", platform: "telegram", style: "conversational", length: "short" };
const parseDraft = (s: string | null | undefined) => s ? JSON.parse(s) : { ...defaults };
const renderConfig = (d: typeof defaults) => `📝 Post Maker

Тема:
${d.topic}

Выбери параметры:`;
async function saveDraft(db: ReturnType<typeof createDb>, userId: number, draft: typeof defaults) {
  await db.update(userSessions).set({ flow: "post", step: "config", draftJson: JSON.stringify(draft), updatedAt: new Date() }).where(eq(userSessions.userId, userId));
}

export async function handleWebhook(env: Bindings, update: unknown) {
  const u = update as any, message = u.message, cb = u.callback_query, from = message?.from ?? cb?.from;
  if (!from) return;
  const chatId = String(message?.chat?.id ?? cb?.message?.chat?.id);
  const user = await ensureUser(env, String(from.id), from.first_name, from.username);
  const db = createDb(env);

  if (message?.text === "/start") {
    await sendMessage(env, chatId, "👋 Creator AI

Создавай готовый контент прямо в Telegram.", mainMenu);
    return;
  }

  if (message?.text) {
    const session = await db.select().from(userSessions).where(eq(userSessions.userId, user.id)).get();
    if (session?.flow === "post" && session.step === "topic") {
      const topic = message.text.trim().slice(0, Number(env.MAX_INPUT_CHARS ?? 12000));
      const draft = { ...defaults, topic };
      await db.insert(userSessions).values({ userId: user.id, flow: "post", step: "config", draftJson: JSON.stringify(draft), updatedAt: new Date() })
        .onConflictDoUpdate({ target: userSessions.userId, set: { flow: "post", step: "config", draftJson: JSON.stringify(draft), updatedAt: new Date() } });
      await deleteMessage(env, chatId, message.message_id);
      await sendMessage(env, chatId, renderConfig(draft), postConfig(draft));
      return;
    }
  }

  if (!cb) return;
  await answerCallback(env, cb.id);
  const data = String(cb.data ?? ""), msg = cb.message;
  if (!msg) return;

  if (data === "menu:post") {
    await db.insert(userSessions).values({ userId: user.id, flow: "post", step: "topic", draftJson: JSON.stringify(defaults), updatedAt: new Date() })
      .onConflictDoUpdate({ target: userSessions.userId, set: { flow: "post", step: "topic", draftJson: JSON.stringify(defaults), updatedAt: new Date() } });
    await editMessageText(env, chatId, msg.message_id, "📝 Post Maker

О чём пост?

Напиши тему или идею.

Например:
«5 способов использовать AI
в Telegram»

[ ← Назад ]");
    return;
  }

  const session = await db.select().from(userSessions).where(eq(userSessions.userId, user.id)).get();
  const draft = parseDraft(session?.draftJson) as typeof defaults;

  if (data.startsWith("post:p:")) {
    draft.platform = data.slice(7); await saveDraft(db, user.id, draft);
    await editMessageText(env, chatId, msg.message_id, renderConfig(draft), postConfig(draft)); return;
  }
  if (data.startsWith("post:s:")) {
    draft.style = data.slice(7); await saveDraft(db, user.id, draft);
    await editMessageText(env, chatId, msg.message_id, renderConfig(draft), postConfig(draft)); return;
  }
  if (data.startsWith("post:l:")) {
    draft.length = data.slice(7); await saveDraft(db, user.id, draft);
    await editMessageText(env, chatId, msg.message_id, renderConfig(draft), postConfig(draft)); return;
  }

  if (data === "post:create") {
    if (!draft.topic) return;
    const jobId = Date.now();
    if (!(await reserveCredits(env, user.id, 1, jobId))) {
      await editMessageText(env, chatId, msg.message_id, "💳 Недостаточно credits. Откройте ⭐ Credits.", mainMenu); return;
    }
    const sent = await editMessageText(env, chatId, msg.message_id, "⏳ Создаю пост...");
    const inserted = await db.insert(jobs).values({
      userId: user.id, type: "post", status: "queued", inputJson: JSON.stringify(draft),
      creditsReserved: 1, telegramChatId: chatId, telegramMessageId: sent.message_id, createdAt: new Date(),
    }).returning({ id: jobs.id }).get();
    await db.delete(userSessions).where(eq(userSessions.userId, user.id));
    await env.AI_QUEUE.send({ jobId: inserted.id });
    return;
  }

  if (data === "post:back") {
    await db.delete(userSessions).where(eq(userSessions.userId, user.id));
    await editMessageText(env, chatId, msg.message_id, "Главное меню", mainMenu);
  }
}
