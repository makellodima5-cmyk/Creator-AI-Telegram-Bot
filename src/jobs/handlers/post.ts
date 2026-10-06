import { eq } from "drizzle-orm";
import { jobs } from "../../db/schema";
import { createDb } from "../../db/client";
import { OpenAIProvider } from "../../ai/openai";
import { editMessageText } from "../../telegram/api";
import { postResult } from "../../telegram/keyboards";
import type { Bindings } from "../../env";
import type { PostJobInput } from "../types";

export async function handlePostJob(env:Bindings,jobId:number){
  const db=createDb(env); const job=await db.select().from(jobs).where(eq(jobs.id,jobId)).get(); if(!job) throw new Error("job_not_found");
  const input=JSON.parse(job.inputJson??"{}") as PostJobInput; const model=env.OPENAI_MODEL_FAST; if(!env.OPENAI_API_KEY || !model) throw new Error("openai_not_configured");
  const provider=new OpenAIProvider(env.OPENAI_API_KEY,model); await db.update(jobs).set({status:"processing",startedAt:new Date(),attempts:(job.attempts??0)+1}).where(eq(jobs.id,jobId));
  try{
    const r=await provider.createPost(input); const output=JSON.stringify(r.output); const now=new Date();
    await db.update(jobs).set({status:"completed",outputJson:output,provider:"openai",model:r.model,tokensInput:r.inputTokens,tokensOutput:r.outputTokens,creditsCharged:job.creditsReserved,completedAt:now,updatedAt:now as never}).where(eq(jobs.id,jobId));
    if(job.telegramChatId && job.telegramMessageId) await editMessageText(env,job.telegramChatId,job.telegramMessageId,`📝 Готово ✅\\n\\n${r.output.title}\\n\\n${r.output.body}\\n\\n────────────\\n\\n📱 ${r.output.platform}\\n✍️ ${r.output.style}\\n📏 ${r.output.length}`,postResult(jobId));
  }catch(e){
    await db.update(jobs).set({status:"failed",errorMessage:e instanceof Error?e.message:"unknown_error",completedAt:new Date()}).where(eq(jobs.id,jobId));
    if(job.telegramChatId && job.telegramMessageId) await editMessageText(env,job.telegramChatId,job.telegramMessageId,"❌ Не удалось создать пост. Credits не списаны.",undefined);
    throw e;
  }
}
