import type { Bindings } from "../env";
import { ensureUser, reserveCredits } from "../billing/credits";
import { createDb } from "../db/client";
import { jobs, userSessions } from "../db/schema";
import { and, eq } from "drizzle-orm";
import { answerCallback, deleteMessage, editMessageText, sendMessage } from "./api";
import { mainMenu, postConfig } from "./keyboards";

const maxInput=(env:Bindings)=>Number(env.MAX_INPUT_CHARS??12000);
const now=()=>new Date();
const parseDraft=(s?:string|null)=>s?JSON.parse(s):{topic:"",platform:"telegram",style:"conversational",length:"short"};

export async function handleWebhook(env:Bindings,update:any){
  const message=update.message; const cb=update.callback_query; const from=message?.from??cb?.from; if(!from) return;
  const chatId=String(message?.chat?.id??cb?.message?.chat?.id); const user=await ensureUser(env,String(from.id),from.first_name,from.username); const db=createDb(env);
  if(message?.text==="/start"){ await sendMessage(env,chatId,"👋 Creator AI\\n\\nСоздавай готовый контент прямо в Telegram.",mainMenu); return; }
  if(message?.text){ const session=await db.select().from(userSessions).where(eq(userSessions.userId,user.id)).get(); if(session?.flow==="post" && session.step==="topic"){
      const topic=message.text.trim().slice(0,maxInput(env)); await db.insert(userSessions).values({userId:user.id,flow:"post",step:"config",draftJson:JSON.stringify({...parseDraft(),topic}),updatedAt:now()}).onConflictDoUpdate({target:userSessions.userId,set:{step:"config",draftJson:JSON.stringify({...parseDraft(),topic}),updatedAt:now()}}); await deleteMessage(env,chatId,message.message_id); const sent=await sendMessage(env,chatId,`📝 Post Maker\\n\\nТема:\\n${topic}\\n\\n📱 Площадка\\n`,postConfig(parseDraft(JSON.stringify({topic})))); await db.update(userSessions).set({draftJson:JSON.stringify({...parseDraft(),topic}),updatedAt:now()}).where(eq(userSessions.userId,user.id)); return; }
  }
  if(cb){ await answerCallback(env,cb.id); const data=String(cb.data); const msg=cb.message; if(data==="menu:post"){
      await db.insert(userSessions).values({userId:user.id,flow:"post",step:"topic",draftJson:JSON.stringify(parseDraft()),updatedAt:now()}).onConflictDoUpdate({target:userSessions.userId,set:{flow:"post",step:"topic",draftJson:JSON.stringify(parseDraft()),updatedAt:now()}}); await editMessageText(env,chatId,msg.message_id,"📝 Post Maker\\n\\nО чём пост?\\n\\nНапиши тему или идею.\\n\\nНапример:\\n«5 способов использовать AI\\nв Telegram»\\n\\n[ ← Назад ]"); return;
    }
    if(data.startsWith("post:p:")||data.startsWith("post:s:")||data.startsWith("post:l:")){ const s=await db.select().from(userSessions).where(eq(userSessions.userId,user.id)).get(); const d=parseDraft(s?.draftJson); if(data.startsWith("post:p:")) d.platform=data.slice(7); if(data.startsWith("post:s:")) d.style=data.slice(7); if(data.startsWith("post:l:")) d.length=data.slice(7); await db.update(userSessions).set({draftJson:JSON.stringify(d),updatedAt:now()}).where(eq(userSessions.userId,user.id)); await editMessageText(env,chatId,msg.message_id,`📝 Post Maker\\n\\nТема:\\n${d.topic}\\n\\n📱 Площадка\\n${d.platform}\\n\\n✍️ Стиль\\n${d.style}\\n\\n📏 Длина\\n${d.length}`,postConfig(d)); return; }
    if(data==="post:create"){ const s=await db.select().from(userSessions).where(eq(userSessions.userId,user.id)).get(); const d=parseDraft(s?.draftJson); if(!d.topic) return; if(!(await reserveCredits(env,user.id,1))){ await editMessageText(env,chatId,msg.message_id,"💳 Недостаточно credits. Откройте ⭐ Credits."); return; } const sent=await editMessageText(env,chatId,msg.message_id,"⏳ Создаю пост..."); const inserted=await db.insert(jobs).values({userId:user.id,type:"post",status:"queued",inputJson:JSON.stringify(d),creditsReserved:1,telegramChatId:chatId,telegramMessageId:sent.message_id,createdAt:now()}).returning({id:jobs.id}).get(); await env.AI_QUEUE.send({jobId:inserted.id}); await db.delete(userSessions).where(eq(userSessions.userId,user.id)); return; }
    if(data==="post:back"){ await db.delete(userSessions).where(eq(userSessions.userId,user.id)); await editMessageText(env,chatId,msg.message_id,"Главное меню",mainMenu); return; }
    if(data.startsWith("post:back-result:")){ await editMessageText(env,chatId,msg.message_id,"Главное меню",mainMenu); return; }
  }
}
