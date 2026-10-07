import { describe, expect, it } from "vitest";
import { mainMenu,persistentMenu,postConfig,postResult,repurposeTargets,scriptConfig,scriptResult,settingsKeyboard } from "../src/telegram/keyboards";

describe("Creator AI Telegram UX reference v2",()=>{
const main=["📝 Пост","🎬 Сценарий","♻️ Переработка","📅 Контент-план","👤 Мой стиль","🕘 История","💎 Тарифы","⭐ Credits","⚙️ Настройки"];
it("main menu matches reference",()=>{expect(mainMenu.inline_keyboard.flat().map(x=>x.text)).toEqual(main);expect(persistentMenu.keyboard.flat().map(x=>x.text)).toEqual(main);});
it("post config matches reference",()=>{const r=postConfig({topic:"x",platform:"telegram",style:"conversational",length:"short"}).inline_keyboard;expect(r.map(x=>x.map(y=>y.text))).toEqual([["✅ 📱 Telegram","📸 Instagram"],["🎵 TikTok","▶️ YouTube"],["💼 Экспертный","🔥 Провокационный"],["✅ 😎 Разговорный","📰 Новостной"],["💰 Продающий"],["✅ ⚡ Короткая","📝 Средняя"],["📚 Длинная"],["🚀 Создать"],["← Назад"]]);});
it("result and settings keyboards exist",()=>{expect(postResult(1,"x").inline_keyboard.length).toBe(4);expect(scriptResult(1,"x").inline_keyboard.length).toBe(3);expect(settingsKeyboard.inline_keyboard.length).toBe(5);});
it("repurpose and script controls match reference options",()=>{expect(repurposeTargets(["all"]).inline_keyboard.flat().map(x=>x.text)).toContain("✅ Выбрать всё");expect(scriptConfig({topic:"x",platform:"tiktok",style:"dynamic",duration:"30"}).inline_keyboard.flat().map(x=>x.text)).toContain("✅ 30 сек");});
});
