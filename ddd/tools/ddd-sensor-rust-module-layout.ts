#!/usr/bin/env bun
import { checkModuleLayout } from "./ddd/lib/module-layout/check.ts";
import { runSensor, ToolUnavailableError } from "./ddd/lib/runtime/runtime.ts";
import { initAnalyzer } from "./ddd/lib/rust/analyzer.ts";

const runtime = await initAnalyzer();
process.exit(
  runSensor({
    sensor_id: "ddd-rust-module-layout",
    severity: "blocking",
    budget_ms: 9000,
    evaluate: (context, api) => {
      if (runtime.state !== "ready") throw new ToolUnavailableError("tree-sitter-rust runtime is unavailable");
      const result = checkModuleLayout(runtime, context.workspace_root, () => api.checkBudget());
      return {
        findings: result.findings,
        note: `${result.mode ?? "no Rust project"}; ${result.crates} crates; ${result.files} module files`,
      };
    },
  }),
);
