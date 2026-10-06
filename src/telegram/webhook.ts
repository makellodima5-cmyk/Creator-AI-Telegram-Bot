import { and, desc, eq } from "drizzle-orm";
import { createDb } from "../db/client";
import { creditLedger, jobs, payments, subscriptions, userSessions, users } from "../db/schema";
import { ensureUser, reserveCredits, refundCredits } from "../billing/credits";
import { answerCallback, answerPreCheckoutQuery, deleteMessage, editMessageText, sendInvoice, sendMessage } from "./api";
import {
  mainMenu,
  persistentMenu,
  planConfig,
  planResult,
  postConfig,
  postResult,
  pricingKeyboard,
  repurposeConfirm,
  repurposeResult,
  repurposeTargets,
  scriptConfig,
  scriptResult,
} from "./keyboards";
import type { Bindings } from "../env";
import type { TelegramMessage } from "./api";

const defaults = {
  post: { topic: "", platform: "telegram", style: "conversational", length: "short" },
  script: { topic: "", platform: "tiktok", style: "dynamic", duration: "30" },
  plan: { topic: "", goal: "growth", platform: "telegram", style: "expert" },
  repurpose: { material: "", targets: ["all"] as string[] },
};

const costs = { post: 1, script: 2, repurpose: 3, plan: 5 };
const uiKeys = ["__uiMessageId", "__uiKind"] as const;

type UiKind = "menu" | "flow" | "processing" | "result";
type FeatureFlow = "post" | "script" | "plan" | "repurpose";

const mainMenuText = "👋 Creator AI\n\nСоздавай готовый контент прямо в Telegram.";

const prompts = {
  post:
    "📝 Post Maker\n\nО чём пост?\n\nНапиши тему или идею.\n\nНапример:\n«5 способов использовать AI\nв Telegram»\n\n",
  script:
    "🎬 Script Maker\n\nО чём ролик?\n\nНапиши тему или идею.\n\nНапример:\n«5 AI-сервисов для работы\nс телефона»\n\n",
  repurpose:
    "♻️ Repurpose\n\nПреврати один материал\nв готовый контент для разных площадок.\n\nМожно отправить:\n• текст\n• статью\n• документ\n• аудио\n• видео\n• голосовое сообщение\n\nОтправь материал ↓\n\n",
  plan:
    "📅 Content Plan\n\nСоздам контент-план\nна 7 дней.\n\nО чём твой канал\nили проект?\n\nНапиши тему ↓\n\n",
};

export async function handleWebhook(env: Bindings, update: unknown) {
  const u = update as any;

  if (u.pre_checkout_query) {
    const q = u.pre_checkout_query;
    const db = createDb(env);
    const payment = await db
      .select()
      .from(payments)
      .where(eq(payments.invoicePayload, String(q.invoice_payload)))
      .get();
    const payer = await db
      .select()
      .from(users)
      .where(eq(users.telegramId, String(q.from?.id ?? "")))
      .get();
    const valid =
      !!payment &&
      payment.status === "pending" &&
      !!payer &&
      payment.userId === payer.id &&
      String(q.currency) === "XTR" &&
      Number(q.total_amount) === Number(payment.starsAmount);
    await answerPreCheckoutQuery(env, q.id, valid, valid ? "" : "Платёж больше недоступен или не совпадает с заказом.");
    return;
  }

  const message = u.message;
  const cb = u.callback_query;
  const from = message?.from ?? cb?.from;
  if (!from) return;

  const chatId = String(message?.chat?.id ?? cb?.message?.chat?.id);
  const user = await ensureUser(env, String(from.id), from.first_name, from.username);
  const db = createDb(env);

  if (message?.successful_payment) {
    await completePayment(env, user.id, message.successful_payment);
    await openMainMenu(env, user.id, chatId, true);
    return;
  }

  if (message?.text === "/start") {
    await openMainMenu(env, user.id, chatId, true);
    return;
  }

  if (message?.text) {
    const text = message.text.trim();
    const mapped: Record<string, string> = {
      "📝 Пост": "menu:post",
      "🎬 Сценарий": "menu:script",
      "♻️ Переработка": "menu:repurpose",
      "📅 План": "menu:plan",
      "👤 Мой стиль": "menu:style",
      "🕘 История": "menu:history",
      "💎 Тарифы": "menu:pricing",
      "⭐ Credits": "menu:credits",
      "⚙️ Настройки": "menu:settings",
    };

    if (mapped[text]) {
      await deleteMessage(env, chatId, message.message_id).catch(() => {});
      await handleAction(env, user.id, chatId, mapped[text], null);
      return;
    }

    const session = await db.select().from(userSessions).where(eq(userSessions.userId, user.id)).get();
    if (session && (session.step === "topic" || session.step === "material")) {
      const draft = JSON.parse(session.draftJson ?? "{}");
      const uiMessageId = Number(draft.__uiMessageId ?? 0);

      if (session.flow === "post") {
        draft.topic = text.slice(0, Number(env.MAX_INPUT_CHARS ?? 12000));
        await updateFlowMessage(env, db, user.id, chatId, uiMessageId, "post", draft, renderPostConfig(draft), postConfig(draft));
        await deleteMessage(env, chatId, message.message_id).catch(() => {});
        return;
      }

      if (session.flow === "script") {
        draft.topic = text.slice(0, Number(env.MAX_INPUT_CHARS ?? 12000));
        await updateFlowMessage(env, db, user.id, chatId, uiMessageId, "script", draft, renderScriptConfig(draft), scriptConfig(draft));
        await deleteMessage(env, chatId, message.message_id).catch(() => {});
        return;
      }

      if (session.flow === "plan") {
        draft.topic = text.slice(0, Number(env.MAX_INPUT_CHARS ?? 12000));
        await updateFlowMessage(env, db, user.id, chatId, uiMessageId, "plan", draft, renderPlanConfig(draft), planConfig(draft));
        await deleteMessage(env, chatId, message.message_id).catch(() => {});
        return;
      }

      if (session.flow === "repurpose") {
        draft.material = text.slice(0, Number(env.MAX_INPUT_CHARS ?? 12000));
        await updateFlowMessage(
          env,
          db,
          user.id,
          chatId,
          uiMessageId,
          "repurpose",
          draft,
          "♻️ Repurpose\n\nМатериал получен ✅\n\nВыбери, что создать:",
          repurposeTargets(draft.targets ?? ["all"]),
        );
        await deleteMessage(env, chatId, message.message_id).catch(() => {});
        return;
      }
    }
  }

  if (!cb) return;
  await answerCallback(env, cb.id);
  await handleAction(env, user.id, chatId, String(cb.data ?? ""), cb.message);
}

