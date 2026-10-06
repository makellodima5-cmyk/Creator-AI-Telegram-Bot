export type PostInput = { topic:string; platform:string; style:string; length:string };
export type PostOutput = { title:string; body:string; hook:string; platform:string; style:string; length:string };
export interface AIProvider { createPost(input:PostInput):Promise<{output:PostOutput; model:string; inputTokens?:number; outputTokens?:number}> }
