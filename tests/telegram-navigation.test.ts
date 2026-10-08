import { describe, expect, it } from "vitest";
import { mainMenu, settingsKeyboard, tariffsKeyboard, creditsKeyboard } from "../src/telegram/keyboards";

describe("Final T3 navigation", () => {
  it("main inline menu has only the six primary actions", () => {
    expect(mainMenu.inline_keyboard.flat().map((x:any)=>x.callback_data)).toEqual([
      "menu:post","menu:script","menu:repurpose","menu:plan","menu:pricing","menu:credits"
    ]);
  });

  it("settings is four rows and top-level menu stays compact", () => {
    expect(settingsKeyboard.inline_keyboard).toHaveLength(4);
    expect(tariffsKeyboard.inline_keyboard).toHaveLength(2);
    expect(creditsKeyboard().inline_keyboard).toHaveLength(3);
  });
});
