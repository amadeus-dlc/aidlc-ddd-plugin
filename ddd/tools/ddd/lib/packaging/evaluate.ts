import { join } from "node:path";
import type { InspectionContext, InspectionTarget } from "../rules/types.ts";
import { finding, relPath } from "../sensors/common.ts";
import { readModel } from "../sensors/declaration.ts";
import type { FindingInput } from "../shared/findings.ts";
import { checkPackageDeclarations, crateParts, moduleParts, packageKey, technicalName } from "./declarations.ts";
import { inspectModules } from "./rust-modules.ts";

export function evaluateDomainPackaging(target: InspectionTarget, context: InspectionContext): FindingInput[] {
  const crate = context.assignments.find((entry) => entry.crate_name === target.crate_name);
  if (crate?.layer !== "domain") return [];
  const findings: FindingInput[] = [];
  const inventory =
    context.program.moduleInventories.get(crate.crate_name) ??
    inspectModules(context.analyzer, context.workspace.root_path, crate);
  const crateName = technicalName(crateParts(crate.crate_name));
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
  const path = join(context.run.record_dir, "inception/domain-design/ddd-aggregate-mapping.md");
  const file = relPath(context.run, path);
  const mapping = context.aggregateMapping;
  if (!mapping?.ok)
    return [
      ...findings,
      finding("domain-packaging.declaration", file, "a readable aggregate mapping with domain_packages is required"),
    ];
  const loaded = readModel(context.run.record_dir, mapping.document.model_ref);
  if (!loaded.ok)
    return [...findings, finding("domain-packaging.reference", file, "domain_packages model_ref could not be loaded")];
  const invalid = checkPackageDeclarations(mapping.document, file, loaded.index, new Set([crate.crate_name]));
  if (invalid.length > 0) return [...findings, ...invalid];
  const declared = new Set(
    (mapping.document.domain_packages ?? []).map((entry) => packageKey(entry.crate, moduleParts(entry.module) ?? [])),
  );
  for (const module of validModules) {
    if (!declared.has(packageKey(crate.crate_name, module.parts)))
      findings.push(
        finding(
          "domain-packaging.coverage",
          module.file,
          `domain package ${crate.crate_name}/${module.parts.join("::") || "crate"} has no term/model declaration`,
          module.line,
        ),
      );
  }
  return findings;
}