async function handleAction(env: Bindings, userId: number, chatId: string, data: string, msg: any) {
  const db = createDb(env);

  if (data === "menu:post") {
    return openFeature(env, db, userId, chatId, msg, "post", defaults.post, prompts.post + "[ ← Назад ]", postConfig(defaults.post));
  }

  if (data === "menu:script") {
    return openFeature(env, db, userId, chatId, msg, "script", defaults.script, prompts.script + "[ ← Назад ]", scriptConfig(defaults.script));
  }

  if (data === "menu:plan") {
    return openFeature(env, db, userId, chatId, msg, "plan", defaults.plan, prompts.plan + "[ ← Назад ]", planConfig(defaults.plan));
  }

  if (data === "menu:repurpose") {
    return openFeature(env, db, userId, chatId, msg, "repurpose", defaults.repurpose, prompts.repurpose + "[ ← Назад ]", repurposeTargets(defaults.repurpose.targets));
  }

  if (data === "menu:pricing") {
    return openScreen(env, db, userId, chatId, msg, "💎 Тарифы Creator AI\n\nВыбери подходящий план.\n\n🆓 FREE\n10 credits / месяц\n\n⭐ CREATOR\n100 credits / месяц\n99 ⭐ / месяц\n\n🔥 PRO\n500 credits / месяц\n299 ⭐ / месяц", pricingKeyboard, "menu");
  }

  if (data === "menu:credits") {
    const u = await db.select().from(users).where(eq(users.id, userId)).get();
    return openScreen(env, db, userId, chatId, msg, "⭐ Credits\n\nБаланс: " + (u?.creditsBalance ?? 0) + "\n\n1 пост = 1 credit\n1 сценарий = 2 credits\nRepurpose = 3 credits\nПлан на 7 дней = 5 credits", pricingKeyboard, "menu");
  }

  if (data === "menu:history") return showHistory(env, userId, chatId, msg);

  if (data === "menu:style") {
    return openScreen(
      env,
      db,
      userId,
      chatId,
      msg,
      "👤 Мой стиль\n\nПрофиль голоса анализирует 5–20 прошлых постов.\n\nВ следующем MVP-шаге добавим загрузку примеров.",
      mainMenu,
      "menu",
    );
  }

  if (data === "menu:settings") {
    return openScreen(env, db, userId, chatId, msg, "⚙️ Настройки\n\nЯзык: русский\nУведомления: включены", mainMenu, "menu");
  }

  if (data === "menu:back") return openMainMenu(env, userId, chatId, false);

  const session = await db.select().from(userSessions).where(eq(userSessions.userId, userId)).get();
  const draft = session?.flow === "ui" ? null : session ? JSON.parse(session.draftJson ?? "{}") : null;

  if (data.startsWith("post:p:") || data.startsWith("post:s:") || data.startsWith("post:l:")) {
    if (!draft) return;
    if (data.startsWith("post:p:")) draft.platform = data.slice(7);
    if (data.startsWith("post:s:")) draft.style = data.slice(7);
    if (data.startsWith("post:l:")) draft.length = data.slice(7);
    const currentMessage = messageFromDraft(draft);
    if (!currentMessage) return;
    await saveFeatureSession(db, userId, "post", draft, currentMessage.message_id);
    return editMessageText(env, chatId, currentMessage.message_id, renderPostConfig(draft), postConfig(draft));
  }

  if (data.startsWith("script:p:") || data.startsWith("script:s:") || data.startsWith("script:d:")) {
    if (!draft) return;
    if (data.startsWith("script:p:")) draft.platform = data.slice(9);
    if (data.startsWith("script:s:")) draft.style = data.slice(9);
    if (data.startsWith("script:d:")) draft.duration = data.slice(9);
    const currentMessage = messageFromDraft(draft);
    if (!currentMessage) return;
    await saveFeatureSession(db, userId, "script", draft, currentMessage.message_id);
    return editMessageText(env, chatId, currentMessage.message_id, renderScriptConfig(draft), scriptConfig(draft));
  }

  if (data.startsWith("plan:g:") || data.startsWith("plan:p:") || data.startsWith("plan:s:")) {
    if (!draft) return;
    if (data.startsWith("plan:g:")) draft.goal = data.slice(7);
    if (data.startsWith("plan:p:")) draft.platform = data.slice(7);
    if (data.startsWith("plan:s:")) draft.style = data.slice(7);
    const currentMessage = messageFromDraft(draft);
    if (!currentMessage) return;
    await saveFeatureSession(db, userId, "plan", draft, currentMessage.message_id);
    return editMessageText(env, chatId, currentMessage.message_id, renderPlanConfig(draft), planConfig(draft));
  }

  if (data.startsWith("rep:target:")) {
    if (!draft || session?.flow !== "repurpose") return;
    const target = data.slice(11);
    draft.targets =
      target === "all"
        ? ["all"]
        : (draft.targets ?? []).filter((x: string) => x !== "all").includes(target)
          ? (draft.targets ?? []).filter((x: string) => x !== target)
          : (draft.targets ?? []).filter((x: string) => x !== "all").concat(target);
    const currentMessage = messageFromDraft(draft);
    if (!currentMessage) return;
    await saveFeatureSession(db, userId, "repurpose", draft, currentMessage.message_id);
    return editMessageText(env, chatId, currentMessage.message_id, "♻️ Repurpose\n\nМатериал получен ✅\n\nВыбери, что создать:", repurposeTargets(draft.targets));
  }

  if (data === "rep:create") {
    if (!draft || session?.flow !== "repurpose") return;
    const currentMessage = messageFromDraft(draft);
    if (!currentMessage) return;
    const items = repurposeItems(draft.targets ?? ["all"]);
    await saveFeatureSession(db, userId, "repurpose", draft, currentMessage.message_id);
    const confirmMarkup = repurposeConfirm();
    return editMessageText(
      env,
      chatId,
      currentMessage.message_id,
      "♻️ Repurpose\n\nБудет создано:\n\n" + items.join("\n") + "\n\nСтоимость:\n3 credits",
      confirmMarkup,
    );
  }

  if (data === "rep:confirm-create") return enqueue(env, userId, chatId, msg, costs.repurpose, "repurpose", draft);
  if (data === "rep:back-confirm") {
    if (!draft || session?.flow !== "repurpose") return;
    const currentMessage = messageFromDraft(draft);
    if (!currentMessage) return;
    return editMessageText(env, chatId, currentMessage.message_id, "♻️ Repurpose\n\nМатериал получен ✅\n\nВыбери, что создать:", repurposeTargets(draft.targets ?? ["all"]));
  }

  if (data === "post:create") return enqueue(env, userId, chatId, msg, costs.post, "post", draft);
  if (data === "script:create") return enqueue(env, userId, chatId, msg, costs.script, "script", draft);
  if (data === "plan:create") return enqueue(env, userId, chatId, msg, costs.plan, "content_plan", draft);

  if (data === "post:back" || data === "script:back" || data === "plan:back" || data === "rep:back") {
    return openMainMenu(env, userId, chatId, false);
  }

  if (data.startsWith("post:back-result:")) return openMainMenu(env, userId, chatId, true);
  if (data.startsWith("rep:back-result:")) return openMainMenu(env, userId, chatId, true);
  if (data.startsWith("script:back-result:") || data.startsWith("plan:back-result:")) return openMainMenu(env, userId, chatId, true);

  if (data.startsWith("post:regen:") || data.startsWith("post:hook:") || data.startsWith("post:shorten:")) {
    return postAction(env, userId, chatId, msg, data);
  }

  if (data.startsWith("script:regen:") || data.startsWith("script:hook:") || data.startsWith("script:shorten:")) {
    return scriptAction(env, userId, chatId, data);
  }

  if (data.startsWith("post:script:")) {
    const id = Number(data.split(":")[2]);
    const source = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, userId))).get();
    if (!source) return;
    const original = JSON.parse(source.outputJson ?? "{}");
    const next = { topic: String(original.title) + "\n\n" + String(original.body), platform: "youtube", style: "dynamic", duration: "30" };
    return openFeature(
      env,
      db,
      userId,
      chatId,
      null,
      "script",
      next,
      renderScriptConfig(next),
      scriptConfig(next),
    );
  }

  if (data.startsWith("rep:view:")) return viewRepurpose(env, userId, chatId, msg, data);
  if (data.startsWith("rep:view-summary:")) {
    const id = Number(data.split(":")[2]);
    return viewHistory(env, userId, chatId, msg, id);
  }

  if (data.startsWith("plan:item:")) return viewPlanItem(env, userId, chatId, msg, data);
  if (data.startsWith("plan:create-item:")) return createPlanItem(env, userId, chatId, msg, data);
  if (data.startsWith("history:view:")) return viewHistory(env, userId, chatId, msg, Number(data.split(":")[2]));
  if (data.startsWith("buy:")) return buy(env, userId, chatId, data);
}

