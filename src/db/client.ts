import { drizzle } from "drizzle-orm/d1";
import type { Bindings } from "../env";
import * as schema from "./schema";
export const createDb=(env:Bindings)=>drizzle(env.DB,{schema});
