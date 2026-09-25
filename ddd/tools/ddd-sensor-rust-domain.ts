#!/usr/bin/env bun
// ddd-sensor-rust-domain — the code-generation gate for the domain layer (U5).
// Rules a / b / c / d and the dependency safety net g, plus U2 layer diagnostics.
import { evaluateSensor } from "./ddd/lib/rules/evaluate.ts";
import { runSensor } from "./ddd/lib/runtime/runtime.ts";
import { classifyDomainFactExtractor } from "./ddd/lib/rust/domain-facts/index.ts";

// Every rule this gate reports decides on the native extractor's facts, so its one launch is
// classified here, as the only tool this gate cannot run without. Whether an unusable one stops
// this run is decided where the files those rules are evaluated over are known.
const extractor = await classifyDomainFactExtractor();
process.exit(
  runSensor({
    sensor_id: "ddd-rust-domain",
    severity: "blocking",
    budget_ms: 9000,
    evaluate: (context, api) =>
      evaluateSensor(
        context,
        {
          sensor_id: "ddd-rust-domain",
          target_layers: ["domain"],
          includes_query_side: false,
          report_layer_diagnostics: true,
          domain_facts: extractor,
        },
        ["a", "b", "c", "d", "g", "domain-packaging"],
        api,
      ),
  }),
);
