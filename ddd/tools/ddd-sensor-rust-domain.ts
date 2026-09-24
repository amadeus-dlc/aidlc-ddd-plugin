#!/usr/bin/env bun
import { evaluateSensor } from "./ddd/lib/rules/evaluate.ts";
import { runSensor, ToolUnavailableError } from "./ddd/lib/runtime/runtime.ts";
// ddd-sensor-rust-domain — the code-generation gate for the domain layer (U5).
// Rules a / b / c / d and the dependency safety net g, plus U2 layer diagnostics.
import { initAnalyzer } from "./ddd/lib/rust/analyzer.ts";
import { classifyDomainFactExtractor } from "./ddd/lib/rust/domain-facts/index.ts";

const runtime = await initAnalyzer();
// Every rule this gate reports decides on the native extractor's facts, so its one launch is
// classified here, beside the other tool this gate cannot run without. Whether an unusable one
// stops this run is decided where the files those rules are evaluated over are known.
const extractor = await classifyDomainFactExtractor();
process.exit(
  runSensor({
    sensor_id: "ddd-rust-domain",
    severity: "blocking",
    budget_ms: 9000,
    evaluate: (context, api) => {
      if (runtime.state !== "ready") throw new ToolUnavailableError("tree-sitter-rust runtime is unavailable");
      return evaluateSensor(
        runtime,
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
      );
    },
  }),
);
