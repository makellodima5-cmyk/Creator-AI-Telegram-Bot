const b=(text:string,data:string)=>({text,callback_data:data});
const mark=(ok:boolean,label:string,data:string)=>b(ok?"✅ "+label:label,data);
export type PostDraft={topic:string;platform:string;style:string;length:string;credits?:number};
export type ScriptDraft={topic:string;platform:string;style:string;duration:string;credits?:number};
export type PlanDraft={topic:string;goal:string;platform:string;style:string;credits?:number};
export const mainMenu={inline_keyboard:[[b("📝 Пост","menu:post"),b("🎬 Сценарий","menu:script"),b("♻️ Переработка","menu:repurpose")],[b("📅 Контент-план","menu:plan"),b("👤 Мой стиль","menu:style"),b("🕘 История","menu:history")],[b("💎 Тарифы","menu:pricing"),b("⭐ Credits","menu:credits"),b("⚙️ Настройки","menu:settings")]]};
export const persistentMenu={keyboard:[[{text:"📝 Пост"},{text:"🎬 Сценарий"},{text:"♻️ Переработка"}],[{text:"📅 Контент-план"},{text:"🕘 История"},{text:"💎 Тарифы"}],[{text:"⭐ Credits"},{text:"⚙️ Настройки"}]],resize_keyboard:true,is_persistent:true};
export const postConfig=(d:PostDraft)=>({inline_keyboard:[
 [mark(d.platform==="telegram","📱 Telegram","sel:telegram"),mark(d.platform==="instagram","📸 Instagram","sel:instagram")],
 [mark(d.platform==="tiktok","🎵 TikTok","sel:tiktok"),mark(d.platform==="youtube","▶️ YouTube","sel:youtube")],
 [mark(d.style==="expert","💼 Экспертный","sel:expert"),mark(d.style==="provocative","🔥 Провокационный","sel:provocative")],
 [mark(d.style==="conversational","😎 Разговорный","sel:conversational"),mark(d.style==="news","📰 Новостной","sel:news")],
 [mark(d.style==="sales","💰 Продающий","sel:sales")],
 [mark(d.length==="short","⚡ Короткая","sel:short"),mark(d.length==="medium","📝 Средняя","sel:medium")],
 [mark(d.length==="long","📚 Длинная","sel:long")],
 [b("🚀 Создать","create")],
 [b("← Назад","back")]
]});
export const scriptConfig=(d:ScriptDraft)=>({inline_keyboard:[
 [mark(d.platform==="tiktok","🎵 TikTok","sel:tiktok"),mark(d.platform==="instagram","📸 Reels","sel:instagram")],
 [mark(d.platform==="youtube","▶️ YouTube Shorts","sel:youtube"),mark(d.style==="dynamic","⚡ Динамичная","sel:dynamic")],
 [mark(d.duration==="15","15 сек","sel:15"),mark(d.duration==="30","30 сек","sel:30"),mark(d.duration==="45","45 сек","sel:45"),mark(d.duration==="60","60 сек","sel:60")],
 [b("🚀 Создать","create")],
 [b("← Назад","back")]
]});
export const planConfig=(d:PlanDraft)=>({inline_keyboard:[
 [mark(d.goal==="growth","📈 Рост","sel:growth"),mark(d.goal==="sales","💰 Продажи","sel:sales")],
 [mark(d.goal==="engagement","❤️ Вовлечение","sel:engagement"),mark(d.goal==="expertise","🧠 Экспертность","sel:expertise")],
 [mark(d.platform==="telegram","📱 Telegram","sel:telegram"),mark(d.platform==="instagram","📸 Instagram","sel:instagram")],
 [mark(d.platform==="tiktok","🎵 TikTok","sel:tiktok"),mark(d.platform==="youtube","▶️ YouTube","sel:youtube")],
 [mark(d.style==="expert","💼 Экспертный","sel:expert"),mark(d.style==="conversational","😎 Разговорный","sel:conversational")],
 [mark(d.style==="news","📰 Новостной","sel:news"),mark(d.style==="sales","💰 Продающий","sel:sales")],
 [b("🚀 Создать план","create")],[b("← Назад","back")]
]});
export const optionKeyboard=(options:{text:string;data:string}[],back:string)=>{const rows:any[][]=[];for(let i=0;i<options.length;i+=2)rows.push(options.slice(i,i+2).map(x=>b(x.text,x.data)));rows.push([b("← Назад",back)]);return{inline_keyboard:rows}};
export const repurposeTargets=(selected:string[],_price:number)=>({inline_keyboard:[[mark(selected.includes("telegram"),"📱 Telegram","target:telegram"),mark(selected.includes("instagram"),"📸 Instagram","target:instagram"),mark(selected.includes("tiktok"),"🎵 TikTok","target:tiktok")],[mark(selected.includes("youtube"),"▶️ YouTube Shorts","target:youtube"),mark(selected.includes("hooks"),"🔥 5 Hook","target:hooks"),mark(selected.includes("cta"),"🎯 3 CTA","target:cta")],[mark(selected.includes("plan"),"📅 Контент на неделю","target:plan"),b("🚀 Создать контент","create"),b("❌ Отмена","cancel")]]});
export const postResult=(id:number)=>({inline_keyboard:[[b("📋 Скопировать","copy:"+id),b("✏️ Изменить","edit:"+id)],[b("🔄 Другой вариант","variant:"+id),b("⭐ Сохранить в историю","save:"+id)]]});
export const scriptResult=postResult;
export const genericResult=postResult;
export const repurposeResult=postResult;
export const styleResult=(id:number)=>({inline_keyboard:[[b("⭐ Сохранить в историю","save:"+id),b("← My Style","menu:style")],[b("🏠 Главное меню","menu:back")]]});
export const planResult=(jobId:number,days:any[],resultId:number)=>{const buttons=days.map((d:any,i:number)=>b("📅 "+String(d.day??"День "+(i+1))+" · "+String(d.title??"").slice(0,16),"dayview:"+jobId+":"+i));const rows:any[][]=[];for(let i=0;i<buttons.length;i+=3)rows.push(buttons.slice(i,i+3));return{inline_keyboard:rows};};
export const historyItem=(id:number)=>({inline_keyboard:[[b("▶️ Открыть","hcontinue:"+id)],[b("📋 Скопировать","hcopy:"+id),b("🗑 Удалить из истории","hdelete:"+id)]]});
export const styleExamples=(ready:boolean)=>ready?{inline_keyboard:[[b("✨ Проанализировать стиль","style:analyze")],[b("← Назад","back")]]}:{inline_keyboard:[[b("← Назад","back")]]};
export const insufficientKeyboard=()=>({inline_keyboard:[[b("🔹 Купить кредиты","menu:credits"),b("💎 Изменить тариф","menu:pricing")],[b("❌ Отмена","cancel")]]});
export const errorKeyboard=(id:number)=>({inline_keyboard:[[b("🔄 Попробовать ещё раз","retry:"+id)],[b("❌ Отмена","cancel")]]});
export const repurposeFailureKeyboard=(id:number)=>({inline_keyboard:[[b("🔄 Повторить неудачные","rep-retry:"+id)],[b("❌ Отмена","cancel")]]});
export const settingsKeyboard={inline_keyboard:[[b("👤 Аккаунт","settings:profile"),b("🌐 Язык","settings:language"),b("🔔 Уведомления","settings:notifications")],[b("💬 Помощь","settings:support"),b("⚖️ Условия использования","settings:terms"),b("🛡️ Конфиденциальность","settings:privacy")],[b("← Назад","menu:back")]]};
export const languageKeyboard={inline_keyboard:[[b("🇷🇺 Русский","settings:language:ru"),b("🇬🇧 English","settings:language:en")],[b("← Назад","menu:settings")]]};
export const notificationKeyboard=(enabled:boolean)=>({inline_keyboard:[[b(enabled?"🔕 Выключить уведомления":"🔔 Включить уведомления","settings:toggle")],[b("← Назад","menu:settings")]]});
export const creditsKeyboard=(packages=[50,100,250,500])=>({inline_keyboard:[[b("⭐ "+packages[0]+" кредитов","buy:credits:"+packages[0]),b("⭐ "+packages[1]+" кредитов","buy:credits:"+packages[1])],[b("⭐ "+packages[2]+" кредитов","buy:credits:"+packages[2]),b("⭐ "+packages[3]+" кредитов","buy:credits:"+packages[3])],[b("💎 Изменить тариф","menu:pricing")]]});
export const adminMenu={inline_keyboard:[[b("💰 Стоимость","admin:pricing"),b("🧠 AI","admin:ai"),b("⚙️ Лимиты","admin:limits")],[b("👥 Пользователи","admin:users"),b("📊 Метрики","admin:metrics"),b("🧾 Платежи","admin:payments")],[b("← Выйти","menu:back")]]};
export const adminBack={inline_keyboard:[[b("← Назад","admin:menu")]]};
