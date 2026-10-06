import type { AIProvider, PostInput } from "./provider";

const schema = {type:"object",properties:{title:{type:"string"},body:{type:"string"},hook:{type:"string"},platform:{type:"string"},style:{type:"string"},length:{type:"string"}},required:["title","body","hook","platform","style","length"],additionalProperties:false};

export class OpenAIProvider implements AIProvider {
  constructor(private apiKey:string, private model:string){ }
  async createPost(input:PostInput){
    const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${this.apiKey}`},body:JSON.stringify({model:this.model,instructions:"You are Creator AI. Write publish-ready social content in the requested language. Return only the requested structured object.",input:`Topic: ${input.topic}\\nPlatform: ${input.platform}\\nStyle: ${input.style}\\nLength: ${input.length}`,text:{format:{type:"json_schema",name:"creator_post",strict:true,schema}}})});
    if(!r.ok) throw new Error(`openai_http_${r.status}`); const data:any=await r.json(); const raw=data.output_text; if(!raw) throw new Error("openai_empty_output");
    const output=JSON.parse(raw); return {output,model:this.model,inputTokens:data.usage?.input_tokens,outputTokens:data.usage?.output_tokens};
  }
}
