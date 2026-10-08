import type{Bindings}from"./env";
import{copyFor}from"./text";
import{adminMenu,adminPricesMenu,adminBack,adminList,adminUserCard}from"./telegram/keyboards";
import{editMessageText,sendMessage}from"./telegram/api";
import{addTransaction}from"./billing/credits";

type A=Record<string,any>;
const tRu=copyFor("ru"), now=()=>Date.now();

export async function isAdmin(env:Bindings,telegramId:string){
 const x=await env.DB.prepare("SELECT au.user_id FROM admin_users au JOIN users u ON u.id=au.user_id WHERE u.telegram_id=? AND u.role='admin'").bind(String(telegramId)).first<A>();
 return !!x;
}
export async function setSetting(env:Bindings,key:string,value:string,adminId:number){
 const old=await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind(key).first<A>();
 await env.DB.prepare("INSERT INTO settings(key,value,updated_at,updated_by) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by").bind(key,value,now(),adminId).run();
 await audit(env,adminId,"setting.update","settings",null,old,{key,value});
}
export async function setPrice(env:Bindings,key:string,credits:number,adminId:number){
 if(!Number.isFinite(credits)||credits<0)return false;
 const old=await env.DB.prepare("SELECT credits_cost,stars_price,included_credits FROM pricing WHERE key=?").bind(key).first<A>();
 const up=await env.DB.prepare("UPDATE pricing SET credits_cost=?,updated_at=?,updated_by=? WHERE key=?").bind(Math.floor(credits),now(),adminId,key).run();
 if(up.meta.changes!==1)return false;
 await audit(env,adminId,"pricing.update","pricing",Number(old?.id??0)||null,old,{key,credits_cost:Math.floor(credits)});
 return true;
}
export async function setStarsPrice(env:Bindings,key:string,stars:number,adminId:number){
 if(!Number.isFinite(stars)||stars<0)return false;
 const old=await env.DB.prepare("SELECT * FROM pricing WHERE key=?").bind(key).first<A>();
 const up=await env.DB.prepare("UPDATE pricing SET stars_price=?,updated_at=?,updated_by=? WHERE key=?").bind(Math.floor(stars),now(),adminId,key).run();
 if(up.meta.changes!==1)return false;
 await audit(env,adminId,"pricing.stars_update","pricing",Number(old?.id??0)||null,old,{key,stars_price:Math.floor(stars)});
 return true;
}
export async function setIncludedCredits(env:Bindings,key:string,credits:number,adminId:number){
 if(!Number.isFinite(credits)||credits<0)return false;
 const old=await env.DB.prepare("SELECT * FROM pricing WHERE key=?").bind(key).first<A>();
 const up=await env.DB.prepare("UPDATE pricing SET included_credits=?,updated_at=?,updated_by=? WHERE key=?").bind(Math.floor(credits),now(),adminId,key).run();
 if(up.meta.changes!==1)return false;
 await audit(env,adminId,"pricing.credits_update","pricing",Number(old?.id??0)||null,old,{key,included_credits:Math.floor(credits)});
 return true;
}
async function audit(env:Bindings,adminId:number,action:string,entityType:string,entityId:number|null,oldValue:any,newValue:any,targetUserId:number|null=null){
 await env.DB.prepare("INSERT INTO admin_audit_log(admin_user_id,action,target_user_id,entity_type,entity_id,old_value_json,new_value_json,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(adminId,action,targetUserId,entityType,entityId,JSON.stringify(oldValue??null),JSON.stringify(newValue??null),now()).run();
}
export async function ensureAdminSeed(env:Bindings){
 const n=now();
 for(const[k,v]of[["job_max_attempts","3"],["delivery_max_attempts","5"],["delivery_backoff_seconds","[15,60,300,900,3600]"]])await env.DB.prepare("INSERT OR IGNORE INTO settings(key,value,updated_at) VALUES(?,?,?)").bind(k,v,n).run();
 for(const id of String(env.ADMIN_TELEGRAM_IDS??"").split(",").map(x=>x.trim()).filter(Boolean)){
  const u=await env.DB.prepare("SELECT id FROM users WHERE telegram_id=?").bind(id).first<A>();
  if(u){await env.DB.prepare("INSERT OR IGNORE INTO admin_users(user_id,created_at) VALUES(?,?)").bind(Number(u.id),n).run();await env.DB.prepare("UPDATE users SET role='admin',updated_at=? WHERE id=?").bind(n,Number(u.id)).run();}
 }
}
export async function openAdmin(env:Bindings,chatId:string){
 return sendMessage(env,chatId,"👨‍💻 Admin Panel",adminMenu);
}
const priceKeys=["post","script","content_plan","post_edit","post_variant","script_edit","script_variant","content_plan_variant","style_profile"];
const repKeys=["repurpose_telegram","repurpose_instagram","repurpose_tiktok","repurpose_youtube","repurpose_hooks","repurpose_cta","repurpose_plan"];
export async function adminAction(env:Bindings,userId:number,chatId:string,data:string,msg:any){
 const u=await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(userId).first<A>();
 if(!u||!(await isAdmin(env,String(u.telegram_id||""))))return;
 const m=Number(msg?.message_id||0);
 const lang=String(u.language)==="en"?"en":"ru";
 const back=lang==="en"?"↩️ Back":"↩️ Назад";
 if(data==="admin:menu")return m?editMessageText(env,chatId,m,lang==="en"?"👨‍💻 Admin Panel":"👨‍💻 Админ-панель",adminMenu):openAdmin(env,chatId);
 if(data==="admin:stats"||data.startsWith("admin:stats:")){
  const period=data.endsWith(":7d")?"7d":data.endsWith(":30d")?"30d":"today",since=now()-(period==="7d"?7*86400000:period==="30d"?30*86400000:86400000);
  const q=async(sql:string)=>Number((await env.DB.prepare(sql).bind(since).first<A>())?.c??0);
  const users=Number((await env.DB.prepare("SELECT COUNT(*) c FROM users").first<A>())?.c??0);
  const newUsers=await q("SELECT COUNT(*) c FROM users WHERE created_at>=?");
  const active=await q("SELECT COUNT(*) c FROM users WHERE last_seen_at>=?");
  const generations=await q("SELECT COUNT(*) c FROM jobs WHERE created_at>=? AND type NOT IN ('source_analysis')");
  const success=await q("SELECT COUNT(*) c FROM jobs WHERE created_at>=? AND status='completed'");
  const errors=await q("SELECT COUNT(*) c FROM jobs WHERE created_at>=? AND status IN ('failed','partial')");
  const credits=await q("SELECT COALESCE(SUM(CASE WHEN type='reserve' THEN -delta ELSE 0 END),0) c FROM credit_transactions WHERE created_at>=?");
  const aiCost=(await q("SELECT COALESCE(SUM(cost_usd_micros),0) c FROM job_attempts WHERE created_at>=? AND status='success'"))/1000000;
  const revenue=await q("SELECT COALESCE(SUM(stars_amount),0) c FROM payments WHERE created_at>=? AND status='paid'");
  const margin=revenue>0?((revenue-aiCost)/revenue)*100:0;
  const label=period==="today"?(lang==="en"?"Today":"Сегодня"):period==="7d"?(lang==="en"?"7 days":"7 дней"):(lang==="en"?"30 days":"30 дней");
  const body=lang==="en"
   ?`📊 Statistics\n\nPeriod: ${label}\n\n👥 Users: ${users}\n🆕 New users: ${newUsers}\n\n🟢 Active: ${active}\n\n🤖 Generations: ${generations}\n✅ Successful: ${success}\n❌ Errors: ${errors}\n\n🔹 Credits spent: ${credits}\n💵 AI Cost: $${aiCost.toFixed(2)}\n⭐ Revenue: ${revenue} ⭐\n📈 Gross Margin: ${margin.toFixed(1)}%`
   :`📊 Статистика\n\nПериод: ${label}\n\n👥 Пользователи: ${users}\n🆕 Новые пользователи: ${newUsers}\n\n🟢 Активные: ${active}\n\n🤖 Генераций: ${generations}\n✅ Успешных: ${success}\n❌ Ошибок: ${errors}\n\n🔹 Потрачено кредитов: ${credits}\n💵 AI Cost: $${aiCost.toFixed(2)}\n⭐ Revenue: ${revenue} ⭐\n📈 Gross Margin: ${margin.toFixed(1)}%`;
  return editMessageText(env,chatId,m,body,{inline_keyboard:[[
   {text:lang==="en"?"Today":"Сегодня",callback_data:"admin:stats:today"},
   {text:lang==="en"?"7 days":"7 дней",callback_data:"admin:stats:7d"},
   {text:lang==="en"?"30 days":"30 дней",callback_data:"admin:stats:30d"}],[{text:back,callback_data:"admin:menu"}]]});
 }
 if(data==="admin:prices")return m?editMessageText(env,chatId,m,lang==="en"?"⚙️ Prices\n\nChoose what to change:":"⚙️ Цены\n\nВыбери, что изменить:",adminPricesMenu):sendMessage(env,chatId,lang==="en"?"⚙️ Prices\n\nChoose what to change:":"⚙️ Цены\n\nВыбери, что изменить:",adminPricesMenu);
 if(data==="admin:tariffs")return editMessageText(env,chatId,m,lang==="en"?"💎 Tariff prices":"💎 Цены тарифов",{inline_keyboard:[[
   {text:"⚡ CREATOR",callback_data:"admin:tariff:creator"},
   {text:"🚀 PRO",callback_data:"admin:tariff:pro"}],[{text:back,callback_data:"admin:prices"}]]});
 if(data.startsWith("admin:tariff:"))return tariffCard(env,chatId,m,data.slice(13));
 if(data==="admin:credit_packages"){const vals=await Promise.all([50,100,250,500].map(async n=>({text:n+" 🔹",callback_data:"admin:credit:"+n})));return editMessageText(env,chatId,m,(lang==="en"?"🔹 Credit packs\n\n":"🔹 Пакеты кредитов\n\n")+(await Promise.all([50,100,250,500].map(async n=>n+" 🔹 — "+Number((await env.DB.prepare("SELECT stars_price FROM pricing WHERE key=?").bind("credits_"+n).first<A>())?.stars_price??0)+" ⭐"))).join("\n"),{inline_keyboard:[[vals[0],vals[1]],[vals[2],vals[3]],[{text:back,callback_data:"admin:prices"}]]});}
 if(data.startsWith("admin:credit:"))return creditCard(env,chatId,m,Number(data.slice(13)));
 if(data==="admin:ai_prices"){const aiLabels:any={post:["📝 Post","📝 Post"],script:["🎬 Script","🎬 Script"],content_plan:["📅 Content Plan","📅 Content Plan"],post_edit:["✏️ Edit","✏️ Edit"],post_variant:["🔄 Other Variant","🔄 Other Variant"],script_edit:["✏️ Edit","✏️ Edit"],script_variant:["🔄 Other Variant","🔄 Other Variant"],content_plan_variant:["🔄 Other Variant","🔄 Other Variant"],style_profile:["🧠 My Style","🧠 My Style"]};const items=await Promise.all(priceKeys.map(async k=>({text:(lang==="en"?aiLabels[k]?.[1]:aiLabels[k]?.[0]??k)+" — "+Number((await env.DB.prepare("SELECT credits_cost FROM pricing WHERE key=?").bind(k).first<A>())?.credits_cost??0)+" 🔹",data:"admin:ai:"+k})));return editMessageText(env,chatId,m,lang==="en"?"🤖 Generation prices":"🤖 Стоимость генераций",adminList(items,"admin:prices"));}
 if(data==="admin:repurpose_prices"){const repLabels:any={telegram:["📝 Telegram Post","📝 Telegram Post"],instagram:["📸 Instagram Caption","📸 Instagram Caption"],tiktok:["🎬 TikTok Script","🎬 TikTok Script"],youtube:["▶️ YouTube Shorts","▶️ YouTube Shorts"],hooks:["🔥 5 Hooks","🔥 5 Hooks"],cta:["🎯 CTA","🎯 CTA"],plan:["📅 Content Plan","📅 Content Plan"]};const items=await Promise.all(repKeys.map(async k=>{const short=k.replace("repurpose_","");return{text:(lang==="en"?repLabels[short]?.[1]:repLabels[short]?.[0]??short)+" — "+Number((await env.DB.prepare("SELECT credits_cost FROM pricing WHERE key=?").bind(k).first<A>())?.credits_cost??0)+" 🔹",data:"admin:rep:"+short}}));return editMessageText(env,chatId,m,"♻️ Repurpose",adminList(items,"admin:prices"));}
 if(data.startsWith("admin:ai:")){const key=data.slice(9);if(!priceKeys.includes(key))return;const p=await env.DB.prepare("SELECT credits_cost FROM pricing WHERE key=?").bind(key).first<A>();return editMessageText(env,chatId,m,key+"\n\n"+(lang==="en"?"Current cost:":"Текущая стоимость:")+"\n"+Number(p?.credits_cost??0)+" 🔹",{inline_keyboard:[[{text:lang==="en"?"💳 Change cost":"💳 Изменить стоимость",callback_data:"admin:ai_edit:"+key}],[{text:back,callback_data:"admin:ai_prices"}]]});}
 if(data.startsWith("admin:rep:")){const key=data.slice(10);if(!repKeys.includes("repurpose_"+key))return;const p=await env.DB.prepare("SELECT credits_cost FROM pricing WHERE key=?").bind("repurpose_"+key).first<A>();return editMessageText(env,chatId,m,key+"\n\n"+(lang==="en"?"Current cost:":"Текущая стоимость:")+"\n"+Number(p?.credits_cost??0)+" 🔹",{inline_keyboard:[[{text:lang==="en"?"💳 Change cost":"💳 Изменить стоимость",callback_data:"admin:rep_edit:"+key}],[{text:back,callback_data:"admin:repurpose_prices"}]]});}
 if(data.startsWith("admin:ai_edit:")||data.startsWith("admin:rep_edit:")||data.startsWith("admin:tariff_edit_price:")||data.startsWith("admin:tariff_edit_credits:")||data.startsWith("admin:credit_edit:")){
  const mode=data.startsWith("admin:ai_edit:")?"ai_edit":data.startsWith("admin:rep_edit:")?"rep_edit":data.startsWith("admin:tariff_edit_price:")?"tariff_price":data.startsWith("admin:tariff_edit_credits:")?"tariff_credits":"credit_price";
  const key=data.slice(mode==="ai_edit"?13:mode==="rep_edit"?14:mode==="tariff_price"?24:mode==="tariff_credits"?26:18);
  await saveAdminInput(env,userId,mode,key);
  return editMessageText(env,chatId,m,lang==="en"?"Enter the new value as a number.":"Введи новое значение числом.",adminBack);
 }
 if(data==="admin:tariffs")return editMessageText(env,chatId,m,lang==="en"?"💎 Tariffs":"💎 Цены тарифов",adminPricesMenu);
 if(data==="admin:users")return editMessageText(env,chatId,m,lang==="en"?"👤 Users\n\nChoose user search.":"👤 Пользователи\n\nВыбери поиск пользователя.",{inline_keyboard:[[{text:lang==="en"?"🔎 Find user":"🔎 Найти пользователя",callback_data:"admin:user_search"}],[{text:back,callback_data:"admin:menu"}]]});
 if(data==="admin:user_search"){await saveAdminInput(env,userId,"user_search","");return editMessageText(env,chatId,m,lang==="en"?"🔎 Enter Telegram ID:":"🔎 Введи Telegram ID пользователя.",adminBack);}
 if(data.startsWith("admin:user:"))return userCard(env,chatId,m,Number(data.slice(10)));
 if(data.startsWith("admin:grant_tariff:"))return grantTariffMenu(env,chatId,m,Number(data.slice(18)));
 if(data.startsWith("admin:grant_credits:"))return grantCreditsMenu(env,chatId,m,Number(data.slice(19)));
 if(data.startsWith("admin:grant_tariff_apply:")){const p=data.split(":");return grantTariff(env,userId,chatId,m,Number(p[3]),p[4]);}
 if(data.startsWith("admin:grant_credits_apply:")){const p=data.split(":");return grantCredits(env,userId,chatId,m,Number(p[3]),Number(p[4]));}
 if(data.startsWith("admin:grant_credits_other:")){const p=data.split(":");await saveAdminInput(env,userId,"grant_credits_other",p[3]);return editMessageText(env,chatId,m,lang==="en"?"Enter credit amount:":"Введи количество кредитов числом.",adminBack);}
 if(data==="admin:menu")return;
}
async function planButtons(env:Bindings,key:string){const p=await env.DB.prepare("SELECT stars_price FROM pricing WHERE key=?").bind(key).first<A>();return[{text:key==="creator"?"⚡ CREATOR":"🚀 PRO",callback_data:"admin:tariff:"+key},{text:Number(p?.stars_price??0)+" ⭐",callback_data:"admin:tariff:"+key}];}
async function tariffCard(env:Bindings,chatId:string,m:number,key:string){const p=await env.DB.prepare("SELECT * FROM pricing WHERE key=?").bind(key).first<A>();return editMessageText(env,chatId,m,(key==="creator"?"⚡ CREATOR":"🚀 PRO")+"\n\nТекущая цена:\n"+Number(p?.stars_price??0)+" ⭐ / месяц\n\nКредитов:\n"+Number(p?.included_credits??0)+" 🔹",{inline_keyboard:[[ {text:"💳 Изменить цену",callback_data:"admin:tariff_edit_price:"+key},{text:"🔹 Изменить кредиты",callback_data:"admin:tariff_edit_credits:"+key}],[{text:"↩️ Назад",callback_data:"admin:tariffs"}]]});}
async function creditCard(env:Bindings,chatId:string,m:number,n:number){const p=await env.DB.prepare("SELECT stars_price FROM pricing WHERE key=?").bind("credits_"+n).first<A>();return editMessageText(env,chatId,m,"🔹 "+n+" кредитов\n\nТекущая цена: "+Number(p?.stars_price??0)+" ⭐",{inline_keyboard:[[ {text:"💳 Изменить цену",callback_data:"admin:credit_edit:"+n}],[{text:"↩️ Назад",callback_data:"admin:credit_packages"}]]});}
async function saveAdminInput(env:Bindings,userId:number,mode:string,key:string){await env.DB.prepare("INSERT INTO user_sessions(user_id,flow,step,draft_json,expires_at,updated_at) VALUES(?,?,?, ?,?,?) ON CONFLICT(user_id) DO UPDATE SET flow=excluded.flow,step=excluded.step,draft_json=excluded.draft_json,expires_at=excluded.expires_at,updated_at=excluded.updated_at").bind(userId,"admin",mode,JSON.stringify({mode,key}),now()+3600000,now()).run();}
export async function applyAdminValue(env:Bindings,userId:number,chatId:string,value:string){
 const s=await env.DB.prepare("SELECT * FROM user_sessions WHERE user_id=? AND flow='admin'").bind(userId).first<A>();if(!s||!(await isAdmin(env,String((await env.DB.prepare("SELECT telegram_id FROM users WHERE id=?").bind(userId).first<A>())?.telegram_id||""))))return;
 const d=JSON.parse(String(s.draft_json||"{}")),n=Number(value.trim());
 if(d.mode==="user_search"){const u=await env.DB.prepare("SELECT id FROM users WHERE telegram_id=?").bind(value.trim()).first<A>();await env.DB.prepare("DELETE FROM user_sessions WHERE user_id=?").bind(userId).run();return u?sendMessage(env,chatId,"✅ Пользователь найден.",adminUserCard(Number(u.id))):sendMessage(env,chatId,"Пользователь не найден.",adminBack)}
 if(d.mode==="grant_credits_other"){if(!Number.isInteger(n)||n<=0)return sendMessage(env,chatId,"Введи положительное целое число.",adminBack);const target=Number(d.key);await env.DB.prepare("DELETE FROM user_sessions WHERE user_id=?").bind(userId).run();return grantCredits(env,userId,chatId,0,target,n)}
 if(!Number.isFinite(n)||n<0){return sendMessage(env,chatId,"Введите неотрицательное число.");}
 let ok=false;
 if(d.mode==="ai_edit")ok=await setPrice(env,String(d.key),n,userId);
 else if(d.mode==="rep_edit")ok=await setPrice(env,"repurpose_"+String(d.key),n,userId);
 else if(d.mode==="tariff_price")ok=await setStarsPrice(env,String(d.key),n,userId);
 else if(d.mode==="tariff_credits")ok=await setIncludedCredits(env,String(d.key),n,userId);
 else if(d.mode==="credit_price")ok=await setStarsPrice(env,"credits_"+String(d.key),n,userId);
 await env.DB.prepare("DELETE FROM user_sessions WHERE user_id=?").bind(userId).run();
 return sendMessage(env,chatId,ok?"✅ Конфигурация обновлена.":"⚠️ Не удалось обновить конфигурацию.",adminPricesMenu);
}
async function userCard(env:Bindings,chatId:string,m:number,id:number){const u=await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(id).first<A>();if(!u)return sendMessage(env,chatId,"Пользователь не найден.");return editMessageText(env,chatId,m,"👤 Пользователь\n\nИмя: "+String(u.first_name||"—")+"\nUsername: @"+String(u.username||"—")+"\nTelegram ID: "+String(u.telegram_id)+"\n\n💎 Тариф: "+String(u.plan)+"\n🔹 Кредиты: "+Number(u.credits_balance||0)+"\n\n📅 Подписка до:\n"+(await subscriptionDate(env,id)),adminUserCard(id));}
async function grantTariffMenu(env:Bindings,chatId:string,m:number,id:number){return editMessageText(env,chatId,m,"💎 Выдать тариф",{inline_keyboard:[[ {text:"🆓 FREE",callback_data:"admin:grant_tariff_apply:"+id+":free"}],[{text:"⚡ CREATOR",callback_data:"admin:grant_tariff_apply:"+id+":creator"},{text:"🚀 PRO",callback_data:"admin:grant_tariff_apply:"+id+":pro"}],[{text:"↩️ Назад",callback_data:"admin:user:"+id}]]});}
async function grantTariff(env:Bindings,adminId:number,chatId:string,m:number,userId:number,plan:string){const p=await env.DB.prepare("SELECT * FROM pricing WHERE key=?").bind(plan).first<A>();if(!p)return;const u=await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(userId).first<A>();const ref="admin_tariff:"+adminId+":"+userId+":"+plan;const seen=await env.DB.prepare("SELECT id FROM admin_audit_log WHERE action='grant_tariff' AND target_user_id=? AND new_value_json LIKE ?").bind(userId,"%"+plan+"%").first<A>();if(seen)return;const exp=now()+Number(p.duration_days??30)*86400000;await env.DB.prepare("UPDATE users SET plan=?,tariff_id=?,credits_balance=?,credits_reset_at=?,updated_at=? WHERE id=?").bind(plan,Number(p.id),Number(p.included_credits??0),exp,now(),userId).run();await audit(env,adminId,"grant_tariff","users",userId,null,{plan},userId);await sendMessage(env,chatId,"✅ Тариф пользователя обновлён.\n\nНовый тариф:\n"+plan.toUpperCase());await notify(env,userId,"🎉 Твой тариф обновлён!\n\nТеперь у тебя:\n"+plan.toUpperCase());return;
}
async function grantCreditsMenu(env:Bindings,chatId:string,m:number,id:number){return editMessageText(env,chatId,m,"🔹 Выдать кредиты",{inline_keyboard:[[ {text:"50 🔹",callback_data:"admin:grant_credits_apply:"+id+":50"},{text:"100 🔹",callback_data:"admin:grant_credits_apply:"+id+":100"}],[{text:"250 🔹",callback_data:"admin:grant_credits_apply:"+id+":250"},{text:"500 🔹",callback_data:"admin:grant_credits_apply:"+id+":500"}],[{text:"✏️ Другое количество",callback_data:"admin:grant_credits_other:"+id}],[{text:"↩️ Назад",callback_data:"admin:user:"+id}]]});}
async function grantCredits(env:Bindings,adminId:number,chatId:string,m:number,userId:number,amount:number){if(!Number.isInteger(amount)||amount<=0)return;const ref="admin_credit:"+adminId+":"+userId+":"+amount;const seen=await env.DB.prepare("SELECT id FROM credit_transactions WHERE reference=?").bind(ref).first<A>();if(seen)return;const u=await env.DB.prepare("SELECT credits_balance FROM users WHERE id=?").bind(userId).first<A>(),b=Number(u?.credits_balance??0)+amount;await env.DB.prepare("UPDATE users SET credits_balance=?,updated_at=? WHERE id=?").bind(b,now(),userId).run();await addTransaction(env,userId,"admin adjustment",amount,b,null,null,adminId,ref);await audit(env,adminId,"grant_credits","users",userId,null,{amount},userId);await sendMessage(env,chatId,"✅ Кредиты выданы.\n\nНачислено:\n+"+amount+" 🔹");await notify(env,userId,"🎁 Тебе начислены дополнительные кредиты!\n\n+"+amount+" 🔹\n\nТекущий баланс:\n"+b+" 🔹");}
async function notify(env:Bindings,userId:number,text:string){const u=await env.DB.prepare("SELECT notifications_enabled FROM users WHERE id=?").bind(userId).first<A>();if(u?.notifications_enabled===0)return;const chat=await env.DB.prepare("SELECT telegram_id FROM users WHERE id=?").bind(userId).first<A>();if(chat)await sendMessage(env,String(chat.telegram_id),text).catch(()=>{});}
async function subscriptionDate(env:Bindings,id:number){const r=await env.DB.prepare("SELECT expires_at FROM subscriptions WHERE user_id=? ORDER BY expires_at DESC LIMIT 1").bind(id).first<A>();return r?.expires_at?new Date(Number(r.expires_at)).toLocaleDateString("ru-RU"):"—";}
