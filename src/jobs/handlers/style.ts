import {eq} from "drizzle-orm";
import {jobs,projects,userSessions} from "../../db/schema";
import {createDb} from "../../db/client";
import {OpenAIProvider} from "../../ai/openai";
import {editMessageText} from "../../telegram/api";
import {mainMenu} from "../../telegram/keyboards";
import {refundCredits} from "../../billing/credits";
import {getPrice} from "../../config";
import type {Bindings} from "../../env";
export async function handleStyleProfileJob(env:Bindings,jobId:number){
 const db=createDb(env); const job=await db.select().from(jobs).where(eq(jobs.id,jobId)).get();
 if(!job||job.status==="completed"||job.status==="failed")return;
 if(!env.OPENAI_API_KEY||!env.OPENAI_MODEL_FAST)throw new Error("openai_not_configured");
 await db.update(jobs).set({status:"processing",startedAt:job.startedAt??new Date(),attempts:(job.attempts??0)+1}).where(eq(jobs.id,jobId));
 try{
  const input=JSON.parse(job.inputJson??"{}") as {examples:string[]};
  const result=await new OpenAIProvider(env.OPENAI_API_KEY,env.OPENAI_MODEL_FAST).createStyleProfile(input);
  const project=await db.select().from(projects).where(eq(projects.userId,job.userId)).get();
  if(project)await db.update(projects).set({styleProfileJson:JSON.stringify(result.output),updatedAt:new Date()}).where(eq(projects.id,project.id));
  else await db.insert(projects).values({userId:job.userId,name:"Default",styleProfileJson:JSON.stringify(result.output),createdAt:new Date(),updatedAt:new Date()});
  await db.update(jobs).set({status:"completed",outputJson:JSON.stringify(result.output),provider:"openai",model:result.model,tokensInput:result.inputTokens,tokensOutput:result.outputTokens,creditsCharged:job.creditsReserved,creditsReserved:0,completedAt:new Date()}).where(eq(jobs.id,jobId));
  if(job.telegramChatId&&job.telegramMessageId){
   await editMessageText(env,job.telegramChatId,job.telegramMessageId,"✦ CREATOR AI / MY STYLE\n\nСтиль проанализирован ✅\n\nПрофиль сохранён и будет автоматически применяться там, где это предусмотрено.",mainMenu);
   await db.update(userSessions).set({flow:"ui",step:"menu",draftJson:JSON.stringify({kind:"menu",messageId:job.telegramMessageId}),updatedAt:new Date()}).where(eq(userSessions.userId,job.userId));
  }
 }catch(error){
  if(job.creditsReserved>0)await refundCredits(env,job.userId,job.creditsReserved,job.id);
  await db.update(jobs).set({status:"failed",creditsReserved:0,errorMessage:error instanceof Error?error.message:"unknown_error",completedAt:new Date()}).where(eq(jobs.id,jobId));
  if(job.telegramChatId&&job.telegramMessageId)await editMessageText(env,job.telegramChatId,job.telegramMessageId,"❌ Не удалось проанализировать стиль.\n\nCredits возвращены.",mainMenu);
  throw error;
 }
}