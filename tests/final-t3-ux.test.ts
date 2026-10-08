import{describe,expect,it}from"vitest";
import{mainMenu,postConfig,scriptConfig,planConfig,repurposeTargets,postResult,settingsKeyboard,accountKeyboard,languageKeyboard,notificationKeyboard,helpKeyboard,tariffsKeyboard,creditsKeyboard,insufficientKeyboard,historyItem,styleKeyboard}from"../src/telegram/keyboards";
import{ru}from"../src/text";
const texts=(k:any)=>k.inline_keyboard.flat().map((x:any)=>x.text);
describe("Final T3 UX",()=>{
 it("has six /start actions and no Reply Keyboard export",async()=>{
  expect(texts(mainMenu)).toEqual(["📝 Post","🎬 Script","♻️ Repurpose","📅 Content Plan","💎 Tariffs","🔹 Credits"]);expect(mainMenu.inline_keyboard).toHaveLength(3);expect("persistentMenu" in await import("../src/telegram/keyboards")).toBe(false);
 });
 it("keeps compact user keyboards within three rows",()=>{
  for(const k of [postConfig({platform:"",style:"",length:""}),scriptConfig({platform:"",style:"",duration:""}),planConfig({goal:"",platform:"",style:""}),repurposeTargets(["telegram","tiktok"],"ru"),postResult(1),historyItem(1),tariffsKeyboard(),creditsKeyboard(),styleKeyboard(5)])expect(k.inline_keyboard.length).toBeLessThanOrEqual(3);
 });
 it("uses exact result controls",()=>expect(texts(postResult(1))).toEqual(["📋 Скопировать","✏️ Изменить","🔄 Другой вариант","⭐ Сохранить в историю"]));
 it("uses Settings/tariff/credits/insufficient controls",()=>{
  expect(texts(settingsKeyboard("ru"))).toEqual(["👤 Аккаунт","🌐 Язык","🔔 Уведомления","💬 Помощь","⚖️ Условия использования","🛡️ Конфиденциальность","↩️ В меню"]);expect(texts(accountKeyboard("ru"))).toEqual(["↩️ Назад"]);expect(texts(languageKeyboard("ru"))).toEqual(["🇷🇺 Русский","🇬🇧 English","↩️ Назад"]);expect(texts(notificationKeyboard(true,"ru"))).toEqual(["🔕 Выключить уведомления","↩️ Назад"]);expect(texts(helpKeyboard("ru"))).toEqual(["💬 Поддержка в Telegram","📧 Поддержка по почте","↩️ Назад"]);expect(texts(tariffsKeyboard("ru"))).toEqual(["⚡ CREATOR","🚀 PRO","↩️ В меню"]);expect(texts(creditsKeyboard([50,100,250,500],"ru"))).toEqual(["50 🔹","100 🔹","250 🔹","500 🔹","↩️ Назад"]);expect(texts(insufficientKeyboard("ru"))).toEqual(["🔹 Купить кредиты","💎 Изменить тариф","❌ Отмена"]);
 });
 it("uses History and My Style controls",()=>{
  expect(texts(historyItem(1,"ru"))).toEqual(["▶️ Продолжить","📋 Скопировать","🗑 Удалить из истории","↩️ Назад к истории"]);expect(texts(styleKeyboard(0,"ru"))).toEqual(["✨ Начать анализ","↩️ В меню"]);
 });
 it("uses authoritative Russian copy",()=>{
  expect(ru.start("Alex")).toBe("🤖 Привет, Alex!\n\nCreator AI превращает идеи и готовые материалы в контент:\n\n✦ Посты и сценарии\n✦ Repurpose и контент-планы\n✦ Адаптация под разные площадки\n✦ Твой стиль\n\n⚡ Меньше времени. Больше контента.\n\nЧто создаём сегодня? 👇");
  expect(ru.repEntry).toContain("Отправь один материал:");
  expect(ru.settings).toBe("⚙️ Creator AI / Настройки\n\nЗдесь можно изменить основные параметры Creator AI.");
  expect(ru.language).toBe("🌐 CREATOR AI / ЯЗЫК\n\nВыбери язык интерфейса и общения с Creator AI.");
 });
});
