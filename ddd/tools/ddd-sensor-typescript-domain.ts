#!/usr/bin/env bun
// ddd-sensor-typescript-domain — the code-generation gate for the TypeScript domain layer (T-11-02).
// Rules a / b / c / d and the dependency safety net g, domain packaging and the layer diagnostics,
// with the rule ids of ddd-rust-domain.
import { evaluateTypeScriptDomain } from "./ddd/lib/rules/typescript/evaluate.ts";
import { runSensor } from "./ddd/lib/runtime/runtime.ts";

// The compiler every rule decides on is classified inside the evaluation, where the project root
// and whether a claimed domain source needs it are known.
process.exit(
  runSensor({
    sensor_id: "ddd-typescript-domain",
    severity: "blocking",
    budget_ms: 9000,
    evaluate: (context, api) => evaluateTypeScriptDomain(context, api),
  }),
);
