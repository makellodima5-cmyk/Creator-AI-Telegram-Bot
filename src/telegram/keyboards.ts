export type Lang="ru"|"en";
export const b=(text:string,data:string)=>({text,callback_data:data});
const tr=(lang:Lang,ru:string,en:string)=>lang==="en"?en:ru;
const mark=(ok:boolean,label:string,data:string)=>b(ok?"✅ "+label:label,data);

export type PostDraft={topic:string;platform:string;style:string;length:string;credits?:number;editResultId?:number;parentJobId?:number;resultType?:string};
export type ScriptDraft={topic:string;platform:string;style:string;duration:string;credits?:number;editResultId?:number;parentJobId?:number;resultType?:string};
export type PlanDraft={topic:string;goal:string;platform:string;style:string;credits?:number;editResultId?:number;parentJobId?:number};

export const mainMenu={inline_keyboard:[
 [b("📝 Post","menu:post"),b("🎬 Script","menu:script")],
 [b("♻️ Repurpose","menu:repurpose"),b("📅 Content Plan","menu:plan")],
 [b("💎 Tariffs","menu:pricing"),b("🔹 Credits","menu:credits")]
]};

const labels={
 postPlatform:(v:string,lang:Lang)=>({telegram:"Telegram",instagram:"Instagram",tiktok:"TikTok",youtube:"YouTube"}[v]??tr(lang,"Площадка","Platform")),
 postStyle:(v:string,lang:Lang)=>({expert:"Экспертный",conversational:"Разговорный",news:"Новостной",sales:"Продающий"}[v]??tr(lang,"Стиль","Style")),
 postLength:(v:string,lang:Lang)=>({short:"Короткий",medium:"Средний",long:"Длинный"}[v]??tr(lang,"Размер","Length")),
 scriptPlatform:(v:string,lang:Lang)=>({tiktok:"TikTok",instagram:"Reels",youtube:"YouTube Shorts"}[v]??tr(lang,"Формат","Format")),
 scriptStyle:(v:string,lang:Lang)=>({expert:"Экспертная",conversational:"Разговорная",dynamic:"Динамичная",sales:"Продающая"}[v]??tr(lang,"Стиль","Style")),
 planGoal:(v:string,lang:Lang)=>({growth:"Рост",sales:"Продажи",engagement:"Вовлечение",expertise:"Экспертность"}[v]??tr(lang,"Цель","Goal")),
 planPlatform:(v:string,lang:Lang)=>({telegram:"Telegram",instagram:"Instagram",tiktok:"TikTok",youtube:"YouTube"}[v]??tr(lang,"Площадка","Platform")),
 planStyle:(v:string,lang:Lang)=>({expert:"Экспертный",conversational:"Разговорный",news:"Новостной",sales:"Продающий"}[v]??tr(lang,"Стиль","Style"))
};
export const menuBack=(lang:Lang="ru")=>b(tr(lang,"↩️ В меню","↩️ In menu"),"menu:back");
export const back=(lang:Lang="ru")=>b(tr(lang,"↩️ Назад","↩️ Back"),"menu:back");

export const postConfig=(d:PostDraft,lang:Lang="ru")=>({inline_keyboard:[
 [["telegram","instagram","tiktok","youtube"].map(v=>b((v===d.platform?"✅ ":"")+labels.postPlatform(v,lang),"sel:"+v))].flat(),
 [["expert","conversational","news","sales"].map(v=>b((v===d.style?"✅ ":"")+labels.postStyle(v,lang),"sel:"+v))].flat(),
 [["short","medium","long"].map(v=>b((v===d.length?"✅ ":"")+labels.postLength(v,lang),"sel:"+v))].flat().concat([b(tr(lang,"🚀 Создать пост","🚀 Create post"),"create"),menuBack(lang)])
]});

export const scriptConfig=(d:ScriptDraft,lang:Lang="ru")=>({inline_keyboard:[
 [["tiktok","instagram","youtube"].map(v=>b((v===d.platform?"✅ ":"")+labels.scriptPlatform(v,lang),"sel:"+v))].flat(),
 [["expert","conversational","dynamic","sales"].map(v=>b((v===d.style?"✅ ":"")+labels.scriptStyle(v,lang),"sel:"+v))].flat(),
 [["15","30","45","60"].map(v=>b((v===d.duration?"✅ ":"")+v+(lang==="en"?" sec":" сек"),"sel:"+v))].flat().concat([b(tr(lang,"🚀 Создать сценарий","🚀 Create script"),"create"),menuBack(lang)])
]});

