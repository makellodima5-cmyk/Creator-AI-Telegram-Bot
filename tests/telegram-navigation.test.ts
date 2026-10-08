import{describe,expect,it}from"vitest";
import{mainMenu,settingsKeyboard,tariffsKeyboard,creditsKeyboard}from"../src/telegram/keyboards";
describe("Final T3 navigation",()=>{
 it("main inline menu has only the six primary actions",()=>expect(mainMenu.inline_keyboard.flat().map((x:any)=>x.callback_data)).toEqual(["menu:post","menu:script","menu:repurpose","menu:plan","menu:pricing","menu:credits"]));
 it("keeps menu sizes aligned with T3",()=>{expect(settingsKeyboard("ru").inline_keyboard).toHaveLength(4);expect(tariffsKeyboard("ru").inline_keyboard).toHaveLength(2);expect(creditsKeyboard([50,100,250,500],"ru").inline_keyboard).toHaveLength(3);});
});
