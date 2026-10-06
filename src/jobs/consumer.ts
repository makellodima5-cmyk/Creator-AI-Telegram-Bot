import type { Bindings } from "../env";
import { handlePostJob } from "./handlers/post";
import { handleScriptJob } from "./handlers/script";
import { handleRepurposeJob } from "./handlers/repurpose";
import { handlePlanJob } from "./handlers/plan";
import type { JobMessage } from "./types";

export async function consumeJobs(batch:MessageBatch<JobMessage>,env:Bindings){
  for(const message of batch.messages){
    try{
      const job=await env.DB.prepare("SELECT type FROM jobs WHERE id = ?").bind(message.body.jobId).first<{type:string}>();
      if(!job) { message.ack(); continue; }
      if(job.type==="post") await handlePostJob(env,message.body.jobId);
      else if(job.type==="script") await handleScriptJob(env,message.body.jobId);
      else if(job.type==="repurpose") await handleRepurposeJob(env,message.body.jobId);
      else if(job.type==="content_plan") await handlePlanJob(env,message.body.jobId);
      else throw new Error("unsupported_job_type");
      message.ack();
    }catch(error){
      console.error("queue_job_failed",{jobId:message.body.jobId,error});
      message.retry();
    }
  }
}
