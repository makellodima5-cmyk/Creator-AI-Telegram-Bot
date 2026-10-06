type TelegramResponse<T> = { ok: true; result: T } | { ok: false; description: string; error_code: number };

export type TelegramMessage = { message_id: number; chat: { id: number }; text?: string };

export async function telegram<T>(env: { TELEGRAM_BOT_TOKEN: string }, method: string, body: unknown): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const data = (await res.json()) as TelegramResponse<T>;
  if (!res.ok || !data.ok) throw new Error("Telegram API error: " + ("description" in data ? data.description : res.status));
  return data.result;
}

export const sendMessage = (env: { TELEGRAM_BOT_TOKEN: string }, chatId: string | number, text: string, replyMarkup?: unknown) =>
  telegram<TelegramMessage>(env, "sendMessage", { chat_id: chatId, text, reply_markup: replyMarkup });

export const editMessageText = (env: { TELEGRAM_BOT_TOKEN: string }, chatId: string | number, messageId: number, text: string, replyMarkup?: unknown) =>
  telegram<TelegramMessage>(env, "editMessageText", { chat_id: chatId, message_id: messageId, text, reply_markup: replyMarkup });

export const deleteMessage = (env: { TELEGRAM_BOT_TOKEN: string }, chatId: string | number, messageId: number) =>
  telegram<boolean>(env, "deleteMessage", { chat_id: chatId, message_id: messageId });

export const answerCallback = (env: { TELEGRAM_BOT_TOKEN: string }, callbackQueryId: string) =>
  telegram<boolean>(env, "answerCallbackQuery", { callback_query_id: callbackQueryId });
