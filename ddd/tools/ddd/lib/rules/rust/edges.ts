/**
 * DependencyEdge builder (U5 BR6.1) — from `use` paths and Cargo dependencies,
 * with U2 isAllowed and the I/O denylist attaching the verdict.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { uses } from "../../rust/analyzer.ts";
import { type CrateLayerAssignment, isAllowed } from "../../workspace/resolver.ts";
import { type ExternalCrateRule, matchesIoRule } from "../lists.ts";
import type { DependencyEdge, InspectionTarget } from "../types.ts";

const LOCAL_SEGMENTS = new Set(["crate", "self", "super", "std", "core", "alloc"]);

function normalize(crateName: string): string {
  return crateName.replace(/_/g, "-");
}

export function buildEdges(
  targets: readonly InspectionTarget[],
  assignments: readonly CrateLayerAssignment[],
  workspaceRoot: string,
  denylist: readonly ExternalCrateRule[],
): DependencyEdge[] {
  const byName = new Map(assignments.map((assignment) => [assignment.crate_name, assignment]));
  const memberNames = new Set(assignments.map((assignment) => normalize(assignment.crate_name)));
  const edges: DependencyEdge[] = [];

  const verdictFor = (from: CrateLayerAssignment, to: CrateLayerAssignment): DependencyEdge["verdict"] => {
    const result = isAllowed(from, to);
    return result.reason === "ok" ? "ok" : result.reason;
  };

  for (const target of targets) {
    if (!target.tree || !target.crate_name) continue;
    const from = byName.get(target.crate_name);
    if (!from) continue;
    for (const use of uses(target.tree)) {
      const first = use.first_segment;
      if (LOCAL_SEGMENTS.has(first)) continue;
      if (memberNames.has(normalize(first))) {
        const to = byName.get(first) ?? byName.get(normalize(first));
        if (to) {
          edges.push({
            from_crate: from.crate_name,
            to_crate: to.crate_name,
            evidence: "use-path",
            file: use.file,
            line: use.span.start_line,
            verdict: verdictFor(from, to),
          });
        }
        continue;
      }
      const io = matchesIoRule(normalize(first), denylist);
      if (io) {
        edges.push({
          from_crate: from.crate_name,
          to_crate: first,
          evidence: "use-path",
          file: use.file,
          line: use.span.start_line,
          verdict: from.layer === "domain" || from.layer === "use-case" ? "external-io" : "ok",
        });
      }
    }
  }

  // Cargo internal dependencies (file = the from crate's Cargo.toml).
  const fromCrates = new Set(
    targets.map((target) => target.crate_name).filter((name): name is string => name !== undefined),
  );
  for (const crateName of fromCrates) {
    const from = byName.get(crateName);
    if (!from) continue;
    const cargoToml = from.path === "." ? "Cargo.toml" : `${from.path}/Cargo.toml`;
    const deps = cargoInternalDependencies(workspaceRoot, from.path);
    for (const dep of deps) {
      const to = byName.get(dep);
      if (!to) continue;
      const already = edges.some(
        (edge) =>
          edge.from_crate === from.crate_name && edge.to_crate === to.crate_name && edge.evidence === "use-path",
      );
      if (already) continue;
      edges.push({
        from_crate: from.crate_name,
        to_crate: to.crate_name,
        evidence: "cargo-dependency",
        file: cargoToml,
        verdict: verdictFor(from, to),
      });
    }
  }

  edges.sort((a, b) => {
    const byFile = a.file.localeCompare(b.file, "en");
    if (byFile !== 0) return byFile;
    const byLine = (a.line ?? 0) - (b.line ?? 0);
    if (byLine !== 0) return byLine;
    return a.to_crate.localeCompare(b.to_crate, "en");
  });
  return edges;
}

function cargoInternalDependencies(workspaceRoot: string, cratePath: string): string[] {
  const path = join(workspaceRoot, cratePath === "." ? "Cargo.toml" : `${cratePath}/Cargo.toml`);
  if (!existsSync(path)) return [];
  try {
    const parsed = Bun.TOML.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
    const names: string[] = [];
    for (const section of ["dependencies", "dev-dependencies", "build-dependencies"]) {
      const deps = parsed[section];
      if (typeof deps !== "object" || deps === null) continue;
      for (const [name, value] of Object.entries(deps as Record<string, unknown>)) {
        const spec = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
        if (spec?.path !== undefined) names.push(name);
      }
    }
    return names;
  } catch {
    return [];
  }
}
