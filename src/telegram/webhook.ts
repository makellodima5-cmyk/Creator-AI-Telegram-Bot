import { and, desc, eq } from "drizzle-orm";
import { createDb } from "../db/client";
import { creditLedger, jobs, payments, subscriptions, userSessions, users } from "../db/schema";
import { ensureUser, reserveCredits } from "../billing/credits";
import { answerCallback, answerPreCheckoutQuery, deleteMessage, editMessageText, sendInvoice, sendMessage } from "./api";
import { mainMenu, persistentMenu, postConfig, pricingKeyboard, repurposeTargets, scriptConfig, planConfig } from "./keyboards";
import type { Bindings } from "../env";

const defaults = {
  post:{topic:"",platform:"telegram",style:"conversational",length:"short"},
  script:{topic:"",platform:"tiktok",style:"dynamic",duration:"30"},
  plan:{topic:"",goal:"growth",platform:"telegram",style:"expert"},
  repurpose:{material:"",targets:["all"] as string[]}
};
const costs={post:1,script:2,repurpose:3,plan:5};

export async function handleWebhook(env:Bindings,update:unknown){
  const u=update as any;
  if(u.pre_checkout_query){
    const q=u.pre_checkout_query, db=createDb(env);
    const payment=await db.select().from(payments).where(eq(payments.invoicePayload,String(q.invoice_payload))).get();
    await answerPreCheckoutQuery(env,q.id,!!payment&&payment.status==="pending",payment?"": "Платёж больше недоступен.");
    return;
  }
  const message=u.message, cb=u.callback_query, from=message?.from??cb?.from;
  if(!from)return;
  const chatId=String(message?.chat?.id??cb?.message?.chat?.id), user=await ensureUser(env,String(from.id),from.first_name,from.username), db=createDb(env);

  if(message?.successful_payment){
    await completePayment(env,user.id,message.successful_payment);
    await sendMessage(env,chatId,"✅ Оплата прошла. Тариф/credits уже зачислены.",persistentMenu);
    return;
  }
  if(message?.text==="/start"){
    await sendMessage(env,chatId,"👋 Creator AI\n\nСоздавай готовый контент прямо в Telegram.",mainMenu);
    await sendMessage(env,chatId,"Навигация:",persistentMenu); return;
  }

  if(message?.text){
    const text=message.text.trim();
    const mapped:Record<string,string>={"📝 Пост":"menu:post","🎬 Сценарий":"menu:script","♻️ Переработка":"menu:repurpose","📅 План":"menu:plan","👤 Мой стиль":"menu:style","🕘 История":"menu:history","💎 Тарифы":"menu:pricing","⭐ Credits":"menu:credits","⚙️ Настройки":"menu:settings"};
    if(mapped[text]){await deleteMessage(env,chatId,message.message_id).catch(()=>{});await handleAction(env,user.id,chatId,mapped[text],null);return;}
    const session=await db.select().from(userSessions).where(eq(userSessions.userId,user.id)).get();
    if(session?.step==="topic"||session?.step==="material"){
      const draft=JSON.parse(session.draftJson??"{}");
      if(session.flow==="post"){draft.topic=text.slice(0,Number(env.MAX_INPUT_CHARS??12000));await saveSession(db,user.id,"post","config",draft);await deleteMessage(env,chatId,message.message_id).catch(()=>{});await sendMessage(env,chatId,renderPostConfig(draft),postConfig(draft));return;}
      if(session.flow==="script"){draft.topic=text.slice(0,Number(env.MAX_INPUT_CHARS??12000));await saveSession(db,user.id,"script","config",draft);await deleteMessage(env,chatId,message.message_id).catch(()=>{});await sendMessage(env,chatId,renderScriptConfig(draft),scriptConfig(draft));return;}
      if(session.flow==="plan"){draft.topic=text.slice(0,Number(env.MAX_INPUT_CHARS??12000));await saveSession(db,user.id,"plan","config",draft);await deleteMessage(env,chatId,message.message_id).catch(()=>{});await sendMessage(env,chatId,renderPlanConfig(draft),planConfig(draft));return;}
      if(session.flow==="repurpose"){draft.material=text.slice(0,Number(env.MAX_INPUT_CHARS??12000));await saveSession(db,user.id,"repurpose","targets",draft);await deleteMessage(env,chatId,message.message_id).catch(()=>{});await sendMessage(env,chatId,"♻️ Repurpose\n\nМатериал получен ✅\n\nВыбери, что создать:",repurposeTargets(draft.targets??["all"]));return;}
    }
  }
  if(!cb)return;
  await answerCallback(env,cb.id);
  await handleAction(env,user.id,chatId,String(cb.data??""),cb.message);
}

