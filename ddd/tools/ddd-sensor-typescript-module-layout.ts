#!/usr/bin/env bun
import { checkTypeScriptModuleLayout } from "./ddd/lib/module-layout/typescript.ts";
import { runSensor } from "./ddd/lib/runtime/runtime.ts";

// The layout is decided by the tree alone, so this gate needs no fact extractor.
process.exit(
  runSensor({
    sensor_id: "ddd-typescript-module-layout",
    severity: "blocking",
    budget_ms: 9000,
    evaluate: (context, api) => {
      const result = checkTypeScriptModuleLayout(context.workspace_root, () => api.checkBudget());
      return {
        findings: result.findings,
        note: `${result.mode ?? "no TypeScript project"}; ${result.packages} packages; ${result.files} module files`,
      };
    },
  }),
);
