#!/usr/bin/env bun
import { checkModuleLayout } from "./ddd/lib/module-layout/check.ts";
import { runSensor } from "./ddd/lib/runtime/runtime.ts";
import { classifyDomainFactExtractor } from "./ddd/lib/rust/domain-facts/index.ts";

// The module walk reads the declarations of the native extractor, so its one launch is classified
// here; an unusable one stops this gate where the walk would otherwise read a file as empty.
const extractor = await classifyDomainFactExtractor();
process.exit(
  runSensor({
    sensor_id: "ddd-rust-module-layout",
    severity: "blocking",
    budget_ms: 9000,
    evaluate: (context, api) => {
      const result = checkModuleLayout(extractor, context.workspace_root, () => api.checkBudget());
      return {
        findings: result.findings,
        note: `${result.mode ?? "no Rust project"}; ${result.crates} crates; ${result.files} module files`,
      };
    },
  }),
);
