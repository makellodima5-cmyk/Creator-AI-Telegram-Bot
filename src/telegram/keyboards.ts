const b=(text:string,data:string)=>({text,callback_data:data});
const copy=(text:string)=>({text:"📋 Копировать",copy_text:{text:text.slice(0,256)}});

export const mainMenu={inline_keyboard:[
[b("📝 Пост","menu:post"),b("🎬 Сценарий","menu:script")],
[b("♻️ Переработка","menu:repurpose"),b("📅 Контент-план","menu:plan")],
[b("👤 Мой стиль","menu:style"),b("🕘 История","menu:history")],
[b("💎 Тарифы","menu:pricing"),b("⭐ Credits","menu:credits")],
[b("⚙️ Настройки","menu:settings")],
]};

export const persistentMenu={keyboard:[
[{text:"📝 Пост"},{text:"🎬 Сценарий"}],[{text:"♻️ Переработка"},{text:"📅 Контент-план"}],[{text:"👤 Мой стиль"},{text:"🕘 История"}],[{text:"💎 Тарифы"},{text:"⭐ Credits"}],[{text:"⚙️ Настройки"}]
],resize_keyboard:true,is_persistent:true};

export type PostDraft={topic:string;platform:string;style:string;length:string};
export type ScriptDraft={topic:string;platform:string;style:string;duration:string};
export type PlanDraft={topic:string;goal:string;platform:string;style:string};

const sel=(v:string,k:string,label:string)=>b(v===k?"✅ "+label:label, k);
export const postConfig=(d:PostDraft)=>({inline_keyboard:[
 [sel(d.platform,"telegram","📱 Telegram"),sel(d.platform,"instagram","📸 Instagram")],
 [sel(d.platform,"tiktok","🎵 TikTok"),sel(d.platform,"youtube","▶️ YouTube")],
 [sel(d.style,"expert","💼 Экспертный"),sel(d.style,"provocative","🔥 Провокационный")],
 [sel(d.style,"conversational","😎 Разговорный"),sel(d.style,"news","📰 Новостной")],
 [sel(d.style,"sales","💰 Продающий")],
 [sel(d.length,"short","⚡ Короткая"),sel(d.length,"medium","📝 Средняя")],
 [sel(d.length,"long","📚 Длинная")],
 [b("🚀 Создать","post:create")],[b("← Назад","post:back")]
]});

export const scriptConfig=(d:ScriptDraft)=>({inline_keyboard:[
 [sel(d.platform,"tiktok","🎵 TikTok"),sel(d.platform,"instagram","📸 Reels")],
 [sel(d.platform,"youtube","▶️ YouTube Shorts")],
 [sel(d.style,"dynamic","⚡ Динамичный"),sel(d.style,"expert","💼 Экспертный")],
 [sel(d.style,"conversational","😎 Разговорный"),sel(d.style,"sales","💰 Продающий")],
 [sel(d.duration,"15","15 сек"),sel(d.duration,"30","30 сек")],
 [sel(d.duration,"45","45 сек"),sel(d.duration,"60","60 сек")],
 [b("🚀 Создать","script:create")],[b("← Назад","script:back")]
]});

export const planConfig=(d:PlanDraft)=>({inline_keyboard:[
 [sel(d.goal,"growth","📈 Рост"),sel(d.goal,"sales","💰 Продажи")],
 [sel(d.goal,"engagement","❤️ Вовлечение"),sel(d.goal,"expertise","🧠 Экспертность")],
 [sel(d.platform,"telegram","📱 Telegram"),sel(d.platform,"instagram","📸 Instagram")],
 [sel(d.platform,"tiktok","🎵 TikTok"),sel(d.platform,"youtube","▶️ YouTube")],
 [sel(d.style,"expert","💼 Экспертный"),sel(d.style,"conversational","😎 Разговорный")],
 [sel(d.style,"dynamic","⚡ Динамичный"),sel(d.style,"sales","💰 Продающий")],
 [b("🚀 Создать","plan:create")],[b("← Назад","plan:back")]
]});