async function openMainMenu(env: Bindings, userId: number, chatId: string, preserveResult: boolean) {
  const db = createDb(env);
  const state = await getUiState(db, userId);

  if (state && ((preserveResult && state.kind === "result") || state.kind === "processing")) {
    const sent = await sendMessage(env, chatId, mainMenuText, mainMenu);
    await setUiState(db, userId, "menu", sent.message_id);
    if (!state) await sendMessage(env, chatId, "\u2063", persistentMenu);
    return sent;
  }

  if (state?.messageId) {
    try {
      const edited = await editMessageText(env, chatId, state.messageId, mainMenuText, mainMenu);
      await setUiState(db, userId, "menu", edited.message_id);
      return edited;
    } catch {}
  }

  const sent = await sendMessage(env, chatId, mainMenuText, mainMenu);
  await setUiState(db, userId, "menu", sent.message_id);
  await sendMessage(env, chatId, "\u2063", persistentMenu);
  return sent;
}

async function openFeature(
  env: Bindings,
  db: any,
  userId: number,
  chatId: string,
  msg: any,
  flow: FeatureFlow,
  draft: any,
  text: string,
  markup: unknown,
) {
  const sent = await openScreen(env, db, userId, chatId, msg, text, markup, "flow");
  await saveFeatureSession(db, userId, flow, draft, sent.message_id);
  return sent;
}

