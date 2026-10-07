const b=(text:string,data:string)=>({text,callback_data:data});
const copy=(text:string)=>({text:"📋 Скопировать",copy_text:{text:text.slice(0,256)}});
export const mainMenu={inline_keyboard:[
[b("📝 Пост","menu:post"),b("🎬 Сценарий","menu:script")],
[b("♻️ Переработка","menu:repurpose"),b("📅 Контент-план","menu:plan")],
[b("👤 Мой стиль","menu:style"),b("🕘 История","menu:history")],
[b("💎 Тарифы","menu:pricing"),b("⭐ Credits","menu:credits")],
[b("⚙️ Настройки","menu:settings")]]};
export const persistentMenu={keyboard:[
[{text:"📝 Пост"},{text:"🎬 Сценарий"}],[{text:"♻️ Переработка"},{text:"📅 Контент-план"}],
[{text:"👤 Мой стиль"},{text:"🕘 История"}],[{text:"💎 Тарифы"},{text:"⭐ Credits"}],[{text:"⚙️ Настройки"}]
],resize_keyboard:true,is_persistent:true};
export type PostDraft={topic:string;platform:string;style:string;length:string;credits?:number};
export type ScriptDraft={topic:string;platform:string;style:string;duration:string;credits?:number};
export type PlanDraft={topic:string;goal:string;platform:string;style:string;credits?:number};
const sel=(v:string,k:string,label:string)=>b(v===k?"✅ "+label:label,k);
export const postConfig=(d:PostDraft)=>({inline_keyboard:[
[sel(d.platform,"telegram","📱 Telegram"),sel(d.platform,"instagram","📸 Instagram")],
[sel(d.platform,"tiktok","🎵 TikTok"),sel(d.platform,"youtube","▶️ YouTube")],
[sel(d.style,"expert","💼 Экспертный"),sel(d.style,"conversational","😎 Разговорный")],
[sel(d.style,"news","📰 Новостной"),sel(d.style,"sales","💰 Продающий")],
[sel(d.length,"short","⚡ Короткий"),sel(d.length,"medium","📝 Средний")],[sel(d.length,"long","📚 Длинный")],
[b("🚀 Создать пост","post:create")],[b("← Назад","post:back")]]});
export const scriptConfig=(d:ScriptDraft)=>({inline_keyboard:[
[sel(d.platform,"tiktok","🎵 TikTok"),sel(d.platform,"instagram","📸 Reels")],[sel(d.platform,"youtube","▶️ YouTube Shorts")],
[sel(d.style,"expert","💼 Экспертная"),sel(d.style,"conversational","😎 Разговорная")],[sel(d.style,"dynamic","⚡ Динамичная"),sel(d.style,"sales","💰 Продающая")],
[sel(d.duration,"15","15 сек"),sel(d.duration,"30","30 сек")],[sel(d.duration,"45","45 сек"),sel(d.duration,"60","60 сек")],
[b("🚀 Создать сценарий","script:create")],[b("← Назад","script:back")]]});
export const planConfig=(d:PlanDraft)=>({inline_keyboard:[
[sel(d.goal,"growth","📈 Рост"),sel(d.goal,"sales","💰 Продажи")],[sel(d.goal,"engagement","❤️ Вовлечение"),sel(d.goal,"expertise","🧠 Экспертность")],
[sel(d.platform,"telegram","📱 Telegram"),sel(d.platform,"instagram","📸 Instagram")],[sel(d.platform,"tiktok","🎵 TikTok"),sel(d.platform,"youtube","▶️ YouTube")],
[sel(d.style,"expert","💼 Экспертный"),sel(d.style,"conversational","😎 Разговорный")],[sel(d.style,"news","📰 Новостной"),sel(d.style,"sales","💰 Продающий")],
[b("🚀 Создать план","plan:create")],[b("← Назад","plan:back")]]});
export const repurposeTargets=(selected:string[])=>({inline_keyboard:[
[b(selected.includes("all")?"✅ Выбрать всё":"🚀 Выбрать всё","rep:target:all")],
[b(selected.includes("telegram")?"✅ Telegram":"📱 Telegram","rep:target:telegram"),b(selected.includes("instagram")?"✅ Instagram":"📸 Instagram","rep:target:instagram")],
[b(selected.includes("tiktok")?"✅ TikTok":"🎵 TikTok","rep:target:tiktok"),b(selected.includes("youtube")?"✅ YouTube Shorts":"▶️ YouTube Shorts","rep:target:youtube")],
[b(selected.includes("hooks")?"✅ 5 Hook":"🔥 5 Hook","rep:target:hooks"),b(selected.includes("cta")?"✅ CTA":"🎯 CTA","rep:target:cta")],
[b(selected.includes("plan")?"✅ Контент на неделю":"📅 Контент на неделю","rep:target:plan")],[b("🚀 Создать контент","rep:create")],[b("← Назад","rep:back")]]});
export const repurposeConfirm=()=>({inline_keyboard:[[b("🚀 Создать контент","rep:confirm-create")],[b("← Назад","rep:back-confirm")]]});
export const postResult=(id:number,text="")=>({inline_keyboard:[[copy(text),b("✏️ Изменить","post:edit:"+id)],[b("🔄 Другой вариант","post:variant:"+id),b("⭐ Сохранить в историю","save:"+id)],[b("← Назад","post:back-result:"+id)]]});
export const scriptResult=(id:number,text="")=>({inline_keyboard:[[copy(text),b("✏️ Изменить","script:edit:"+id)],[b("🔄 Другой вариант","script:variant:"+id),b("⭐ Сохранить в историю","save:"+id)],[b("← Назад","script:back-result:"+id)]]});
export const planResult=(id:number,days:any[])=>({inline_keyboard:[...days.slice(0,7).map((d:any,i:number)=>[b("🚀 "+d.day+" · "+String(d.title).slice(0,24),"plan:item:"+id+":"+i)]),[b("🔄 Другой вариант","plan:variant:"+id),b("⭐ Сохранить в историю","save:"+id)],[b("← Назад","plan:back-result:"+id)]]});
export const repurposeResult=(id:number)=>({inline_keyboard:[[b("📱 Telegram","rep:view:"+id+":telegram"),b("📸 Instagram","rep:view:"+id+":instagram")],[b("🎵 TikTok","rep:view:"+id+":tiktok"),b("▶️ YouTube Shorts","rep:view:"+id+":youtube")],[b("🔥 5 Hook","rep:view:"+id+":hooks"),b("🎯 CTA","rep:view:"+id+":cta")],[b("📅 Контент на неделю","rep:view:"+id+":plan")],[b("🔄 Другой вариант","rep:variant:"+id),b("⭐ Сохранить в историю","save:"+id)],[b("← Назад","rep:back-result:"+id)]]});
export const pricingKeyboard={inline_keyboard:[[b("⚡ Взять CREATOR — 99 ⭐","buy:creator")],[b("🚀 Взять PRO — 299 ⭐","buy:pro")],[b("⭐ Купить Credits","menu:credits")],[b("← Назад","menu:back")]]};
export const creditsKeyboard=(packages=[50,100,250,500])=>({inline_keyboard:[...packages.map(n=>[b("⭐ "+n+" кредитов","buy:credits:"+n)]),[b("💎 Изменить тариф","menu:pricing")],[b("← Назад","menu:back")]]});
export const settingsKeyboard={inline_keyboard:[[b("👤 Аккаунт","settings:profile"),b("🌐 Язык","settings:language")],[b("🔔 Уведомления","settings:notifications"),b("💬 Помощь","settings:support")],[b("⚖️ Условия использования","settings:terms")],[b("🛡️ Конфиденциальность","settings:privacy")],[b("← Назад","menu:back")]]};
export const languageKeyboard={inline_keyboard:[[b("🇷🇺 Русский","settings:language:ru"),b("🇬🇧 English","settings:language:en")],[b("← Назад","menu:settings")]]};
export const notificationKeyboard=(enabled:boolean)=>({inline_keyboard:[[b(enabled?"🔕 Выключить уведомления":"🔔 Включить уведомления","settings:toggle-notifications")],[b("← Назад","menu:settings")]]});
export const errorKeyboard=(id:number)=>({inline_keyboard:[[b("🔄 Повторить","retry:"+id)],[b("❌ Отмена","error:cancel:"+id)]]});