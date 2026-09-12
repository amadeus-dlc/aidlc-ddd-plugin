/**
 * Per-manifest evaluation loop (U5 WF1). Assembles the context and runs the
 * rule evaluators in rust/ independently.
 */

import type { SensorRunContext } from "../runtime/context.ts";
import type { SensorApi } from "../runtime/runtime.ts";
import type { AnalyzerRuntime } from "../rust/analyzer.ts";
import type { FindingInput } from "../shared/findings.ts";
import { assembleContext, type ContextResult, type SensorConfig } from "./context.ts";
import { rulesFor } from "./definitions.ts";
import { CONTEXT_EVALUATORS, PER_FILE_EVALUATORS } from "./rust/evaluators.ts";
import type { InspectionContext, InspectionTarget } from "./types.ts";

export interface Evaluation {
  findings: FindingInput[];
  note?: string;
}

export function evaluateSensor(
  runtime: AnalyzerRuntime,
  run: SensorRunContext,
  config: SensorConfig,
  ruleIds: readonly string[],
  api?: SensorApi,
): Evaluation {
  const assembled: ContextResult = assembleContext(runtime, run, config);
  if (assembled.kind === "empty") return { findings: [], note: assembled.note };
  if (assembled.kind === "failed") {
    return { findings: assembled.findings, ...(assembled.note ? { note: assembled.note } : {}) };
  }
  const context = assembled.context;
  const findings: FindingInput[] = [...assembled.findings];

  if (config.report_layer_diagnostics) {
    for (const diagnostic of context.layerDiagnostics) {
      findings.push({
        // `DiagnosticCode` already carries its namespace (`layer.` / `cqrs.` /
        // `workspace.`), so prefixing here would emit `layer.layer.unknown`.
        rule_id: diagnostic.code,
        file: diagnostic.file,
        message: diagnostic.message,
      });
    }
  }

  const definitions = rulesFor(ruleIds);
  for (const definition of definitions) {
    if (definition.per_file) {
      const evaluator = PER_FILE_EVALUATORS[definition.rule_id];
      if (!evaluator) continue;
      for (const target of context.targets) {
        api?.checkBudget();
        findings.push(...evaluator(target, context));
      }
    } else {
      const evaluator = CONTEXT_EVALUATORS[definition.rule_id];
      if (!evaluator) continue;
      for (const target of representativeTargets(context)) {
        findings.push(...evaluator(target, context));
      }
    }
  }

  const noteParts: string[] = [];
  noteParts.push(...[...context.program.notes].sort());
  if (assembled.note) noteParts.push(assembled.note);
  if (context.skipped.length > 0) noteParts.push(`${context.skipped.length} non-target files skipped`);
  const deduped = dedupe(findings);
  return { findings: deduped, ...(noteParts.length > 0 ? { note: noteParts.join("; ") } : {}) };
}

function representativeTargets(context: InspectionContext): InspectionTarget[] {
  const seen = new Set<string>();
  const out: InspectionTarget[] = [];
  for (const target of context.targets) {
    if (!target.crate_name || seen.has(target.crate_name)) continue;
    seen.add(target.crate_name);
    out.push(target);
  }
  return out;
}

function dedupe(findings: readonly FindingInput[]): FindingInput[] {
  const seen = new Set<string>();
  const out: FindingInput[] = [];
  for (const item of findings) {
    const key = `${item.file}\u0000${item.line ?? ""}\u0000${item.rule_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