async function openScreen(
  env: Bindings,
  db: any,
  userId: number,
  chatId: string,
  msg: any,
  text: string,
  markup: unknown,
  kind: UiKind,
) {
  if (msg?.message_id) return editAndKeepState(env, db, userId, chatId, msg.message_id, text, markup, kind);

  const state = await getUiState(db, userId);
  if (state && state.kind !== "result" && state.kind !== "processing" && state.messageId) {
    try {
      return await editAndKeepState(env, db, userId, chatId, state.messageId, text, markup, kind);
    } catch {}
  }

  const sent = await sendMessage(env, chatId, text, markup);
  await setUiState(db, userId, kind, sent.message_id);
  return sent;
}

async function editAndKeepState(
  env: Bindings,
  db: any,
  userId: number,
  chatId: string,
  messageId: number,
  text: string,
  markup: unknown,
  kind: UiKind,
) {
  const edited = await editMessageText(env, chatId, messageId, text, markup);
  await setUiState(db, userId, kind, edited.message_id);
  return edited;
}

async function updateFlowMessage(
  env: Bindings,
  db: any,
  userId: number,
  chatId: string,
  messageId: number,
  flow: FeatureFlow,
  draft: any,
  text: string,
  markup: unknown,
) {
  let sent: TelegramMessage;
  if (messageId) {
    try {
      sent = await editMessageText(env, chatId, messageId, text, markup);
    } catch {
      sent = await sendMessage(env, chatId, text, markup);
    }
  } else {
    sent = await sendMessage(env, chatId, text, markup);
  }
  await saveFeatureSession(db, userId, flow, draft, sent.message_id);
  return sent;
}