async function handleAction(env:Bindings,userId:number,chatId:string,data:string,msg:any){
  const db=createDb(env);
  if(data==="menu:post"){await startFlow(db,userId,"post","topic",defaults.post);return editOrSend(env,chatId,msg,"📝 Post Maker\n\nО чём пост?\n\nНапиши тему или идею.\n\nНапример:\n«5 способов использовать AI\nв Telegram»\n\n[ ← Назад ]");}
  if(data==="menu:script"){await startFlow(db,userId,"script","topic",defaults.script);return editOrSend(env,chatId,msg,"🎬 Script Maker\n\nО чём ролик?\n\nНапиши тему или идею.\n\nНапример:\n«5 AI-сервисов для работы с телефона»\n\n[ ← Назад ]");}
  if(data==="menu:plan"){await startFlow(db,userId,"plan","topic",defaults.plan);return editOrSend(env,chatId,msg,"📅 Content Plan\n\nО чём твой канал или проект?\n\nНапиши тему ↓\n\n[ ← Назад ]");}
  if(data==="menu:repurpose"){await startFlow(db,userId,"repurpose","material",defaults.repurpose);return editOrSend(env,chatId,msg,"♻️ Repurpose\n\nПреврати один материал в готовый контент для разных площадок.\n\nМожно отправить текст, статью, документ, аудио, видео или голосовое.\n\nОтправь материал ↓\n\n[ ← Назад ]");}
  if(data==="menu:pricing")return editOrSend(env,chatId,msg,"💎 Тарифы Creator AI\n\n🆓 FREE\n10 credits / месяц\n\n⭐ CREATOR\n100 credits / месяц\n99 ⭐ / месяц\n\n🔥 PRO\n500 credits / месяц\n299 ⭐ / месяц",pricingKeyboard);
  if(data==="menu:credits"){const u=await db.select().from(users).where(eq(users.id,userId)).get();return editOrSend(env,chatId,msg,"⭐ Credits\n\nБаланс: "+(u?.creditsBalance??0)+"\n\n1 пост = 1 credit\n1 сценарий = 2 credits\nRepurpose = 3 credits\nПлан на 7 дней = 5 credits",pricingKeyboard);}
  if(data==="menu:history")return showHistory(env,userId,chatId,msg);
  if(data==="menu:style")return editOrSend(env,chatId,msg,"👤 Мой стиль\n\nПрофиль голоса анализирует 5–20 прошлых постов.\n\nВ следующем MVP-шаге добавим загрузку примеров.",mainMenu);
  if(data==="menu:settings")return editOrSend(env,chatId,msg,"⚙️ Настройки\n\nЯзык: русский\nУведомления: включены",mainMenu);
  if(data==="menu:back")return editOrSend(env,chatId,msg,"Главное меню",mainMenu);

  const session=await db.select().from(userSessions).where(eq(userSessions.userId,userId)).get();
  const draft=session?JSON.parse(session.draftJson??"{}"):null;
  if(data.startsWith("post:p:")||data.startsWith("post:s:")||data.startsWith("post:l:")){
    if(!draft)return;
    if(data.startsWith("post:p:"))draft.platform=data.slice(7);
    if(data.startsWith("post:s:"))draft.style=data.slice(7);
    if(data.startsWith("post:l:"))draft.length=data.slice(7);
    await saveSession(db,userId,"post","config",draft);return editOrSend(env,chatId,msg,renderPostConfig(draft),postConfig(draft));
  }
  if(data.startsWith("script:p:")||data.startsWith("script:s:")||data.startsWith("script:d:")){
    if(!draft)return;
    if(data.startsWith("script:p:"))draft.platform=data.slice(9);
    if(data.startsWith("script:s:"))draft.style=data.slice(9);
    if(data.startsWith("script:d:"))draft.duration=data.slice(9);
    await saveSession(db,userId,"script","config",draft);return editOrSend(env,chatId,msg,renderScriptConfig(draft),scriptConfig(draft));
  }
  if(data.startsWith("plan:g:")||data.startsWith("plan:p:")||data.startsWith("plan:s:")){
    if(!draft)return;
    if(data.startsWith("plan:g:"))draft.goal=data.slice(7);
    if(data.startsWith("plan:p:"))draft.platform=data.slice(7);
    if(data.startsWith("plan:s:"))draft.style=data.slice(7);
    await saveSession(db,userId,"plan","config",draft);return editOrSend(env,chatId,msg,renderPlanConfig(draft),planConfig(draft));
  }
  if(data.startsWith("rep:target:")){
    if(!draft)return;
    const target=data.slice(11);
    draft.targets=target==="all"?["all"]:(draft.targets??[]).filter((x:string)=>x!=="all").includes(target)?(draft.targets??[]).filter((x:string)=>x!==target):(draft.targets??[]).filter((x:string)=>x!=="all").concat(target);
    await saveSession(db,userId,"repurpose","targets",draft);return editOrSend(env,chatId,msg,"♻️ Repurpose\n\nМатериал получен ✅\n\nВыбери, что создать:",repurposeTargets(draft.targets));
  }
  if(data==="post:create")return enqueue(env,userId,chatId,msg,costs.post,"post",draft);
  if(data==="script:create")return enqueue(env,userId,chatId,msg,costs.script,"script",draft);
  if(data==="plan:create")return enqueue(env,userId,chatId,msg,costs.plan,"content_plan",draft);
  if(data==="rep:create")return enqueue(env,userId,chatId,msg,costs.repurpose,"repurpose",draft);
  if(data==="post:back"||data==="script:back"||data==="plan:back"||data==="rep:back"){await db.delete(userSessions).where(eq(userSessions.userId,userId));return editOrSend(env,chatId,msg,"Главное меню",mainMenu);}
  if(data.startsWith("post:back-result:"))return editOrSend(env,chatId,msg,"Главное меню",mainMenu);
  if(data.startsWith("post:regen:")||data.startsWith("post:hook:")||data.startsWith("post:shorten:"))return postAction(env,userId,chatId,msg,data);
  if(data.startsWith("post:script:")){const id=Number(data.split(":")[2]),source=await db.select().from(jobs).where(and(eq(jobs.id,id),eq(jobs.userId,userId))).get();if(!source)return;const original=JSON.parse(source.outputJson??"{}"),next={topic:String(original.title)+"\n\n"+String(original.body),platform:"youtube",style:"dynamic",duration:"30"};await saveSession(db,userId,"script","config",next);return editOrSend(env,chatId,msg,renderScriptConfig(next),scriptConfig(next));}
  if(data.startsWith("rep:view:"))return viewRepurpose(env,userId,chatId,msg,data);
  if(data.startsWith("plan:item:"))return viewPlanItem(env,userId,chatId,msg,data);
  if(data.startsWith("plan:create-item:"))return createPlanItem(env,userId,chatId,msg,data);
  if(data.startsWith("history:view:"))return viewHistory(env,userId,chatId,msg,Number(data.split(":")[2]));
  if(data.startsWith("buy:"))return buy(env,userId,chatId,data);
}