export const planConfig=(d:PlanDraft,lang:Lang="ru")=>({inline_keyboard:[
 [["growth","sales","engagement","expertise"].map(v=>b((v===d.goal?"✅ ":"")+labels.planGoal(v,lang),"sel:"+v))].flat(),
 [["telegram","instagram","tiktok","youtube"].map(v=>b((v===d.platform?"✅ ":"")+labels.planPlatform(v,lang),"sel:"+v))].flat(),
 [["expert","conversational","news","sales"].map(v=>b((v===d.style?"✅ ":"")+labels.planStyle(v,lang),"sel:"+v))].flat().concat([b(tr(lang,"🚀 Создать план","🚀 Create plan"),"create"),menuBack(lang)])
]});

export const optionKeyboard=(options:{text:string;data:string}[],backData:string,lang:Lang="ru")=>{
 const rows:any[][]=[];for(let i=0;i<options.length;i+=2)rows.push(options.slice(i,i+2).map(x=>b(x.text,x.data)));rows.push([b(tr(lang,"↩️ Назад","↩️ Back"),backData)]);return{inline_keyboard:rows};
};

export const repurposeTargets=(selectedOutputs:string[],lang:Lang="ru")=>{
 const labels:[string,string,string][]=[
  ["telegram","📝 Telegram-пост","📝 Telegram post"],
  ["instagram","📸 Instagram caption","📸 Instagram caption"],
  ["tiktok","🎬 TikTok-сценарий","🎬 TikTok script"],
  ["youtube","▶️ YouTube Shorts","▶️ YouTube Shorts"],
  ["hooks","🔥 5 Hook","🔥 5 Hooks"],
  ["cta","🎯 CTA","🎯 CTA"],
  ["plan","📅 Контент на неделю","📅 Content plan"]
 ];
 return{inline_keyboard:[
  labels.slice(0,3).map(([k,ru,en])=>mark(selectedOutputs.includes(k),lang==="en"?en:ru,"target:"+k)),
  labels.slice(3,6).map(([k,ru,en])=>mark(selectedOutputs.includes(k),lang==="en"?en:ru,"target:"+k)),
  [mark(selectedOutputs.includes("plan"),lang==="en"?labels[6][2]:labels[6][1],"target:plan"),b(tr(lang,"🚀 Создать контент","🚀 Create content"),"create"),menuBack(lang)]
 ]};
};

export const postResult=(id:number,lang:Lang="ru")=>({inline_keyboard:[
 [b("📋 "+tr(lang,"Скопировать","Copy"),"copy:"+id),b("✏️ "+tr(lang,"Изменить","Edit"),"edit:"+id)],
 [b("🔄 "+tr(lang,"Другой вариант","Another variant"),"variant:"+id),b("⭐ "+tr(lang,"Сохранить в историю","Save to history"),"save:"+id)]
]});
export const scriptResult=postResult;
export const genericResult=postResult;
export const repurposeResult=postResult;
export const styleResult=postResult;
export const planResult=(jobId:number,days:any[],_resultId:number,lang:Lang="ru")=>{
 const buttons=days.map((d:any,i:number)=>b("📅 "+String(d.day??(lang==="en"?"Day ":"День ")+(i+1))+" · "+String(d.title??"").slice(0,16),"dayview:"+jobId+":"+i));
 return{inline_keyboard:[buttons.slice(0,3),buttons.slice(3,5),buttons.slice(5,7)]};
};

export const historyItem=(id:number,lang:Lang="ru")=>({inline_keyboard:[
 [b("▶️ "+tr(lang,"Продолжить","Continue"),"hcontinue:"+id)],
 [b("📋 "+tr(lang,"Скопировать","Copy"),"hcopy:"+id),b("🗑 "+tr(lang,"Удалить из истории","Delete from history"),"hdelete:"+id)],
 [b("↩️ "+tr(lang,"Назад к истории","Back to history"),"hpage:0")]
]});