async function saveFeatureSession(db: any, userId: number, flow: FeatureFlow, draft: any, messageId: number) {
  const next = { ...draft, __uiMessageId: messageId, __uiKind: "flow" };
  await db
    .insert(userSessions)
    .values({ userId, flow, step: draft.topic || draft.material ? "config" : flow === "repurpose" ? "material" : "topic", draftJson: JSON.stringify(next), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userSessions.userId,
      set: { flow, step: draft.topic || draft.material ? "config" : flow === "repurpose" ? "material" : "topic", draftJson: JSON.stringify(next), updatedAt: new Date() },
    });
}

async function setUiState(db: any, userId: number, kind: UiKind, messageId: number, extra: Record<string, unknown> = {}) {
  const state = { kind, messageId, ...extra };
  await db
    .insert(userSessions)
    .values({ userId, flow: "ui", step: kind, draftJson: JSON.stringify(state), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userSessions.userId,
      set: { flow: "ui", step: kind, draftJson: JSON.stringify(state), updatedAt: new Date() },
    });
}

async function getUiState(db: any, userId: number): Promise<{ kind: UiKind; messageId: number } | null> {
  const row = await db.select().from(userSessions).where(eq(userSessions.userId, userId)).get();
  if (!row || row.flow !== "ui") return null;
  const state = JSON.parse(row.draftJson ?? "{}");
  if (!state.messageId || !state.kind) return null;
  return state;
}

function messageFromDraft(draft: any): TelegramMessage | null {
  const messageId = Number(draft.__uiMessageId ?? 0);
  return messageId ? { message_id: messageId, chat: { id: 0 } } : null;
}

function stripUi(input: any) {
  if (!input || typeof input !== "object") return input;
  const clone = { ...input };
  for (const key of uiKeys) delete clone[key];
  return clone;
}

async function enqueue(env: Bindings, userId: number, chatId: string, msg: any, cost: number, type: string, input: any) {
  const cleanInput = stripUi(input);
  if (!cleanInput || (type === "repurpose" ? !cleanInput.material : !cleanInput.topic)) return;

  const db = createDb(env);
  const sent =
    msg?.message_id
      ? await editMessageText(env, chatId, msg.message_id, processingText(type, cleanInput))
      : await sendMessage(env, chatId, processingText(type, cleanInput));

  const inserted = await db
    .insert(jobs)
    .values({
      userId,
      type,
      status: "queued",
      inputJson: JSON.stringify(cleanInput),
      creditsReserved: 0,
      telegramChatId: chatId,
      telegramMessageId: sent.message_id,
      createdAt: new Date(),
    })
    .returning({ id: jobs.id })
    .get();

  if (!(await reserveCredits(env, userId, cost, inserted.id))) {
    await db.delete(jobs).where(eq(jobs.id, inserted.id));
    await editMessageText(env, chatId, sent.message_id, "💳 Недостаточно credits.\n\nОткрой тарифы, чтобы продолжить.", pricingKeyboard);
    await setUiState(db, userId, "menu", sent.message_id);
    return;
  }

  await db.update(jobs).set({ creditsReserved: cost }).where(eq(jobs.id, inserted.id));
  await setUiState(db, userId, "processing", sent.message_id, { jobId: inserted.id });

  try {
    await env.AI_QUEUE.send({ jobId: inserted.id });
    return;
  } catch (error) {
    await refundCredits(env, userId, cost, inserted.id);
    await db
      .update(jobs)
      .set({
        status: "failed",
        creditsReserved: 0,
        errorMessage: error instanceof Error ? error.message : "queue_send_failed",
        completedAt: new Date(),
      })
      .where(eq(jobs.id, inserted.id));
    await editMessageText(env, chatId, sent.message_id, "❌ Не удалось поставить задачу в очередь.\n\nCredits возвращены.", mainMenu);
    await setUiState(db, userId, "menu", sent.message_id);
  }
}

function processingText(type: string, input: any) {
  if (type === "post") return "⏳ Создаю пост...\n\n" + platformLabel(input.platform) + "\n· " + styleLabel(input.style) + "\n· " + lengthLabel(input.length);
  if (type === "script") return "⏳ Создаю сценарий...\n\n" + platformLabel(input.platform) + "\n· " + scriptStyleLabel(input.style) + "\n· " + input.duration + " сек";
  if (type === "content_plan") return "⏳ Создаю контент-план...\n\n" + platformLabel(input.platform) + "\n· " + planStyleLabel(input.style);
  return "⏳ Перерабатываю материал...\n\n· 3 credits";
}

