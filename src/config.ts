export const DEFAULT_PRICES = {
  post:1, script:2, repurpose:3, content_plan:5,
  post_edit:1, post_variant:1, script_edit:2, script_variant:2, repurpose_variant:3, plan_variant:5, style_profile:3,
  repurpose_telegram:1, repurpose_instagram:1, repurpose_tiktok:1, repurpose_youtube:1, repurpose_hooks:1, repurpose_cta:1, repurpose_plan:1
} as const;
export const DEFAULT_PACKAGES = [{credits:50,stars:49},{credits:100,stars:89},{credits:250,stars:199},{credits:500,stars:349}] as const;
export async function getPrice(env:any,key:keyof typeof DEFAULT_PRICES):Promise<number>{
  const row=(await env.DB.prepare("SELECT credits_cost FROM pricing WHERE key=? AND is_active=1 LIMIT 1").bind(key).first()) as {credits_cost:number|null}|null;
  return Number(row?.credits_cost ?? DEFAULT_PRICES[key]);
}
export async function getPackage(env:any,credits:number){
  const row=(await env.DB.prepare("SELECT stars_price,included_credits FROM pricing WHERE key=? AND is_active=1 LIMIT 1").bind("credits_"+credits).first()) as {stars_price:number|null;included_credits:number|null}|null;
  const fallback=DEFAULT_PACKAGES.find(x=>x.credits===credits);
  return {credits:Number(row?.included_credits ?? fallback?.credits ?? credits),stars:Number(row?.stars_price ?? fallback?.stars ?? 0)};
}