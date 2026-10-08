import{describe,expect,it}from"vitest";
import{adminMenu,adminPricesMenu,adminUserCard}from"../src/telegram/keyboards";
describe("Final T3 admin UI",()=>{
 it("has only the specified admin sections",()=>expect(adminMenu("ru").inline_keyboard.flat().map((x:any)=>x.text)).toEqual(["⚙️ Цены","📊 Статистика","👤 Пользователи","↩️ В меню"]));
 it("has prices grouped by tariffs, credit packs, AI operations and Repurpose",()=>expect(adminPricesMenu("ru").inline_keyboard.flat().map((x:any)=>x.text)).toEqual(["💎 Тарифы","🔹 Пакеты кредитов","🤖 AI-операции","♻️ Repurpose","↩️ Назад"]));
 it("exposes only tariff and credit grants on the user card",()=>expect(adminUserCard(42,"ru").inline_keyboard.flat().map((x:any)=>x.text)).toEqual(["💎 Выдать тариф","🔹 Выдать кредиты","↩️ Назад"]));
});
