const t=(v:any)=>typeof v==="string"&&v.trim().length>0;
const unique=(a:any[])=>new Set(a.map(v=>String(v).trim().toLowerCase())).size===a.length;
export function validateOutput(o:string,x:any):any{
 if(!x||typeof x!=="object")return{ok:false,reason:"not_object"};
 if(o==="post"||o==="repurpose_telegram")return t(x.title)&&t(x.body??x.content)&&t(x.hook)?{ok:true}:{ok:false,reason:"bad_post"};
 if(o==="repurpose_instagram")return t(x.hook)&&t(x.body)&&t(x.cta)&&Array.isArray(x.hashtags)?{ok:true}:{ok:false,reason:"bad_instagram"};
 if(o==="script"||o==="repurpose_tiktok"||o==="repurpose_youtube")return t(x.title)&&t(x.hook)&&Array.isArray(x.scenes)&&x.scenes.length>0&&x.scenes.every((s:any)=>t(s.time)&&t(s.spoken)&&t(s.visual)&&t(s.onScreen))&&t(x.cta)&&t(x.duration)?{ok:true}:{ok:false,reason:"bad_script"};
 if(o==="repurpose_hooks"){if(!Array.isArray(x.hooks)||x.hooks.length!==5||!Array.isArray(x.mechanisms)||x.mechanisms.length!==5)return{ok:false,reason:"hooks_structure"};return unique(x.hooks)&&unique(x.mechanisms)?{ok:true}:{ok:false,reason:"hooks_not_unique"}}
 if(o==="repurpose_cta"){if(!Array.isArray(x.ctas)||x.ctas.length!==3||!Array.isArray(x.types)||x.types.length!==3)return{ok:false,reason:"cta_structure"};return unique(x.ctas)&&unique(x.types)?{ok:true}:{ok:false,reason:"cta_not_unique"}}
 if(o==="content_plan"||o==="repurpose_plan"){if(!Array.isArray(x.days)||x.days.length!==7)return{ok:false,reason:"plan_days"};const a=new Set(["Post","Short","Пост","Shorts"]);return x.days.every((d:any)=>t(d.day)&&t(d.title)&&t(d.goal)&&t(d.format)&&t(d.hook)&&t(d.angle)&&t(d.mainThought)&&t(d.cta)&&t(d.status)&&a.has(String(d.format)))?{ok:true}:{ok:false,reason:"plan_day_invalid"}}
 if(o==="style_profile")return t(x.vocabulary)&&t(x.structure)&&t(x.rhythm)&&t(x.emotion)&&t(x.humor)&&t(x.emojis)&&t(x.hooks)&&t(x.cta)&&t(x.instruction)?{ok:true}:{ok:false,reason:"style_profile_invalid"};
 if(o==="source_analysis")return t(x.summary)&&Array.isArray(x.keyPoints)&&x.keyPoints.length>0&&t(x.angle)?{ok:true}:{ok:false,reason:"analysis_invalid"};
 return{ok:false,reason:"unsupported_operation"};
}
export function normalizeOutput(_o:string,x:any){return x}
