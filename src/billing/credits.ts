import { eq } from "drizzle-orm";
import { creditLedger, users } from "../db/schema";
import { createDb } from "../db/client";

export async function ensureUser(env:any, telegramId:string, firstName?:string, username?:string){
  const db=createDb(env); const now=new Date(); const existing=await db.select().from(users).where(eq(users.telegramId,telegramId)).get();
  if(existing) return existing;
  const free=10; const inserted=await db.insert(users).values({telegramId,firstName,username,plan:"free",creditsBalance:free,creditsResetAt:new Date(now.getTime()+30*86400000),createdAt:now,updatedAt:now}).returning().get();
  await db.insert(creditLedger).values({userId:inserted.id,delta:free,balanceAfter:free,reason:"free_grant",createdAt:now}); return inserted;
}

export async function reserveCredits(env:any,userId:number,cost:number){
  const db=createDb(env); const u=await db.select().from(users).where(eq(users.id,userId)).get();
  if(!u || u.creditsBalance<cost) return false;
  const r=await env.DB.prepare("UPDATE users SET credits_balance = credits_balance - ?, updated_at = ? WHERE id = ? AND credits_balance >= ?").bind(cost,Date.now(),userId,cost).run();
  return r.meta.changes===1;
}

export async function chargeCredits(env:any,userId:number,cost:number,jobId:number){
  const db=createDb(env); const u=await db.select().from(users).where(eq(users.id,userId)).get(); if(!u) throw new Error("user_not_found");
  await db.insert(creditLedger).values({userId,delta:-cost,balanceAfter:u.creditsBalance,reason:"job_charge",jobId,createdAt:new Date()});
}
