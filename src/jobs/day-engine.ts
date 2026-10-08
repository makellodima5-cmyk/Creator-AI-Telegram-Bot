import type{Bindings}from"../env";
import{createJob}from"./create";
export async function createPlanDayJob(env:Bindings,a:{userId:number;planDayId:number;chatId:string;workingMessageId:number;topic:string;goal:string;platform:string;style:string;format:string;hook:string;angle:string;mainThought:string;cta:string}){
 const type=a.format.toLowerCase().includes("short")?"script":"post";
 const cost=Number((await env.DB.prepare("SELECT credits_cost FROM pricing WHERE key=? AND is_active=1").bind(type).first<any>())?.credits_cost??(type==="script"?2:1));
 const now=Date.now(),claim=await env.DB.prepare("UPDATE content_plan_days SET status='⏳',updated_at=? WHERE id=? AND status IN ('○','❌')").bind(now,a.planDayId).run();
 if(claim.meta.changes!==1)return{status:"existing"};
 const idem="plan-day:"+a.planDayId+":"+now;
 const r=await createJob(env,{userId:a.userId,type,parentJobId:null,cost,chatId:a.chatId,workingMessageId:a.workingMessageId,idempotencyKey:idem,input:{topic:a.topic,goal:a.goal,platform:a.platform,style:a.style,format:a.format,hook:a.hook,angle:a.angle,mainThought:a.mainThought,cta:a.cta,contentPlanDayId:a.planDayId}});
 if(r.status!=="created"&&r.status!=="existing")await env.DB.prepare("UPDATE content_plan_days SET status='○',updated_at=? WHERE id=? AND status='⏳'").bind(Date.now(),a.planDayId).run();
 return r;
}