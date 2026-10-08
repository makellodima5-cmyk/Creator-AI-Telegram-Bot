import{describe,it,expect}from"vitest";
import{readFileSync}from"node:fs";
import{mainMenu,postConfig,scriptConfig,planConfig,repurposeTargets,postResult,historyItem,settingsKeyboard,tariffsKeyboard,creditsKeyboard,styleKeyboard}from"../src/telegram/keyboards";
import{copyFor}from"../src/text";
import{validateOutput}from"../src/ai/validator";
import{plainResult}from"../src/jobs/runner";

const clean=(v:string)=>v.replace(/^✅\s/,"");
const flat=(rows:any[][])=>rows.map(r=>r.map((x:any)=>clean(String(x.text))));

describe("Final T3 UX contract",()=>{
 it("has exactly the six /start buttons in exactly three rows",()=>{
  expect(mainMenu.inline_keyboard).toHaveLength(3);
  expect(flat(mainMenu.inline_keyboard)).toEqual([
   ["📝 Post","🎬 Script"],
   ["♻️ Repurpose","📅 Content Plan"],
   ["💎 Tariffs","🔹 Credits"]
  ]);
 });
 it("uses direct Post parameter choices in three compact rows",()=>{
  const kb=postConfig({topic:"x",platform:"",style:"",length:""},"ru");
  expect(kb.inline_keyboard).toHaveLength(3);
  expect(flat(kb.inline_keyboard)[0]).toEqual(["Telegram","Instagram","TikTok","YouTube"]);
  expect(flat(kb.inline_keyboard)[1]).toEqual(["Экспертный","Разговорный","Новостной","Продающий"]);
  expect(flat(kb.inline_keyboard)[2]).toEqual(["Короткий","Средний","Длинный","🚀 Создать пост","↩️ В меню"]);
 });
 it("uses direct Script parameter choices in three compact rows",()=>{
  const kb=scriptConfig({topic:"x",platform:"",style:"",duration:""},"ru");
  expect(kb.inline_keyboard).toHaveLength(3);
  expect(flat(kb.inline_keyboard)[0]).toEqual(["TikTok","Reels","YouTube Shorts"]);
  expect(flat(kb.inline_keyboard)[1]).toEqual(["Экспертная","Разговорная","Динамичная","Продающая"]);
  expect(flat(kb.inline_keyboard)[2]).toEqual(["15 сек","30 сек","45 сек","60 сек","🚀 Создать сценарий","↩️ В меню"]);
 });
 it("uses direct Content Plan parameter choices in three compact rows",()=>{
  const kb=planConfig({topic:"x",goal:"",platform:"",style:""},"ru");
  expect(kb.inline_keyboard).toHaveLength(3);
  expect(flat(kb.inline_keyboard)[0]).toEqual(["Рост","Продажи","Вовлечение","Экспертность"]);
  expect(flat(kb.inline_keyboard)[1]).toEqual(["Telegram","Instagram","TikTok","YouTube"]);
  expect(flat(kb.inline_keyboard)[2]).toEqual(["Экспертный","Разговорный","Новостной","Продающий","🚀 Создать план","↩️ В меню"]);
 });
 it("uses the Final T3 Repurpose compact three-row target layout",()=>{
  const kb=repurposeTargets([],"ru");
  expect(kb.inline_keyboard).toHaveLength(3);
  expect(flat(kb.inline_keyboard)).toEqual([
   ["📝 Telegram-пост","📸 Instagram caption","🎬 TikTok-сценарий"],
   ["▶️ YouTube Shorts","🔥 5 Hook","🎯 CTA"],
   ["📅 Контент на неделю","🚀 Создать контент","↩️ В меню"]
  ]);
 });
 it("uses the common four result actions and History item actions",()=>{
  expect(flat(postResult(1,"ru").inline_keyboard)).toEqual([
   ["📋 Скопировать","✏️ Изменить"],
   ["🔄 Другой вариант","⭐ Сохранить в историю"]
  ]);
  expect(flat(historyItem(1,"ru").inline_keyboard)).toEqual([
   ["▶️ Продолжить"],
   ["📋 Скопировать","🗑 Удалить из истории"],
   ["↩️ Назад к истории"]
  ]);
 });
 it("uses exact Settings, Tariffs, Credits and My Style button structures",()=>{
  expect(flat(settingsKeyboard("ru").inline_keyboard)).toEqual([
   ["👤 Аккаунт","🌐 Язык"],
   ["🔔 Уведомления","💬 Помощь"],
   ["⚖️ Условия использования","🛡️ Конфиденциальность"],
   ["↩️ В меню"]
  ]);
  expect(flat(tariffsKeyboard("ru").inline_keyboard)).toEqual([["⚡ CREATOR","🚀 PRO"],["↩️ В меню"]]);
  expect(flat(creditsKeyboard([50,100,250,500],"ru").inline_keyboard)).toEqual([["50 🔹","100 🔹"],["250 🔹","500 🔹"],["↩️ Назад"]]);
  expect(flat(styleKeyboard(5,"ru").inline_keyboard)).toEqual([["➕ Добавить пример","✨ Проанализировать стиль"],["↩️ В меню"]]);
 });
 it("contains exact Final T3 copy for core screens",()=>{
  const t=copyFor("ru");
  expect(t.start("Алекс")).toBe("🤖 Привет, Алекс!\\n\\nCreator AI превращает идеи и готовые материалы в контент:\\n\\n✦ Посты и сценарии\\n✦ Repurpose и контент-планы\\n✦ Адаптация под разные площадки\\n✦ Твой стиль\\n\\n⚡ Меньше времени. Больше контента.\\n\\nЧто создаём сегодня? 👇");
  expect(t.postEntry).toBe("✦ Creator AI / Post Maker\\n\\nПревратим твою идею в сильный пост.\\n\\nНапиши тему или набросок.\\n\\nЯ помогу:\\n— Hook\\n— структура\\n— главная мысль\\n— адаптация под площадку\\n\\nНачни с идеи — остальное сделаем вместе.");
  expect(t.scriptEntry).toBe("✦ Creator AI / Script Maker\\n\\nПревратим твою идею в ролик, который хочется досмотреть.\\n\\nНапиши тему или набросок.\\n\\nЯ помогу:\\n— Hook\\n— структура\\n— текст диктора\\n— визуал\\n— текст на экране\\n— CTA\\n\\nНачни с идеи — остальное сделаем вместе.");
  expect(t.repEntry).toBe("✦ Creator AI / Repurpose\\n\\nПревратим твой готовый материал в контент для разных площадок.\\n\\nОтправь один материал:\\n\\n📝 Текст — одним сообщением, до 4 000 символов\\n\\n📄 Документ — PDF, DOC или TXT, до 5 MB и до 20 000 символов текста после обработки\\n\\nОдин материал. Несколько форматов. Больше контента.");
  expect(t.planEntry).toBe("✦ Creator AI / Content Plan\\n\\nСоздадим контент-план на 7 дней, чтобы тебе не приходилось каждый день думать, что публиковать.\\n\\nНапиши свою тему, нишу или цель — например, что хочешь продвигать или о чём рассказывать.\\n\\n7 дней. 7 идей. Один понятный план действий.");
  expect(t.settings).toBe("⚙️ Creator AI / Настройки\\n\\nЗдесь можно изменить основные параметры Creator AI.");
 });
 it("rejects invalid Instagram structures and accepts the T3 structure",()=>{
  expect(validateOutput("repurpose_instagram",{title:"wrong",body:"x",hook:"h",cta:"c",hashtags:[]})).toEqual({ok:true});
  expect(validateOutput("repurpose_instagram",{title:"wrong",body:"",hook:"h",cta:"c",hashtags:[]})).toEqual({ok:false,reason:"bad_instagram"});
 });
 it("produces clean Instagram copy text without UI wrapper",()=>{
  expect(plainResult("repurpose_instagram",{hook:"Hook",body:"Caption",cta:"Read more",hashtags:["#ai"]},"ru")).toBe("Hook\\n\\nCaption\\n\\n🎯 CTA\\n\\nRead more\\n\\n#ai");
 });
 it("contains no Reply Keyboard implementation and uses the Telegram Bot Menu button",()=>{
  const files=["src/telegram/api.ts","src/telegram/keyboards.ts","src/telegram/webhook.ts","src/text.ts"];
  for(const f of files){
   const s=readFileSync(f,"utf8");
   expect(s).not.toMatch(/ReplyKeyboardMarkup|KeyboardButton|resize_keyboard|persistentMenu/);
  }
  expect(readFileSync("src/telegram/api.ts","utf8")).toContain('menu_button:{type:"commands"}');
  expect(readFileSync("src/telegram/webhook.ts","utf8")).toContain("setChatMenuButton");
  expect(readFileSync("src/telegram/webhook.ts","utf8")).toContain("setMyCommands");
 });
});
