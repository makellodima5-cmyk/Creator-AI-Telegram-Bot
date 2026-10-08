import type{Bindings}from"./env";
import{editMessageText,sendMessage}from"./telegram/api";
import{adminMenu,adminPricesMenu,adminBack,adminList,adminUserCard}from"./telegram/keyboards";
import{addTransaction}from"./billing/credits";

type A=Record<string,any>;
type Lang="ru"|"en";
const now=()=>Date.now();
const tr=(lang:Lang,ru:string,en:string)=>lang==="en"?en:ru;

export async function isAdmin(env:Bindings,telegramId:string){
 const x=await env.DB.prepare("SELECT au.user_id FROM admin_users au JOIN users u ON u.id=au.user_id WHERE u.telegram_id=? AND u.role='admin'").bind(String(telegramId)).first<A>();
 return !!x;
}
export async function ensureAdminSeed(env:Bindings){
 const n=now();
 for(const[k,v]of[["job_max_attempts","3"],["delivery_max_attempts","5"],["delivery_backoff_seconds","[15,60,300,900,3600]"]])await env.DB.prepare("INSERT OR IGNORE INTO settings(key,value,updated_at) VALUES(?,?,?)").bind(k,v,n).run();
 for(const id of String(env.ADMIN_TELEGRAM_IDS??"").split(",").map(x=>x.trim()).filter(Boolean)){
  const u=await env.DB.prepare("SELECT id FROM users WHERE telegram_id=?").bind(id).first<A>();
  if(u){await env.DB.prepare("INSERT OR IGNORE INTO admin_users(user_id,created_at) VALUES(?,?)").bind(Number(u.id),n).run();await env.DB.prepare("UPDATE users SET role='admin',updated_at=? WHERE id=?").bind(n,Number(u.id)).run();}
 }
}
export async function openAdmin(env:Bindings,chatId:string,lang:Lang="ru"){return sendMessage(env,chatId,tr(lang,"👨‍💻 Админ-панель","👨‍💻 Admin Panel"),adminMenu(lang));}

const priceKeys=["post","script","content_plan","post_edit","post_variant","script_edit","script_variant","content_plan_variant","style_profile"];
const repKeys=["repurpose_telegram","repurpose_instagram","repurpose_tiktok","repurpose_youtube","repurpose_hooks","repurpose_cta","repurpose_plan"];

