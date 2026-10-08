import type{Bindings}from"../env";
import{sendMessage,editMessageText}from"../telegram/api";
import{resultMarkup}from"./runner";
import{postResult}from"../telegram/keyboards";

async function settingNumber(env:Bindings,key:string,fallback:number){
 const row=await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind(key).first<any>();
 const n=Number(row?.value);return Number.isFinite(n)&&n>0?n:fallback;
}
async function settingArray(env:Bindings,key:string,fallback:number[]){
 const row=await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind(key).first<any>();
 try{const a=JSON.parse(String(row?.value??""));return Array.isArray(a)&&a.length?a.map(Number):fallback}catch{return fallback}
}
export async function deliverBatch(batch:MessageBatch<any>,env:Bindings){
 for(const m of batch.messages){
  try{await deliverOne(env,Number(m.body?.deliveryId));m.ack()}
  catch(e){await markDeliveryFailure(env,Number(m.body?.deliveryId),String(e).slice(0,500));m.retry()}
 }
}
async function deliverOne(env:Bindings,id:number){
 const d=await env.DB.prepare("SELECT * FROM deliveries WHERE id=?").bind(id).first<any>();
 if(!d||d.status==="sent")return;
 const claim=await env.DB.prepare("UPDATE deliveries SET status='sending',attempts=attempts+1 WHERE id=? AND status='queued'").bind(id).run();
 if(claim.meta.changes!==1) return;
 const r=await env.DB.prepare("SELECT * FROM job_results WHERE id=? AND user_id=?").bind(d.result_id,d.user_id).first<any>();
 if(!r||r.status!=="completed")throw new Error("result_not_ready");
 const j=await env.DB.prepare("SELECT * FROM jobs WHERE id=? AND user_id=?").bind(r.job_id,d.user_id).first<any>();
 if(!j)throw new Error("job_missing");
 const text=resultMarkup(String(r.result_type),JSON.parse(r.content_json||"{}")),markup=postResult(Number(r.id));
 let msg:any;
 if(Number(d.position)===0&&j.telegram_message_id)msg=await editMessageText(env,String(d.chat_id),Number(j.telegram_message_id),text,markup);
 else msg=await sendMessage(env,String(d.chat_id),text,markup);
 await env.DB.prepare("UPDATE deliveries SET status='sent',message_id=?,sent_at=?,last_error=NULL WHERE id=?").bind(Number(msg.message_id),Date.now(),id).run();
 await env.DB.prepare("UPDATE job_results SET telegram_chat_id=?,telegram_message_id=? WHERE id=?").bind(String(d.chat_id),Number(msg.message_id),r.id).run();
}
async function markDeliveryFailure(env:Bindings,id:number,error:string){
 if(!id)return;
 const d=await env.DB.prepare("SELECT * FROM deliveries WHERE id=?").bind(id).first<any>();if(!d||d.status==="sent")return;
 const max=await settingNumber(env,"delivery_max_attempts",5),backoff=await settingArray(env,"delivery_backoff_seconds",[15,60,300,900,3600]);
 const attempts=Number(d.attempts??0);
 const terminal=attempts>=max;
 if(terminal){
  await env.DB.prepare("UPDATE deliveries SET status='failed',last_error=?,next_retry_at=NULL WHERE id=?").bind(error,id).run();
 }else{
  const delay=backoff[Math.min(Math.max(attempts-1,0),backoff.length-1)]||backoff[backoff.length-1]||60;
  await env.DB.prepare("UPDATE deliveries SET status='queued',last_error=?,next_retry_at=? WHERE id=?").bind(error,Date.now()+delay*1000,id).run();
 }
}