#!/usr/bin/env bun
// ddd-sensor-typescript-use-case — the code-generation gate for the TypeScript use-case layer (T-11-03).
// Rules g (DIP / external I/O), h (execute arguments), i (chaining) and d, with the rule ids of
// ddd-rust-use-case.
import { evaluateTypeScriptUseCase } from "./ddd/lib/rules/typescript/evaluate.ts";
import { runSensor } from "./ddd/lib/runtime/runtime.ts";

// The compiler every rule decides on is classified inside the evaluation, where the project root
// and whether a claimed use-case source needs it are known.
process.exit(
  runSensor({
    sensor_id: "ddd-typescript-use-case",
    severity: "blocking",
    budget_ms: 9000,
    evaluate: (context, api) => evaluateTypeScriptUseCase(context, api),
  }),
);
