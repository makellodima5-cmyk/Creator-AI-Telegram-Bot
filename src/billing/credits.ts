import { eq } from "drizzle-orm";
import { creditLedger, users } from "../db/schema";
import { createDb } from "../db/client";
import type { Bindings } from "../env";

export async function ensureUser(env: Bindings, telegramId: string, firstName?: string, username?: string) {
  const db=createDb(env),now=new Date();
  let existing=await db.select().from(users).where(eq(users.telegramId,telegramId)).get();
  if(!existing){
    const credits=10;
    existing=await db.insert(users).values({
      telegramId,firstName,username,language:"ru",plan:"free",creditsBalance:credits,
      creditsResetAt:new Date(now.getTime()+30*86_400_000),createdAt:now,updatedAt:now
    }).returning().get();
    await db.insert(creditLedger).values({userId:existing.id,delta:credits,balanceAfter:credits,reason:"free_grant",createdAt:now});
    return existing;
  }
  if(existing.creditsResetAt&&existing.creditsResetAt.getTime()<=now.getTime()){
    const credits=existing.plan==="pro"?500:existing.plan==="creator"?100:10;
    const newBalance=existing.creditsBalance+credits;
    await db.update(users).set({creditsBalance:newBalance,creditsResetAt:new Date(now.getTime()+30*86_400_000),updatedAt:now}).where(eq(users.id,existing.id));
    await db.insert(creditLedger).values({userId:existing.id,delta:credits,balanceAfter:newBalance,reason:"period_grant",createdAt:now});
    existing={...existing,creditsBalance:newBalance,creditsResetAt:new Date(now.getTime()+30*86_400_000),updatedAt:now};
  }
  return existing;
}

export async function reserveCredits(env:Bindings,userId:number,cost:number,jobId:number){
  const result=await env.DB.prepare("UPDATE users SET credits_balance = credits_balance - ?, updated_at = ? WHERE id = ? AND credits_balance >= ?").bind(cost,Date.now(),userId,cost).run();
  if(result.meta.changes!==1)return false;
  const db=createDb(env),current=await db.select().from(users).where(eq(users.id,userId)).get();if(!current)return false;
  await db.insert(creditLedger).values({userId,delta:-cost,balanceAfter:current.creditsBalance,reason:"job_reserve",jobId,createdAt:new Date()});
  return true;
}

export async function refundCredits(env:Bindings,userId:number,amount:number,jobId:number){
  const result=await env.DB.prepare("UPDATE users SET credits_balance = credits_balance + ?, updated_at = ? WHERE id = ?").bind(amount,Date.now(),userId).run();
  if(result.meta.changes!==1)return false;
  const db=createDb(env),current=await db.select().from(users).where(eq(users.id,userId)).get();if(!current)return false;
  await db.insert(creditLedger).values({userId,delta:amount,balanceAfter:current.creditsBalance,reason:"job_refund",jobId,createdAt:new Date()});
  return true;
}