async function postAction(env: Bindings, userId: number, chatId: string, _msg: any, data: string) {
  const id = Number(data.split(":")[2]);
  const action = data.split(":")[1];
  const db = createDb(env);
  const source = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, userId))).get();
  if (!source?.outputJson) return;
  const o = JSON.parse(source.outputJson);
  let topic = String(o.body ?? "");
  if (action === "hook") topic = "Rewrite this post with a much stronger hook. Existing post:\n" + topic;
  if (action === "shorten") topic = "Shorten this post while preserving its main idea and CTA. Existing post:\n" + topic;
  if (action === "regen") {
    const original = JSON.parse(source.inputJson ?? "{}");
    topic = original.topic ?? topic;
  }
  const input = { topic, platform: o.platform ?? "telegram", style: o.style ?? "conversational", length: action === "shorten" ? "short" : o.length ?? "short" };
  return enqueue(env, userId, chatId, null, 1, "post", input);
}

async function scriptAction(env: Bindings, userId: number, chatId: string, data: string) {
  const id = Number(data.split(":")[2]);
  const action = data.split(":")[1];
  const db = createDb(env);
  const source = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, userId))).get();
  if (!source?.outputJson) return;
  const o = JSON.parse(source.outputJson);
  let topic = String(o.title ?? "");
  if (action === "hook") topic = "Create a much stronger hook for this script while preserving the topic and structure:\n" + JSON.stringify(o);
  if (action === "shorten") topic = "Shorten this script while preserving the key points and CTA:\n" + JSON.stringify(o);
  if (action === "regen") {
    const original = JSON.parse(source.inputJson ?? "{}");
    topic = original.topic ?? topic;
  }
  return enqueue(
    env,
    userId,
    chatId,
    null,
    2,
    "script",
    { topic, platform: o.platform ?? "tiktok", style: o.style ?? "dynamic", duration: o.duration ?? "30" },
  );
}

async function showHistory(env: Bindings, userId: number, chatId: string, msg: any) {
  const db = createDb(env);
  const rows = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.userId, userId), eq(jobs.status, "completed")))
    .orderBy(desc(jobs.createdAt))
    .limit(10);

  const buttons = rows.map((j) => [b(historyLabel(j), `history:view:${j.id}`)]);
  buttons.push([b("← Назад", "menu:back")]);

  const sent = await openScreen(
    env,
    db,
    userId,
    chatId,
    msg,
    rows.length ? "🕘 История\n\nСегодня" : "🕘 История\n\nСегодня\n\nПока ничего нет.",
    { inline_keyboard: buttons },
    "menu",
  );
  return sent;
}

async function viewHistory(env: Bindings, userId: number, chatId: string, msg: any, id: number) {
  const db = createDb(env);
  const job = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, userId))).get();
  if (!job?.outputJson) return;

  const o = JSON.parse(job.outputJson);
  const text =
    job.type === "post"
      ? formatPost(o)
      : job.type === "script"
        ? formatScript(o)
        : job.type === "content_plan"
          ? formatPlan(o)
          : "♻️ Repurpose\n\nРезультат сохранён. Открой его из истории по нужному разделу.";

  const markup =
    job.type === "repurpose"
      ? repurposeResult(id)
      : job.type === "post"
        ? postResult(id, String(o.title ?? "") + "\n\n" + String(o.body ?? ""))
        : job.type === "script"
          ? scriptResult(id, formatScript(o))
          : job.type === "content_plan"
            ? planResult(id, o.days ?? [])
            : mainMenu;

  return openResultScreen(env, db, userId, chatId, msg, text, markup, id);
}

async function viewPlanItem(env: Bindings, userId: number, chatId: string, msg: any, data: string) {
  const [, , id, index] = data.split(":");
  const db = createDb(env);
  const job = await db.select().from(jobs).where(and(eq(jobs.id, Number(id)), eq(jobs.userId, userId))).get();
  if (!job?.outputJson) return;
  const o = JSON.parse(job.outputJson);
  const d = o.days?.[Number(index)];
  if (!d) return;

  const sent = await openResultScreen(
    env,
    db,
    userId,
    chatId,
    msg,
    "📅 " + d.day + "\n\n📝 " + d.title + "\n\n" + d.platform + " · " + d.format + "\n\n🔥 " + d.hook,
    { inline_keyboard: [[b("✨ Создать", "plan:create-item:" + id + ":" + index)], [b("← К плану", "history:view:" + id)]] },
    Number(id),
  );
  return sent;
}

