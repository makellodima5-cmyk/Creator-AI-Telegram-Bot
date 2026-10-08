import type{Bindings}from"./env";
async function due(env:Bindings,now:number){
 const rows=await env.DB.prepare("SELECT id FROM deliveries WHERE status='queued' AND (next_retry_at IS NULL OR next_retry_at<=?) ORDER BY COALESCE(next_retry_at,created_at) ASC LIMIT 20").bind(now).all<any>();
 for(const x of rows.results??[]){
  const id=Number(x.id),claim=await env.DB.prepare("UPDATE deliveries SET next_retry_at=NULL WHERE id=? AND status='queued' AND (next_retry_at IS NULL OR next_retry_at<=?)").bind(id,now).run();
  if(claim.meta.changes!==1)continue;
  try{await env.DELIVERY_QUEUE.send({deliveryId:id})}
  catch(e){await env.DB.prepare("UPDATE deliveries SET next_retry_at=?,last_error=? WHERE id=? AND status='queued'").bind(Date.now()+60000,String(e).slice(0,500),id).run()}
 }
}
async function recoverStale(env:Bindings,now:number){
 await env.DB.prepare("UPDATE deliveries SET status='queued',next_retry_at=? WHERE status='sending' AND created_at<?").bind(now+60000,now-600000).run().catch(()=>{});
}
export async function cleanup(env:Bindings){
 const now=Date.now();
 await recoverStale(env,now);
 await due(env,now);
 await env.DB.prepare("DELETE FROM user_sessions WHERE expires_at IS NOT NULL AND expires_at<?").bind(now).run();
 await env.DB.prepare("DELETE FROM history WHERE expires_at IS NOT NULL AND expires_at<?").bind(now).run();
 const rows=await env.DB.prepare("SELECT id,r2_key FROM sources WHERE expires_at IS NOT NULL AND expires_at<?").bind(now).all<any>();
 for(const x of rows.results??[]){if(x.r2_key)await env.FILES.delete(String(x.r2_key));await env.DB.prepare("DELETE FROM files WHERE source_id=?").bind(x.id).run();await env.DB.prepare("DELETE FROM sources WHERE id=?").bind(x.id).run()}
 await env.DB.prepare("DELETE FROM update_receipts WHERE created_at<?").bind(now-604800000).run();
 await env.DB.prepare("DELETE FROM settings WHERE key LIKE 'rl:%' AND updated_at<?").bind(now-86400000).run();
}
