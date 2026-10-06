import { describe, expect, it } from "vitest";
import { postConfig, postResult } from "../src/telegram/keyboards";

describe("Post Maker", () => {
  it("marks selected options", () => {
    const labels = postConfig({ topic: "x", platform: "telegram", style: "conversational", length: "short" }).inline_keyboard.flat().map((x) => x.text);
    expect(labels).toContain("✅ Telegram");
    expect(labels).toContain("✅ Разговорный");
    expect(labels).toContain("✅ Короткая");
  });
  it("has result actions", () => {
    const rows = postResult(42,"hello").inline_keyboard;
    expect(rows.length).toBe(3);
    expect(rows[0][0].callback_data).toBe("post:regen:42");
    expect(rows[0][1].callback_data).toBe("post:hook:42");
    expect(rows[0][2].callback_data).toBe("post:shorten:42");
    expect(rows[1][0].callback_data).toBe("post:script:42");
    expect(rows[1][1].copy_text.text).toBe("hello");
  });
});
