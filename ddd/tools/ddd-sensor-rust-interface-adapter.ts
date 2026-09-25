#!/usr/bin/env bun
// ddd-sensor-rust-interface-adapter — the code-generation gate for the
// interface-adapter / rmu layers and every query-side file (U5). Rules
// k / l / m / n and g.
import { evaluateSensor } from "./ddd/lib/rules/evaluate.ts";
import { runSensor } from "./ddd/lib/runtime/runtime.ts";
import { classifyDomainFactExtractor } from "./ddd/lib/rust/domain-facts/index.ts";

// Rule (g) reads the dependency edges the native extractor's `use` facts build, so this gate
// classifies the same one launch and is required to read it on the same condition as the others.
const extractor = await classifyDomainFactExtractor();
process.exit(
  runSensor({
    sensor_id: "ddd-rust-interface-adapter",
    severity: "blocking",
    budget_ms: 9000,
    evaluate: (context, api) =>
      evaluateSensor(
        context,
        {
          sensor_id: "ddd-rust-interface-adapter",
          target_layers: ["interface-adapter", "rmu"],
          includes_query_side: true,
          domain_facts: extractor,
        },
        ["k", "l", "m", "n", "g"],
        api,
      ),
  }),
);
