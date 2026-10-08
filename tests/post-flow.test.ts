import{describe,expect,it}from"vitest";
import{mainMenu,postConfig,scriptConfig,planConfig,repurposeTargets,postResult,settingsKeyboard}from"../src/telegram/keyboards";
describe("Creator AI Final T3 compatibility",()=>{
 it("uses the six-button primary menu",()=>expect(mainMenu.inline_keyboard.flat().map((x:any)=>x.text)).toEqual(["📝 Post","🎬 Script","♻️ Repurpose","📅 Content Plan","💎 Tariffs","🔹 Credits"]));
 it("uses compact configuration controls",()=>{expect(postConfig({platform:"telegram",style:"conversational",length:"short"}).inline_keyboard.length).toBeLessThanOrEqual(3);expect(scriptConfig({platform:"tiktok",style:"dynamic",duration:"30"}).inline_keyboard.length).toBeLessThanOrEqual(3);expect(planConfig({goal:"growth",platform:"telegram",style:"expert"}).inline_keyboard.length).toBeLessThanOrEqual(3);});
 it("uses independent Repurpose outputs",()=>expect(repurposeTargets(["telegram","cta"],"ru").inline_keyboard.flat().map((x:any)=>x.text)).toContain("✅ 🎯 CTA"));
 it("uses two-row result controls",()=>expect(postResult(1).inline_keyboard.length).toBe(2));
 it("uses four-row Settings",()=>expect(settingsKeyboard("ru").inline_keyboard.length).toBe(4));
});
