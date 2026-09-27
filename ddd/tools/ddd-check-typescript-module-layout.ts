#!/usr/bin/env bun
import { resolve } from "node:path";
import { checkTypeScriptModuleLayout } from "./ddd/lib/module-layout/typescript.ts";

// CI uses process exit status; gate sensors use the same checker with the standard JSON verdict protocol.
try {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--project" || !args[1])
    throw new Error("Usage: bun ddd-check-typescript-module-layout.ts --project <project-root>");
  const result = checkTypeScriptModuleLayout(resolve(args[1]));
  const pass = result.findings.length === 0 && result.packages > 0;
  console.log(
    JSON.stringify({ pass, ...result, ...(result.packages ? {} : { reason: "no TypeScript packages checked" }) }),
  );
  process.exitCode = pass ? 0 : 1;
} catch (error) {
  console.log(JSON.stringify({ pass: false, reason: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
}
