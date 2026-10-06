export const mainMenu = { inline_keyboard: [
  [{ text:"📝 Пост", callback_data:"menu:post" }, { text:"🎬 Сценарий", callback_data:"menu:script" }],
  [{ text:"♻️ Переработка", callback_data:"menu:repurpose" }, { text:"📅 План", callback_data:"menu:plan" }],
  [{ text:"👤 Мой стиль", callback_data:"menu:style" }, { text:"🕘 История", callback_data:"menu:history" }],
  [{ text:"💎 Тарифы", callback_data:"menu:pricing" }, { text:"⭐ Credits", callback_data:"menu:credits" }],
  [{ text:"⚙️ Настройки", callback_data:"menu:settings" }],
] };

const b = (text:string, data:string) => ({ text, callback_data:data });
export const postConfig = (draft:{platform:string;style:string;length:string}) => ({ inline_keyboard: [
  [b(draft.platform==="telegram"?"✅ Telegram":"Telegram","post:p:telegram"), b(draft.platform==="instagram"?"✅ Instagram":"Instagram","post:p:instagram")],
  [b(draft.platform==="tiktok"?"✅ TikTok":"TikTok","post:p:tiktok"), b(draft.platform==="youtube"?"✅ YouTube":"YouTube","post:p:youtube")],
  [b(draft.style==="expert"?"✅ Экспертный":"Экспертный","post:s:expert"), b(draft.style==="provocative"?"✅ Провокационный":"Провокационный","post:s:provocative")],
  [b(draft.style==="conversational"?"✅ Разговорный":"Разговорный","post:s:conversational"), b(draft.style==="news"?"✅ Новостной":"Новостной","post:s:news")],
  [b(draft.style==="sales"?"✅ Продающий":"Продающий","post:s:sales")],
  [b(draft.length==="short"?"✅ Короткая":"Короткая","post:l:short"), b(draft.length==="medium"?"✅ Средняя":"Средняя","post:l:medium"), b(draft.length==="long"?"✅ Длинная":"Длинная","post:l:long")],
  [b("🚀 Создать","post:create")],
  [b("← Назад","post:back")],
] });

export const postResult = (jobId:number) => ({ inline_keyboard: [
  [b("🔄 Ещё вариант",`post:regen:${jobId}`), b("🔥 Усилить Hook",`post:hook:${jobId}`), b("✂️ Сократить",`post:shorten:${jobId}`)],
  [b("🎬 Сделать сценарий",`post:script:${jobId}`), b("📋 Копировать",`post:copy:${jobId}`)],
  [b("← Назад",`post:back-result:${jobId}`)],
] });