export const repurposeTargets=(selected:string[])=>({inline_keyboard:[
 [b(selected.includes("all")?"✅ Выбрать всё":"🚀 Выбрать всё","rep:target:all")],
 [b(selected.includes("telegram")?"✅ Telegram":"📱 Telegram","rep:target:telegram"),b(selected.includes("instagram")?"✅ Instagram":"📸 Instagram","rep:target:instagram")],
 [b(selected.includes("tiktok")?"✅ TikTok":"🎵 TikTok","rep:target:tiktok"),b(selected.includes("youtube")?"✅ YouTube Shorts":"▶️ YouTube Shorts","rep:target:youtube")],
 [b(selected.includes("hooks")?"✅ 5 Hooks":"🔥 5 Hooks","rep:target:hooks"),b(selected.includes("cta")?"✅ CTA":"🎯 CTA","rep:target:cta")],
 [b(selected.includes("plan")?"✅ Контент на неделю":"📅 Контент на неделю","rep:target:plan")],
 [b("🚀 Создать","rep:create")],[b("← Назад","rep:back")]
]});
export const repurposeConfirm=()=>({inline_keyboard:[[b("🚀 Создать","rep:confirm-create")],[b("← Назад","rep:back-confirm")]]});

export const postResult=(jobId:number,copyText="")=>({inline_keyboard:[
 [b("🔄 Ещё вариант",`post:regen:${jobId}`),b("🔥 Сильнее Hook",`post:hook:${jobId}`)],
 [b("✂️ Сократить",`post:shorten:${jobId}`),b("🎬 Сценарий",`post:script:${jobId}`)],
 [copy(copyText)],[b("← Назад",`post:back-result:${jobId}`)]
]});
export const scriptResult=(jobId:number,copyText="")=>({inline_keyboard:[
 [b("🔄 Другой вариант",`script:regen:${jobId}`),b("🔥 Сильнее Hook",`script:hook:${jobId}`)],
 [b("✂️ Сделать короче",`script:shorten:${jobId}`),copy(copyText)],[b("← Назад",`script:back-result:${jobId}`)]
]});
export const planResult=(jobId:number,days:any[])=>({inline_keyboard:[...days.slice(0,7).map((d:any,i:number)=>[b("🚀 "+d.day+" · "+String(d.title).slice(0,24),`plan:item:${jobId}:${i}`)]),[b("← Назад",`plan:back-result:${jobId}`)]]});
export const repurposeResult=(jobId:number)=>({inline_keyboard:[
 [b("📱 Telegram",`rep:view:${jobId}:telegram`),b("📸 Instagram",`rep:view:${jobId}:instagram`)],
 [b("🎵 TikTok",`rep:view:${jobId}:tiktok`),b("▶️ YouTube Shorts",`rep:view:${jobId}:youtube`)],
 [b("🔥 5 Hooks",`rep:view:${jobId}:hooks`),b("🎯 CTA",`rep:view:${jobId}:cta`)],
 [b("📅 Контент на неделю",`rep:view:${jobId}:plan`)],[b("← Назад",`rep:back-result:${jobId}`)]
]});
export const pricingKeyboard={inline_keyboard:[[b("🔥 Взять Creator — 99 ⭐","buy:creator")],[b("⚡ Взять Pro — 299 ⭐","buy:pro")],[b("⭐ Купить Credits","buy:credits")],[b("← Назад","menu:back")]]};
export const creditsKeyboard={inline_keyboard:[[b("⭐ Купить Credits","buy:credits")],[b("💎 Улучшить тариф","menu:pricing")],[b("← Назад","menu:back")]]};
export const settingsKeyboard={inline_keyboard:[
 [b("🌐 Язык","settings:language"),b("🔔 Уведомления","settings:notifications")],
 [b("👤 Профиль","settings:profile"),b("💎 Мой тариф","menu:pricing")],
 [b("📜 Условия","settings:terms"),b("🔒 Приватность","settings:privacy")],
 [b("💬 Поддержка","settings:support")],[b("← Назад","menu:back")]
]};
export const languageKeyboard={inline_keyboard:[[b("🇷🇺 Русский","settings:language:ru"),b("🇬🇧 English","settings:language:en")],[b("← Назад","menu:settings")]]};
export const notificationKeyboard=(enabled:boolean)=>({inline_keyboard:[[b(enabled?"🔕 Выключить уведомления":"🔔 Включить уведомления","settings:toggle-notifications")],[b("← Назад","menu:settings")]]});
