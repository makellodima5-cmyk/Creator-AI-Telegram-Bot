import { eq } from "drizzle-orm";
import { jobs } from "../../db/schema";
import { createDb } from "../../db/client";
import { OpenAIProvider } from "../../ai/openai";
import { editMessageText } from "../../telegram/api";\nimport { userSessions } from "../../db/schema";
import { mainMenu, planResult } from "../../telegram/keyboards";
import { refundCredits } from "../../billing/credits";
import type { Bindings } from "../../env";
import type { PlanJobInput } from "../types";

export async function handlePlanJob(env:Bindings,jobId:number){
  const db=createDb(env), job=await db.select().from(jobs).where(eq(jobs.id,jobId)).get();
  if(!job || job.status==="completed" || job.status==="failed") return;
  if(!env.OPENAI_API_KEY || !env.OPENAI_MODEL_FAST) throw new Error("openai_not_configured");
  await db.update(jobs).set({status:"processing",startedAt:job.startedAt??new Date(),attempts:(job.attempts??0)+1}).where(eq(jobs.id,jobId));
  try{
    const result=await new OpenAIProvider(env.OPENAI_API_KEY,env.OPENAI_MODEL_FAST).createPlan(JSON.parse(job.inputJson??"{}") as PlanJobInput);
    await db.update(jobs).set({status:"completed",outputJson:JSON.stringify(result.output),provider:"openai",model:result.model,tokensInput:result.inputTokens,tokensOutput:result.outputTokens,creditsCharged:job.creditsReserved,creditsReserved:0,completedAt:new Date()}).where(eq(jobs.id,jobId));
    if(job.telegramChatId&&job.telegramMessageId) await editMessageText(env,job.telegramChatId,job.telegramMessageId,format(result.output),planResult(jobId,result.output.days));
    await db.update(userSessions).set({flow:"ui",step:"result",draftJson:JSON.stringify({kind:"result",messageId:job.telegramMessageId,jobId}),updatedAt:new Date()}).where(eq(userSessions.userId,job.userId));
  }catch(e){
    if(job.creditsReserved>0) await refundCredits(env,job.userId,job.creditsReserved,job.id);
    await db.update(jobs).set({status:"failed",creditsReserved:0,errorMessage:e instanceof Error?e.message:"unknown_error",completedAt:new Date()}).where(eq(jobs.id,jobId));
    if(job.telegramChatId&&job.telegramMessageId) await editMessageText(env,job.telegramChatId,job.telegramMessageId,"❌ Не удалось создать план.\n\nCredits возвращены.",mainMenu);
    if(job.telegramChatId&&job.telegramMessageId) await db.update(userSessions).set({flow:"ui",step:"menu",draftJson:JSON.stringify({kind:"menu",messageId:job.telegramMessageId}),updatedAt:new Date()}).where(eq(userSessions.userId,job.userId));
    throw e;
  }
}
function format(o:any){return `📅 План готов ✅

${o.topic}

7 дней

${o.days.map((d:any)=>`${d.day}
📝 ${d.title}
${d.platform} · ${d.format}
🔥 ${d.hook}`).join("\n\n")}`;}
