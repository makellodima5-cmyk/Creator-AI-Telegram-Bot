import { eq } from "drizzle-orm";
import { jobs } from "../../db/schema";
import { createDb } from "../../db/client";
import { OpenAIProvider } from "../../ai/openai";
import { editMessageText } from "../../telegram/api";
import { postResult, mainMenu } from "../../telegram/keyboards";
import { refundCredits } from "../../billing/credits";
import type { Bindings } from "../../env";
import type { PostJobInput } from "../types";

export async function handlePostJob(env:Bindings,jobId:number){
  const db=createDb(env),job=await db.select().from(jobs).where(eq(jobs.id,jobId)).get();
  if(!job||job.status==="completed"||job.status==="failed")return;
  if(!env.OPENAI_API_KEY||!env.OPENAI_MODEL_FAST)throw new Error("openai_not_configured");
  await db.update(jobs).set({status:"processing",startedAt:job.startedAt??new Date(),attempts:(job.attempts??0)+1}).where(eq(jobs.id,jobId));
  try{
    const result=await new OpenAIProvider(env.OPENAI_API_KEY,env.OPENAI_MODEL_FAST).createPost(JSON.parse(job.inputJson??"{}") as PostJobInput);
    await db.update(jobs).set({status:"completed",outputJson:JSON.stringify(result.output),provider:"openai",model:result.model,tokensInput:result.inputTokens,tokensOutput:result.outputTokens,creditsCharged:job.creditsReserved,creditsReserved:0,completedAt:new Date()}).where(eq(jobs.id,jobId));
    if(job.telegramChatId&&job.telegramMessageId)await editMessageText(env,job.telegramChatId,job.telegramMessageId,formatResult(result.output),postResult(jobId,(result.output.title+"\n\n"+result.output.body)));
  }catch(error){
    if(job.creditsReserved>0)await refundCredits(env,job.userId,job.creditsReserved,job.id);
    await db.update(jobs).set({status:"failed",creditsReserved:0,errorMessage:error instanceof Error?error.message:"unknown_error",completedAt:new Date()}).where(eq(jobs.id,jobId));
    if(job.telegramChatId&&job.telegramMessageId)await editMessageText(env,job.telegramChatId,job.telegramMessageId,"❌ Не удалось создать пост. Credits возвращены.",mainMenu);
    throw error;
  }
}
function formatResult(o:any){return ("📝 Готово ✅\n\n"+o.title+"\n\n"+o.body+"\n\n────────────\n\n📱 "+o.platform+"\n✍️ "+o.style+"\n📏 "+o.length).slice(0,4000);}
