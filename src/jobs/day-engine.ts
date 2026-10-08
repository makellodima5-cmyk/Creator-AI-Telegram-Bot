import type{Bindings}from"../env";
import{createJob}from"./create";

function engineForFormat(format:string){
 const f=String(format||"").toLowerCase();
 if(["short","shorts","reels","reel","tiktok","youtube shorts","short video","video"].some(x=>f.includes(x)))return"script";
 return"post";
}

export async function createPlanDayJob(env:Bindings,a:{userId:number;planDayId:number;chatId:string;workingMessageId:number;topic:string;goal:string;platform:string;style:string;format:string;hook:string;angle:string;mainThought:string;cta:string}){
 const type=engineForFormat(a.format);
 const key=type==="script"?"script":"post";
 const cost=Number((await env.DB.prepare("SELECT credits_cost FROM pricing WHERE key=? AND is_active=1").bind(key).first<any>())?.credits_cost??(type==="script"?2:1));
 const now=Date.now();
 const day=await env.DB.prepare("SELECT cpd.id,cp.job_id FROM content_plan_days cpd JOIN content_plans cp ON cp.id=cpd.plan_id WHERE cpd.id=?").bind(a.planDayId).first<any>();
 const parentJobId=day?.job_id?Number(day.job_id):null;
 const claim=await env.DB.prepare("UPDATE content_plan_days SET status='⏳',updated_at=? WHERE id=? AND status IN ('○','❌')").bind(now,a.planDayId).run();
 if(claim.meta.changes!==1)return{status:"existing"};
 const r=await createJob(env,{userId:a.userId,type,parentJobId,cost,chatId:a.chatId,workingMessageId:a.workingMessageId,idempotencyKey:"plan-day:"+a.planDayId,input:{topic:a.topic,goal:a.goal,platform:a.platform,style:a.style,format:a.format,hook:a.hook,angle:a.angle,mainThought:a.mainThought,cta:a.cta,contentPlanDayId:a.planDayId}});
 if(r.status!=="created"&&r.status!=="existing")await env.DB.prepare("UPDATE content_plan_days SET status='○',updated_at=? WHERE id=? AND status='⏳'").bind(Date.now(),a.planDayId).run();
 return r;
}
