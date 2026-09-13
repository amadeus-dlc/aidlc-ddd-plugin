import { resolve } from "node:path";
import { type FrozenTask, verifyTask } from "../../state-exposure-verification/input.ts";
import {
  DEFAULT_LIMITS,
  type Limits,
  type Observation,
  observeProcess,
} from "../../state-exposure-verification/process.ts";

export { extractTypeScriptLocal } from "./extract.ts";
export { createFrozenProgram, TS_TOOLCHAIN } from "./program.ts";
export async function extractTypeScript(task: FrozenTask, limits: Limits = DEFAULT_LIMITS): Promise<Observation> {
  verifyTask(task);
  return observeProcess([process.execPath, resolve(import.meta.dir, "worker.ts")], JSON.stringify(task), limits);
}
