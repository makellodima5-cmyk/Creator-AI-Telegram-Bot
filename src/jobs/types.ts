export type JobMessage = { jobId:number };
export type PostJobInput = { topic:string; platform:string; style:string; length:string };
export type ScriptJobInput = { topic:string; platform:string; style:string; duration:string };
export type RepurposeJobInput = { material:string; targets:string[] };
export type PlanJobInput = { topic:string; goal:string; platform:string; style:string };
