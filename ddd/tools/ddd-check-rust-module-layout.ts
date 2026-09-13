#!/usr/bin/env bun
import { resolve } from "node:path";
import { checkModuleLayout } from "./ddd/lib/module-layout/check.ts";
import { initAnalyzer } from "./ddd/lib/rust/analyzer.ts";

// CI uses process exit status; gate sensors use the same checker with the standard JSON verdict protocol.
try {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--project" || !args[1])
    throw new Error("Usage: bun ddd-check-rust-module-layout.ts --project <project-root>");
  const runtime = await initAnalyzer();
  if (runtime.state !== "ready") throw new Error("tree-sitter-rust runtime is unavailable");
  const result = checkModuleLayout(runtime, resolve(args[1]));
  const pass = result.findings.length === 0 && result.crates > 0;
  console.log(JSON.stringify({ pass, ...result, ...(result.crates ? {} : { reason: "no Rust packages checked" }) }));
  process.exitCode = pass ? 0 : 1;
} catch (error) {
  console.log(JSON.stringify({ pass: false, reason: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
}
