/**
 * The TypeScript domain gate's evaluation: the layer diagnostics, then rules (a), (b), (c) and (d)
 * over each claimed domain source, the dependency direction (g), and domain packaging over each
 * domain package a claim touches — the rules and rule ids of the Rust domain gate.
 *
 * A construct any of the rules could not decide stops the whole gate once they have all run, as a
 * source the facts could not describe stops it before they run: a verdict is only given over what
 * was decided.
 */

import type { SensorRunContext } from "../../runtime/context.ts";
import { type SensorApi, type SensorEvaluation, ToolUnavailableError } from "../../runtime/runtime.ts";
import type { FindingInput } from "../../shared/findings.ts";
import { dedupe } from "../evaluate.ts";
import { assembleTypeScriptInspection } from "./context.ts";
import { ruleG } from "./edges.ts";
import { ruleB, ruleC, ruleD, ruleDomainPackaging } from "./evaluators.ts";
import { ruleA } from "./state-hiding.ts";

export function evaluateTypeScriptDomain(run: SensorRunContext, api: SensorApi): SensorEvaluation {
  const assembled = assembleTypeScriptInspection(run);
  if (assembled.kind === "empty") return { findings: [], note: assembled.note };
  if (assembled.kind === "findings-only")
    return { findings: dedupe(assembled.findings), ...(assembled.note ? { note: assembled.note } : {}) };
  const inspection = assembled.inspection;
  const findings: FindingInput[] = [...assembled.findings, ...inspection.layerDiagnostics];
  for (const target of inspection.targets) {
    api.checkBudget();
    const facts = inspection.facts.files.get(target.file);
    if (!facts) throw new Error(`the TypeScript facts carry no record for ${target.file}`);
    findings.push(
      ...ruleA(target.file, facts, inspection.undecided),
      ...ruleB(inspection, target),
      ...ruleC(inspection, target),
      ...ruleD(inspection, target),
    );
  }
  findings.push(...ruleG(inspection));
  for (const pkg of new Map(inspection.targets.map((target) => [target.pkg.root, target.pkg])).values()) {
    api.checkBudget();
    findings.push(...ruleDomainPackaging(inspection, pkg));
  }
  if (inspection.undecided.items.length > 0)
    throw new ToolUnavailableError(
      `the TypeScript domain rules cannot decide ${inspection.undecided.items.join("; ")}`,
    );
  const noteParts = [...[...inspection.notes].sort(), ...(assembled.note ? [assembled.note] : [])];
  return { findings: dedupe(findings), ...(noteParts.length > 0 ? { note: noteParts.join("; ") } : {}) };
}
