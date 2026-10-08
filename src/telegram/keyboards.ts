export const b=(text:string,data:string)=>({text,callback_data:data});
const mark=(ok:boolean,label:string,data:string)=>b(ok?"✅ "+label:label,data);
export type PostDraft={topic:string;platform:string;style:string;length:string;credits?:number};
export type ScriptDraft={topic:string;platform:string;style:string;duration:string;credits?:number};
export type PlanDraft={topic:string;goal:string;platform:string;style:string;credits?:number};

export const mainMenu={inline_keyboard:[
  [b("📝 Post","menu:post"),b("🎬 Script","menu:script")],
  [b("♻️ Repurpose","menu:repurpose"),b("📅 Content Plan","menu:plan")],
  [b("💎 Tariffs","menu:pricing"),b("🔹 Credits","menu:credits")]
]};

const selected=(ok:boolean,label:string,data:string)=>mark(ok,label,data);
const display=(v:string,map:Record<string,string>)=>map[v]??v;

export const postConfig=(d:PostDraft)=>({inline_keyboard:[
  [selected(d.platform==="telegram","📱 Telegram","cfg:post:platform"),selected(d.style==="expert","🎨 Экспертный","cfg:post:style")],
  [selected(d.length==="short","📏 Короткий","cfg:post:length")],
  [b("🚀 Создать пост","create"),b("↩️ В меню","menu:back")]
]});
export const scriptConfig=(d:ScriptDraft)=>({inline_keyboard:[
  [selected(d.platform==="tiktok","📱 TikTok","cfg:script:platform"),selected(d.style==="dynamic","🎨 Динамичный","cfg:script:style")],
  [selected(d.duration==="30","⏱️ 30 сек","cfg:script:duration")],
  [b("🚀 Создать сценарий","create"),b("↩️ В меню","menu:back")]
]});
export const planConfig=(d:PlanDraft)=>({inline_keyboard:[
  [selected(d.goal==="growth","🎯 Рост","cfg:plan:goal"),selected(d.platform==="telegram","📱 Telegram","cfg:plan:platform")],
  [selected(d.style==="expert","🎨 Экспертный","cfg:plan:style")],
  [b("🚀 Создать план","create"),b("↩️ В меню","menu:back")]
]});
export const optionKeyboard=(options:{text:string;data:string}[],back:string)=>{
  const rows:any[][]=[];for(let i=0;i<options.length;i+=2)rows.push(options.slice(i,i+2).map(x=>b(x.text,x.data)));
  rows.push([b("↩️ Назад",back)]);return{inline_keyboard:rows};
};
export const repurposeTargets=(selectedOutputs:string[],_price:number)=>({inline_keyboard:[
  [["telegram","📱 Telegram"],["instagram","📸 Instagram"],["tiktok","🎵 TikTok"]].map(([k,l])=>mark(selectedOutputs.includes(k),l,"target:"+k)),
  [["youtube","▶️ YouTube Shorts"],["hooks","🔥 5 Hook"],["cta","🎯 3 CTA"]].map(([k,l])=>mark(selectedOutputs.includes(k),l,"target:"+k)),
  [mark(selectedOutputs.includes("plan"),"📅 Контент на неделю","target:plan"),b("🚀 Создать контент","create"),b("↩️ В меню","menu:back")]
]});
export const postResult=(id:number)=>({inline_keyboard:[
  [b("📋 Скопировать","copy:"+id),b("✏️ Изменить","edit:"+id)],
  [b("🔄 Другой вариант","variant:"+id),b("⭐ Сохранить в историю","save:"+id)]
]});
export const scriptResult=postResult;
export const genericResult=postResult;
export const repurposeResult=postResult;
export const styleResult=postResult;
export const planResult=(jobId:number,days:any[],_resultId:number)=>{const buttons=days.map((d:any,i:number)=>b("📅 "+String(d.day??("Day "+(i+1)))+" · "+String(d.title??"").slice(0,16),"dayview:"+jobId+":"+i));const rows:any[][]=[];for(let i=0;i<buttons.length;i+=3)rows.push(buttons.slice(i,i+3));return{inline_keyboard:rows}};
export const historyItem=(id:number)=>({inline_keyboard:[
  [b("▶️ Продолжить","hcontinue:"+id)],
  [b("📋 Скопировать","hcopy:"+id),b("🗑 Удалить из истории","hdelete:"+id)],
  [b("↩️ Назад к истории","hpage:0")]
]});
export const styleExamples=(ready:boolean)=>ready
  ?{inline_keyboard:[[b("✨ Проанализировать стиль","style:analyze"),b("➕ Добавить пример","style:add")],[b("↩️ В меню","menu:back")]]}
  :{inline_keyboard:[[b("✨ Начать анализ","style:start")],[b("↩️ В меню","menu:back")]]};