async function enqueue(env:Bindings,userId:number,chatId:string,msg:any,cost:number,type:string,input:any){
  if(!input||(type==="repurpose"?!input.material:!input.topic))return;
  const db=createDb(env),jobId=Date.now();
  if(!(await reserveCredits(env,userId,cost,jobId)))return editOrSend(env,chatId,msg,"💳 Недостаточно credits. Откройте 💎 Тарифы.",pricingKeyboard);
  const sent=await editOrSend(env,chatId,msg,"⏳ Создаю...");
  const inserted=await db.insert(jobs).values({userId,type,status:"queued",inputJson:JSON.stringify(input),creditsReserved:cost,telegramChatId:chatId,telegramMessageId:sent?.message_id??msg?.message_id,createdAt:new Date()}).returning({id:jobs.id}).get();
  await db.delete(userSessions).where(eq(userSessions.userId,userId));
  await env.AI_QUEUE.send({jobId:inserted.id});
}

async function postAction(env:Bindings,userId:number,chatId:string,msg:any,data:string){
  const id=Number(data.split(":")[2]),action=data.split(":")[1],db=createDb(env),source=await db.select().from(jobs).where(and(eq(jobs.id,id),eq(jobs.userId,userId))).get();
  if(!source?.outputJson)return;
  const o=JSON.parse(source.outputJson),jobId=Date.now();
  if(!(await reserveCredits(env,userId,1,jobId)))return editOrSend(env,chatId,msg,"💳 Недостаточно credits.",pricingKeyboard);
  let topic=String(o.body??"");
  if(action==="hook")topic="Rewrite this post with a much stronger hook. Existing post:\n"+topic;
  if(action==="shorten")topic="Shorten this post while preserving its main idea and CTA. Existing post:\n"+topic;
  if(action==="regen"){const original=JSON.parse(source.inputJson??"{}");topic=original.topic??topic;}
  const input={topic,platform:o.platform??"telegram",style:o.style??"conversational",length:action==="shorten"?"short":o.length??"short"};
  const sent=await editOrSend(env,chatId,msg,"⏳ Создаю вариант...");
  const inserted=await db.insert(jobs).values({userId,type:"post",status:"queued",inputJson:JSON.stringify(input),creditsReserved:1,telegramChatId:chatId,telegramMessageId:sent?.message_id??msg?.message_id,createdAt:new Date()}).returning({id:jobs.id}).get();
  await env.AI_QUEUE.send({jobId:inserted.id});
}