async function createPlanItem(env: Bindings, userId: number, chatId: string, _msg: any, data: string) {
  const [, , id, index] = data.split(":");
  const db = createDb(env);
  const source = await db.select().from(jobs).where(and(eq(jobs.id, Number(id)), eq(jobs.userId, userId))).get();
  if (!source?.outputJson) return;

  const o = JSON.parse(source.outputJson);
  const d = o.days?.[Number(index)];
  if (!d) return;

  const type = String(d.format).toLowerCase().includes("short") || String(d.platform).toLowerCase().includes("tiktok") || String(d.platform).toLowerCase().includes("youtube") ? "script" : "post";
  const cost = type === "script" ? 2 : 1;
  const input =
    type === "script"
      ? {
          topic: d.title,
          platform: String(d.platform).toLowerCase().includes("instagram") ? "instagram" : String(d.platform).toLowerCase().includes("tiktok") ? "tiktok" : "youtube",
          style: "dynamic",
          duration: "30",
        }
      : {
          topic: d.title,
          platform: String(d.platform).toLowerCase().includes("instagram") ? "instagram" : "telegram",
          style: "conversational",
          length: "short",
        };

  return enqueue(env, userId, chatId, null, cost, type, input);
}

async function viewRepurpose(env: Bindings, userId: number, chatId: string, _msg: any, data: string) {
  const [, , id, key] = data.split(":");
  const db = createDb(env);
  const job = await db.select().from(jobs).where(and(eq(jobs.id, Number(id)), eq(jobs.userId, userId))).get();
  if (!job?.outputJson) return;

  const o = JSON.parse(job.outputJson);
  const value =
    key === "hooks"
      ? (o.hooks ?? []).map((x: string, i: number) => i + 1 + ". " + x).join("\n")
      : key === "plan"
        ? (o.plan ?? []).map((x: any) => x.day + " — " + x.title + " · " + x.format).join("\n")
        : o[key] ?? "";

  const sent = await sendMessage(env, chatId, "♻️ " + key + "\n\n" + String(value).slice(0, 3800), {
    inline_keyboard: [[b("← Назад", "rep:view-summary:" + id)]],
  });
  await setUiState(db, userId, "result", sent.message_id, { jobId: id });
  return sent;
}

async function buy(env: Bindings, userId: number, chatId: string, data: string) {
  const plans: any = {
    creator: { stars: 99, credits: 100, days: 30, title: "Creator" },
    pro: { stars: 299, credits: 500, days: 30, title: "Pro" },
    credits: { stars: 49, credits: 50, days: 0, title: "50 Credits" },
  };
  const plan = plans[data.slice(4)];
  if (!plan) return;

  const payload = "creatorai:" + userId + ":" + data.slice(4) + ":" + Date.now();
  const db = createDb(env);
  await db.insert(payments).values({
    userId,
    provider: "telegram_stars",
    kind: data.slice(4) === "credits" ? "credits" : "subscription",
    invoicePayload: payload,
    currency: "XTR",
    starsAmount: plan.stars,
    status: "pending",
    createdAt: new Date(),
  });
  await sendInvoice(env, chatId, plan.title, plan.credits + " credits" + (plan.days ? " for " + plan.days + " days" : ""), payload, plan.stars);
}

async function completePayment(env: Bindings, userId: number, payment: any) {
  const db = createDb(env);
  const row = await db.select().from(payments).where(eq(payments.invoicePayload, String(payment.invoice_payload))).get();
  if (!row || row.status === "paid") return;

  await db
    .update(payments)
    .set({ status: "paid", telegramPaymentChargeId: payment.telegram_payment_charge_id })
    .where(eq(payments.id, row.id));

  const key = String(row.invoicePayload).split(":")[2];
  const now = new Date();
  const grants: any = {
    creator: { plan: "creator", credits: 100, days: 30 },
    pro: { plan: "pro", credits: 500, days: 30 },
    credits: { plan: null, credits: 50, days: 0 },
  };
  const grant = grants[key];
  if (!grant) return;

  const u = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!u) return;

  const balance = u.creditsBalance + grant.credits;
  await db.update(users).set({
    plan: grant.plan ?? u.plan,
    creditsBalance: balance,
    creditsResetAt: grant.days ? new Date(now.getTime() + grant.days * 86400000) : u.creditsResetAt,
    updatedAt: now,
  }).where(eq(users.id, userId));

  await db.insert(creditLedger).values({
    userId,
    delta: grant.credits,
    balanceAfter: balance,
    reason: key === "credits" ? "stars_credits" : "subscription_grant",
    paymentId: row.id,
    createdAt: now,
  });

  if (grant.days) {
    await db.insert(subscriptions).values({
      userId,
      plan: grant.plan,
      provider: "telegram_stars",
      starsAmount: row.starsAmount,
      status: "active",
      currentPeriodStart: now,
      expiresAt: new Date(now.getTime() + grant.days * 86400000),
      telegramPaymentChargeId: payment.telegram_payment_charge_id,
      invoicePayload: row.invoicePayload,
      isRecurring: false,
      createdAt: now,
      updatedAt: now,
    });
  }
}

