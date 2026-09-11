#!/usr/bin/env bun
// ddd-sensor-model-completeness — the domain-modeling gate (U4 BR2).
//
// Loads the normalised model with U1, transcribes load-time and completeness
// violations, resolves references (iv), and checks domain-model.md against the
// yaml (v / rule f).
import { dirname, join } from "node:path";
import { runSensor } from "./ddd/lib/runtime/runtime.ts";
import { checkCompleteness } from "./ddd/lib/schema/completeness.ts";
import { loadDomainModel } from "./ddd/lib/schema/loader.ts";
import { collectUnresolved, finding, readText, relPath } from "./ddd/lib/sensors/common.ts";
import type { FindingInput } from "./ddd/lib/shared/findings.ts";

const ID_PATTERN =
  /(?:bc|aggregate|entity|vo|primitive|invariant|command|event|error|transition|factory|pm)\.[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*/g;

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

process.exit(
  runSensor({
    sensor_id: "ddd-model-completeness",
    severity: "blocking",
    budget_ms: 9000,
    evaluate: (context) => {
      const yamlPath = context.output_path;
      const file = relPath(context, yamlPath);
      const loaded = loadDomainModel(yamlPath);
      if (!loaded.ok) {
        return loaded.findings.map((entry) => finding("model-completeness.schema", file, entry.message, entry.line));
      }
      const findings: FindingInput[] = [];

      for (const entry of checkCompleteness(loaded.model, file)) {
        const ruleId =
          entry.rule_id === "completeness.i"
            ? "model-completeness.i"
            : entry.rule_id === "completeness.ii"
              ? "model-completeness.ii"
              : undefined;
        if (ruleId) findings.push(finding(ruleId, file, entry.message, entry.line));
      }

      for (const reference of collectUnresolved(loaded.model, loaded.index)) {
        findings.push(
          finding("model-completeness.iv", file, `unresolved reference ${reference.id} (${reference.reason})`),
        );
      }

      const mdPath = join(dirname(yamlPath), "domain-model.md");
      const markdown = readText(mdPath);
      if (markdown === undefined) {
        findings.push(finding("model-completeness.f-absent", file, "domain-model.md is missing"));
        return findings;
      }

      const mentioned = new Set(markdown.match(ID_PATTERN) ?? []);
      for (const element of loaded.index.elements()) {
        if (!mentioned.has(element.id.value)) {
          findings.push(
            finding(
              "model-completeness.f-missing",
              file,
              `element_id ${element.id.value} is not mentioned in domain-model.md`,
            ),
          );
        }
      }
      for (const id of mentioned) {
        if (loaded.index.byId(id) === undefined && !loaded.index.retiredIds().has(id)) {
          findings.push(finding("model-completeness.f-unknown", file, `domain-model.md mentions unknown id ${id}`));
        }
      }
      const normalizedMd = normalize(markdown);
      for (const bc of loaded.model.bounded_contexts) {
        for (const aggregate of bc.aggregates) {
          for (const invariant of aggregate.invariants) {
            if (!normalizedMd.includes(normalize(invariant.statement))) {
              findings.push(
                finding(
                  "model-completeness.f-invariant",
                  file,
                  `invariant ${invariant.element_id} statement is absent from domain-model.md`,
                ),
              );
            }
          }
        }
      }
      return findings;
    },
  }),
);
