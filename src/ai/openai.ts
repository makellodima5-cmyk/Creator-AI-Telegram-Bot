import type { AIProvider, PostInput, PostOutput, ScriptInput, ScriptOutput, RepurposeInput, RepurposeOutput, PlanInput, PlanOutput } from "./provider";

const schemas = {
  post: { type:"object", properties:{title:{type:"string"},body:{type:"string"},hook:{type:"string"},platform:{type:"string"},style:{type:"string"},length:{type:"string"}}, required:["title","body","hook","platform","style","length"], additionalProperties:false },
  script: { type:"object", properties:{title:{type:"string"},hook:{type:"string"},duration:{type:"string"},scenes:{type:"array",items:{type:"object",properties:{time:{type:"string"},spoken:{type:"string"},visual:{type:"string"},onScreen:{type:"string"}},required:["time","spoken","visual","onScreen"],additionalProperties:false}},cta:{type:"string"},platform:{type:"string"},style:{type:"string"}}, required:["title","hook","duration","scenes","cta","platform","style"], additionalProperties:false },
  repurpose: { type:"object", properties:{telegram:{type:"string"},instagram:{type:"string"},tiktok:{type:"string"},youtube:{type:"string"},hooks:{type:"array",items:{type:"string"}},cta:{type:"string"},plan:{type:"array",items:{type:"object",properties:{day:{type:"string"},title:{type:"string"},format:{type:"string"}},required:["day","title","format"],additionalProperties:false}}}, required:["telegram","instagram","tiktok","youtube","hooks","cta","plan"], additionalProperties:false },
  plan: { type:"object", properties:{topic:{type:"string"},days:{type:"array",items:{type:"object",properties:{day:{type:"string"},title:{type:"string"},format:{type:"string"},platform:{type:"string"},hook:{type:"string"}},required:["day","title","format","platform","hook"],additionalProperties:false}}}, required:["topic","days"], additionalProperties:false }
} as const;

export class OpenAIProvider implements AIProvider {
  constructor(private readonly apiKey:string, private readonly model:string) {}

  private async structured<T>(name:string, schema:object, instructions:string, input:string) {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method:"POST",
      headers:{ "content-type":"application/json", authorization:`Bearer ${this.apiKey}` },
      body:JSON.stringify({
        model:this.model,
        instructions,
        input:[{ role:"user", content:input }],
        text:{ format:{ type:"json_schema", name, strict:true, schema } }
      })
    });
    if(!response.ok) throw new Error(`openai_http_${response.status}`);
    const data = await response.json() as { output_text?:string; usage?:{input_tokens?:number;output_tokens?:number} };
    if(!data.output_text) throw new Error("openai_empty_output");
    return { output:JSON.parse(data.output_text) as T, model:this.model, inputTokens:data.usage?.input_tokens, outputTokens:data.usage?.output_tokens };
  }

  createPost(input:PostInput) {
    return this.structured<PostOutput>("creator_post",schemas.post,
      "You are Creator AI. Create publish-ready social content. Preserve the requested language and follow platform, style and length.",
      `Topic: ${input.topic}\nPlatform: ${input.platform}\nStyle: ${input.style}\nLength: ${input.length}`);
  }

  createScript(input:ScriptInput) {
    return this.structured<ScriptOutput>("creator_script",schemas.script,
      "You are Creator AI. Create a concise publish-ready short-form video script with a strong hook, scenes, spoken text, visuals, on-screen text and CTA. Preserve the requested language.",
      `Topic: ${input.topic}\nPlatform: ${input.platform}\nStyle: ${input.style}\nDuration: ${input.duration}`);
  }

  createRepurpose(input:RepurposeInput) {
    return this.structured<RepurposeOutput>("creator_repurpose",schemas.repurpose,
      "You are Creator AI. Transform one source material into useful platform-specific content. Do not invent facts not supported by the source. Preserve the source language unless the target requires otherwise.",
      `Material:\n${input.material}\n\nTargets: ${input.targets.join(", ")}`);
  }

  createPlan(input:PlanInput) {
    return this.structured<PlanOutput>("creator_plan",schemas.plan,
      "You are Creator AI. Create a practical 7-day content plan, not seven full posts. Make each day distinct and actionable. Preserve the requested language.",
      `Topic: ${input.topic}\nGoal: ${input.goal}\nPlatform: ${input.platform}\nStyle: ${input.style}`);
  }
}
