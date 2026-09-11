#!/usr/bin/env bun
// ddd-sensor-model-presence — the domain-design gate (U4 BR3).
//
// components.md is the trigger only; when domain-modeling ran (EXECUTE) the
// normalised model must exist, load, and resolve. SKIP / absent passes with a
// note (ADR-004).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readStageStatus } from "./ddd/lib/runtime/context.ts";
import { runSensor } from "./ddd/lib/runtime/runtime.ts";
import { loadDomainModel } from "./ddd/lib/schema/loader.ts";
import { collectUnresolved, finding, relPath } from "./ddd/lib/sensors/common.ts";

process.exit(
  runSensor({
    sensor_id: "ddd-model-presence",
    severity: "blocking",
    budget_ms: 9000,
    evaluate: (context) => {
      const status = readStageStatus(context, "domain-modeling");
      if (status.execution === "SKIP" || status.execution === "absent") {
        return { findings: [], note: `domain-modeling is ${status.execution}; presence check skipped` };
      }
      const modelPath = join(context.record_dir, "inception", "domain-modeling", "domain-model.yaml");
      const file = relPath(context, modelPath);
      if (!existsSync(modelPath)) {
        return [finding("model-presence.missing", file, "domain-modeling ran but domain-model.yaml is missing")];
      }
      const loaded = loadDomainModel(modelPath);
      if (!loaded.ok) {
        return loaded.findings.map((entry) => finding("model-presence.invalid", file, entry.message, entry.line));
      }
      return collectUnresolved(loaded.model, loaded.index).map((reference) =>
        finding("model-presence.unresolved", file, `unresolved reference ${reference.id} (${reference.reason})`),
      );
    },
  }),
);
