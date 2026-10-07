import type { Bindings } from "../env";
import { OpenAIProvider } from "./openai";
import { routeModel, costUsdMicros } from "./router";
import { buildPrompt, promptVersion } from "./prompt-builder";
import { validateOutput, normalizeOutput } from "./validator";

const postSchema={type:"object",properties:{title:{type:"string"},body:{type:"string"},hook:{type:"string"}},required:["title","body","hook"],additionalProperties:false};
const scriptSchema={type:"object",properties:{title:{type:"string"},hook:{type:"string"},duration:{type:"string"},scenes:{type:"array",items:{type:"object",properties:{time:{type:"string"},spoken:{type:"string"},visual:{type:"string"},onScreen:{type:"string"}},required:["time","spoken","visual","onScreen"],additionalProperties:false}},cta:{type:"string"}},required:["title","hook","duration","scenes","cta"],additionalProperties:false};
const planSchema={type:"object",properties:{topic:{type:"string"},days:{type:"array",items:{type:"object",properties:{day:{type:"string"},title:{type:"string"},goal:{type:"string"},format:{type:"string"},hook:{type:"string"},angle:{type:"string"},mainThought:{type:"string"},cta:{type:"string"},status:{type:"string"}},required:["day","title","goal","format","hook","angle","mainThought","cta","status"],additionalProperties:false}}},required:["topic","days"],additionalProperties:false};
const styleSchema={type:"object",properties:{vocabulary:{type:"string"},structure:{type:"string"},rhythm:{type:"string"},emotion:{type:"string"},humor:{type:"string"},emojis:{type:"string"},hooks:{type:"string"},cta:{type:"string"},instruction:{type:"string"}},required:["vocabulary","structure","rhythm","emotion","humor","emojis","hooks","cta","instruction"],additionalProperties:false};
const hooksSchema={type:"object",properties:{hooks:{type:"array",items:{type:"string"}},mechanisms:{type:"array",items:{type:"string"}}},required:["hooks","mechanisms"],additionalProperties:false};
const ctaSchema={type:"object",properties:{ctas:{type:"array",items:{type:"string"}},types:{type:"array",items:{type:"string"}}},required:["ctas","types"],additionalProperties:false};
const analysisSchema={type:"object",properties:{summary:{type:"string"},keyPoints:{type:"array",items:{type:"string"}},angle:{type:"string"}},required:["summary","keyPoints","angle"],additionalProperties:false};

export async function generate<T>(env:Bindings,op:string,ctx:any,max=3){
  if(!env.OPENAI_API_KEY) throw new Error("ai_provider_not_configured");
  const model=await routeModel(env,op);
  if(!model) throw new Error("ai_model_not_configured");
  const schemas:Record<string,object>={post:postSchema,script:scriptSchema,content_plan:planSchema,style_profile:styleSchema,repurpose_hooks:hooksSchema,repurpose_cta:ctaSchema,source_analysis:analysisSchema};
  schemas.repurpose_telegram=postSchema;schemas.repurpose_instagram=postSchema;schemas.repurpose_tiktok=scriptSchema;schemas.repurpose_youtube=scriptSchema;schemas.repurpose_plan=planSchema;
  let last:any;
  for(let attempt=1;attempt<=max;attempt++){
    const ai=await new OpenAIProvider(env.OPENAI_API_KEY).structured<T>({
      model,name:"creator_"+op.replace(/[^a-z0-9_]/gi,"_"),schema:schemas[op]??postSchema,
      instructions:"Creator AI engine. Preserve facts. For hooks create five genuinely different mechanisms. For CTA create three genuinely different CTAs. For plans return exactly seven days and do not create finished posts.",
      input:buildPrompt(ctx)
    });
    last={...ai,output:normalizeOutput(op,ai.output),attempt,promptVersion:promptVersion(op),costUsdMicros:await costUsdMicros(env,ai.model,ai.inputTokens,ai.outputTokens)};
    if(validateOutput(op,last.output).ok) return last;
  }
  throw new Error("ai_validation_failed");
}