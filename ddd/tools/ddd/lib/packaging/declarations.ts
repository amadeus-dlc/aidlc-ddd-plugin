import type { ElementIndex } from "../schema/index-builder.ts";
import { finding } from "../sensors/common.ts";
import type { DeclarationDocument } from "../sensors/declaration.ts";
import type { FindingInput } from "../shared/findings.ts";

export const TECHNICAL_PACKAGE_NAMES = new Set([
  "aggregate",
  "aggregates",
  "impl",
  "impls",
  "implementation",
  "implementations",
  "vo",
  "vos",
  "entity",
  "entities",
  "value_object",
  "value_objects",
  "valueobject",
  "valueobjects",
]);

export function moduleParts(module: string): string[] | undefined {
  const parts = module.split("::").map((part) => part.replace(/^r#/, ""));
  if (!parts.every((part) => /^[A-Za-z_]\w*$/.test(part))) return undefined;
  if (parts[0] === "crate") parts.shift();
  return parts;
}

export function technicalName(parts: readonly string[]): string | undefined {
  return parts.find((part) => TECHNICAL_PACKAGE_NAMES.has(part.replace(/^r#/, "").toLowerCase()));
}

export function crateParts(crate: string): string[] {
  const business = crate.toLowerCase().replace(/(?:-|_)domain$/, "");
  return [business.replace(/-/g, "_"), ...business.split(/[-_]/)];
}

export function packageKey(crate: string, parts: readonly string[]): string {
  return `${crate}:${parts.join("::")}`;
}

/** Shared structural checks; semantic fitness of the term remains a review. */
export function checkPackageDeclarations(
  document: DeclarationDocument,
  file: string,
  index?: ElementIndex,
  onlyCrates?: ReadonlySet<string>,
): FindingInput[] {
  const packages = document.domain_packages;
  if (!packages) return [finding("domain-packaging.declaration", file, "domain_packages is required")];
  const entries = packages.filter((entry) => !onlyCrates || onlyCrates.has(entry.crate));
  const findings: FindingInput[] = [];
  const declared = new Set<string>();
  for (const entry of entries) {
    const parts = moduleParts(entry.module);
    if (!/^[A-Za-z][\w-]*$/.test(entry.crate) || !parts) {
      findings.push(
        finding(
          "domain-packaging.declaration",
          file,
          `package ${entry.crate}/${entry.module} requires crate, module, term, model_refs and rationale`,
          entry.line,
        ),
      );
      continue;
    }
    const key = packageKey(entry.crate, parts);
    if (declared.has(key))
      findings.push(finding("domain-packaging.duplicate", file, `duplicate package ${key}`, entry.line));
    declared.add(key);
    if (!entry.term.trim() || !entry.rationale.trim() || entry.model_refs.length === 0)
      findings.push(
        finding(
          "domain-packaging.declaration",
          file,
          `package ${key} requires term, model_refs and rationale`,
          entry.line,
        ),
      );
    const banned = technicalName([...crateParts(entry.crate), ...parts]);
    if (banned || entry.crate === "domain")
      findings.push(
        finding(
          "domain-packaging.technical-name",
          file,
          `package ${key} uses technical classification ${banned ?? "domain"}`,
          entry.line,
        ),
      );
    if (index)
      for (const ref of entry.model_refs) {
        const resolved = index.resolve(ref);
        if (!resolved.ok)
          findings.push(
            finding(
              "domain-packaging.reference",
              file,
              `package ${key} references ${ref}: ${resolved.reason}`,
              entry.line,
            ),
          );
      }
  }
  const required = new Set(
    onlyCrates ?? [...document.aggregate_mappings.map((entry) => entry.crate), ...entries.map((entry) => entry.crate)],
  );
  for (const crate of required) {
    if (!declared.has(packageKey(crate, [])))
      findings.push(
        finding("domain-packaging.coverage", file, `crate ${crate} needs a root package declaration (module: crate)`),
      );
  }
  for (const entry of entries) {
    const parts = moduleParts(entry.module);
    if (!parts) continue;
    for (let length = 1; length < parts.length; length++) {
      const parent = packageKey(entry.crate, parts.slice(0, length));
      if (!declared.has(parent))
        findings.push(
          finding("domain-packaging.coverage", file, `package parent ${parent} is not declared`, entry.line),
        );
    }
  }
  for (const mapping of document.aggregate_mappings) {
    if (onlyCrates && !onlyCrates.has(mapping.crate)) continue;
    const parts = moduleParts(mapping.module);
    if (!parts || !declared.has(packageKey(mapping.crate, parts)))
      findings.push(
        finding(
          "domain-packaging.coverage",
          file,
          `aggregate mapping ${mapping.aggregate_ref} has no package declaration for ${mapping.crate}/${mapping.module}`,
        ),
      );
  }
  return findings;
}
