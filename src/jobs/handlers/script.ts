import { eq } from "drizzle-orm";
import { jobs } from "../../db/schema";
import { createDb } from "../../db/client";
import { OpenAIProvider } from "../../ai/openai";
import { editMessageText } from "../../telegram/api";
import { mainMenu } from "../../telegram/keyboards";
import { refundCredits } from "../../billing/credits";
import type { Bindings } from "../../env";
import type { ScriptJobInput } from "../types";

export async function handleScriptJob(env:Bindings,jobId:number){
  const db=createDb(env), job=await db.select().from(jobs).where(eq(jobs.id,jobId)).get();
  if(!job || job.status==="completed" || job.status==="failed") return;
  if(!env.OPENAI_API_KEY || !env.OPENAI_MODEL_FAST) throw new Error("openai_not_configured");
  await db.update(jobs).set({status:"processing",startedAt:job.startedAt??new Date(),attempts:(job.attempts??0)+1}).where(eq(jobs.id,jobId));
  try{
    const result=await new OpenAIProvider(env.OPENAI_API_KEY,env.OPENAI_MODEL_FAST).createScript(JSON.parse(job.inputJson??"{}") as ScriptJobInput);
    await db.update(jobs).set({status:"completed",outputJson:JSON.stringify(result.output),provider:"openai",model:result.model,tokensInput:result.inputTokens,tokensOutput:result.outputTokens,creditsCharged:job.creditsReserved,creditsReserved:0,completedAt:new Date()}).where(eq(jobs.id,jobId));
    if(job.telegramChatId&&job.telegramMessageId) await editMessageText(env,job.telegramChatId,job.telegramMessageId,format(result.output),mainMenu);
  }catch(e){
    if(job.creditsReserved>0) await refundCredits(env,job.userId,job.creditsReserved,job.id);
    await db.update(jobs).set({status:"failed",creditsReserved:0,errorMessage:e instanceof Error?e.message:"unknown_error",completedAt:new Date()}).where(eq(jobs.id,jobId));
    if(job.telegramChatId&&job.telegramMessageId) await editMessageText(env,job.telegramChatId,job.telegramMessageId,"❌ Не удалось создать сценарий. Credits возвращены.",mainMenu);
    throw e;
  }
}
function format(o:any){return `🎬 Сценарий готов ✅

${o.title}

🔥 Hook:
${o.hook}

⏱ ${o.duration}

${o.scenes.map((s:any)=>`[ ${s.time} ]
🗣 ${s.spoken}
🎥 ${s.visual}
📝 ${s.onScreen}`).join("\n\n")}

🎯 CTA:
${o.cta}

📱 ${o.platform} · ${o.style}`;}
