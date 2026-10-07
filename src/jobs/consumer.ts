import type {Bindings} from "../env";
import {handlePostJob} from "./handlers/post";
import {handleScriptJob} from "./handlers/script";
import {handleRepurposeJob} from "./handlers/repurpose";
import {handlePlanJob} from "./handlers/plan";
import {handleStyleProfileJob} from "./handlers/style";
import type {JobMessage} from "./types";
export async function consumeJobs(batch:MessageBatch<unknown>,env:Bindings){
 for(const message of batch.messages){
  const body=message.body as JobMessage;
  try{
   const job=await env.DB.prepare("SELECT type FROM jobs WHERE id=?").bind(body.jobId).first<{type:string}>();
   if(!job){message.ack();continue;}
   if(job.type==="post")await handlePostJob(env,body.jobId);
   else if(job.type==="script")await handleScriptJob(env,body.jobId);
   else if(job.type==="repurpose")await handleRepurposeJob(env,body.jobId);
   else if(job.type==="content_plan")await handlePlanJob(env,body.jobId);
   else if(job.type==="style_profile")await handleStyleProfileJob(env,body.jobId);
   else throw new Error("unsupported_job_type");
   message.ack();
  }catch(error){console.error("queue_job_failed",{jobId:body.jobId,error});message.retry();}
 }
}