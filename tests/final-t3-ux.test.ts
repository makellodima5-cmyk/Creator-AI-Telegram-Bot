import { describe, expect, it } from "vitest";
import { mainMenu, postConfig, scriptConfig, planConfig, repurposeTargets, postResult, settingsKeyboard, accountKeyboard, languageKeyboard, notificationKeyboard, helpKeyboard, tariffsKeyboard, creditsKeyboard, insufficientKeyboard, historyItem, styleExamples } from "../src/telegram/keyboards";
import { ru } from "../src/text";

const texts = (k: any) => k.inline_keyboard.flat().map((x: any) => x.text);

describe("Final T3 Telegram UX", () => {
  it("uses exactly six /start buttons and no Reply Keyboard", async () => {
    expect(mainMenu.inline_keyboard.flat().map((x: any) => x.text)).toEqual(["📝 Post","🎬 Script","♻️ Repurpose","📅 Content Plan","💎 Tariffs","🔹 Credits"]);
    expect(mainMenu.inline_keyboard).toHaveLength(3);
    const mod = await import("../src/telegram/keyboards");
    expect("persistentMenu" in mod).toBe(false);
  });

  it("keeps generation configuration keyboards within three rows", () => {
    for (const keyboard of [
      postConfig({topic:"x",platform:"telegram",style:"conversational",length:"short"}),
      scriptConfig({topic:"x",platform:"tiktok",style:"dynamic",duration:"30"}),
      planConfig({topic:"x",goal:"growth",platform:"telegram",style:"expert"}),
    ]) expect(keyboard.inline_keyboard.length).toBeLessThanOrEqual(3);
  });

  it("keeps Repurpose selection within three rows while exposing seven outputs", () => {
    const keyboard = repurposeTargets(["telegram","tiktok"], 6);
    expect(keyboard.inline_keyboard.length).toBeLessThanOrEqual(3);
    expect(texts(keyboard)).toEqual(["📱 Telegram","📸 Instagram","🎵 TikTok","▶️ YouTube Shorts","🔥 5 Hooks","🎯 CTA","📅 Content Plan","🚀 Создать контент","↩️ В меню"]);
  });

  it("uses the exact generic result controls", () => {
    expect(texts(postResult(1))).toEqual(["📋 Скопировать","✏️ Изменить","🔄 Другой вариант","⭐ Сохранить в историю"]);
    expect(postResult(1).inline_keyboard).toHaveLength(2);
  });

  it("uses the exact Settings nested navigation", () => {
    expect(texts(settingsKeyboard)).toEqual(["👤 Аккаунт","🌐 Язык","🔔 Уведомления","💬 Помощь","⚖️ Условия использования","🛡️ Конфиденциальность","↩️ В меню"]);
    expect(texts(accountKeyboard)).toEqual(["↩️ Назад"]);
    expect(texts(languageKeyboard)).toEqual(["🇷🇺 Русский","🇬🇧 English","↩️ Назад"]);
    expect(texts(notificationKeyboard(true))).toEqual(["🔕 Выключить уведомления","↩️ Назад"]);
    expect(texts(helpKeyboard)).toEqual(["💬 Поддержка в Telegram","📧 Поддержка по почте","↩️ Назад"]);
  });

  it("uses exact tariff, credit and insufficient-credit controls", () => {
    expect(texts(tariffsKeyboard)).toEqual(["⚡ CREATOR","🚀 PRO","↩️ В меню"]);
    expect(texts(creditsKeyboard())).toEqual(["50 🔹","100 🔹","250 🔹","500 🔹","↩️ Назад"]);
    expect(texts(insufficientKeyboard())).toEqual(["🔹 Купить кредиты","💎 Изменить тариф","❌ Отмена"]);
  });

  it("uses final history item controls and style start controls", () => {
    expect(texts(historyItem(1))).toEqual(["▶️ Продолжить","📋 Скопировать","🗑 Удалить из истории","↩️ Назад к истории"]);
    expect(historyItem(1).inline_keyboard.length).toBeLessThanOrEqual(3);
    expect(texts(styleExamples(false))).toEqual(["✨ Начать анализ","↩️ В меню"]);
  });

  it("uses authoritative final T3 copy", () => {
    expect(ru.start("Alex")).toBe("🤖 Привет, Alex!\n\nCreator AI превращает идеи и готовые материалы в контент:\n\n✦ Посты и сценарии\n✦ Repurpose и контент-планы\n✦ Адаптация под разные площадки\n✦ Твой стиль\n\n⚡ Меньше времени. Больше контента.\n\nЧто создаём сегодня? 👇");
    expect(ru.repEntry).toBe("✦ Creator AI / Repurpose\n\nПревратим твой готовый материал в контент для разных площадок.\n\nОтправь один материал:\n\n📝 Текст — одним сообщением, до 4 000 символов\n\n📄 Документ — PDF, DOC или TXT, до 5 MB и до 20 000 символов текста после обработки\n\nОдин материал. Несколько форматов. Больше контента.");
    expect(ru.settings).toBe("⚙️ Creator AI / Настройки\n\nЗдесь можно изменить основные параметры Creator AI.");
    expect(ru.language).toBe("🌐 CREATOR AI / ЯЗЫК\n\nВыбери язык интерфейса и общения с Creator AI.");
    expect(ru.postConfig(7, {})).toContain("💳 Стоимость генерации: 7 🔹");
    expect(ru.scriptConfig(7, {})).toContain("💳 Стоимость генерации: 7 🔹");
    expect(ru.planConfig(7, {})).toContain("💳 Стоимость генерации: 7 🔹");
  });
});
