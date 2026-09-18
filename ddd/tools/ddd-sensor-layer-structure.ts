#!/usr/bin/env bun
// ddd-sensor-layer-structure — infrastructure-design gate (U4 BR6).
//
// Reads the declaration through the reader that owns its format and runs the layer rules through
// the inspection that owns them; this gate only transcribes what they report onto the rule ids the
// approval contract declares. It reads nothing else: not the implementation mapping, not Rust, not
// Cargo, so where an aggregate's code lives never decides whether this context must rebuild it.
import { inspectLayerDeclaration, loadLayerDeclaration } from "./ddd/lib/layer-declaration/index.ts";
import { runSensor } from "./ddd/lib/runtime/runtime.ts";
import { finding, relPath } from "./ddd/lib/sensors/common.ts";
import { declarationPath } from "./ddd/lib/sensors/declaration.ts";

/** Which rule of this gate reports a refusal the declaration reader made. */
const READER_RULE: Readonly<Record<string, string>> = { "layer-declaration.model": "layer-structure.model" };

/** Which rule of this gate reports a layer rule the inspection judged. */
const INSPECTION_RULE: Readonly<Record<string, string>> = {
  "layer-declaration.required-items": "layer-structure.item",
  "layer-declaration.dependency-row": "layer-structure.dependencies-incomplete",
  "layer-declaration.cqrs-sides": "layer-structure.cqrs-sides",
  "layer-declaration.side-dependency": "layer-structure.k",
  "layer-declaration.query-domain-dependency": "layer-structure.l",
  "layer-declaration.restoration-path": "layer-structure.n",
};

process.exit(
  runSensor({
    sensor_id: "ddd-layer-structure",
    severity: "blocking",
    budget_ms: 9000,
    evaluate: (context) => {
      const path = declarationPath(context, "layer-structure");
      const file = relPath(context, path);
      const loaded = loadLayerDeclaration(path);
      if (!loaded.ok)
        return loaded.findings.map((entry) =>
          finding(READER_RULE[entry.rule_id] ?? "layer-structure.item", file, `${entry.rule_id}: ${entry.message}`),
        );
      return inspectLayerDeclaration(loaded.declaration, loaded.model, file).map((entry) =>
        finding(INSPECTION_RULE[entry.rule_id] ?? "layer-structure.item", file, entry.message),
      );
    },
  }),
);
