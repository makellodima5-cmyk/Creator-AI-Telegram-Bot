export type PostInput={topic:string;platform:string;style:string;length:string;styleProfile?:string};
export type PostOutput={title:string;body:string;hook:string;platform:string;style:string;length:string};
export type ScriptInput={topic:string;platform:string;style:string;duration:string};
export type ScriptOutput={title:string;hook:string;duration:string;scenes:Array<{time:string;spoken:string;visual:string;onScreen:string}>;cta:string;platform:string;style:string};
export type RepurposeInput={material:string;targets:string[];styleProfile?:string};
export type RepurposeOutput={telegram?:string;instagram?:string;tiktok?:string;youtube?:string;hooks?:string[];cta?:string;plan?:Array<{day:string;title:string;format:string}>};
export type PlanInput={topic:string;goal:string;platform:string;style:string;styleProfile?:string};
export type PlanOutput={topic:string;days:Array<{day:string;title:string;goal:string;format:string;hook:string;angle:string;mainThought:string;cta:string;status:string}>};
export type StyleProfileInput={examples:string[]};
export type StyleProfileOutput={vocabulary:string;structure:string;rhythm:string;emotion:string;humor:string;emojis:string;hooks:string;cta:string;instruction:string};
export interface AIProvider{
 createPost(input:PostInput):Promise<{output:PostOutput;model:string;inputTokens?:number;outputTokens?:number}>;
 createScript(input:ScriptInput):Promise<{output:ScriptOutput;model:string;inputTokens?:number;outputTokens?:number}>;
 createRepurpose(input:RepurposeInput):Promise<{output:RepurposeOutput;model:string;inputTokens?:number;outputTokens?:number}>;
 createPlan(input:PlanInput):Promise<{output:PlanOutput;model:string;inputTokens?:number;outputTokens?:number}>;
 createStyleProfile(input:StyleProfileInput):Promise<{output:StyleProfileOutput;model:string;inputTokens?:number;outputTokens?:number}>;
}