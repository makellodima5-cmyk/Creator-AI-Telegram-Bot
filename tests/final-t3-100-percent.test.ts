import{describe,it,expect}from"vitest";
import{readFileSync}from"node:fs";
import{mainMenu,postConfig,scriptConfig,planConfig,repurposeTargets,postResult,historyItem,settingsKeyboard,tariffsKeyboard,creditsKeyboard,styleKeyboard}from"../src/telegram/keyboards";
import{copyFor}from"../src/text";
import{validateOutput}from"../src/ai/validator";
import{plainResult}from"../src/jobs/runner";

const flat=(rows:any[][])=>rows.map(r=>r.map((x:any)=>String(x.text).replace(/^✅\s/,"")));

describe("Final T3 UX contract",()=>{
 it("has exactly the six /start buttons in exactly three rows",()=>{
  expect(mainMenu.inline_keyboard).toEqual([
   [{text:"📝 Post",callback_data:"menu:post"},{text:"🎬 Script",callback_data:"menu:script"}],
   [{text:"♻️ Repurpose",callback_data:"menu:repurpose"},{text:"📅 Content Plan",callback_data:"menu:plan"}],
   [{text:"💎 Tariffs",callback_data:"menu:pricing"},{text:"🔹 Credits",callback_data:"menu:credits"}]
  ]);
 });
 it("uses direct Post parameter choices in three compact rows",()=>{
  const kb=postConfig({platform:"",style:"",length:""},"ru");expect(flat(kb.inline_keyboard)).toEqual([
   ["Telegram","Instagram","TikTok","YouTube"],["Экспертный","Разговорный","Новостной","Продающий"],["Короткий","Средний","Длинный","🚀 Создать пост","↩️ В меню"]
  ]);
 });
 it("uses direct Script parameter choices in three compact rows",()=>{
  const kb=scriptConfig({platform:"",style:"",duration:""},"ru");expect(flat(kb.inline_keyboard)).toEqual([
   ["TikTok","Reels","YouTube Shorts"],["Экспертная","Разговорная","Динамичная","Продающая"],["15 сек","30 сек","45 сек","60 сек","🚀 Создать сценарий","↩️ В меню"]
  ]);
 });
 it("uses direct Content Plan parameter choices in three compact rows",()=>{
  const kb=planConfig({goal:"",platform:"",style:""},"ru");expect(flat(kb.inline_keyboard)).toEqual([
   ["Рост","Продажи","Вовлечение","Экспертность"],["Telegram","Instagram","TikTok","YouTube"],["Экспертный","Разговорный","Новостной","Продающий","🚀 Создать план","↩️ В меню"]
  ]);
 });
 it("uses the Final T3 Repurpose compact three-row target layout",()=>{
  expect(flat(repurposeTargets([],"ru").inline_keyboard)).toEqual([
   ["📝 Telegram-пост","📸 Instagram caption","🎬 TikTok-сценарий"],["▶️ YouTube Shorts","🔥 5 Hook","🎯 CTA"],["📅 Контент на неделю","🚀 Создать контент","↩️ В меню"]
  ]);
 });
 it("uses the common four result actions and History item actions",()=>{
  expect(flat(postResult(1,"ru").inline_keyboard)).toEqual([["📋 Скопировать","✏️ Изменить"],["🔄 Другой вариант","⭐ Сохранить в историю"]]);
  expect(flat(historyItem(1,"ru").inline_keyboard)).toEqual([["▶️ Продолжить"],["📋 Скопировать","🗑 Удалить из истории"],["↩️ Назад к истории"]]);
 });
 it("uses exact Settings, Tariffs, Credits and My Style button structures",()=>{
  expect(flat(settingsKeyboard("ru").inline_keyboard)).toEqual([["👤 Аккаунт","🌐 Язык"],["🔔 Уведомления","💬 Помощь"],["⚖️ Условия использования","🛡️ Конфиденциальность"],["↩️ В меню"]]);
  expect(flat(tariffsKeyboard("ru").inline_keyboard)).toEqual([["⚡ CREATOR","🚀 PRO"],["↩️ В меню"]]);
  expect(flat(creditsKeyboard([50,100,250,500],"ru").inline_keyboard)).toEqual([["50 🔹","100 🔹"],["250 🔹","500 🔹"],["↩️ Назад"]]);
  expect(flat(styleKeyboard(5,"ru").inline_keyboard)).toEqual([["➕ Добавить пример","✨ Проанализировать стиль"],["↩️ В меню"]]);
 });
 it("contains exact Final T3 copy for core screens",()=>{
  const t=copyFor("ru");
  expect(t.start("Алекс")).toBe("🤖 Привет, Алекс!\n\nCreator AI превращает идеи и готовые материалы в контент:\n\n✦ Посты и сценарии\n✦ Repurpose и контент-планы\n✦ Адаптация под разные площадки\n✦ Твой стиль\n\n⚡ Меньше времени. Больше контента.\n\nЧто создаём сегодня? 👇");
  expect(t.postEntry).toBe("✦ Creator AI / Post Maker\n\nПревратим твою идею в сильный пост.\n\nНапиши тему или набросок.\n\nЯ помогу:\n— Hook\n— структура\n— главная мысль\n— адаптация под площадку\n\nНачни с идеи — остальное сделаем вместе.");
  expect(t.scriptEntry).toBe("✦ Creator AI / Script Maker\n\nПревратим твою идею в ролик, который хочется досмотреть.\n\nНапиши тему, идею или что хочешь донести зрителю.\n\nЯ помогу:\n— создать сильный Hook с первых секунд\n— выстроить сценарий и динамику\n— написать текст для диктора\n— подобрать визуал\n— добавить текст на экран и CTA\n\nНачни с идеи — сценарий соберём вместе.");
  expect(t.planEntry).toBe("✦ Creator AI / Content Plan\n\nСоздадим контент-план на 7 дней, чтобы тебе не приходилось каждый день думать, что публиковать.\n\nНапиши свою тему, нишу или цель — например, что хочешь продвигать или о чём рассказывать.\n\n7 дней. 7 идей. Один понятный план действий.");
  expect(t.settings).toBe("⚙️ Creator AI / Настройки\n\nЗдесь можно изменить основные параметры Creator AI.");
 });
 it("validates Instagram output shape",()=>{
  expect(validateOutput("repurpose_instagram",{body:"",hook:"h",cta:"c",hashtags:[]})).toEqual({ok:false,reason:"bad_instagram"});
  expect(validateOutput("repurpose_instagram",{body:"body",hook:"h",cta:"c",hashtags:["#ai"]}).ok).toBe(true);
 });
 it("produces clean Instagram copy text without UI wrapper",()=>{
  expect(plainResult("repurpose_instagram",{hook:"Hook",body:"Caption",cta:"Read more",hashtags:["#ai"]},"ru")).toBe("Hook\n\nCaption\n\n🎯 CTA\n\nRead more\n\n#ai");
 });
 it("contains no Reply Keyboard implementation and uses the Telegram Bot Menu button",()=>{
  for(const f of ["src/telegram/api.ts","src/telegram/keyboards.ts","src/telegram/webhook.ts","src/text.ts"]){const s=readFileSync(f,"utf8");expect(s).not.toMatch(/ReplyKeyboardMarkup|KeyboardButton|resize_keyboard|persistentMenu/);}
  expect(readFileSync("src/telegram/api.ts","utf8")).toContain('menu_button:{type:"commands"}');
  expect(readFileSync("src/telegram/webhook.ts","utf8")).toContain("setChatMenuButton");
  expect(readFileSync("src/telegram/webhook.ts","utf8")).toContain("setMyCommands");
 });
 it("keeps all compact T3 keyboards at three rows or fewer",()=>{
  const keyboards=[postConfig({platform:"",style:"",length:""}),scriptConfig({platform:"",style:"",duration:""}),planConfig({goal:"",platform:"",style:""}),repurposeTargets([]),postResult(1),historyItem(1),tariffsKeyboard(),creditsKeyboard(),styleKeyboard(0),styleKeyboard(5),styleKeyboard(20)];
  for(const kb of keyboards)expect(kb.inline_keyboard.length).toBeLessThanOrEqual(3);
 });
 it("rejects a Content Plan format without a supported generator",()=>{
  const out={topic:"AI",days:Array.from({length:7},(_,i)=>({day:"D"+(i+1),title:"Idea",goal:"Рост",format:i===1?"Опрос":"Пост",hook:"Hook",angle:"Angle",mainThought:"Thought",cta:"CTA",status:"○"}))};
  expect(validateOutput("content_plan",out).ok).toBe(false);
  out.days[1].format="Reels";
  expect(validateOutput("content_plan",out).ok).toBe(true);
 });
});
