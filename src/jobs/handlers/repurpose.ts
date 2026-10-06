import { eq } from "drizzle-orm";
import { jobs } from "../../db/schema";
import { createDb } from "../../db/client";
import { OpenAIProvider } from "../../ai/openai";
import { editMessageText } from "../../telegram/api";
import { refundCredits } from "../../billing/credits";
import type { Bindings } from "../../env";
import type { RepurposeJobInput } from "../types";

export async function handleRepurposeJob(env:Bindings,jobId:number){
  const db=createDb(env), job=await db.select().from(jobs).where(eq(jobs.id,jobId)).get();
  if(!job || job.status==="completed" || job.status==="failed") return;
  if(!env.OPENAI_API_KEY || !env.OPENAI_MODEL_FAST) throw new Error("openai_not_configured");
  await db.update(jobs).set({status:"processing",startedAt:job.startedAt??new Date(),attempts:(job.attempts??0)+1}).where(eq(jobs.id,jobId));
  try{
    const result=await new OpenAIProvider(env.OPENAI_API_KEY,env.OPENAI_MODEL_FAST).createRepurpose(JSON.parse(job.inputJson??"{}") as RepurposeJobInput);
    await db.update(jobs).set({status:"completed",outputJson:JSON.stringify(result.output),provider:"openai",model:result.model,tokensInput:result.inputTokens,tokensOutput:result.outputTokens,creditsCharged:job.creditsReserved,creditsReserved:0,completedAt:new Date()}).where(eq(jobs.id,jobId));
    if(job.telegramChatId&&job.telegramMessageId) await editMessageText(env,job.telegramChatId,job.telegramMessageId,summary(result.output),repurposeResult(jobId));
  }catch(e){
    if(job.creditsReserved>0) await refundCredits(env,job.userId,job.creditsReserved,job.id);
    await db.update(jobs).set({status:"failed",creditsReserved:0,errorMessage:e instanceof Error?e.message:"unknown_error",completedAt:new Date()}).where(eq(jobs.id,jobId));
    if(job.telegramChatId&&job.telegramMessageId) await editMessageText(env,job.telegramChatId,job.telegramMessageId,"❌ Не удалось переработать материал. Credits возвращены.");
    throw e;
  }
}
export const repurposeResult=(jobId:number)=>({inline_keyboard:[[b("📱 Telegram",`rep:view:${jobId}:telegram`),b("📸 Instagram",`rep:view:${jobId}:instagram`)],[b("🎵 TikTok",`rep:view:${jobId}:tiktok`),b("▶️ YouTube",`rep:view:${jobId}:youtube`)],[b("🔥 5 Hooks",`rep:view:${jobId}:hooks`),b("🎯 CTA",`rep:view:${jobId}:cta`)],[b("📅 План",`rep:view:${jobId}:plan`),b("← Назад","menu:back")]]});
function b(text:string,data:string){return {text,callback_data:data};}
function summary(o:any){return `♻️ Готово ✅

Из одного материала создано:

📱 Telegram-пост
📸 Instagram caption
🎵 TikTok script
▶️ YouTube Shorts script
🔥 5 Hooks
🎯 CTA
📅 Контент на 7 дней

Нажми кнопку ниже, чтобы открыть нужный результат.`;}
