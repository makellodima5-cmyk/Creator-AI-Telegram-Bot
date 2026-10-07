const b=(text:string,data:string)=>({text,callback_data:data});
const mark=(ok:boolean,label:string,data:string)=>b(ok?"✅ "+label:label,data);
export type PostDraft={topic:string;platform:string;style:string;length:string;credits?:number};
export type ScriptDraft={topic:string;platform:string;style:string;duration:string;credits?:number};
export type PlanDraft={topic:string;goal:string;platform:string;style:string;credits?:number};

export const mainMenu={inline_keyboard:[
  [b("📝 Пост","menu:post"),b("🎬 Сценарий","menu:script"),b("♻️ Переработка","menu:repurpose")],
  [b("📅 Контент-план","menu:plan"),b("👤 Мой стиль","menu:style"),b("🕘 История","menu:history")],
  [b("💎 Тарифы","menu:pricing"),b("⭐ Credits","menu:credits"),b("⚙️ Настройки","menu:settings")]
]};
export const persistentMenu={keyboard:[
  [{text:"📝 Пост"},{text:"🎬 Сценарий"},{text:"♻️ Переработка"}],
  [{text:"📅 Контент-план"},{text:"🕘 История"},{text:"💎 Тарифы"}],
  [{text:"⭐ Credits"},{text:"⚙️ Настройки"}]
],resize_keyboard:true,is_persistent:true};

export const postConfig=(d:PostDraft)=>({inline_keyboard:[
  [b("📱 Площадка","cfg:post:platform"),b("🎨 Стиль","cfg:post:style"),b("📏 Размер","cfg:post:length")],
  [b("📋 "+String(d.platform).toUpperCase()+" · "+String(d.style)+" · "+String(d.length),"cfg:post:summary")],
  [b("🚀 Создать пост","create")]
]});
export const scriptConfig=(d:ScriptDraft)=>({inline_keyboard:[
  [b("📱 Формат","cfg:script:platform"),b("🎨 Стиль","cfg:script:style"),b("⏱️ Длительность","cfg:script:duration")],
  [b("📋 "+String(d.platform).toUpperCase()+" · "+String(d.style)+" · "+String(d.duration)+" сек","cfg:script:summary")],
  [b("🚀 Создать сценарий","create")]
]});
export const planConfig=(d:PlanDraft)=>({inline_keyboard:[
  [b("🎯 Цель","cfg:plan:goal"),b("📱 Площадка","cfg:plan:platform"),b("🎨 Стиль","cfg:plan:style")],
  [b("📋 "+String(d.goal)+" · "+String(d.platform)+" · "+String(d.style),"cfg:plan:summary")],
  [b("🚀 Создать план","create")]
]});
export const optionKeyboard=(options:{text:string;data:string}[],back:string)=>({inline_keyboard:[options.map(x=>b(x.text,x.data)),[b("← Назад",back)]]});
export const repurposeTargets=(selected:string[],_price:number)=>({inline_keyboard:[
  [mark(selected.includes("telegram"),"📱 Telegram","target:telegram"),mark(selected.includes("instagram"),"📸 Instagram","target:instagram"),mark(selected.includes("tiktok"),"🎵 TikTok","target:tiktok")],
  [mark(selected.includes("youtube"),"▶️ YouTube Shorts","target:youtube"),mark(selected.includes("hooks"),"🔥 5 Hook","target:hooks"),mark(selected.includes("cta"),"🎯 CTA","target:cta")],
  [mark(selected.includes("plan"),"📅 Контент на неделю","target:plan"),b("🚀 Создать контент","create")]
]});
export const postResult=(id:number)=>({inline_keyboard:[
  [b("📋 Скопировать","copy:"+id),b("✏️ Изменить","edit:"+id)],
  [b("🔄 Другой вариант","variant:"+id),b("⭐ Сохранить в историю","save:"+id)]
]});
export const scriptResult=postResult;
export const genericResult=postResult;
export const repurposeResult=postResult;
export const planResult=(jobId:number,days:any[],resultId:number)=>({inline_keyboard:[
  days.slice(0,4).map((d:any,i:number)=>b("🚀 "+String(d.day??"День "+(i+1))+" · "+String(d.title??"").slice(0,18),"day:"+jobId+":"+i)),
  days.slice(4,7).map((d:any,i:number)=>b("🚀 "+String(d.day??"День "+(i+5))+" · "+String(d.title??"").slice(0,18),"day:"+jobId+":"+(i+4)),
  [b("🔄 Другой вариант","variant:"+resultId),b("⭐ Сохранить в историю","save:"+resultId)]
].filter(row=>row.length>0)});
export const historyItem=(id:number)=>({inline_keyboard:[[b("▶️ Продолжить","hcontinue:"+id)],[b("📋 Скопировать","hcopy:"+id),b("🗑 Удалить из истории","hdelete:"+id)]]});
export const styleExamples=(ready:boolean)=>ready?{inline_keyboard:[[b("✨ Проанализировать стиль","style:analyze")],[b("← Назад","back")]]}:{inline_keyboard:[[b("← Назад","back")]]};
export const insufficientKeyboard=()=>({inline_keyboard:[[b("🔹 Купить кредиты","menu:credits"),b("💎 Изменить тариф","menu:pricing")],[b("❌ Отмена","cancel")]]});
export const errorKeyboard=(id:number)=>({inline_keyboard:[[b("🔄 Попробовать ещё раз","retry:"+id)],[b("❌ Отмена","cancel-error:"+id)]]});
export const repurposeFailureKeyboard=(id:number)=>({inline_keyboard:[[b("🔄 Повторить неудачные","rep-retry:"+id)],[b("❌ Отмена","cancel-error:"+id)]]});
export const settingsKeyboard={inline_keyboard:[
  [b("👤 Аккаунт","settings:profile"),b("🌐 Язык","settings:language"),b("🔔 Уведомления","settings:notifications")],
  [b("💬 Помощь","settings:support"),b("⚖️ Условия использования","settings:terms"),b("🛡️ Конфиденциальность","settings:privacy")],
  [b("← Назад","menu:back")]
]};
export const languageKeyboard={inline_keyboard:[[b("🇷🇺 Русский","settings:language:ru"),b("🇬🇧 English","settings:language:en")],[b("← Назад","menu:settings")]]};
export const notificationKeyboard=(enabled:boolean)=>({inline_keyboard:[[b(enabled?"🔕 Выключить уведомления":"🔔 Включить уведомления","settings:toggle")],[b("← Назад","menu:settings")]]});
export const creditsKeyboard=(packages=[50,100,250,500])=>({inline_keyboard:[
 [b("⭐ "+packages[0]+" кредитов","buy:credits:"+packages[0]),b("⭐ "+packages[1]+" кредитов","buy:credits:"+packages[1])],
 [b("⭐ "+packages[2]+" кредитов","buy:credits:"+packages[2]),b("⭐ "+packages[3]+" кредитов","buy:credits:"+packages[3])],
 [b("💎 Изменить тариф","menu:pricing")]
]});
export const adminMenu={inline_keyboard:[
  [b("💰 Стоимость","admin:pricing"),b("🧠 AI","admin:ai"),b("⚙️ Лимиты","admin:limits")],
  [b("👥 Пользователи","admin:users"),b("📊 Метрики","admin:metrics"),b("🧾 Платежи","admin:payments")],
  [b("← Выйти","menu:back")]
]};
export const adminBack={inline_keyboard:[[b("← Назад","admin:menu")]]};