export const styleKeyboard=(count:number,lang:Lang="ru")=>{
 if(count<=0)return{inline_keyboard:[[b("✨ "+tr(lang,"Начать анализ","Start analysis"),"style:start")],[menuBack(lang)]]};
 if(count>=20)return{inline_keyboard:[[b("✨ "+tr(lang,"Проанализировать стиль","Analyze style"),"style:analyze")],[menuBack(lang)]]};
 return{inline_keyboard:[[b("➕ "+tr(lang,"Добавить пример","Add example"),"style:add"),b("✨ "+tr(lang,"Проанализировать стиль","Analyze style"),"style:analyze")],[menuBack(lang)]]};
};
export const styleExamples=styleKeyboard;
export const insufficientKeyboard=(lang:Lang="ru")=>({inline_keyboard:[
 [b("🔹 "+tr(lang,"Купить кредиты","Buy credits"),"menu:credits"),b("💎 "+tr(lang,"Изменить тариф","Change plan"),"menu:pricing")],
 [b("❌ "+tr(lang,"Отмена","Cancel"),"cancel")]
]});
export const errorKeyboard=(id:number,lang:Lang="ru")=>({inline_keyboard:[[b("🔄 "+tr(lang,"Попробовать ещё раз","Try again"),"retry:"+id)],[b("❌ "+tr(lang,"Отмена","Cancel"),"cancel")]]});
export const repurposeFailureKeyboard=(id:number,lang:Lang="ru")=>({inline_keyboard:[[b("🔄 "+tr(lang,"Повторить неудачные","Retry failed"),"rep-retry:"+id)]]);
export const settingsKeyboard=(lang:Lang="ru")=>({inline_keyboard:[
 [b("👤 "+tr(lang,"Аккаунт","Account"),"settings:profile"),b("🌐 "+tr(lang,"Язык","Language"),"settings:language")],
 [b("🔔 "+tr(lang,"Уведомления","Notifications"),"settings:notifications"),b("💬 "+tr(lang,"Помощь","Help"),"settings:support")],
 [b("⚖️ "+tr(lang,"Условия использования","Terms of Use"),"settings:terms"),b("🛡️ "+tr(lang,"Конфиденциальность","Privacy"),"settings:privacy")],
 [menuBack(lang)]
]});
export const accountKeyboard=(lang:Lang="ru")=>({inline_keyboard:[[back(lang)] ]});
export const languageKeyboard=(lang:Lang="ru")=>({inline_keyboard:[[b("🇷🇺 Русский","settings:language:ru"),b("🇬🇧 English","settings:language:en")],[back(lang)]]});
export const notificationKeyboard=(enabled:boolean,lang:Lang="ru")=>({inline_keyboard:[[b(enabled?"🔕 "+tr(lang,"Выключить уведомления","Turn off notifications"):"🔔 "+tr(lang,"Включить уведомления","Turn on notifications"),"settings:toggle")],[back(lang)]});
export const helpKeyboard=(lang:Lang="ru",telegramUrl?:string,emailUrl?:string)=>{
 const support=telegramUrl?{text:"💬 "+tr(lang,"Поддержка в Telegram","Telegram support"),url:telegramUrl}:b("💬 "+tr(lang,"Поддержка в Telegram","Telegram support"),"support:telegram");
 const email=emailUrl?{text:"📧 "+tr(lang,"Поддержка по почте","Email support"),url:emailUrl}:b("📧 "+tr(lang,"Поддержка по почте","Email support"),"support:email");
 return{inline_keyboard:[[support,email],[back(lang)] ]};
};
export const creditsKeyboard=(packages=[50,100,250,500],lang:Lang="ru")=>({inline_keyboard:[
 [b("50 🔹","buy:credits:"+packages[0]),b("100 🔹","buy:credits:"+packages[1])],
 [b("250 🔹","buy:credits:"+packages[2]),b("500 🔹","buy:credits:"+packages[3])],
 [back(lang)]
]});
export const tariffsKeyboard=(lang:Lang="ru")=>({inline_keyboard:[[b("⚡ CREATOR","buy:creator"),b("🚀 PRO","buy:pro")],[menuBack(lang)]]);
export const adminMenu=(lang:Lang="ru")=>({inline_keyboard:[
 [b("⚙️ "+tr(lang,"Цены","Prices"),"admin:prices"),b("📊 "+tr(lang,"Статистика","Statistics"),"admin:stats")],
 [b("👤 "+tr(lang,"Пользователи","Users"),"admin:users")],
 [menuBack(lang)]
]});
export const adminPricesMenu=(lang:Lang="ru")=>({inline_keyboard:[
 [b("💎 "+tr(lang,"Тарифы","Plans"),"admin:tariffs"),b("🔹 "+tr(lang,"Пакеты кредитов","Credit packs"),"admin:credit_packages")],
 [b("🤖 "+tr(lang,"AI-операции","AI operations"),"admin:ai_prices"),b("♻️ Repurpose","admin:repurpose_prices")],
 [b(back(lang).text,"admin:menu")]
]});
export const adminBack=(lang:Lang="ru")=>({inline_keyboard:[[b(back(lang).text,"admin:menu")] ]});
export const adminList=(items:{text:string;data:string}[],backData="admin:menu",lang:Lang="ru")=>{const rows:any[][]=[];for(let i=0;i<items.length;i+=2)rows.push(items.slice(i,i+2).map(x=>b(x.text,x.data)));rows.push([b(back(lang).text,backData)]);return{inline_keyboard:rows}};
export const adminUserCard=(id:number,lang:Lang="ru")=>({inline_keyboard:[
 [b("💎 "+tr(lang,"Выдать тариф","Grant plan"),"admin:grant_tariff:"+id),b("🔹 "+tr(lang,"Выдать кредиты","Grant credits"),"admin:grant_credits:"+id)],
 [b(back(lang).text,"admin:users")]
]});
