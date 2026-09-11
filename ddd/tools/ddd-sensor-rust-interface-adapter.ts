#!/usr/bin/env bun
import { evaluateSensor } from "./ddd/lib/rules/evaluate.ts";
import { runSensor, ToolUnavailableError } from "./ddd/lib/runtime/runtime.ts";
// ddd-sensor-rust-interface-adapter — the code-generation gate for the
// interface-adapter / rmu layers and every query-side file (U5). Rules
// k / l / m / n and g.
import { initAnalyzer } from "./ddd/lib/rust/analyzer.ts";

const runtime = await initAnalyzer();
process.exit(
  runSensor({
    sensor_id: "ddd-rust-interface-adapter",
    severity: "blocking",
    budget_ms: 9000,
    evaluate: (context, api) => {
      if (runtime.state !== "ready") throw new ToolUnavailableError("tree-sitter-rust runtime is unavailable");
      return evaluateSensor(
        runtime,
        context,
        {
          sensor_id: "ddd-rust-interface-adapter",
          target_layers: ["interface-adapter", "rmu"],
          includes_query_side: true,
        },
        ["k", "l", "m", "n", "g"],
        api,
      );
    },
  }),
);
