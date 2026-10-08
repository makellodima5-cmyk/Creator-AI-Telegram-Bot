import type{Bindings}from"../env";
import{sendMessage,editMessageText}from"../telegram/api";
import{resultMarkup}from"./runner";
import{postResult}from"../telegram/keyboards";
import{copyFor,Lang}from"../text";

async function settingNumber(env:Bindings,key:string,fallback:number){const row=await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind(key).first<any>();const n=Number(row?.value);return Number.isFinite(n)&&n>0?n:fallback}
async function settingArray(env:Bindings,key:string,fallback:number[]){const row=await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind(key).first<any>();try{const a=JSON.parse(String(row?.value??""));return Array.isArray(a)&&a.length?a.map(Number).filter(Number.isFinite):fallback}catch{return fallback}}
async function userLang(env:Bindings,userId:number):Promise<Lang>{const u=await env.DB.prepare("SELECT language FROM users WHERE id=?").bind(userId).first<any>();return String(u?.language)==="en"?"en":"ru"}
export async function deliverBatch(batch:MessageBatch<any>,env:Bindings){
 for(const m of batch.messages){
  try{await deliverOne(env,Number(m.body?.deliveryId));m.ack()}
  catch(e){const id=Number(m.body?.deliveryId);const terminal=await markDeliveryFailure(env,id,String(e).slice(0,500));m.ack();if(terminal)await advanceDelivery(env,id)}
 }
}
async function deliverOne(env:Bindings,id:number){
 const d=await env.DB.prepare("SELECT * FROM deliveries WHERE id=?").bind(id).first<any>();if(!d||d.status==="sent")return;
 const claim=await env.DB.prepare("UPDATE deliveries SET status='sending',attempts=attempts+1 WHERE id=? AND status='queued'").bind(id).run();if(claim.meta.changes!==1)return;
 const r=await env.DB.prepare("SELECT * FROM job_results WHERE id=? AND user_id=?").bind(d.result_id,d.user_id).first<any>();if(!r||r.status!=="completed")throw new Error("result_not_ready");
 const j=await env.DB.prepare("SELECT * FROM jobs WHERE id=? AND user_id=?").bind(r.job_id,d.user_id).first<any>();if(!j)throw new Error("job_missing");
 const lang=await userLang(env,d.user_id),text=resultMarkup(String(r.result_type),JSON.parse(r.content_json||"{}"),lang),markup=postResult(Number(r.id),lang);
 let msg:any;
 if(Number(d.position)===0&&j.telegram_message_id)msg=await editMessageText(env,String(d.chat_id),Number(j.telegram_message_id),text,markup);else msg=await sendMessage(env,String(d.chat_id),text,markup);
 await env.DB.prepare("UPDATE deliveries SET status='sent',message_id=?,sent_at=?,last_error=NULL,next_retry_at=NULL WHERE id=? AND status='sending'").bind(Number(msg.message_id),Date.now(),id).run();
 await env.DB.prepare("UPDATE job_results SET telegram_chat_id=?,telegram_message_id=? WHERE id=?").bind(String(d.chat_id),Number(msg.message_id),r.id).run();
 await advanceDelivery(env,id);
}
async function markDeliveryFailure(env:Bindings,id:number,error:string){
 if(!id)return false;
 const d=await env.DB.prepare("SELECT * FROM deliveries WHERE id=?").bind(id).first<any>();if(!d||d.status==="sent")return false;
 const max=await settingNumber(env,"delivery_max_attempts",5),backoff=await settingArray(env,"delivery_backoff_seconds",[15,60,300,900,3600]),attempts=Number(d.attempts??0),terminal=attempts>=max;
 if(terminal){await env.DB.prepare("UPDATE deliveries SET status='failed',last_error=?,next_retry_at=NULL WHERE id=? AND status='sending'").bind(error,id).run();const lang=await userLang(env,d.user_id);const u=await env.DB.prepare("SELECT telegram_id FROM users WHERE id=?").bind(d.user_id).first<any>();if(u?.telegram_id)await sendMessage(env,String(u.telegram_id),copyFor(lang).deliveryError).catch(()=>{});return true}
 const delay=backoff[Math.min(Math.max(attempts-1,0),backoff.length-1)]||60;
 await env.DB.prepare("UPDATE deliveries SET status='queued',last_error=?,next_retry_at=? WHERE id=? AND status='sending'").bind(error,Date.now()+delay*1000,id).run();
 return false;
}
async function advanceDelivery(env:Bindings,deliveryId:number){
 const d=await env.DB.prepare("SELECT job_results.job_id,job_results.position,job_results.user_id,jobs.telegram_chat_id FROM deliveries JOIN job_results ON job_results.id=deliveries.result_id JOIN jobs ON jobs.id=job_results.job_id WHERE deliveries.id=?").bind(deliveryId).first<any>();if(!d)return;
 const next=await env.DB.prepare("SELECT id,position FROM job_results WHERE job_id=? AND position>? ORDER BY position LIMIT 1").bind(Number(d.job_id),Number(d.position)).first<any>();if(!next)return;
 await env.DB.prepare("INSERT OR IGNORE INTO deliveries(result_id,user_id,position,chat_id,status,created_at) VALUES(?,?,?,?,?,?)").bind(Number(next.id),Number(d.user_id),Number(next.position),String(d.telegram_chat_id??""),"queued",Date.now()).run();
 const actual=await env.DB.prepare("SELECT id,status FROM deliveries WHERE result_id=?").bind(Number(next.id)).first<any>();if(!actual||actual.status==="sent")return;
 const deliveryId=Number(actual.id);
 await env.DELIVERY_QUEUE.send({deliveryId}).catch(async()=>{await env.DB.prepare("UPDATE deliveries SET next_retry_at=?,last_error=? WHERE id=? AND status='queued'").bind(Date.now()+60000,"QUEUE_ERROR",deliveryId).run()});
}