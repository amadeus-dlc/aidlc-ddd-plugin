import type { FrozenTask } from "../../state-exposure-verification/input.ts";
import { extractTypeScriptLocal } from "./extract.ts";

try {
  const text = await Bun.stdin.text();
  const task: FrozenTask = JSON.parse(text);
  process.stdout.write(`${JSON.stringify(extractTypeScriptLocal(task))}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
