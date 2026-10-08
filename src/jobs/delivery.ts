import type{Bindings}from"../env";
import{sendMessage,editMessageText}from"../telegram/api";
import{resultMarkup}from"./runner";
import{postResult}from"../telegram/keyboards";
export async function deliverBatch(batch:MessageBatch<any>,env:Bindings){for(const m of batch.messages){try{await deliverOne(env,Number(m.body?.deliveryId));m.ack();}catch(e){await m.retry();}}}
async function deliverOne(env:Bindings,id:number){
 const d=await env.DB.prepare("SELECT * FROM deliveries WHERE id=?").bind(id).first<any>();if(!d||d.status==="sent")return;
 const r=await env.DB.prepare("SELECT * FROM job_results WHERE id=? AND user_id=?").bind(d.result_id,d.user_id).first<any>();if(!r||r.status!=="completed")throw new Error("result_not_ready");
 const j=await env.DB.prepare("SELECT * FROM jobs WHERE id=? AND user_id=?").bind(r.job_id,d.user_id).first<any>();if(!j)throw new Error("job_missing");
 const u=await env.DB.prepare("SELECT language FROM users WHERE id=?").bind(d.user_id).first<any>();
 const text=resultMarkup(String(r.result_type),JSON.parse(r.content_json||"{}")),markup=postResult(Number(r.id));
 let msg:any;
 if(Number(d.position)===0&&j.telegram_message_id){msg=await editMessageText(env,String(d.chat_id),Number(j.telegram_message_id),text,markup);}else{msg=await sendMessage(env,String(d.chat_id),text,markup);}
 await env.DB.prepare("UPDATE deliveries SET status='sent',message_id=?,attempts=attempts+1,sent_at=?,last_error=NULL WHERE id=?").bind(Number(msg.message_id),Date.now(),id).run();
 await env.DB.prepare("UPDATE job_results SET telegram_chat_id=?,telegram_message_id=? WHERE id=?").bind(String(d.chat_id),Number(msg.message_id),r.id).run();
}