async function openResultScreen(
  env: Bindings,
  db: any,
  userId: number,
  chatId: string,
  msg: any,
  text: string,
  markup: unknown,
  jobId: number,
) {
  let sent: TelegramMessage;
  if (msg?.message_id) {
    sent = await editMessageText(env, chatId, msg.message_id, text, markup);
  } else {
    sent = await sendMessage(env, chatId, text, markup);
  }
  await setUiState(db, userId, "result", sent.message_id, { jobId });
  return sent;
}

function repurposeItems(targets: string[]) {
  const order: Record<string, string> = {
    telegram: "📱 Telegram-пост",
    instagram: "📸 Instagram caption",
    tiktok: "🎵 TikTok script",
    youtube: "▶️ YouTube Shorts script",
    hooks: "🔥 5 Hooks",
    cta: "🎯 CTA",
    plan: "📅 Контент на 7 дней",
  };
  const keys = targets.includes("all") ? Object.keys(order) : targets;
  return keys.filter((key) => order[key]).map((key) => order[key]);
}

function renderPostConfig(d: any) {
  return (
    "📝 Post Maker\n\n" +
    "Тема:\n" +
    d.topic +
    "\n\n" +
    "📱 Площадка\n\n" +
    "✍️ Стиль\n\n" +
    "📏 Длина"
  );
}

function renderScriptConfig(d: any) {
  return (
    "🎬 Script Maker\n\n" +
    "Тема:\n" +
    d.topic +
    "\n\n" +
    "📱 Площадка\n\n" +
    "✍️ Стиль\n\n" +
    "⏱ Длительность"
  );
}

function renderPlanConfig(d: any) {
  return (
    "📅 Content Plan\n\n" +
    "Тема:\n" +
    d.topic +
    "\n\n" +
    "🎯 Цель\n\n" +
    "📱 Площадка\n\n" +
    "✍️ Стиль"
  );
}

function formatPost(o: any) {
  return ("📝 Готово ✅\n\n" + o.title + "\n\n" + o.body + "\n\n────────────\n\n📱 " + o.platform + "\n😎 " + o.style + "\n⚡ " + o.length).slice(0, 4000);
}

function formatScript(o: any) {
  return (
    "🎬 Сценарий готов ✅\n\n" +
    o.title +
    "\n\n🔥 Hook:\n" +
    o.hook +
    "\n\n" +
    "⏱ " +
    o.duration +
    "\n\n" +
    o.scenes.map((s: any) => "[ " + s.time + " ]\n🗣 " + s.spoken + "\n🎥 " + s.visual + "\n📝 " + s.onScreen).join("\n\n") +
    "\n\n🎯 CTA:\n" +
    o.cta +
    "\n\n📱 " +
    o.platform +
    " · " +
    o.style
  );
}

function formatPlan(o: any) {
  return (
    "📅 План готов ✅\n\n" +
    o.topic +
    "\n\n" +
    o.days.map((d: any) => d.day + "\n📝 " + d.title + "\n" + d.platform + " · " + d.format + "\n🔥 " + d.hook).join("\n\n")
  );
}

function historyLabel(j: any) {
  const input = JSON.parse(j.inputJson ?? "{}");
  const icon = j.type === "post" ? "📝" : j.type === "script" ? "🎬" : j.type === "repurpose" ? "♻️" : "📅";
  return icon + " " + String(input.topic ?? input.material ?? "Результат").slice(0, 42) + " · " + j.creditsCharged + " credits";
}

function platformLabel(platform: string) {
  return ({ telegram: "Telegram", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube" } as any)[platform] ?? platform;
}

function styleLabel(style: string) {
  return ({ expert: "Экспертный", provocative: "Провокационный", conversational: "Разговорный", news: "Новостной", sales: "Продающий" } as any)[style] ?? style;
}

function scriptStyleLabel(style: string) {
  return ({ dynamic: "Динамичный", expert: "Экспертный", conversational: "Разговорный", sales: "Продающий" } as any)[style] ?? style;
}

function planStyleLabel(style: string) {
  return ({ expert: "Экспертный", conversational: "Разговорный", dynamic: "Динамичный", sales: "Продающий" } as any)[style] ?? style;
}

function lengthLabel(length: string) {
  return ({ short: "Короткий формат", medium: "Средний формат", long: "Длинный формат" } as any)[length] ?? length;
}

function b(text: string, data: string) {
  return { text, callback_data: data };
}
