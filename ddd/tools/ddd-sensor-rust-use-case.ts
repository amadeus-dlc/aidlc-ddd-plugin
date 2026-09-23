#!/usr/bin/env bun
import { evaluateSensor } from "./ddd/lib/rules/evaluate.ts";
import { runSensor, ToolUnavailableError } from "./ddd/lib/runtime/runtime.ts";
// ddd-sensor-rust-use-case — the code-generation gate for the use-case layer
// (U5). Rules g (DIP / external I/O), h (execute arguments), i (chaining) and d.
import { initAnalyzer } from "./ddd/lib/rust/analyzer.ts";
import { classifyDomainFactExtractor } from "./ddd/lib/rust/domain-facts/index.ts";

const runtime = await initAnalyzer();
// Rule (d) decides on the native extractor's facts here too, so this gate classifies the same one
// launch and is required to read it on the same condition as the domain gate.
const extractor = await classifyDomainFactExtractor();
process.exit(
  runSensor({
    sensor_id: "ddd-rust-use-case",
    severity: "blocking",
    budget_ms: 9000,
    evaluate: (context, api) => {
      if (runtime.state !== "ready") throw new ToolUnavailableError("tree-sitter-rust runtime is unavailable");
      return evaluateSensor(
        runtime,
        context,
        {
          sensor_id: "ddd-rust-use-case",
          target_layers: ["use-case"],
          includes_query_side: false,
          domain_facts: extractor,
        },
        ["g", "h", "i", "d"],
        api,
      );
    },
  }),
);
