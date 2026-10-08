import type{Bindings}from"../env";
import{reserveCredits,refundCredits}from"../billing/credits";
import{editMessageText}from"../telegram/api";
import{copyFor}from"../text";
import{insufficientKeyboard,errorKeyboard}from"../telegram/keyboards";
import{checkRateLimit}from"../security/rate-limit";
export async function createJob(env:Bindings,a:any){
 const u0=await env.DB.prepare("SELECT language FROM users WHERE id=?").bind(a.userId).first<any>(),t=copyFor(String(u0?.language)==="en"?"en":"ru");
 const existing=await env.DB.prepare("SELECT id,status FROM jobs WHERE idempotency_key=? AND user_id=?").bind(a.idempotencyKey,a.userId).first<any>();if(existing)return{status:"existing",jobId:Number(existing.id)};
 if(!Number.isFinite(a.cost)||a.cost<0)return{status:"invalid_cost"};if(!(await checkRateLimit(env,a.userId,String(a.type))))return{status:"rate_limited"};
 const lock=await env.DB.prepare("SELECT generation_lock_job_id FROM users WHERE id=?").bind(a.userId).first<any>();if(lock?.generation_lock_job_id)return{status:"locked"};
 const now=Date.now();
 try{
  const row=await env.DB.prepare("INSERT INTO jobs(user_id,parent_job_id,type,status,source_id,input_json,selected_outputs_json,credits_required,credits_reserved,telegram_chat_id,telegram_message_id,idempotency_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
   .bind(a.userId,a.parentJobId??null,a.type,"created",a.sourceId??null,JSON.stringify(a.input??{}),JSON.stringify(a.input?.selectedOutputs??[]),a.cost,0,a.chatId,a.workingMessageId??null,a.idempotencyKey,now,now).run();
  const id=Number(row.meta.last_row_id);
  const claimed=await env.DB.prepare("UPDATE users SET generation_lock_job_id=?,updated_at=? WHERE id=? AND generation_lock_job_id IS NULL").bind(id,now,a.userId).run();
  if(claimed.meta.changes!==1){await env.DB.prepare("DELETE FROM jobs WHERE id=? AND idempotency_key=?").bind(id,a.idempotencyKey).run();return{status:"locked"}}
  const reserved=await reserveCredits(env,a.userId,a.cost,id);
  if(!reserved){const x=await env.DB.prepare("SELECT credits_balance FROM users WHERE id=?").bind(a.userId).first<any>();await env.DB.prepare("UPDATE jobs SET status='cancelled',completed_at=?,updated_at=? WHERE id=?").bind(now,now,id).run();await env.DB.prepare("UPDATE users SET generation_lock_job_id=NULL,updated_at=? WHERE id=? AND generation_lock_job_id=?").bind(now,a.userId,id).run();if(a.workingMessageId)await editMessageText(env,a.chatId,a.workingMessageId,t.insufficient(a.cost,Number(x?.credits_balance??0)),insufficientKeyboard(String(u0?.language)==="en"?"en":"ru")).catch(()=>{});return{status:"insufficient"}}
  await env.DB.prepare("UPDATE jobs SET status='queued',updated_at=? WHERE id=? AND status='created'").bind(now,id).run();
  if(a.workingMessageId)await editMessageText(env,a.chatId,a.workingMessageId,t.processingSteps(a.type)[0]).catch(()=>{});
  try{await env.AI_QUEUE.send({jobId:id});}catch(e){await refundCredits(env,a.userId,a.cost,id,"job:"+id+":queue_refund");await env.DB.prepare("UPDATE jobs SET status='failed',credits_reserved=0,error_code='QUEUE_ERROR',error_message=?,updated_at=?,completed_at=? WHERE id=?").bind(String(e).slice(0,500),now,now,id).run();await env.DB.prepare("UPDATE users SET generation_lock_job_id=NULL,updated_at=? WHERE id=? AND generation_lock_job_id=?").bind(now,a.userId,id).run();if(a.workingMessageId)await editMessageText(env,a.chatId,a.workingMessageId,t.aiError,errorKeyboard(id,String(u0?.language)==="en"?"en":"ru")).catch(()=>{});}
  return{status:"created",jobId:id};
 }catch(e){
  const again=await env.DB.prepare("SELECT id FROM jobs WHERE idempotency_key=? AND user_id=?").bind(a.idempotencyKey,a.userId).first<any>();if(again)return{status:"existing",jobId:Number(again.id)};throw e;
 }
}