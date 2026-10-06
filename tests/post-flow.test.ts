import { describe, expect, it } from "vitest";
import { mainMenu, persistentMenu, postConfig, postResult, repurposeConfirm, repurposeTargets, scriptConfig, scriptResult } from "../src/telegram/keyboards";

describe("Creator AI Telegram v1 UX", () => {
  it("has the fixed main menu actions", () => {
    const labels = mainMenu.inline_keyboard.flat().map((x) => x.text);
    expect(labels).toEqual([
      "📝 Пост",
      "🎬 Сценарий",
      "♻️ Переработка",
      "📅 План",
      "👤 Мой стиль",
      "🕘 История",
      "💎 Тарифы",
      "⭐ Credits",
      "⚙️ Настройки",
    ]);
  });

  it("has persistent bottom navigation", () => {
    const labels = persistentMenu.keyboard.flat().map((x) => x.text);
    expect(labels).toEqual([
      "📝 Пост",
      "🎬 Сценарий",
      "♻️ Переработка",
      "📅 План",
      "👤 Мой стиль",
      "🕘 История",
      "💎 Тарифы",
      "⭐ Credits",
      "⚙️ Настройки",
    ]);
  });

  it("marks selected Post Maker options", () => {
    const labels = postConfig({
      topic: "x",
      platform: "telegram",
      style: "conversational",
      length: "short",
    }).inline_keyboard.flat().map((x) => x.text);

    expect(labels).toContain("✅ Telegram");
    expect(labels).toContain("✅ Разговорный");
    expect(labels).toContain("✅ Короткая");
    expect(labels).toContain("🚀 Создать");
    expect(labels).toContain("← Назад");
  });

  it("keeps the fixed post result actions", () => {
    const rows = postResult(42, "hello").inline_keyboard;
    expect(rows.length).toBe(3);
    expect(rows[0].map((x) => x.text)).toEqual(["🔄 Ещё вариант", "🔥 Усилить Hook", "✂️ Сократить"]);
    expect(rows[1][0].text).toBe("🎬 Сделать сценарий");
    expect(rows[1][1].copy_text.text).toBe("hello");
    expect(rows[2][0].text).toBe("← Назад");
  });

  it("keeps Script Maker result actions", () => {
    const rows = scriptResult(42, "script").inline_keyboard;
    expect(rows.length).toBe(3);
    expect(rows[0].map((x) => x.text)).toEqual(["🔄 Ещё вариант", "🔥 Усилить Hook", "✂️ Сократить"]);
    expect(rows[1][0].copy_text.text).toBe("script");
  });

  it("uses the fixed Repurpose target flow", () => {
    const labels = repurposeTargets(["all"]).inline_keyboard.flat().map((x) => x.text);
    expect(labels).toContain("✅ Всё сразу");
    expect(labels).toContain("🚀 Создать");
    expect(repurposeConfirm().inline_keyboard[0][0].text).toBe("🚀 Создать");
  });
});