async function claimAudit(env:Bindings,adminId:number,action:string,targetUserId:number|null,entityType:string,entityId:number|null,oldValue:any,newValue:any,idempotencyKey:string){
 const r=await env.DB.prepare("INSERT OR IGNORE INTO admin_audit_log(admin_user_id,action,target_user_id,entity_type,entity_id,old_value_json,new_value_json,idempotency_key,created_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(adminId,action,targetUserId,entityType,entityId,JSON.stringify(oldValue??null),JSON.stringify(newValue??null),idempotencyKey,now()).run();
 return r.meta.changes===1;
}
export async function setSetting(env:Bindings,key:string,value:string,adminId:number,idempotencyKey="setting:"+adminId+":"+key+":"+value){
 const old=await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind(key).first<A>();
 if(!(await claimAudit(env,adminId,"setting.update",null,"settings",null,old,{key,value},idempotencyKey)))return true;
 await env.DB.prepare("INSERT INTO settings(key,value,updated_at,updated_by) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by").bind(key,value,now(),adminId).run();
 return true;
}
export async function setPrice(env:Bindings,key:string,credits:number,adminId:number,idempotencyKey="price:"+adminId+":"+key+":"+credits){
 if(!Number.isFinite(credits)||credits<0)return false;const old=await env.DB.prepare("SELECT * FROM pricing WHERE key=?").bind(key).first<A>();if(!old)return false;
 if(!(await claimAudit(env,adminId,"pricing.update",null,"pricing",Number(old.id),old,{key,credits_cost:Math.floor(credits)},idempotencyKey)))return true;
 const up=await env.DB.prepare("UPDATE pricing SET credits_cost=?,updated_at=?,updated_by=? WHERE key=?").bind(Math.floor(credits),now(),adminId,key).run();return up.meta.changes===1;
}
export async function setStarsPrice(env:Bindings,key:string,stars:number,adminId:number,idempotencyKey="stars:"+adminId+":"+key+":"+stars){
 if(!Number.isFinite(stars)||stars<0)return false;const old=await env.DB.prepare("SELECT * FROM pricing WHERE key=?").bind(key).first<A>();if(!old)return false;
 if(!(await claimAudit(env,adminId,"pricing.stars_update",null,"pricing",Number(old.id),old,{key,stars_price:Math.floor(stars)},idempotencyKey)))return true;
 const up=await env.DB.prepare("UPDATE pricing SET stars_price=?,updated_at=?,updated_by=? WHERE key=?").bind(Math.floor(stars),now(),adminId,key).run();return up.meta.changes===1;
}
export async function setIncludedCredits(env:Bindings,key:string,credits:number,adminId:number,idempotencyKey="included:"+adminId+":"+key+":"+credits){
 if(!Number.isFinite(credits)||credits<0)return false;const old=await env.DB.prepare("SELECT * FROM pricing WHERE key=?").bind(key).first<A>();if(!old)return false;
 if(!(await claimAudit(env,adminId,"pricing.credits_update",null,"pricing",Number(old.id),old,{key,included_credits:Math.floor(credits)},idempotencyKey)))return true;
 const up=await env.DB.prepare("UPDATE pricing SET included_credits=?,updated_at=?,updated_by=? WHERE key=?").bind(Math.floor(credits),now(),adminId,key).run();return up.meta.changes===1;
}
export async function adminAction(env:Bindings,userId:number,chatId:string,data:string,msg:any,updateId=0){
 const u=await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(userId).first<A>();if(!u||!(await isAdmin(env,String(u.telegram_id||""))))return;
 const m=Number(msg?.message_id||0),lang:Lang=String(u.language)==="en"?"en":"ru",back=tr(lang,"↩️ Назад","↩️ Back");
 if(data==="admin:menu")return m?editMessageText(env,chatId,m,tr(lang,"👨‍💻 Админ-панель","👨‍💻 Admin Panel"),adminMenu(lang)):openAdmin(env,chatId,lang);
 if(data==="admin:stats"||data.startsWith("admin:stats:")){
  const period=data.endsWith(":7d")?"7d":data.endsWith(":30d")?"30d":"today",since=now()-(period==="7d"?7*86400000:period==="30d"?30*86400000:86400000);
  const count=async(sql:string)=>Number((await env.DB.prepare(sql).bind(since).first<A>())?.c??0);
  const users=Number((await env.DB.prepare("SELECT COUNT(*) c FROM users").first<A>())?.c??0),newUsers=await count("SELECT COUNT(*) c FROM users WHERE created_at>=?"),active=await count("SELECT COUNT(*) c FROM users WHERE last_seen_at>=?");
  const generations=await count("SELECT COUNT(*) c FROM jobs WHERE created_at>=? AND type NOT IN ('source_analysis')"),success=await count("SELECT COUNT(*) c FROM jobs WHERE created_at>=? AND status='completed'"),errors=await count("SELECT COUNT(*) c FROM jobs WHERE created_at>=? AND status IN ('failed','partial')");
  const credits=await count("SELECT COALESCE(SUM(CASE WHEN type='reserve' THEN -delta ELSE 0 END),0) c FROM credit_transactions WHERE created_at>=?");
  const aiCostMicros=Number((await env.DB.prepare("SELECT COALESCE(SUM(cost_usd_micros),0) c FROM job_attempts WHERE created_at>=?").bind(since).first<A>())?.c??0),aiCost=aiCostMicros/1e6;
  const revenue=await count("SELECT COALESCE(SUM(stars_amount),0) c FROM payments WHERE created_at>=? AND status='paid'");
  const starsRate=Number((await env.DB.prepare("SELECT value FROM settings WHERE key='stars_usd_rate'").first<A>())?.value??0),margin=starsRate>0?(((revenue*starsRate-aiCost)/(revenue*starsRate))*100):null;
  const label=period==="today"?tr(lang,"Сегодня","Today"):period==="7d"?tr(lang,"7 дней","7 days"):tr(lang,"30 дней","30 days");
  const body=lang==="en"?`📊 Statistics\n\nPeriod: ${label}\n\n👥 Users: ${users}\n🆕 New users: ${newUsers}\n\n🟢 Active: ${active}\n\n🤖 Generations: ${generations}\n✅ Successful: ${success}\n❌ Errors: ${errors}\n\n🔹 Credits spent: ${credits}\n💵 AI Cost: $${aiCost.toFixed(2)}\n⭐ Revenue: ${revenue} ⭐\n📈 Gross Margin: ${margin===null?"—":margin.toFixed(1)+"%"}`:`📊 Статистика\n\nПериод: ${label}\n\n👥 Пользователи: ${users}\n🆕 Новые пользователи: ${newUsers}\n\n🟢 Активные: ${active}\n\n🤖 Генераций: ${generations}\n✅ Успешных: ${success}\n❌ Ошибок: ${errors}\n\n🔹 Потрачено кредитов: ${credits}\n💵 AI Cost: $${aiCost.toFixed(2)}\n⭐ Revenue: ${revenue} ⭐\n📈 Gross Margin: ${margin===null?"—":margin.toFixed(1)+"%"}`;
  return editMessageText(env,chatId,m,body,{inline_keyboard:[[{text:tr(lang,"Сегодня","Today"),callback_data:"admin:stats:today"},{text:"7 "+tr(lang,"дней","days"),callback_data:"admin:stats:7d"},{text:"30 "+tr(lang,"дней","days"),callback_data:"admin:stats:30d"}],[{text:back,callback_data:"admin:menu"}]]});
 }
 if(data==="admin:prices")return editMessageText(env,chatId,m,tr(lang,"⚙️ Цены\n\nВыбери, что изменить:","⚙️ Prices\n\nChoose what to change:"),adminPricesMenu(lang));
 if(data==="admin:tariffs")return editMessageText(env,chatId,m,tr(lang,"💎 Цены тарифов","💎 Tariff prices"),{inline_keyboard:[[{text:"⚡ CREATOR",callback_data:"admin:tariff:creator"},{text:"🚀 PRO",callback_data:"admin:tariff:pro"}],[{text:back,callback_data:"admin:prices"}]]});
 if(data==="admin:credit_packages"){const vals=[50,100,250,500].map(n=>({text:n+" 🔹",callback_data:"admin:credit:"+n}));const rows=await Promise.all(vals.map(async v=>v.text+" — "+Number((await env.DB.prepare("SELECT stars_price FROM pricing WHERE key=?").bind("credits_"+v.text.split(" ")[0]).first<A>())?.stars_price??0)+" ⭐"));return editMessageText(env,chatId,m,(lang==="en"?"🔹 Credit packs\n\n":"🔹 Пакеты кредитов\n\n")+rows.join("\n"),{inline_keyboard:[[...vals.slice(0,2)],[...vals.slice(2)],[{text:back,callback_data:"admin:prices"}]]});}
 if(data==="admin:ai_prices"){const labels:any={post:["📝 Post","📝 Post"],script:["🎬 Script","🎬 Script"],content_plan:["📅 Content Plan","📅 Content Plan"],post_edit:["✏️ Edit","✏️ Edit"],post_variant:["🔄 Other Variant","🔄 Other Variant"],script_edit:["✏️ Edit Script","✏️ Edit Script"],script_variant:["🔄 Other Variant Script","🔄 Other Variant Script"],content_plan_variant:["🔄 Other Variant Plan","🔄 Other Variant Plan"],style_profile:["🧠 My Style","🧠 My Style"]};const items=await Promise.all(priceKeys.map(async k=>({text:(labels[k]?.[lang==="en"?1:0]??k)+" — "+Number((await env.DB.prepare("SELECT credits_cost FROM pricing WHERE key=?").bind(k).first<A>())?.credits_cost??0)+" 🔹",data:"admin:ai:"+k})));return editMessageText(env,chatId,m,tr(lang,"🤖 Стоимость генераций","🤖 Generation prices"),adminList(items,"admin:prices",lang));}
 if(data==="admin:repurpose_prices"){const labels:any={telegram:["Telegram Post","Telegram Post"],instagram:["Instagram Caption","Instagram Caption"],tiktok:["TikTok Script","TikTok Script"],youtube:["YouTube Shorts","YouTube Shorts"],hooks:["5 Hooks","5 Hooks"],cta:["CTA","CTA"],plan:["Content Plan","Content Plan"]};const items=await Promise.all(repKeys.map(async k=>{const short=k.replace("repurpose_",""),icon=short==="telegram"?"📝 ":short==="instagram"?"📱 ":short==="tiktok"?"🎬 ":short==="youtube"?"▶️ ":short==="hooks"?"🔥 ":short==="cta"?"🎯 ":"📅 ";return{text:icon+(labels[short]?.[lang==="en"?1:0]??short)+" — "+Number((await env.DB.prepare("SELECT credits_cost FROM pricing WHERE key=?").bind(k).first<A>())?.credits_cost??0)+" 🔹",data:"admin:rep:"+short}}));return editMessageText(env,chatId,m,"♻️ Repurpose",adminList(items,"admin:prices",lang));}
 if(data.startsWith("admin:ai:")){const key=data.slice(9);if(!priceKeys.includes(key))return;const p=await env.DB.prepare("SELECT credits_cost FROM pricing WHERE key=?").bind(key).first<A>();return editMessageText(env,chatId,m,key+"\n\n"+tr(lang,"Текущая стоимость:","Current cost:")+"\n"+Number(p?.credits_cost??0)+" 🔹",{inline_keyboard:[[{text:tr(lang,"💳 Изменить стоимость","💳 Change cost"),callback_data:"admin:ai_edit:"+key}],[{text:back,callback_data:"admin:ai_prices"}]]});}
 if(data.startsWith("admin:rep:")){const key=data.slice(10);if(!repKeys.includes("repurpose_"+key))return;const p=await env.DB.prepare("SELECT credits_cost FROM pricing WHERE key=?").bind("repurpose_"+key).first<A>();return editMessageText(env,chatId,m,key+"\n\n"+tr(lang,"Текущая стоимость:","Current cost:")+"\n"+Number(p?.credits_cost??0)+" 🔹",{inline_keyboard:[[{text:tr(lang,"💳 Изменить стоимость","💳 Change cost"),callback_data:"admin:rep_edit:"+key}],[{text:back,callback_data:"admin:repurpose_prices"}]]});}
 if(data.startsWith("admin:tariff:"))return tariffCard(env,chatId,m,data.slice(13),lang);
 if(data.startsWith("admin:credit:"))return creditCard(env,chatId,m,Number(data.slice(13)),lang);
 if(data.startsWith("admin:ai_edit:")||data.startsWith("admin:rep_edit:")||data.startsWith("admin:tariff_edit_price:")||data.startsWith("admin:tariff_edit_credits:")||data.startsWith("admin:credit_edit:")){
  const mode=data.startsWith("admin:ai_edit:")?"ai_edit":data.startsWith("admin:rep_edit:")?"rep_edit":data.startsWith("admin:tariff_edit_price:")?"tariff_price":data.startsWith("admin:tariff_edit_credits:")?"tariff_credits":"credit_price";
  const prefix=mode==="ai_edit"?"admin:ai_edit:":mode==="rep_edit"?"admin:rep_edit:":mode==="tariff_price"?"admin:tariff_edit_price:":mode==="tariff_credits"?"admin:tariff_edit_credits:":"admin:credit_edit:";
  await saveAdminInput(env,userId,mode,data.slice(prefix.length));return editMessageText(env,chatId,m,tr(lang,"Введи новое значение числом.","Enter the new value as a number."),adminBack(lang));
 }
 if(data==="admin:users")return editMessageText(env,chatId,m,tr(lang,"👤 Пользователи\n\nВыбери поиск пользователя.","👤 Users\n\nChoose user search."),{inline_keyboard:[[{text:tr(lang,"🔎 Найти пользователя","🔎 Find user"),callback_data:"admin:user_search"}],[{text:back,callback_data:"admin:menu"}]]});
 if(data==="admin:user_search"){await saveAdminInput(env,userId,"user_search","");return editMessageText(env,chatId,m,tr(lang,"🔎 Введи Telegram ID пользователя.","🔎 Enter Telegram ID:"),adminBack(lang));}
 if(data.startsWith("admin:user:"))return userCard(env,chatId,m,Number(data.slice(10)),lang);
 if(data.startsWith("admin:grant_tariff:"))return grantTariffMenu(env,chatId,m,Number(data.slice(18)),lang);
 if(data.startsWith("admin:grant_credits:"))return grantCreditsMenu(env,chatId,m,Number(data.slice(19)),lang);
 if(data.startsWith("admin:grant_tariff_apply:")){const p=data.split(":");return grantTariff(env,userId,chatId,Number(p[3]),p[4],updateId);}
 if(data.startsWith("admin:grant_credits_apply:")){const p=data.split(":");return grantCredits(env,userId,chatId,Number(p[3]),Number(p[4]),updateId);}
 if(data.startsWith("admin:grant_credits_other:")){const p=data.split(":");await saveAdminInput(env,userId,"grant_credits_other",p[3]);return editMessageText(env,chatId,m,tr(lang,"Введи количество кредитов числом.","Enter credit amount:"),adminBack(lang));}
}
async function planButtons(env:Bindings,key:string){return[{text:key==="creator"?"⚡ CREATOR":"🚀 PRO",callback_data:"admin:tariff:"+key},{text:Number((await env.DB.prepare("SELECT stars_price FROM pricing WHERE key=?").bind(key).first<A>())?.stars_price??0)+" ⭐",callback_data:"admin:tariff:"+key}]}
async function tariffCard(env:Bindings,chatId:string,m:number,key:string,lang:Lang){const p=await env.DB.prepare("SELECT * FROM pricing WHERE key=?").bind(key).first<A>();if(!p)return;return editMessageText(env,chatId,m,(key==="creator"?"⚡ CREATOR":"🚀 PRO")+"\n\n"+tr(lang,"Текущая цена:","Current price:")+"\n"+Number(p.stars_price??0)+" ⭐ / "+tr(lang,"месяц","month")+"\n\n"+tr(lang,"Кредитов:","Credits:")+"\n"+Number(p.included_credits??0)+" 🔹",{inline_keyboard:[[{text:tr(lang,"💳 Изменить цену","💳 Change price"),callback_data:"admin:tariff_edit_price:"+key},{text:tr(lang,"🔹 Изменить кредиты","🔹 Change credits"),callback_data:"admin:tariff_edit_credits:"+key}],[{text:backText(lang),callback_data:"admin:tariffs"}]]})}
async function creditCard(env:Bindings,chatId:string,m:number,n:number,lang:Lang){const p=await env.DB.prepare("SELECT stars_price FROM pricing WHERE key=?").bind("credits_"+n).first<A>();return editMessageText(env,chatId,m,"🔹 "+n+" "+tr(lang,"кредитов","credits")+"\n\n"+tr(lang,"Текущая цена:","Current price:")+" "+Number(p?.stars_price??0)+" ⭐",{inline_keyboard:[[{text:tr(lang,"💳 Изменить цену","💳 Change price"),callback_data:"admin:credit_edit:"+n}],[{text:backText(lang),callback_data:"admin:credit_packages"}]]})}
const backText=(lang:Lang)=>lang==="en"?"↩️ Back":"↩️ Назад";
async function saveAdminInput(env:Bindings,userId:number,mode:string,key:string){await env.DB.prepare("INSERT INTO user_sessions(user_id,flow,step,draft_json,expires_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET flow=excluded.flow,step=excluded.step,draft_json=excluded.draft_json,expires_at=excluded.expires_at,updated_at=excluded.updated_at").bind(userId,"admin",mode,JSON.stringify({mode,key}),now()+3600000,now()).run();}
export async function applyAdminValue(env:Bindings,userId:number,chatId:string,value:string,updateId=0){
 const s=await env.DB.prepare("SELECT * FROM user_sessions WHERE user_id=? AND flow='admin'").bind(userId).first<A>(),u=await env.DB.prepare("SELECT telegram_id,language FROM users WHERE id=?").bind(userId).first<A>();if(!s||!u||!(await isAdmin(env,String(u.telegram_id||""))))return;const lang:Lang=String(u.language)==="en"?"en":"ru",d=JSON.parse(String(s.draft_json||"{}")),n=Number(value.trim());
 if(d.mode==="user_search"){const target=await env.DB.prepare("SELECT id FROM users WHERE telegram_id=?").bind(value.trim()).first<A>();await env.DB.prepare("DELETE FROM user_sessions WHERE user_id=?").bind(userId).run();return target?sendMessage(env,chatId,tr(lang,"✅ Пользователь найден.","✅ User found."),adminUserCard(Number(target.id),lang)):sendMessage(env,chatId,tr(lang,"Пользователь не найден.","User not found."),adminBack(lang))}
 if(d.mode==="grant_credits_other"){if(!Number.isInteger(n)||n<=0)return sendMessage(env,chatId,tr(lang,"Введи положительное целое число.","Enter a positive integer."),adminBack(lang));const target=Number(d.key);await env.DB.prepare("DELETE FROM user_sessions WHERE user_id=?").bind(userId).run();return grantCredits(env,userId,chatId,target,n,updateId,lang)}
 if(!Number.isFinite(n)||n<0)return sendMessage(env,chatId,tr(lang,"Введи неотрицательное число.","Enter a non-negative number."),adminBack(lang));
 let ok=false;
 if(d.mode==="ai_edit")ok=await setPrice(env,String(d.key),n,userId,"admin:price:"+updateId+":"+d.key);
 else if(d.mode==="rep_edit")ok=await setPrice(env,"repurpose_"+String(d.key),n,userId,"admin:rep:"+updateId+":"+d.key);
 else if(d.mode==="tariff_price")ok=await setStarsPrice(env,String(d.key),n,userId,"admin:tariff_price:"+updateId+":"+d.key);
 else if(d.mode==="tariff_credits")ok=await setIncludedCredits(env,String(d.key),n,userId,"admin:tariff_credits:"+updateId+":"+d.key);
 else if(d.mode==="credit_price")ok=await setStarsPrice(env,"credits_"+String(d.key),n,userId,"admin:credit_price:"+updateId+":"+d.key);
 await env.DB.prepare("DELETE FROM user_sessions WHERE user_id=?").bind(userId).run();return sendMessage(env,chatId,tr(lang,ok?"✅ Конфигурация обновлена.":"⚠️ Не удалось обновить конфигурацию.",ok?"✅ Configuration updated.":"⚠️ Could not update configuration."),adminPricesMenu(lang));
}
async function userCard(env:Bindings,chatId:string,m:number,id:number,lang:Lang){const u=await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(id).first<A>();if(!u)return sendMessage(env,chatId,tr(lang,"Пользователь не найден.","User not found."),adminBack(lang));return editMessageText(env,chatId,m,tr(lang,"👤 Пользователь","👤 User")+"\n\n"+tr(lang,"Имя: ","Name: ")+String(u.first_name||"—")+"\n"+tr(lang,"Username: ","Username: ")+("@"+String(u.username||"—"))+"\n"+tr(lang,"Telegram ID: ","Telegram ID: ")+String(u.telegram_id)+"\n\n💎 "+tr(lang,"Тариф: ","Plan: ")+String(u.plan)+"\n🔹 "+tr(lang,"Кредиты: ","Credits: ")+Number(u.credits_balance||0)+"\n\n📅 "+tr(lang,"Подписка до: ","Subscription until: ")+(await subscriptionDate(env,id,lang)),adminUserCard(id,lang))}
async function grantCreditsMenu(env:Bindings,chatId:string,m:number,id:number,lang:Lang){return editMessageText(env,chatId,m,tr(lang,"🔹 Выдать кредиты","🔹 Grant credits"),{inline_keyboard:[[{text:"50 🔹",callback_data:"admin:grant_credits_apply:"+id+":50"},{text:"100 🔹",callback_data:"admin:grant_credits_apply:"+id+":100"}],[{text:"250 🔹",callback_data:"admin:grant_credits_apply:"+id+":250"},{text:"500 🔹",callback_data:"admin:grant_credits_apply:"+id+":500"}],[{text:"✏️ "+tr(lang,"Другое количество","Custom amount"),callback_data:"admin:grant_credits_other:"+id}],[{text:backText(lang),callback_data:"admin:user:"+id}]]})}
async function grantTariffMenu(env:Bindings,chatId:string,m:number,id:number,lang:Lang){return editMessageText(env,chatId,m,tr(lang,"💎 Выдать тариф","💎 Grant plan"),{inline_keyboard:[[{text:"🆓 FREE",callback_data:"admin:grant_tariff_apply:"+id+":free"}],[{text:"⚡ CREATOR",callback_data:"admin:grant_tariff_apply:"+id+":creator"},{text:"🚀 PRO",callback_data:"admin:grant_tariff_apply:"+id+":pro"}],[{text:backText(lang),callback_data:"admin:user:"+id}]]})}
async function grantTariff(env:Bindings,adminId:number,chatId:string,userId:number,plan:string,updateId:number,lang:Lang){
 const p=await env.DB.prepare("SELECT * FROM pricing WHERE key=? AND type='plan' AND is_active=1").bind(plan).first<A>();if(!p)return;
 const target=await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(userId).first<A>();if(!target)return;
 const ref="admin_tariff:"+updateId+":"+adminId+":"+userId+":"+plan;
 if(!(await claimAudit(env,adminId,"grant_tariff",userId,"users",userId,{plan:target.plan,credits_balance:target.credits_balance},{plan},ref)))return;
 const exp=now()+Number(p.duration_days??30)*86400000,grant=Number(p.included_credits??0),oldBalance=Number(target.credits_balance??0),newBalance=oldBalance+grant;
 await env.DB.prepare("UPDATE users SET plan=?,tariff_id=?,credits_balance=?,credits_reset_at=?,updated_at=? WHERE id=?").bind(plan,Number(p.id),newBalance,exp,now(),userId).run();
 await addTransaction(env,userId,"grant",grant,newBalance,null,null,adminId,ref+":credits");
 await env.DB.prepare("INSERT INTO subscriptions(user_id,plan,provider,stars_amount,status,current_period_start,expires_at,telegram_payment_charge_id,invoice_payload,is_recurring,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
  .bind(userId,plan,"admin",0,"active",now(),exp,null,ref,0,now(),now()).run();
 await sendMessage(env,chatId,tr(lang,"✅ Тариф пользователя обновлён.\n\nНовый тариф:\n","✅ User plan updated.\n\nNew plan:\n")+plan.toUpperCase());
 await notify(env,userId,lang==="en"?"🎉 Your plan was updated!\n\nNow active:\n"+plan.toUpperCase():"🎉 Твой тариф обновлён!\n\nТеперь у тебя:\n"+plan.toUpperCase());
}
async function grantCredits(env:Bindings,adminId:number,chatId:string,userId:number,amount:number,updateId:number,lang:Lang){
 if(!Number.isInteger(amount)||amount<=0)return;
 const ref="admin_credit:"+updateId+":"+adminId+":"+userId+":"+amount;
 if(!(await claimAudit(env,adminId,"grant_credits",userId,"users",userId,null,{amount},ref)))return;
 const u=await env.DB.prepare("SELECT credits_balance FROM users WHERE id=?").bind(userId).first<A>();if(!u)return;
 const b=Number(u.credits_balance??0)+amount;
 await env.DB.prepare("UPDATE users SET credits_balance=?,updated_at=? WHERE id=?").bind(b,now(),userId).run();
 await addTransaction(env,userId,"grant",amount,b,null,null,adminId,ref);
 const msg=lang==="en"?"✅ Credits granted.\n\nAdded:\n+"+amount+" 🔹":"✅ Кредиты выданы.\n\nНачислено:\n+"+amount+" 🔹";
 await sendMessage(env,chatId,msg);
 await notify(env,userId,lang==="en"?"🎁 You received extra credits!\n\n+"+amount+" 🔹\n\nCurrent balance:\n"+b+" 🔹":"🎁 Тебе начислены дополнительные кредиты!\n\n+"+amount+" 🔹\n\nТекущий баланс:\n"+b+" 🔹");
}
async function notify(env:Bindings,userId:number,text:string){const u=await env.DB.prepare("SELECT notifications_enabled,telegram_id FROM users WHERE id=?").bind(userId).first<A>();if(u?.notifications_enabled===0||!u?.telegram_id)return;await sendMessage(env,String(u.telegram_id),text).catch(()=>{});}
async function subscriptionDate(env:Bindings,id:number,lang:Lang){const r=await env.DB.prepare("SELECT expires_at FROM subscriptions WHERE user_id=? AND status='active' ORDER BY expires_at DESC LIMIT 1").bind(id).first<A>();return r?.expires_at?new Date(Number(r.expires_at)).toLocaleDateString(lang==="en"?"en-US":"ru-RU"):"—";}
async function updateAdminView(env:Bindings,userId:number,chatId:string,msgId:number,lang:Lang){return editMessageText(env,chatId,msgId,tr(lang,"⚙️ Цены","⚙️ Prices"),adminPricesMenu(lang));}
