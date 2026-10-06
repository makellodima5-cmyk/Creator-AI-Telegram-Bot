import type { Bindings } from "../env";
import { handlePostJob } from "./handlers/post";
import type { JobMessage } from "./types";

export async function consumeJobs(batch:MessageBatch<JobMessage>,env:Bindings){
  for(const message of batch.messages){ try{ await handlePostJob(env,message.body.jobId); message.ack(); } catch { message.retry(); } }
}
