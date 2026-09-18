/**
 * Domain packaging for the Rust code gate: every module the inspected crate reaches has a business
 * package declared for it, and no name below it is a technical classification.
 *
 * Whether the mapping itself is sound is the mapping reader's decision, not this one's. A mapping
 * the reader refuses yields no packages at all, and its findings are reported here under the rule
 * ids this gate already declares, so the same defect is never judged twice by two checks.
 */

import { join } from "node:path";
import { mappingPathOf } from "../rules/rust/mapping.ts";
import type { InspectionContext, InspectionTarget } from "../rules/types.ts";
import { finding, relPath } from "../sensors/common.ts";
import type { FindingInput } from "../shared/findings.ts";
import { packageKey, packageWord, technicalName } from "./declarations.ts";
import { inspectModules } from "./rust-modules.ts";

/** Which rule of this gate reports a refusal the mapping reader made. */
function transcribedRule(ruleId: string): string {
  if (ruleId === "aggregate-mapping.model") return "domain-packaging.reference";
  if (ruleId === "aggregate-mapping.technical-name") return "domain-packaging.technical-name";
  return "domain-packaging.declaration";
}

export function evaluateDomainPackaging(target: InspectionTarget, context: InspectionContext): FindingInput[] {
  const crate = context.assignments.find((entry) => entry.crate_name === target.crate_name);
  if (crate?.layer !== "domain") return [];
  const findings: FindingInput[] = [];
  const inventory =
    context.program.moduleInventories.get(crate.crate_name) ??
    inspectModules(context.analyzer, context.workspace.root_path, crate);
  const crateName = technicalName([packageWord(crate.crate_name)]);
  if (crateName || crate.crate_name === "domain")
    findings.push(
      finding(
        "domain-packaging.technical-name",
        join(crate.path, "Cargo.toml"),
        `crate name uses technical classification ${crateName ?? "domain"}`,
      ),
    );
  const validModules = [];
  for (const module of inventory.modules) {
    const banned = technicalName([...module.parts, ...module.physical]);
    if (banned)
      findings.push(
        finding(
          "domain-packaging.technical-name",
          module.file,
          `domain package ${module.parts.join("::") || "crate"} uses technical classification ${banned}`,
          module.line,
        ),
      );
    else validModules.push(module);
  }
  for (const issue of inventory.problems)
    findings.push(finding("domain-packaging.unresolved", issue.file, issue.reason, issue.line));
  for (const claim of context.targets.filter((entry) => entry.crate_name === crate.crate_name)) {
    if (claim.claim.path.endsWith(".rs") && !inventory.files.has(claim.claim.path))
      findings.push(
        finding(
          "domain-packaging.unresolved",
          claim.claim.path,
          "claimed Rust file is not reachable from this crate's module roots",
        ),
      );
  }
  const file = relPath(context.run, mappingPathOf(context.run.record_dir));
  const mapping = context.rustMapping;
  if (mapping.kind === "absent")
    return [
      ...findings,
      finding("domain-packaging.declaration", file, "a readable aggregate mapping with domain_packages is required"),
    ];
  if (mapping.kind === "invalid")
    return [
      ...findings,
      ...mapping.findings.map((entry) =>
        finding(transcribedRule(entry.rule_id), file, `${entry.rule_id}: ${entry.message}`),
      ),
    ];
  // The raw prefix only lets a keyword be spelled, so it never distinguishes two modules here.
  const declared = new Set(
    mapping.view.packages.map((entry) =>
      packageKey(
        entry.crate,
        entry.module.map((segment) => segment.replace(/^r#/, "")),
      ),
    ),
  );
  if (!declared.has(packageKey(crate.crate_name, [])))
    findings.push(
      finding("domain-packaging.coverage", file, `crate ${crate.crate_name} needs a root package declaration`),
    );
  for (const module of validModules) {
    if (module.parts.length === 0) continue;
    if (!declared.has(packageKey(crate.crate_name, module.parts)))
      findings.push(
        finding(
          "domain-packaging.coverage",
          module.file,
          `domain package ${crate.crate_name}/${module.parts.join("::")} has no term/model declaration`,
          module.line,
        ),
      );
  }
  return findings;
}
