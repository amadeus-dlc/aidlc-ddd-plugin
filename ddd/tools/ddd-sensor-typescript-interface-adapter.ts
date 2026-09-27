#!/usr/bin/env bun
// ddd-sensor-typescript-interface-adapter — the code-generation gate for the TypeScript
// interface-adapter / rmu layers and every query-side source (T-11-03). Rules k / l / m / n and g,
// with the rule ids of ddd-rust-interface-adapter.
import { evaluateTypeScriptInterfaceAdapter } from "./ddd/lib/rules/typescript/evaluate.ts";
import { runSensor } from "./ddd/lib/runtime/runtime.ts";

// The compiler every rule decides on is classified inside the evaluation, where the project root
// and whether a claimed source of these layers needs it are known.
process.exit(
  runSensor({
    sensor_id: "ddd-typescript-interface-adapter",
    severity: "blocking",
    budget_ms: 9000,
    evaluate: (context, api) => evaluateTypeScriptInterfaceAdapter(context, api),
  }),
);