export const insufficientKeyboard=()=>({inline_keyboard:[
  [b("🔹 Купить кредиты","menu:credits"),b("💎 Изменить тариф","menu:pricing")],
  [b("❌ Отмена","cancel")]
]});
export const errorKeyboard=(id:number)=>({inline_keyboard:[[b("🔄 Попробовать ещё раз","retry:"+id)],[b("❌ Отмена","cancel")]]});
export const repurposeFailureKeyboard=(id:number)=>({inline_keyboard:[[b("🔄 Повторить неудачные","rep-retry:"+id)]]});
export const settingsKeyboard={inline_keyboard:[
  [b("👤 Аккаунт","settings:profile"),b("🌐 Язык","settings:language")],
  [b("🔔 Уведомления","settings:notifications"),b("💬 Помощь","settings:support")],
  [b("⚖️ Условия использования","settings:terms"),b("🛡️ Конфиденциальность","settings:privacy")],
  [b("↩️ В меню","menu:back")]
]};
export const accountKeyboard={inline_keyboard:[[b("↩️ Назад","menu:settings")]]};
export const languageKeyboard={inline_keyboard:[[b("🇷🇺 Русский","settings:language:ru"),b("🇬🇧 English","settings:language:en")],[b("↩️ Назад","menu:settings")]]};
export const notificationKeyboard=(enabled:boolean)=>({inline_keyboard:[[b(enabled?"🔕 Выключить уведомления":"🔔 Включить уведомления","settings:toggle")],[b("↩️ Назад","menu:settings")]]});
export const helpKeyboard={inline_keyboard:[[b("💬 Поддержка в Telegram","support:telegram"),b("📧 Поддержка по почте","support:email")],[b("↩️ Назад","menu:settings")]]};
export const creditsKeyboard=(packages=[50,100,250,500])=>({inline_keyboard:[
  [b("50 🔹","buy:credits:"+packages[0]),b("100 🔹","buy:credits:"+packages[1])],
  [b("250 🔹","buy:credits:"+packages[2]),b("500 🔹","buy:credits:"+packages[3])],
  [b("↩️ Назад","menu:back")]
]});
export const tariffsKeyboard={inline_keyboard:[[b("⚡ CREATOR","buy:creator"),b("🚀 PRO","buy:pro")],[b("↩️ В меню","menu:back")]]};
export const adminMenu={inline_keyboard:[[b("⚙️ Цены","admin:prices"),b("📊 Статистика","admin:stats")],[b("👤 Пользователи","admin:users")],[b("↩️ В меню","menu:back")]]};
export const adminPricesMenu={inline_keyboard:[[b("💎 Тарифы","admin:tariffs"),b("🔹 Пакеты кредитов","admin:credit_packages")],[b("🤖 AI-операции","admin:ai_prices"),b("♻️ Repurpose","admin:repurpose_prices")],[b("↩️ Назад","admin:menu")]]};
export const adminBack={inline_keyboard:[[b("↩️ Назад","admin:menu")]]};
export const adminList=(items:{text:string;data:string}[],back="admin:menu")=>{const rows:any[][]=[];for(let i=0;i<items.length;i+=2)rows.push(items.slice(i,i+2).map(x=>b(x.text,x.data)));rows.push([b("↩️ Назад",back)]);return{inline_keyboard:rows}};
export const adminUserCard=(id:number)=>({inline_keyboard:[[b("💎 Выдать тариф","admin:grant_tariff:"+id),b("🔹 Выдать кредиты","admin:grant_credits:"+id)],[b("↩️ Назад","admin:users")]]});
