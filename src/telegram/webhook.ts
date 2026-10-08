import type{Bindings}from"../env";
import{ensureUser}from"../billing/credits";
import{getPrice,getPackage,getPlan,getHistoryDuration}from"../config";
import{createTextSource,createDocumentSource}from"../files/source";
import{createJob}from"../jobs/create";
import{createPlanDayJob}from"../jobs/day-engine";
import{daysForPlan}from"../jobs/plan-store";
import{plainResult,resultMarkup}from"../jobs/runner";
import{answerCallback,answerPreCheckoutQuery,deleteMessage,editMessageText,sendInvoice,sendMessage,setMyCommands,setChatMenuButton}from"./api";
import{mainMenu,postConfig,scriptConfig,planConfig,repurposeTargets,postResult,planResult,historyItem,styleKeyboard,insufficientKeyboard,errorKeyboard,settingsKeyboard,accountKeyboard,languageKeyboard,notificationKeyboard,helpKeyboard,creditsKeyboard,tariffsKeyboard,adminBack}from"./keyboards";
import{copyFor,Lang}from"../text";
import{ensureAdminSeed,isAdmin,adminAction,applyAdminValue,openAdmin}from"../admin";

type Any=Record<string,any>;
const parse=(v:any):Any=>{try{return v?JSON.parse(String(v)):{};}catch{return{}}};
const userById=(env:Bindings,id:number)=>env.DB.prepare("SELECT * FROM users WHERE id=?").bind(id).first<Any>();
const sessionByUser=(env:Bindings,id:number)=>env.DB.prepare("SELECT * FROM user_sessions WHERE user_id=?").bind(id).first<Any>();
const getLang=(u:any):Lang=>String(u?.language)==="en"?"en":"ru";
const tx=(u:any)=>copyFor(getLang(u));
const setupMenu=async(env:Bindings,chatId:string,lang:Lang,isAdminUser=false)=>{
 const names=lang==="en"
  ?[["post","Post"],["script","Script"],["repurpose","Repurpose"],["content_plan","Content Plan"],["history","History"],["tariffs","Tariffs"],["credits","Credits"],["my_style","My Style"],["settings","Settings"]]
  :[["post","Пост"],["script","Сценарий"],["repurpose","Repurpose"],["content_plan","Контент-план"],["history","История"],["tariffs","Тарифы"],["credits","Кредиты"],["my_style","Мой стиль"],["settings","Настройки"]];
 if(isAdminUser)names.push(["admin",lang==="en"?"Admin Panel":"Админ-панель"]);
 await setMyCommands(env,names.map(([command,description])=>({command,description})),lang,{type:"chat",chat_id:chatId});
 await setChatMenuButton(env,chatId);
};
const allowedDuringLock=(d:string)=>d==="menu:pricing"||d==="menu:credits"||d==="menu:settings"||d==="settings:profile"||d==="menu:back"||d==="back"||d==="cancel"||d.startsWith("settings:");
async function hasLock(env:Bindings,userId:number){const r=await env.DB.prepare("SELECT generation_lock_job_id FROM users WHERE id=?").bind(userId).first<Any>();return Number(r?.generation_lock_job_id||0)>0}
async function saveSession(env:Bindings,userId:number,flow:string,step:string,draft:Any,msgId?:number,chatId?:string,ttl=7200000,activeJobId:number|null=null){
 const n=Date.now();
 await env.DB.prepare("INSERT INTO user_sessions(user_id,flow,step,working_message_id,working_chat_id,active_job_id,draft_json,expires_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET flow=excluded.flow,step=excluded.step,working_message_id=COALESCE(excluded.working_message_id,user_sessions.working_message_id),working_chat_id=COALESCE(excluded.working_chat_id,user_sessions.working_chat_id),active_job_id=excluded.active_job_id,draft_json=excluded.draft_json,expires_at=excluded.expires_at,updated_at=excluded.updated_at")
  .bind(userId,flow,step,msgId||null,chatId||null,activeJobId,JSON.stringify(draft||{}),n+ttl,n).run();
}
async function clearPendingRepurpose(env:Bindings,userId:number){
 const s=await sessionByUser(env,userId);if(!s||s.flow!=="repurpose")return;
 const d=parse(s.draft_json);if(d.jobId){
  const j=await env.DB.prepare("SELECT status FROM jobs WHERE id=? AND user_id=?").bind(Number(d.jobId),userId).first<Any>();
  if(j?.status==="awaiting_selection")await env.DB.prepare("UPDATE jobs SET status='cancelled',completed_at=?,updated_at=? WHERE id=? AND user_id=? AND status='awaiting_selection'").bind(Date.now(),Date.now(),Number(d.jobId),userId).run();
  await env.DB.prepare("UPDATE users SET generation_lock_job_id=NULL,updated_at=? WHERE id=? AND generation_lock_job_id=?").bind(Date.now(),userId,Number(d.jobId)).run();
 }
}
async function finalizeReceiptFailure(env:Bindings,updateId:number){if(updateId)await env.DB.prepare("DELETE FROM update_receipts WHERE update_id=?").bind(updateId).run();}
export async function handleWebhook(env:Bindings,update:unknown){
 const u=update as Any;await ensureAdminSeed(env);const updateId=Number(u.update_id||0);
 if(updateId){const q=await env.DB.prepare("INSERT OR IGNORE INTO update_receipts(update_id,created_at) VALUES(?,?)").bind(updateId,Date.now()).run();if(q.meta.changes!==1)return}
 try{
  if(u.pre_checkout_query)return handlePreCheckout(env,u.pre_checkout_query);
  const message=u.message,cb=u.callback_query,from=message?.from||cb?.from;if(!from)return;
  const chatId=String(message?.chat?.id||cb?.message?.chat?.id||"");const user=await ensureUser(env,String(from.id),from.first_name,from.username);const lang=getLang(user),t=copyFor(lang);
  await setupMenu(env,chatId,lang,await isAdmin(env,String(from.id))).catch(()=>{});
  if(message?.successful_payment){
   const paymentUser=await paymentOwner(env,String(message.successful_payment.invoice_payload||""));if(paymentUser!==user.id)return;
   await completePayment(env,user.id,message.successful_payment);
   if(!(await hasLock(env,user.id)))return openMain(env,user.id,chatId);
   return sendMessage(env,chatId,lang==="en"?"✅ Payment completed. Your current generation continues.":"✅ Оплата прошла. Текущая генерация продолжается.");
  }
  const rawText=String(message?.text||"");const cmd=rawText.split("@")[0].split(/\s+/)[0];
  if(cmd==="/paysupport")return sendMessage(env,chatId,t.help);
  if(cmd==="/admin"&&await isAdmin(env,String(from.id)))return openAdmin(env,chatId);
  if(cmd==="/start"){
   if(await hasLock(env,user.id))return sendMessage(env,chatId,t.locked);
   return openMain(env,user.id,chatId);
  }
  const menuCommands:Record<string,()=>Promise<any>>={
   "/post":()=>openFeature(env,user.id,chatId,"post"),"/script":()=>openFeature(env,user.id,chatId,"script"),
   "/repurpose":()=>openFeature(env,user.id,chatId,"repurpose"),"/content_plan":()=>openFeature(env,user.id,chatId,"plan"),
   "/history":()=>showHistory(env,user.id,chatId,undefined,0),"/tariffs":()=>showPricing(env,user.id,chatId,undefined),
   "/credits":()=>showCredits(env,user.id,chatId,undefined),"/my_style":()=>openStyle(env,user.id,chatId),
   "/settings":()=>showSettings(env,user.id,chatId,undefined)
  };
  if(menuCommands[cmd]){
   if(await hasLock(env,user.id)&&cmd!=="/settings")return sendMessage(env,chatId,t.locked);
   return menuCommands[cmd]();
  }
  if(cb){
   await answerCallback(env,String(cb.id)).catch(()=>{});
   return openAction(env,user.id,chatId,String(cb.data||""),cb.message||{},updateId);
  }
  if(message?.document){
   const s=await sessionByUser(env,user.id);
   if(s?.flow==="repurpose"&&s.step==="source")return handleDocument(env,user.id,chatId,message,s,updateId);
  }
  if(message?.text)return handleText(env,user.id,chatId,String(message.text),Number(message.message_id),updateId);
 }catch(e){await finalizeReceiptFailure(env,updateId);throw e}
}
async function paymentOwner(env:Bindings,payload:string){const r=await env.DB.prepare("SELECT user_id FROM payments WHERE invoice_payload=?").bind(payload).first<Any>();return r?.user_id?Number(r.user_id):null}
async function handleText(env:Bindings,userId:number,chatId:string,value:string,messageId:number,updateId:number){
 const s=await sessionByUser(env,userId);if(!s)return false;const user=await userById(env,userId),t=tx(user),v=value.trim(),d=parse(s.draft_json);if(s.flow==="admin")return applyAdminValue(env,userId,chatId,v);if(!v)return true;
 if(s.flow==="style"){
  const a=Array.isArray(d.examples)?d.examples:[];if(a.length>=20)return true;a.push(v.slice(0,4000));
  await saveSession(env,userId,"style","examples",{examples:a},Number(s.working_message_id),chatId,14400000,null);
  await deleteMessage(env,chatId,messageId).catch(()=>{});
  if(a.length>=20){const price=await getPrice(env,"style_profile");await editMessageText(env,chatId,Number(s.working_message_id),t.styleDone(price),styleKeyboard(20,getLang(user))).catch(()=>{});}
  else if(a.length>=5){const price=await getPrice(env,"style_profile");await editMessageText(env,chatId,Number(s.working_message_id),t.styleReady(a.length,price),styleKeyboard(a.length,getLang(user))).catch(()=>{});}
  else await editMessageText(env,chatId,Number(s.working_message_id),t.styleCollecting(a.length)).catch(()=>{});
  return true;
 }
 if(s.flow==="edit"){
  const instruction=v;const resultId=Number(d.resultId||0);if(resultId){const r=await resultRow(env,userId,resultId);if(r){const j=parse(r.job_input);j.editInstruction=instruction;d.previousResult=parse(r.content_json);d.topic=String(j.topic||d.topic||"");await saveSession(env,userId,s.flow,"config",{...d,sourceText:j.sourceText},Number(s.working_message_id),chatId);return renderConfig(env,userId,chatId,String(j.operation||r.result_type),{message_id:Number(s.working_message_id)})}}return true;
 }
 if((s.flow==="repurpose"||s.flow==="repurpose_edit")&&s.step==="source"){
  if(v.length>4000){await editMessageText(env,chatId,Number(s.working_message_id),t.sourceTooLarge).catch(()=>{});return true}
  try{
   const sourceId=await createTextSource(env,userId,v),wm=Number(s.working_message_id);await deleteMessage(env,chatId,messageId).catch(()=>{});await editMessageText(env,chatId,wm,t.processingSteps("repurpose")[0]).catch(()=>{});
   await saveSession(env,userId,"repurpose","analysis",{sourceId,selectedOutputs:[]},wm,chatId,7200000,null);
   const r=await createJob(env,{userId,chatId,type:"repurpose",input:{sourceId,phase:"analysis",selectedOutputs:[]},cost:0,workingMessageId:wm,sourceId,idempotencyKey:"repurpose-analysis:"+sourceId});
   if(r?.status==="created"&&r.jobId)await saveSession(env,userId,"repurpose","analysis",{sourceId,selectedOutputs:[],jobId:r.jobId},wm,chatId,7200000,r.jobId);
  }catch{await editMessageText(env,chatId,Number(s.working_message_id),t.sourceInvalid).catch(()=>{})}
  return true;
 }
 if(s.flow==="post"||s.flow==="script"||s.flow==="plan"){
  if(s.step!=="topic")return true;d.topic=v.slice(0,12000);await deleteMessage(env,chatId,messageId).catch(()=>{});
  await saveSession(env,userId,s.flow,"config",d,Number(s.working_message_id),chatId,7200000,s.active_job_id?Number(s.active_job_id):null);
  return renderConfig(env,userId,chatId,s.flow,{message_id:Number(s.working_message_id)});
 }
 return false;
}
async function handleDocument(env:Bindings,userId:number,chatId:string,message:Any,s:Any,updateId:number){
 const u=await userById(env,userId),t=tx(u);try{
  const x=await createDocumentSource(env,userId,message.document),wm=Number(s.working_message_id);await deleteMessage(env,chatId,message.message_id).catch(()=>{});await editMessageText(env,chatId,wm,t.processingSteps("repurpose")[0]).catch(()=>{});
  const r=await createJob(env,{userId,chatId,type:"repurpose",input:{sourceId:x.sourceId,phase:"analysis",selectedOutputs:[]},cost:0,workingMessageId:wm,sourceId:x.sourceId,idempotencyKey:"repurpose-analysis:"+x.sourceId});
  await saveSession(env,userId,"repurpose","analysis",{sourceId:x.sourceId,selectedOutputs:[],jobId:r?.jobId},wm,chatId,7200000,r?.jobId?Number(r.jobId):null);
  return r;
 }catch(e){
  const key=String(e),body=key.includes("source_too_large")||key.includes("source_extracted_too_large")?t.sourceTooLarge:key.includes("unsupported_format")?t.unsupported:t.sourceInvalid;
  await editMessageText(env,chatId,Number(s.working_message_id),body).catch(()=>{});
 }
}
async function openAction(env:Bindings,userId:number,chatId:string,data:string,msg:Any,updateId:number){
 const u=await userById(env,userId),t=tx(u),locked=await hasLock(env,userId),s=await sessionByUser(env,userId);
 if(data.startsWith("admin:"))return(await isAdmin(env,String(u?.telegram_id||"")))?adminAction(env,userId,chatId,data,msg,updateId):undefined;
 const repSelection=locked&&s?.flow==="repurpose"&&s.step==="select";
 if(locked&&!allowedDuringLock(data)&&!(repSelection&&(data==="create"||data.startsWith("target:"))))return sendMessage(env,chatId,t.locked);
 if(data==="menu:back"||data==="back"){if(locked&&s?.flow==="repurpose"&&s.step==="select")await clearPendingRepurpose(env,userId);return openMain(env,userId,chatId,msg)}
 if(data==="menu:post")return openFeature(env,userId,chatId,"post",msg);
 if(data==="menu:script")return openFeature(env,userId,chatId,"script",msg);
 if(data==="menu:repurpose")return openFeature(env,userId,chatId,"repurpose",msg);
 if(data==="menu:plan")return openFeature(env,userId,chatId,"plan",msg);
 if(data==="menu:style")return openStyle(env,userId,chatId,msg);
 if(data==="menu:history")return showHistory(env,userId,chatId,msg,0);
 if(data==="menu:pricing")return showPricing(env,userId,chatId,msg);
 if(data==="menu:credits")return showCredits(env,userId,chatId,msg);
 if(data==="menu:settings")return showSettings(env,userId,chatId,msg);
 if(data==="settings:profile")return showAccount(env,userId,chatId,msg);
 if(data==="settings:language")return editMessageText(env,chatId,Number(msg.message_id),t.language,languageKeyboard(getLang(u)));
 if(data.startsWith("settings:language:")){
  const l=(data.endsWith(":en")?"en":"ru") as Lang;
  await env.DB.prepare("UPDATE users SET language=?,updated_at=? WHERE id=?").bind(l,Date.now(),userId).run();
  const nt=copyFor(l),m=Number(msg.message_id);
  await editMessageText(env,chatId,m,nt.language,languageKeyboard(l)).catch(()=>{});
  const confirmation=l==="en"?nt.languageAppliedEn:nt.languageAppliedRu;
  await sendMessage(env,chatId,confirmation);
  await setupMenu(env,chatId,l,await isAdmin(env,String(u?.telegram_id||""))).catch(()=>{});
  return;
 }
 if(data==="settings:notifications"){const x=await userById(env,userId);return editMessageText(env,chatId,Number(msg.message_id),tx(x).notifications(!!x?.notifications_enabled),notificationKeyboard(!!x?.notifications_enabled,getLang(x)))}
 if(data==="settings:toggle"){
  const x=await userById(env,userId);await env.DB.prepare("UPDATE users SET notifications_enabled=?,updated_at=? WHERE id=?").bind(x?.notifications_enabled?0:1,Date.now(),userId).run();
  const nu=await userById(env,userId);return editMessageText(env,chatId,Number(msg.message_id),tx(nu).notifications(!!nu?.notifications_enabled),notificationKeyboard(!!nu?.notifications_enabled,getLang(nu)));
 }
 if(data==="settings:support"){
  const tg=String(env.SUPPORT_USERNAME||"").trim();const em=String((env as any).SUPPORT_EMAIL||"").trim();
  const tgUrl=tg?("https://t.me/"+tg.replace(/^@/,"")):undefined,emailUrl=em?("mailto:"+em):undefined;
  return editMessageText(env,chatId,Number(msg.message_id),t.help,helpKeyboard(getLang(u),tgUrl,emailUrl));
 }
 if(data==="support:telegram")return sendMessage(env,chatId,getLang(u)==="en"?"Telegram support is not configured yet.":"Поддержка в Telegram пока не настроена.");
 if(data==="support:email")return sendMessage(env,chatId,getLang(u)==="en"?"Email support is not configured yet.":"Поддержка по почте пока не настроена.");
 if(data==="settings:terms")return editMessageText(env,chatId,Number(msg.message_id),t.terms,{inline_keyboard:[[{text:getLang(u)==="en"?"↩️ Back":"↩️ Назад",callback_data:"menu:settings"}]]});
 if(data==="settings:privacy")return editMessageText(env,chatId,Number(msg.message_id),t.privacy,{inline_keyboard:[[{text:getLang(u)==="en"?"↩️ Back":"↩️ Назад",callback_data:"menu:settings"}]]});
 if(data==="style:start"){await editMessageText(env,chatId,Number(msg.message_id),t.styleInitial).catch(()=>{});return saveSession(env,userId,"style","examples",{examples:[]},Number(msg.message_id),chatId,14400000,null)}
 if(data==="style:add"){const d=parse((await sessionByUser(env,userId))?.draft_json);return editMessageText(env,chatId,Number(msg.message_id),t.styleCollecting(Number(d.examples?.length||0))).then(()=>saveSession(env,userId,"style","examples",d,Number(msg.message_id),chatId,14400000,null))}
 if(data==="style:analyze"){const s0=await sessionByUser(env,userId),d0=parse(s0?.draft_json),n=Number(d0.examples?.length||0);return n>=5?startStyle(env,userId,chatId,msg,updateId):sendMessage(env,chatId,t.styleCollecting(n))}
 if(data.startsWith("cfg:"))return configOptions(env,userId,chatId,data,msg);
 if(data.startsWith("sel:"))return selectParam(env,userId,chatId,data.slice(4),msg);
 if(data.startsWith("cfgback:")){const flow=data.slice(8);return renderConfig(env,userId,chatId,flow,msg);}
 if(data.startsWith("target:"))return selectTarget(env,userId,chatId,data.slice(7),msg);
 if(data==="create")return createCurrent(env,userId,chatId,msg,updateId);
 if(data==="cancel"){if(s?.flow==="repurpose"&&s.step==="select")await clearPendingRepurpose(env,userId);return openMain(env,userId,chatId,msg)}
 if(data.startsWith("copy:"))return copyResult(env,userId,chatId,Number(data.split(":")[1]));
 if(data.startsWith("hcopy:"))return copyResult(env,userId,chatId,Number(data.split(":")[1]));
 if(data.startsWith("save:"))return saveResult(env,userId,chatId,Number(data.split(":")[1]));
 if(data.startsWith("edit:"))return editResult(env,userId,chatId,Number(data.split(":")[1]),msg);
 if(data.startsWith("variant:"))return variantResult(env,userId,chatId,Number(data.split(":")[1]),updateId,msg);
 if(data.startsWith("retry:"))return retryJob(env,userId,chatId,Number(data.split(":")[1]),updateId);
 if(data.startsWith("rep-retry:"))return retryRepurpose(env,userId,chatId,Number(data.split(":")[1]),updateId);
 if(data.startsWith("hcontinue:")||data.startsWith("hitem:"))return historyOpen(env,userId,chatId,Number(data.split(":")[1]),msg);
 if(data.startsWith("hdelete:"))return deleteHistory(env,userId,chatId,Number(data.split(":")[1]),msg);
 if(data.startsWith("hpage:"))return showHistory(env,userId,chatId,msg,Number(data.split(":")[1]));
 if(data.startsWith("dayview:"))return showPlanDay(env,userId,chatId,Number(data.split(":")[1]),Number(data.split(":")[2]),msg);
 if(data.startsWith("plandaylist:"))return showPlanDays(env,userId,chatId,Number(data.split(":")[1]),msg);
 if(data.startsWith("dayedit:"))return startPlanDayEdit(env,userId,chatId,Number(data.split(":")[1]),Number(data.split(":")[2]),msg);
 if(data.startsWith("planopen:"))return reopenPlan(env,userId,chatId,Number(data.split(":")[1]),msg);
 if(data.startsWith("day:"))return createPlanDay(env,userId,chatId,Number(data.split(":")[1]),Number(data.split(":")[2]),updateId,Number(msg.message_id));
 if(data.startsWith("pay:"))return purchase(env,userId,chatId,data.slice(4),msg);
 if(data.startsWith("buy:"))return openPaymentMethod(env,userId,chatId,data.slice(4),msg);
 if(data.startsWith("terms:accept:")){const key=data.slice(13);await env.DB.prepare("UPDATE users SET terms_accepted_at=?,updated_at=? WHERE id=?").bind(Date.now(),Date.now(),userId).run();return issueInvoice(env,userId,chatId,key)}
 if(data.startsWith("deliver-retry:"))return retryDelivery(env,userId,Number(data.split(":")[1]),chatId);
}
async function openMain(env:Bindings,userId:number,chatId:string,msg?:Any){
 const s=await sessionByUser(env,userId);if(s?.flow==="repurpose"&&s.step==="select")await clearPendingRepurpose(env,userId);
 const u=await userById(env,userId),t=tx(u),body=t.start(String(u?.first_name||"Creator"));
 if(msg?.message_id){await editMessageText(env,chatId,Number(msg.message_id),body,mainMenu).catch(()=>{});return saveSession(env,userId,"ui","menu",{},Number(msg.message_id),chatId,86400000,null)}
 const m=await sendMessage(env,chatId,body,mainMenu);return saveSession(env,userId,"ui","menu",{},Number(m.message_id),chatId,86400000,null);
}
async function openFeature(env:Bindings,userId:number,chatId:string,flow:string,msg?:Any){
 const u=await userById(env,userId),t=tx(u);
 const d=flow==="post"?{topic:"",platform:"telegram",style:"conversational",length:"short"}:flow==="script"?{topic:"",platform:"tiktok",style:"dynamic",duration:"30"}:flow==="plan"?{topic:"",goal:"growth",platform:"telegram",style:"expert"}:{sourceId:null,selectedOutputs:[]};
 const body=flow==="post"?t.postEntry:flow==="script"?t.scriptEntry:flow==="plan"?t.planEntry:t.repEntry,kb={inline_keyboard:[[tlang(t,"↩️ В меню","↩️ In menu") as any].map(()=>({text:getLang(u)==="en"?"↩️ In menu":"↩️ В меню",callback_data:"menu:back"}))]};
 if(msg?.message_id){await editMessageText(env,chatId,Number(msg.message_id),body,kb);return saveSession(env,userId,flow,flow==="repurpose"?"source":"topic",d,Number(msg.message_id),chatId)}
 const m=await sendMessage(env,chatId,body,kb);return saveSession(env,userId,flow,flow==="repurpose"?"source":"topic",d,Number(m.message_id),chatId);
}
const tlang=(_t:any,ru:string,en:string)=>getLang(_t)==="en"?en:ru;
async function openStyle(env:Bindings,userId:number,chatId:string,msg?:Any){
 const u=await userById(env,userId),t=tx(u),body=t.styleEntry,kb=styleKeyboard(0,getLang(u));
 if(msg?.message_id){await editMessageText(env,chatId,Number(msg.message_id),body,kb);return saveSession(env,userId,"style","entry",{examples:[]},Number(msg.message_id),chatId,14400000,null)}
 const m=await sendMessage(env,chatId,body,kb);return saveSession(env,userId,"style","entry",{examples:[]},Number(m.message_id),chatId,14400000,null);
}
async function configOptions(env:Bindings,userId:number,chatId:string,data:string,msg:Any){
 const u=await userById(env,userId),lang=getLang(u);
 const items:Record<string,{items:{text:string;data:string}[];back:string}>={
  "cfg:post:platform":{items:lang==="en"?[["📱 Telegram","telegram"],["📸 Instagram","instagram"],["🎵 TikTok","tiktok"],["▶️ YouTube","youtube"]]:[["📱 Telegram","telegram"],["📸 Instagram","instagram"],["🎵 TikTok","tiktok"],["▶️ YouTube","youtube"]],back:"cfgback:post"},
  "cfg:post:style":{items:lang==="en"?[["💼 Expert","expert"],["😎 Conversational","conversational"],["📰 News","news"],["💰 Sales","sales"]]:[["💼 Экспертный","expert"],["😎 Разговорный","conversational"],["📰 Новостной","news"],["💰 Продающий","sales"]],back:"cfgback:post"},
  "cfg:post:length":{items:lang==="en"?[["⚡ Short","short"],["📝 Medium","medium"],["📚 Long","long"]]:[["⚡ Короткий","short"],["📝 Средний","medium"],["📚 Длинный","long"]],back:"cfgback:post"},
  "cfg:script:platform":{items:lang==="en"?[["🎵 TikTok","tiktok"],["📸 Reels","instagram"],["▶️ YouTube Shorts","youtube"]]:[["🎵 TikTok","tiktok"],["📸 Reels","instagram"],["▶️ YouTube Shorts","youtube"]],back:"cfgback:script"},
  "cfg:script:style":{items:lang==="en"?[["💼 Expert","expert"],["😎 Conversational","conversational"],["⚡ Dynamic","dynamic"],["💰 Sales","sales"]]:[["💼 Экспертная","expert"],["😎 Разговорная","conversational"],["⚡ Динамичная","dynamic"],["💰 Продающая","sales"]],back:"cfgback:script"},
  "cfg:script:duration":{items:["15","30","45","60"].map(x=>({text:lang==="en"?x+" sec":x+" сек",data:x})),back:"cfgback:script"},
  "cfg:plan:goal":{items:lang==="en"?[["📈 Growth","growth"],["💰 Sales","sales"],["❤️ Engagement","engagement"],["🧠 Expertise","expertise"]]:[["📈 Рост","growth"],["💰 Продажи","sales"],["❤️ Вовлечение","engagement"],["🧠 Экспертность","expertise"]],back:"cfgback:plan"},
  "cfg:plan:platform":{items:[["📱 Telegram","telegram"],["📸 Instagram","instagram"],["🎵 TikTok","tiktok"],["▶️ YouTube","youtube"]],back:"cfgback:plan"},
  "cfg:plan:style":{items:lang==="en"?[["💼 Expert","expert"],["😎 Conversational","conversational"],["📰 News","news"],["💰 Sales","sales"]]:[["💼 Экспертный","expert"],["😎 Разговорный","conversational"],["📰 Новостной","news"],["💰 Продающий","sales"]],back:"cfgback:plan"}
 };
 const x=items[data];if(!x)return;
 const rows:any[][]=[];for(let i=0;i<x.items.length;i+=2)rows.push(x.items.slice(i,i+2).map(z=>({text:z.text,callback_data:"sel:"+z.data})));
 rows.push([{text:lang==="en"?"↩️ Back":"↩️ Назад",callback_data:x.back}]);
 return editMessageText(env,chatId,Number(msg.message_id),lang==="en"?"Choose a parameter:":"Выбери параметр:",{inline_keyboard:rows});
}
async function renderConfig(env:Bindings,userId:number,chatId:string,flow:string,msg:Any){
 const s=await sessionByUser(env,userId),u=await userById(env,userId),t=tx(u),d=parse(s?.draft_json),price=await getPrice(env,flow==="plan"?"content_plan":flow);
 const body=flow==="post"?t.postConfig(price,d):flow==="script"?t.scriptConfig(price,d):t.planConfig(price,d);
 const kb=flow==="post"?postConfig(d,getLang(u)):flow==="script"?scriptConfig(d,getLang(u)):planConfig(d,getLang(u));
 return editMessageText(env,chatId,Number(msg.message_id),body,kb);
}
async function selectParam(env:Bindings,userId:number,chatId:string,key:string,msg:Any){
 const s=await sessionByUser(env,userId);if(!s)return;const d=parse(s.draft_json);
 if(s.flow==="post"){if(["telegram","instagram","tiktok","youtube"].includes(key)&&!d.resultType)d.platform=key;else if(["expert","conversational","news","sales"].includes(key))d.style=key;else if(["short","medium","long"].includes(key))d.length=key;await saveSession(env,userId,"post","config",d,Number(msg.message_id),chatId);return renderConfig(env,userId,chatId,"post",msg)}
 if(s.flow==="script"){if(["tiktok","instagram","youtube"].includes(key)&&!d.resultType)d.platform=key;else if(["expert","conversational","dynamic","sales"].includes(key))d.style=key;else if(["15","30","45","60"].includes(key))d.duration=key;await saveSession(env,userId,"script","config",d,Number(msg.message_id),chatId);return renderConfig(env,userId,chatId,"script",msg)}
 if(s.flow==="plan"){if(["growth","sales","engagement","expertise"].includes(key))d.goal=key;else if(["telegram","instagram","tiktok","youtube"].includes(key))d.platform=key;else if(["expert","conversational","news","sales"].includes(key))d.style=key;await saveSession(env,userId,"plan","config",d,Number(msg.message_id),chatId);return renderConfig(env,userId,chatId,"plan",msg)}
}
async function selectTarget(env:Bindings,userId:number,chatId:string,key:string,msg:Any){
 const s=await sessionByUser(env,userId),d=parse(s?.draft_json),u=await userById(env,userId);if(!s||s.flow!=="repurpose"||s.step!=="select")return;
 const a=Array.isArray(d.selectedOutputs)?d.selectedOutputs:[];d.selectedOutputs=a.includes(key)?a.filter((x:string)=>x!==key):a.concat(key);d.credits=await repurposeTotal(env,d.selectedOutputs);
 await saveSession(env,userId,"repurpose","select",d,Number(msg.message_id),chatId,7200000,Number(d.jobId||s.active_job_id||0)||null);
 return editMessageText(env,chatId,Number(msg.message_id),tx(u).repSelect(d.credits),repurposeTargets(d.selectedOutputs,getLang(u)));
}
async function createCurrent(env:Bindings,userId:number,chatId:string,msg:Any,updateId:number){
 const s=await sessionByUser(env,userId);if(!s)return;const d=parse(s.draft_json),flow=String(s.flow),u=await userById(env,userId);
 let type=flow,cost=0,sourceId:number|null=null,parentJobId=Number(d.parentJobId||0)||null;
 if(flow==="post"||flow==="script")cost=await getPrice(env,flow);
 else if(flow==="plan"){type="content_plan";cost=await getPrice(env,"content_plan")}
 else if(flow==="repurpose"){if(!d.selectedOutputs?.length)return sendMessage(env,chatId,getLang(u)==="en"?"⚠️ Select at least one result.":"⚠️ Выбери хотя бы один результат.");cost=await repurposeTotal(env,d.selectedOutputs);sourceId=Number(d.sourceId);if(d.jobId)return continueRepurpose(env,userId,chatId,s,d,cost)}
 else if(flow==="repurpose_edit"){const out=String(d.resultType||"");if(!out)return;cost=await getPrice(env,"repurpose_"+out);type="repurpose_result";sourceId=Number(d.sourceId||0)||null}
 else return;
 const input={...d,sourceText:d.sourceText,previousResult:d.previousResult,phase:"generation"};
 const r=await createJob(env,{userId,chatId,type,input,cost,workingMessageId:Number(s.working_message_id||msg?.message_id||0),sourceId,parentJobId,idempotencyKey:"create:"+userId+":"+flow+":"+stableKey(input)});
 if(r?.jobId)await saveSession(env,userId,flow,"processing",{...d,jobId:r.jobId},Number(s.working_message_id||msg?.message_id||0),chatId,14400000,r.jobId);
 return r;
}
function stableKey(input:any){const s=JSON.stringify(input,Object.keys(input).sort());let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16)}
async function continueRepurpose(env:Bindings,userId:number,chatId:string,s:Any,d:Any,cost:number){
 const job=await env.DB.prepare("SELECT * FROM jobs WHERE id=? AND user_id=? AND type='repurpose' AND status='awaiting_selection'").bind(Number(d.jobId),userId).first<Any>();if(!job)return;
 if(!Array.isArray(d.selectedOutputs)||!d.selectedOutputs.length)return sendMessage(env,chatId,getLang(await userById(env,userId))==="en"?"⚠️ Select at least one result.":"⚠️ Выбери хотя бы один результат.");
 const lock=await env.DB.prepare("SELECT generation_lock_job_id FROM users WHERE id=?").bind(userId).first<Any>();const lockId=Number(lock?.generation_lock_job_id||0);if(lockId&&lockId!==Number(job.id))return{status:"locked"};
 if(!lockId){const set=await env.DB.prepare("UPDATE users SET generation_lock_job_id=?,updated_at=? WHERE id=? AND generation_lock_job_id IS NULL").bind(job.id,Date.now(),userId).run();if(set.meta.changes!==1)return{status:"locked"}}
 const up=await env.DB.prepare("UPDATE jobs SET status='created',input_json=?,selected_outputs_json=?,credits_required=?,credits_reserved=0,telegram_chat_id=?,telegram_message_id=?,updated_at=? WHERE id=? AND status='awaiting_selection'").bind(JSON.stringify({...d,phase:"generation"}),JSON.stringify(d.selectedOutputs??[]),cost,chatId,Number(s.working_message_id??job.telegram_message_id??0),Date.now(),job.id).run();if(up.meta.changes!==1)return;
 const reserved=await (await import("../billing/credits")).reserveCredits(env,userId,cost,job.id);
 if(!reserved){
  const x=await userById(env,userId);await env.DB.prepare("UPDATE jobs SET status='cancelled',updated_at=? WHERE id=? AND status='created'").bind(Date.now(),job.id).run();await env.DB.prepare("UPDATE users SET generation_lock_job_id=NULL,updated_at=? WHERE id=? AND generation_lock_job_id=?").bind(Date.now(),userId,job.id).run();
  await editMessageText(env,chatId,Number(s.working_message_id??job.telegram_message_id),tx(x).insufficient(cost,Number(x?.credits_balance??0)),insufficientKeyboard(getLang(x))).catch(()=>{});return{status:"insufficient"};
 }
 await env.DB.prepare("UPDATE jobs SET status='queued',updated_at=? WHERE id=? AND status='created'").bind(Date.now(),job.id).run();
 await editMessageText(env,chatId,Number(s.working_message_id??job.telegram_message_id),tx(await userById(env,userId)).processingSteps("repurpose")[0]).catch(()=>{});
 try{await env.AI_QUEUE.send({jobId:job.id});}
 catch(e){
  const{refundCredits}=await import("../billing/credits");await refundCredits(env,userId,cost,job.id,"job:"+job.id+":queue_refund");await env.DB.prepare("UPDATE jobs SET status='failed',credits_reserved=0,error_code='QUEUE_ERROR',error_message=?,completed_at=?,updated_at=? WHERE id=?").bind(String(e).slice(0,500),Date.now(),Date.now(),job.id).run();await env.DB.prepare("UPDATE users SET generation_lock_job_id=NULL,updated_at=? WHERE id=? AND generation_lock_job_id=?").bind(Date.now(),userId,job.id).run();await editMessageText(env,chatId,Number(s.working_message_id??job.telegram_message_id),tx(await userById(env,userId)).aiError,errorKeyboard(job.id,getLang(await userById(env,userId)))).catch(()=>{});return{status:"failed"};
 }
 await saveSession(env,userId,"repurpose","processing",{...d,jobId:job.id},Number(s.working_message_id??job.telegram_message_id??0),chatId,14400000,job.id);
 return{status:"created",jobId:job.id};
}
async function startStyle(env:Bindings,userId:number,chatId:string,msg:Any,_updateId:number){
 const s=await sessionByUser(env,userId),d=parse(s?.draft_json),u=await userById(env,userId),cost=await getPrice(env,"style_profile");if(Number(d.examples?.length||0)<5)return sendMessage(env,chatId,tx(u).styleCollecting(Number(d.examples?.length||0)));
 const r=await createJob(env,{userId,chatId,type:"style_profile",input:{examples:d.examples},cost,workingMessageId:Number(s?.working_message_id||msg?.message_id||0),idempotencyKey:"style:"+userId+":"+stableKey({examples:d.examples})});
 if(r?.jobId)await saveSession(env,userId,"style","processing",{examples:d.examples},Number(s?.working_message_id||msg?.message_id||0),chatId,14400000,r.jobId);
 return r;
}
async function editResult(env:Bindings,userId:number,chatId:string,id:number,msg:Any){
 const r=await resultRow(env,userId,id),u=await userById(env,userId);if(!r)return;const j=parse(r.job_input),t=tx(u),rt=String(r.result_type);
 if(["post","script","content_plan"].includes(rt)){
  const flow=rt==="content_plan"?"plan":rt;const d={...j,editResultId:id,parentJobId:Number(r.job_id),previousResult:parse(r.content_json)};await saveSession(env,userId,flow,"config",d,Number(msg.message_id),chatId,7200000,null);
  const price=await getPrice(env,flow==="plan"?"content_plan":flow),body=flow==="post"?t.postEditConfig(price):flow==="script"?t.scriptEditConfig(price):t.planEditConfig(price),kb=flow==="post"?postConfig(d,getLang(u)):flow==="script"?scriptConfig(d,getLang(u)):planConfig(d,getLang(u));return editMessageText(env,chatId,Number(msg.message_id),body,kb);
 }
 if(rt.startsWith("repurpose_")){
  const output=rt.replace(/^repurpose_/,""),sourceId=Number(r.source_id||j.sourceId||0)||null,sourceText=await sourceForResult(env,r);
  if(["telegram","instagram"].includes(output)){const d={topic:"",platform:output==="telegram"?"telegram":"instagram",style:"conversational",length:"short",editResultId:id,parentJobId:Number(r.job_id),previousResult:parse(r.content_json),sourceId,sourceText,resultType:output};await saveSession(env,userId,"post","config",d,Number(msg.message_id),chatId,7200000,null);const p=await getPrice(env,"repurpose_"+output);return editMessageText(env,chatId,Number(msg.message_id),t.postEditConfig(p),postConfig(d,getLang(u)));}
  if(["tiktok","youtube"].includes(output)){const platform=output==="tiktok"?"tiktok":"youtube",d={topic:"",platform,style:"dynamic",duration:"30",editResultId:id,parentJobId:Number(r.job_id),previousResult:parse(r.content_json),sourceId,sourceText,resultType:output};await saveSession(env,userId,"script","config",d,Number(msg.message_id),chatId,7200000,null);const p=await getPrice(env,"repurpose_"+output);return editMessageText(env,chatId,Number(msg.message_id),t.scriptEditConfig(p),scriptConfig(d,getLang(u)));}
  const d={resultType:output,editResultId:id,parentJobId:Number(r.job_id),sourceId,sourceText,previousResult:parse(r.content_json)};const p=await getPrice(env,"repurpose_"+output);await saveSession(env,userId,"repurpose_edit","config",d,Number(msg.message_id),chatId,7200000,null);return editMessageText(env,chatId,Number(msg.message_id),getLang(u)==="en"?("♻️ Creator AI / Repurpose\\n\\nChange this result and create a new version.\\n\\n💳 Generation cost: "+p+" 🔹"):("♻️ Creator AI / Repurpose\\n\\nИзмени этот результат и создай новую версию.\\n\\n💳 Стоимость генерации: "+p+" 🔹"),{inline_keyboard:[[{text:getLang(u)==="en"?"🚀 Create":"🚀 Создать","callback_data:"create"}],[{text:getLang(u)==="en"?"↩️ In menu":"↩️ В меню","callback_data:"menu:back"}]]});
 }
}
async function variantResult(env:Bindings,userId:number,chatId:string,id:number,updateId:number,_msg:Any){
 const r=await resultRow(env,userId,id);if(!r)return;const rt=String(r.result_type),u=await userById(env,userId),j=parse(r.job_input),base=rt==="post"?"post_variant":rt==="script"?"script_variant":rt==="content_plan"?"content_plan_variant":"repurpose_"+rt.replace(/^repurpose_/,""),sourceId=Number(r.source_id||j.sourceId||0)||null;
 const d={...j,previousResult:parse(r.content_json),resultType:rt.replace(/^repurpose_/,""),sourceText:j.sourceText||await sourceForResult(env,r),sourceId};
 const m=await sendMessage(env,chatId,tx(u).processingSteps(rt==="content_plan"?"content_plan":rt==="script"?"script":"repurpose")[0]);return createJob(env,{userId,chatId,type:rt.startsWith("repurpose_")?"repurpose_result":rt,input:d,cost:await getPrice(env,base),workingMessageId:Number(m.message_id),sourceId,parentJobId:Number(r.job_id),idempotencyKey:"variant:"+userId+":"+id+":"+stableKey({result:parse(r.content_json),updateId})});
}
async function retryJob(env:Bindings,userId:number,chatId:string,id:number,updateId:number){
 const j=await env.DB.prepare("SELECT * FROM jobs WHERE id=? AND user_id=? AND status='failed'").bind(id,userId).first<Any>();if(!j)return;const d=parse(j.input_json),rt=j.type==="content_plan"?"content_plan":j.type==="repurpose_result"?"repurpose_"+String(d.resultType||"telegram"):j.type,cost=await getPrice(env,rt),lang=getLang(await userById(env,userId));if(d.phase==="analysis"||j.type==="repurpose"&&d.phase==="analysis")return createJob(env,{userId,chatId,type:"repurpose",input:d,cost:0,workingMessageId:Number(j.telegram_message_id||0),sourceId:j.source_id||null,idempotencyKey:"retry:"+userId+":"+id});
 const wm=Number(j.telegram_message_id||0);if(wm)await editMessageText(env,chatId,wm,tx(await userById(env,userId)).processingSteps(j.type==="content_plan"?"content_plan":j.type==="script"?"script":"repurpose")[0]).catch(()=>{});
 return createJob(env,{userId,chatId,type:j.type,input:d,cost,workingMessageId:wm,sourceId:j.source_id||null,parentJobId:j.id,idempotencyKey:"retry:"+userId+":"+id+":"+updateId});
}
async function retryRepurpose(env:Bindings,userId:number,chatId:string,id:number,updateId:number){
 const r=await env.DB.prepare("SELECT result_type FROM job_results WHERE job_id=? AND status='failed' ORDER BY position").bind(id).all<Any>(),j=await env.DB.prepare("SELECT * FROM jobs WHERE id=? AND user_id=?").bind(id,userId).first<Any>();if(!j)return;const outs=(r.results||[]).map((x:any)=>String(x.result_type).replace(/^repurpose_/,""));if(!outs.length)return;const d=parse(j.input_json);d.selectedOutputs=outs;const wm=Number(j.telegram_message_id||0);const u=await userById(env,userId);if(wm)await editMessageText(env,chatId,wm,tx(u).processingSteps("repurpose")[0]).catch(()=>{});return createJob(env,{userId,chatId,type:"repurpose",input:d,cost:await repurposeTotal(env,outs),workingMessageId:wm,sourceId:j.source_id||null,parentJobId:j.id,idempotencyKey:"rep-retry:"+userId+":"+id+":"+updateId});
}
async function resultRow(env:Bindings,userId:number,id:number){return env.DB.prepare("SELECT jr.*,j.input_json job_input,j.source_id,j.id job_id FROM job_results jr JOIN jobs j ON j.id=jr.job_id WHERE jr.id=? AND jr.user_id=?").bind(id,userId).first<Any>()}
async function sourceForResult(env:Bindings,r:Any){if(r.source_id){const x=await env.DB.prepare("SELECT extracted_text FROM sources WHERE id=?").bind(r.source_id).first<Any>();return String(x?.extracted_text||"")}const d=parse(r.job_input);return String(d.sourceText||d.topic||"")}
async function copyResult(env:Bindings,userId:number,chatId:string,id:number){const r=await resultRow(env,userId,id);if(r){const u=await userById(env,userId);await sendMessage(env,chatId,plainResult(String(r.result_type),parse(r.content_json),getLang(u)).slice(0,4000))}}
async function saveResult(env:Bindings,userId:number,chatId:string,id:number){const r=await resultRow(env,userId,id);if(!r)return;if(await env.DB.prepare("SELECT id FROM history WHERE result_id=? AND deleted_at IS NULL").bind(id).first<Any>())return sendMessage(env,chatId,tx(await userById(env,userId)).alreadySaved);const u=await userById(env,userId),days=await getHistoryDuration(env,String(u?.plan||"free"));await env.DB.prepare("INSERT INTO history(user_id,result_id,result_type,title,expires_at,created_at) VALUES(?,?,?,?,?,?)").bind(userId,id,r.result_type,historyTitle(parse(r.content_json),String(r.result_type)),Date.now()+days*86400000,Date.now()).run();return sendMessage(env,chatId,tx(u).saved)}
function historyTitle(o:any,t:string){const icon=t==="post"||t==="repurpose_telegram"?"📝":t==="script"||t==="repurpose_tiktok"||t==="repurpose_youtube"?"🎬":t==="content_plan"||t==="repurpose_plan"?"📅":t==="repurpose_instagram"?"📸":t==="repurpose_hooks"?"🔥":"🎯";return icon+" "+String(o.title||o.topic||t).replace(/^\\s+/,"").slice(0,54)}
async function showHistory(env:Bindings,userId:number,chatId:string,msg?:Any,offset=0){
 const u=await userById(env,userId),t=tx(u),r=await env.DB.prepare("SELECT id,title,result_type FROM history WHERE user_id=? AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at>?) ORDER BY created_at DESC LIMIT 4 OFFSET ?").bind(userId,Date.now(),offset).all<Any>(),a=r.results||[],kb:any[][]=a.map((x:any)=>[{text:String(x.title).slice(0,58),callback_data:"hitem:"+x.id}]),nav:any[]=[];if(offset>0)nav.push({text:"◀️",callback_data:"hpage:"+Math.max(0,offset-4)});if(a.length===4)nav.push({text:"▶️",callback_data:"hpage:"+(offset+4)});if(nav.length)kb.push(nav);kb.push([{text:tlang(t,"↩️ В меню","↩️ In menu"),callback_data:"menu:back"}]);const body=a.length?t.history:t.noHistory;return msg?.message_id?editMessageText(env,chatId,Number(msg.message_id),body,{inline_keyboard:kb}):sendMessage(env,chatId,body,{inline_keyboard:kb});
}
async function historyOpen(env:Bindings,userId:number,chatId:string,id:number,msg:Any){
 const h=await env.DB.prepare("SELECT result_id FROM history WHERE id=? AND user_id=? AND deleted_at IS NULL").bind(id,userId).first<Any>();if(!h)return;const r=await resultRow(env,userId,Number(h.result_id));if(!r)return;const u=await userById(env,userId),rt=String(r.result_type);
 await saveSession(env,userId,rt==="content_plan"?"plan":rt.startsWith("repurpose_")?"continued_repurpose":rt,"continued",{resultId:Number(h.result_id),jobId:Number(r.job_id),sourceId:r.source_id,previousResult:parse(r.content_json),...parse(r.job_input)},Number(msg.message_id),chatId,7200000,null);
 const markup=rt==="content_plan"?planResult(Number(r.job_id),await planDaysFromResult(env,r),Number(r.id),getLang(u)):postResult(Number(r.id),getLang(u));
 return editMessageText(env,chatId,Number(msg.message_id),resultMarkup(rt,parse(r.content_json),getLang(u)),markup);
}
async function deleteHistory(env:Bindings,userId:number,chatId:string,id:number,msg?:Any){await env.DB.prepare("UPDATE history SET deleted_at=? WHERE id=? AND user_id=? AND deleted_at IS NULL").bind(Date.now(),id,userId).run();return showHistory(env,userId,chatId,msg,0)}
async function planDaysFromResult(env:Bindings,r:Any){const p=await env.DB.prepare("SELECT id FROM content_plans WHERE job_id=?").bind(Number(r.job_id)).first<Any>();return p?daysForPlan(env,Number(p.id)):[]}
async function showPricing(env:Bindings,userId:number,chatId:string,msg?:Any){
 const u=await userById(env,userId),t=tx(u),c=await getPlan(env,"creator"),p=await getPlan(env,"pro"),d=await Promise.all(["free","creator","pro"].map(x=>getHistoryDuration(env,x))),body=t.tariffs({creatorStars:Number(c?.stars_price??99),creatorCredits:Number(c?.included_credits??100),proStars:Number(p?.stars_price??299),proCredits:Number(p?.included_credits??500)},{free:d[0]+" days",creator:d[1]+" days",pro:d[2]+" days"}),kb=tariffsKeyboard(getLang(u));return msg?.message_id?editMessageText(env,chatId,Number(msg.message_id),body,kb):sendMessage(env,chatId,body,kb);
}
async function showCredits(env:Bindings,userId:number,chatId:string,msg?:Any){
 const u=await userById(env,userId),p=await Promise.all([50,100,250,500].map(x=>getPackage(env,x))),t=tx(u);return msg?.message_id?editMessageText(env,chatId,Number(msg.message_id),t.credits(Number(u?.credits_balance||0),p.map(x=>Number(x?.stars||0)),getLang(u)),creditsKeyboard([50,100,250,500],getLang(u))):sendMessage(env,chatId,t.credits(Number(u?.credits_balance||0),p.map(x=>Number(x?.stars||0)),getLang(u)),creditsKeyboard([50,100,250,500],getLang(u)));
}
async function showSettings(env:Bindings,userId:number,chatId:string,msg?:Any){const u=await userById(env,userId),t=tx(u),body=t.settings,kb=settingsKeyboard(getLang(u));return msg?.message_id?editMessageText(env,chatId,msg.message_id,body,kb):sendMessage(env,chatId,body,kb)}
async function showAccount(env:Bindings,userId:number,chatId:string,msg:Any){const u=await userById(env,userId),s=await env.DB.prepare("SELECT expires_at FROM subscriptions WHERE user_id=? AND status='active' ORDER BY expires_at DESC LIMIT 1").bind(userId).first<Any>(),t=tx(u),date=s?.expires_at?new Date(Number(s.expires_at)).toLocaleDateString(getLang(u)==="en"?"en-US":"ru-RU"):"—";return msg?.message_id?editMessageText(env,chatId,msg.message_id,t.account(String(u?.first_name||"Creator"),String(u?.telegram_id||""),Number(u?.credits_balance||0),String(u?.plan||"free").toUpperCase(),date),accountKeyboard(getLang(u))):sendMessage(env,chatId,t.account(String(u?.first_name||"Creator"),String(u?.telegram_id||""),Number(u?.credits_balance||0),String(u?.plan||"free").toUpperCase(),date),accountKeyboard(getLang(u)))}
async function openPaymentMethod(env:Bindings,userId:number,chatId:string,key:string,msg?:Any){
 const u=await userById(env,userId),lang=getLang(u);let body="";
 if(key==="creator"||key==="pro"){const p=await getPlan(env,key);body=lang==="en"?("Selected plan:\\n\\n"+key.toUpperCase()+"\\n\\n"+Number(p?.stars_price||0)+" ⭐ / month\\n\\nChoose a payment method:"):("Выбран тариф:\\n\\n"+key.toUpperCase()+"\\n\\n"+Number(p?.stars_price||0)+" ⭐ / месяц\\n\\nВыбери способ оплаты:");}
 else if(key.startsWith("credits:")){const n=Number(key.slice(8)),p=await getPackage(env,n);body=lang==="en"?("Selected pack:\\n\\n"+n+" 🔹\\n\\nPrice: "+Number(p?.stars||0)+" ⭐\\n\\nChoose a payment method:"):("Выбран пакет:\\n\\n"+n+" 🔹\\n\\nСтоимость: "+Number(p?.stars||0)+" ⭐\\n\\nВыбери способ оплаты:");}
 else return;
 const kb={inline_keyboard:[[ {text:"⭐ Telegram Stars",callback_data:"pay:"+key} ],[{text:lang==="en"?"↩️ Back":"↩️ Назад",callback_data:key.startsWith("credits:")?"menu:credits":"menu:pricing"}]]};
 return msg?.message_id?editMessageText(env,chatId,Number(msg.message_id),body,kb):sendMessage(env,chatId,body,kb);
}
async function purchase(env:Bindings,userId:number,chatId:string,key:string,msg?:Any){
 const u=await userById(env,userId),t=tx(u);if(!(key==="creator"||key==="pro"||key.startsWith("credits:")))return;
 if(!u?.terms_accepted_at)return sendMessage(env,chatId,(getLang(u)==="en"?"⚖️ Before payment\\n\\n":"⚖️ Перед оплатой\\n\\n")+t.terms,{inline_keyboard:[[{text:getLang(u)==="en"?"✅ Accept terms":"✅ Принимаю условия",callback_data:"terms:accept:"+key}],[{text:getLang(u)==="en"?"⚖️ Open terms":"⚖️ Открыть условия",callback_data:"settings:terms"}]]});
 return issueInvoice(env,userId,chatId,key);
}
async function issueInvoice(env:Bindings,userId:number,chatId:string,key:string){
 let stars=0,title="",credits=0;const u=await userById(env,userId),lang=getLang(u);
 if(key==="creator"||key==="pro"){const p=await getPlan(env,key);stars=Number(p?.stars_price||0);credits=Number(p?.included_credits||0);title=key.toUpperCase();}
 else if(key.startsWith("credits:")){credits=Number(key.slice(8));const p=await getPackage(env,credits);stars=Number(p?.stars||0);title=credits+" credits";}
 if(!stars)return;const payload="creatorai:"+userId+":"+key+":"+crypto.randomUUID();await env.DB.prepare("INSERT INTO payments(user_id,provider,kind,invoice_payload,currency,stars_amount,status,product_key,created_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(userId,"telegram_stars",key.startsWith("credits:")?"credits":"subscription",payload,"XTR",stars,"pending",key,Date.now()).run();
 return sendInvoice(env,chatId,lang==="en"?title:("Creator AI — "+title),lang==="en"?"Creator AI digital service":"Цифровой сервис Creator AI",payload,stars);
}
async function handlePreCheckout(env:Bindings,q:Any){
 const p=await env.DB.prepare("SELECT * FROM payments WHERE invoice_payload=? AND status='pending'").bind(String(q.invoice_payload)).first<Any>(),u=await env.DB.prepare("SELECT id,language FROM users WHERE telegram_id=?").bind(String(q.from?.id||"")).first<Any>();
 const ok=!!p&&!!u&&Number(p.user_id)===Number(u.id)&&q.currency==="XTR"&&Number(q.total_amount)===Number(p.stars_amount);
 return answerPreCheckoutQuery(env,String(q.id),ok,ok?undefined:(String(u?.language)==="en"?"Payment data mismatch.":"Платёж не совпадает с выставленным счётом."));
}
async function completePayment(env:Bindings,userId:number,p:Any){
 const row=await env.DB.prepare("SELECT * FROM payments WHERE invoice_payload=?").bind(String(p.invoice_payload)).first<Any>();if(!row||Number(row.user_id)!==userId)return;
 const c=await env.DB.prepare("UPDATE payments SET status='paid',telegram_payment_charge_id=? WHERE id=? AND status='pending' AND currency='XTR' AND stars_amount=?").bind(p.telegram_payment_charge_id,row.id,p.total_amount).run();if(c.meta.changes!==1)return;
 const u=await userById(env,userId),key=String(row.product_key||"");
 if(key.startsWith("credits:")){const x=await getPackage(env,Number(key.slice(8)));const b=Number(u?.credits_balance||0)+Number(x?.credits||0);await env.DB.prepare("UPDATE users SET credits_balance=?,updated_at=? WHERE id=?").bind(b,Date.now(),userId).run();return}
 const plan=await getPlan(env,key);if(!plan)return;const exp=Date.now()+Number(plan.duration_days||30)*86400000,b=Number(u?.credits_balance||0)+Number(plan.included_credits||0);
 await env.DB.prepare("UPDATE users SET plan=?,tariff_id=?,credits_balance=?,credits_reset_at=?,updated_at=? WHERE id=?").bind(key,Number(plan.id),b,exp,Date.now(),userId).run();
 await env.DB.prepare("INSERT INTO subscriptions(user_id,plan,provider,stars_amount,status,current_period_start,expires_at,telegram_payment_charge_id,invoice_payload,is_recurring,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").bind(userId,key,"telegram_stars",row.stars_amount,"active",Date.now(),exp,p.telegram_payment_charge_id,row.invoice_payload,0,Date.now(),Date.now()).run();
}
async function showPlanDays(env:Bindings,userId:number,chatId:string,jobId:number,msg:Any){const p=await env.DB.prepare("SELECT id FROM content_plans WHERE job_id=? AND user_id=?").bind(jobId,userId).first<Any>();if(!p)return;const u=await userById(env,userId),days=await daysForPlan(env,Number(p.id)),buttons=days.map((d:any,i:number)=>({text:"📅 "+String(d.day??(getLang(u)==="en"?"Day ":"День ")+(i+1)),callback_data:"dayview:"+jobId+":"+i})),rows=[buttons.slice(0,4),buttons.slice(4,7),[{text:getLang(u)==="en"?"↩️ Back":"↩️ Назад",callback_data:"planopen:"+jobId}]];return editMessageText(env,chatId,Number(msg.message_id),getLang(u)==="en"?"📅 Content Plan / Days":"📅 Content Plan / Дни",{inline_keyboard:rows})}
async function showPlanDay(env:Bindings,userId:number,chatId:string,jobId:number,pos:number,msg:Any){const p=await env.DB.prepare("SELECT id FROM content_plans WHERE job_id=? AND user_id=?").bind(jobId,userId).first<Any>();if(!p)return;const days=await daysForPlan(env,Number(p.id)),d=days[pos];if(!d)return;const u=await userById(env,userId),t=tx(u),b=String(d.format||"").toLowerCase().includes("short"),cost=await getPrice(env,b?"script":"post"),body=getLang(u)==="en"?("📅 "+String(d.day)+" / "+String(d.title)+"\\n\\n🎯 "+String(d.goal)+"\\n📱 "+String(d.format)+"\\n🔥 "+String(d.hook)+"\\n💡 "+String(d.angle)+"\\n🧠 "+String(d.mainThought)+"\\n🎯 "+String(d.cta)+"\\n\\nStatus: "+String(d.status)+"\\n💳 Generation cost: "+cost+" 🔹"):("📅 "+String(d.day)+" / "+String(d.title)+"\\n\\n🎯 "+String(d.goal)+"\\n📱 "+String(d.format)+"\\n🔥 "+String(d.hook)+"\\n💡 "+String(d.angle)+"\\n🧠 "+String(d.mainThought)+"\\n🎯 "+String(d.cta)+"\\n\\nСтатус: "+String(d.status)+"\\n💳 Стоимость генерации: "+cost+" 🔹"),kb={inline_keyboard:[[{text:getLang(u)==="en"?"✏️ Change idea":"✏️ Изменить идею",callback_data:"dayedit:"+jobId+":"+pos}],[{text:getLang(u)==="en"?"🚀 Create":"🚀 Создать",callback_data:"day:"+jobId+":"+pos}],[{text:getLang(u)==="en"?"↩️ Back to plan":"↩️ Назад к плану",callback_data:"planopen:"+jobId}]]};return editMessageText(env,chatId,Number(msg?.message_id),body,kb)}
async function createPlanDay(env:Bindings,userId:number,chatId:string,jobId:number,pos:number,updateId:number,msgId:number){
 const j=await env.DB.prepare("SELECT * FROM jobs WHERE id=? AND user_id=? AND type='content_plan'").bind(jobId,userId).first<Any>();if(!j)return;const p=await env.DB.prepare("SELECT * FROM content_plans WHERE job_id=?").bind(jobId).first<Any>();if(!p)return;const d=(await daysForPlan(env,p.id))[pos];if(!d||d.status==="⏳"||d.status==="✅")return;await env.DB.prepare("UPDATE content_plan_days SET status='⏳',updated_at=? WHERE id=? AND status='○'").bind(Date.now(),d.id).run();const b=parse(j.input_json),res=await createPlanDayJob(env,{userId,planDayId:d.id,chatId,workingMessageId:msgId,topic:d.title,goal:d.goal,platform:b.platform||"telegram",style:b.style||"expert",format:d.format,hook:d.hook,angle:d.angle,mainThought:d.mainThought,cta:d.cta});return res}
async function startPlanDayEdit(env:Bindings,userId:number,chatId:string,jobId:number,pos:number,msg:Any){const p=await env.DB.prepare("SELECT id FROM content_plans WHERE job_id=? AND user_id=?").bind(jobId,userId).first<Any>();if(!p)return;const d=(await daysForPlan(env,p.id))[pos];if(!d||d.status!=="○")return;const m=await sendMessage(env,chatId,getLang(await userById(env,userId))==="en"?"✏️ Change idea\\n\\nSend a new idea in one message.":"✏️ Изменить идею\\n\\nОтправь новую идею одним сообщением.");return saveSession(env,userId,"dayedit","idea",{planJobId:jobId,dayId:d.id,position:pos},m.message_id,chatId)}
async function reopenPlan(env:Bindings,userId:number,chatId:string,jobId:number,msg:Any){const p=await env.DB.prepare("SELECT * FROM content_plans WHERE job_id=? AND user_id=?").bind(jobId,userId).first<Any>();if(!p)return;const r=await env.DB.prepare("SELECT * FROM job_results WHERE job_id=? AND result_type='content_plan'").bind(jobId).first<Any>(),u=await userById(env,userId);return editMessageText(env,chatId,Number(msg?.message_id),resultMarkup("content_plan",parse(r?.content_json||JSON.stringify({days:await daysForPlan(env,p.id)})),getLang(u)),planResult(jobId,await daysForPlan(env,p.id),Number(r?.id||0),getLang(u)))}
async function retryDelivery(env:Bindings,userId:number,resultId:number,chatId:string){const d=await env.DB.prepare("SELECT * FROM deliveries WHERE result_id=? AND user_id=?").bind(resultId,userId).first<Any>();if(!d||d.status==="sent")return;const u=await userById(env,userId);await env.DB.prepare("UPDATE deliveries SET status='queued',next_retry_at=NULL,last_error=NULL WHERE id=? AND user_id=? AND status!='sent'").bind(d.id,userId).run();await env.DELIVERY_QUEUE.send({deliveryId:Number(d.id)});return sendMessage(env,chatId,getLang(u)==="en"?"✅ Delivery retry queued.":"✅ Повторная доставка поставлена в очередь.")}
async function repurposeTotal(env:Bindings,a:string[]){let n=0;for(const x of a)n+=await getPrice(env,"repurpose_"+x);return n}