async function showHistory(env:Bindings,userId:number,chatId:string,msg:any){
  const db=createDb(env),rows=await db.select().from(jobs).where(and(eq(jobs.userId,userId),eq(jobs.status,"completed"))).orderBy(desc(jobs.createdAt)).limit(10);
  const buttons=rows.map(j=>[b(historyLabel(j),`history:view:${j.id}`)]);buttons.push([b("← Назад","menu:back")]);
  return editOrSend(env,chatId,msg,rows.length?"🕘 История\n\nПоследние результаты:":"🕘 История\n\nПока ничего нет.",{inline_keyboard:buttons});
}
async function viewHistory(env:Bindings,userId:number,chatId:string,msg:any,id:number){
  const db=createDb(env),job=await db.select().from(jobs).where(and(eq(jobs.id,id),eq(jobs.userId,userId))).get();if(!job?.outputJson)return;
  const o=JSON.parse(job.outputJson),text=job.type==="post"?formatPost(o):job.type==="script"?formatScript(o):job.type==="content_plan"?formatPlan(o):"♻️ Repurpose\n\nРезультат сохранён. Открой его из истории по нужному разделу.";
  return editOrSend(env,chatId,msg,text,job.type==="repurpose"?{inline_keyboard:[[b("📱 Telegram",`rep:view:${id}:telegram`),b("📸 Instagram",`rep:view:${id}:instagram`)],[b("🎵 TikTok",`rep:view:${id}:tiktok`),b("▶️ YouTube",`rep:view:${id}:youtube`)],[b("🔥 Hooks",`rep:view:${id}:hooks`),b("🎯 CTA",`rep:view:${id}:cta`)],[b("📅 План",`rep:view:${id}:plan`)],[b("← Назад","menu:history")]]}:{inline_keyboard:[[b("← Назад","menu:history")]]});
}
async function viewPlanItem(env:Bindings,userId:number,chatId:string,msg:any,data:string){
  const [, , id,index]=data.split(":"),db=createDb(env),job=await db.select().from(jobs).where(and(eq(jobs.id,Number(id)),eq(jobs.userId,userId))).get();if(!job?.outputJson)return;
  const o=JSON.parse(job.outputJson),d=o.days?.[Number(index)];if(!d)return;
  return editOrSend(env,chatId,msg,"📅 "+d.day+"\\n\\n📝 "+d.title+"\\n\\n"+d.platform+" · "+d.format+"\\n\\n🔥 "+d.hook,{inline_keyboard:[[b("✨ Создать","plan:create-item:"+id+":"+index)],[b("← К плану","history:view:"+id)]]});
}
async function createPlanItem(env:Bindings,userId:number,chatId:string,msg:any,data:string){
  const [, , id,index]=data.split(":"),db=createDb(env),source=await db.select().from(jobs).where(and(eq(jobs.id,Number(id)),eq(jobs.userId,userId))).get();if(!source?.outputJson)return;
  const o=JSON.parse(source.outputJson),d=o.days?.[Number(index)];if(!d)return;
  const type=String(d.format).toLowerCase().includes("short")||String(d.platform).toLowerCase().includes("tiktok")||String(d.platform).toLowerCase().includes("youtube")?"script":"post";
  const cost=type==="script"?2:1,input=type==="script"?{topic:d.title,platform:String(d.platform).toLowerCase().includes("instagram")?"instagram":String(d.platform).toLowerCase().includes("tiktok")?"tiktok":"youtube",style:"dynamic",duration:"30"}:{topic:d.title,platform:String(d.platform).toLowerCase().includes("instagram")?"instagram":"telegram",style:"conversational",length:"short"};
  return enqueue(env,userId,chatId,msg,cost,type,input);
}
async function viewRepurpose(env:Bindings,userId:number,chatId:string,msg:any,data:string){
  const [, , id,key]=data.split(":"),db=createDb(env),job=await db.select().from(jobs).where(and(eq(jobs.id,Number(id)),eq(jobs.userId,userId))).get();if(!job?.outputJson)return;
  const o=JSON.parse(job.outputJson),value=key==="hooks"?o.hooks.map((x:string,i:number)=>(i+1)+". "+x).join("\n"):key==="plan"?o.plan.map((x:any)=>x.day+" — "+x.title+" · "+x.format).join("\n"):o[key]??"";
  return editOrSend(env,chatId,msg,"♻️ "+key+"\n\n"+String(value).slice(0,3800),{inline_keyboard:[[b("← Назад","menu:back")]]});
}
async function buy(env:Bindings,userId:number,chatId:string,data:string){
  const plans:any={creator:{stars:99,credits:100,days:30,title:"Creator"},pro:{stars:299,credits:500,days:30,title:"Pro"},credits:{stars:49,credits:50,days:0,title:"50 Credits"}},plan=plans[data.slice(4)];if(!plan)return;
  const payload="creatorai:"+userId+":"+data.slice(4)+":"+Date.now(),db=createDb(env);
  await db.insert(payments).values({userId,provider:"telegram_stars",kind:data.slice(4)==="credits"?"credits":"subscription",invoicePayload:payload,currency:"XTR",starsAmount:plan.stars,status:"pending",createdAt:new Date()});
  await sendInvoice(env,chatId,plan.title,plan.credits+" credits"+(plan.days?" for "+plan.days+" days":""),payload,plan.stars);
}
async function completePayment(env:Bindings,userId:number,payment:any){
  const db=createDb(env),row=await db.select().from(payments).where(eq(payments.invoicePayload,String(payment.invoice_payload))).get();if(!row||row.status==="paid")return;
  await db.update(payments).set({status:"paid",telegramPaymentChargeId:payment.telegram_payment_charge_id}).where(eq(payments.id,row.id));
  const key=String(row.invoicePayload).split(":")[2],now=new Date(),grants:any={creator:{plan:"creator",credits:100,days:30},pro:{plan:"pro",credits:500,days:30},credits:{plan:null,credits:50,days:0}},grant=grants[key];if(!grant)return;
  const u=await db.select().from(users).where(eq(users.id,userId)).get();if(!u)return;
  const balance=u.creditsBalance+grant.credits;
  await db.update(users).set({plan:grant.plan??u.plan,creditsBalance:balance,creditsResetAt:grant.days?new Date(now.getTime()+grant.days*86400000):u.creditsResetAt,updatedAt:now}).where(eq(users.id,userId));
  await db.insert(creditLedger).values({userId,delta:grant.credits,balanceAfter:balance,reason:key==="credits"?"stars_credits":"subscription_grant",paymentId:row.id,createdAt:now});
  if(grant.days)await db.insert(subscriptions).values({userId,plan:grant.plan,provider:"telegram_stars",starsAmount:row.starsAmount,status:"active",currentPeriodStart:now,expiresAt:new Date(now.getTime()+grant.days*86400000),telegramPaymentChargeId:payment.telegram_payment_charge_id,invoicePayload:row.invoicePayload,isRecurring:false,createdAt:now,updatedAt:now});
}
async function startFlow(db:any,userId:number,flow:string,step:string,draft:any){await db.insert(userSessions).values({userId,flow,step,draftJson:JSON.stringify(draft),updatedAt:new Date()}).onConflictDoUpdate({target:userSessions.userId,set:{flow,step,draftJson:JSON.stringify(draft),updatedAt:new Date()}});}
async function saveSession(db:any,userId:number,flow:string,step:string,draft:any){await db.update(userSessions).set({flow,step,draftJson:JSON.stringify(draft),updatedAt:new Date()}).where(eq(userSessions.userId,userId));}
async function editOrSend(env:Bindings,chatId:string,msg:any,text:string,markup?:unknown){if(msg?.message_id)return editMessageText(env,chatId,msg.message_id,text,markup);return sendMessage(env,chatId,text,markup);}
function renderPostConfig(d:any){return "📝 Post Maker\n\nТема:\n"+d.topic+"\n\n📱 Площадка\n✍️ Стиль\n📏 Длина";}
function renderScriptConfig(d:any){return "🎬 Script Maker\n\nТема:\n"+d.topic+"\n\n📱 Площадка\n✍️ Стиль\n⏱ Длительность";}
function renderPlanConfig(d:any){return "📅 Content Plan\n\nТема:\n"+d.topic+"\n\n🎯 Цель\n📱 Площадка\n✍️ Стиль";}
function formatPost(o:any){return "📝 Готово ✅\n\n"+o.title+"\n\n"+o.body+"\n\n────────────\n\n📱 "+o.platform+"\n✍️ "+o.style+"\n📏 "+o.length;}
function formatScript(o:any){return "🎬 Сценарий готов ✅\n\n"+o.title+"\n\n🔥 Hook:\n"+o.hook+"\n\n"+o.scenes.map((s:any)=>"[ "+s.time+" ]\n🗣 "+s.spoken+"\n🎥 "+s.visual+"\n📝 "+s.onScreen).join("\n\n")+"\n\n🎯 CTA:\n"+o.cta;}
function formatPlan(o:any){return "📅 План готов ✅\n\n"+o.topic+"\n\n"+o.days.map((d:any)=>d.day+"\n📝 "+d.title+"\n"+d.platform+" · "+d.format+"\n🔥 "+d.hook).join("\n\n");}
function historyLabel(j:any){const input=JSON.parse(j.inputJson??"{}"),icon=j.type==="post"?"📝":j.type==="script"?"🎬":j.type==="repurpose"?"♻️":"📅";return icon+" "+String(input.topic??input.material??"Результат").slice(0,42)+" · "+j.creditsCharged+" credits";}
function b(text:string,data:string){return {text,callback_data:data};}
