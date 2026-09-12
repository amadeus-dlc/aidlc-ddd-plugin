/**
 * InspectionContext assembly (U5 WF1) — turns a run context into the facts the
 * rule evaluators consume.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { readSourceClaims, readStageStatus, type SensorRunContext } from "../runtime/context.ts";
import type { AnalyzerRuntime } from "../rust/analyzer.ts";
import { parse } from "../rust/analyzer.ts";
import { MODEL_DATA_PATH } from "../schema/artifacts.ts";
import { loadDomainModel } from "../schema/loader.ts";
import { finding, relPath } from "../sensors/common.ts";
import { parseDeclaration } from "../sensors/declaration.ts";
import type { FindingInput } from "../shared/findings.ts";
import { assignLayers, classifyFile, type Layer, scanWorkspace } from "../workspace/resolver.ts";
import { IO_CRATES } from "./lists.ts";
import { buildEdges } from "./rust/edges.ts";
import { buildProgram } from "./rust/program.ts";
import { buildSymbolTable } from "./rust/symbols.ts";
import type { InspectionContext, InspectionTarget, ModelAvailability } from "./types.ts";

export interface SensorConfig {
  sensor_id: string;
  target_layers: readonly Layer[];
  includes_query_side: boolean;
  report_layer_diagnostics?: boolean;
}

export type ContextResult =
  | { kind: "empty"; note: string }
  | { kind: "failed"; findings: FindingInput[]; note?: string }
  | { kind: "ready"; context: InspectionContext; findings: FindingInput[]; note?: string };

function findWorkspaceRoot(filePath: string): { root: string; isWorkspace: boolean } | undefined {
  let current = dirname(filePath);
  let packageCandidate: string | undefined;
  for (let i = 0; i < 50; i++) {
    const cargo = join(current, "Cargo.toml");
    if (existsSync(cargo)) {
      try {
        const parsed = Bun.TOML.parse(readFileSync(cargo, "utf-8")) as Record<string, unknown>;
        if (parsed.workspace !== undefined) return { root: current, isWorkspace: true };
        if (parsed.package !== undefined && packageCandidate === undefined) packageCandidate = current;
      } catch {
        /* ignore */
      }
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return packageCandidate ? { root: packageCandidate, isWorkspace: false } : undefined;
}

export function assembleContext(runtime: AnalyzerRuntime, run: SensorRunContext, config: SensorConfig): ContextResult {
  const claimsResult = readSourceClaims(run, { extensions: [".rs"] });
  if (!claimsResult.ok) {
    return { kind: "failed", findings: [finding("runtime.claims", ".", claimsResult.reason)] };
  }
  const findings: FindingInput[] = [...claimsResult.findings];
  const rustClaims = claimsResult.claims.filter((claim) => !claim.repo || claim.repo.length > 0);
  if (rustClaims.length === 0) return { kind: "empty", note: "no rust sources claimed" };

  const roots = new Map<string, string[]>();
  for (const claim of rustClaims) {
    if (!claim.resolved_path) continue;
    const found = findWorkspaceRoot(claim.resolved_path);
    if (!found) {
      findings.push(
        finding("layer.unowned", relPath(run, claim.resolved_path), "claimed file has no Cargo workspace root"),
      );
      continue;
    }
    const root = found.root;
    if (!root.startsWith(run.workspace_root)) {
      findings.push(
        finding("layer.unowned", relPath(run, claim.resolved_path), "workspace root is outside the project root"),
      );
      continue;
    }
    const list = roots.get(root) ?? [];
    list.push(claim.path);
    roots.set(root, list);
  }
  if (roots.size === 0) return { kind: "failed", findings };

  const [workspaceRoot, rootClaims] = [...roots.entries()].sort((a, b) => a[0].localeCompare(b[0], "en"))[0];
  if (roots.size > 1) {
    findings.push(
      finding("workspace.multiple-roots", workspaceRoot, "claimed files span more than one Cargo workspace root"),
    );
  }

  const workspace = scanWorkspace(workspaceRoot);
  const assignments = assignLayers(workspace);

  // Model availability (BR3.4).
  const status = readStageStatus(run, "ddd-domain-modeling");
  let model: ModelAvailability;
  if (status.execution === "SKIP" || status.execution === "absent") {
    model = {
      status: status.execution === "SKIP" ? "skipped" : "absent",
      note: `domain-modeling is ${status.execution}; model-dependent checks (b, h, c-model, n-model) skipped`,
    };
  } else {
    const modelPath = join(run.record_dir, MODEL_DATA_PATH);
    const loaded = loadDomainModel(modelPath);
    if (!loaded.ok) {
      model = { status: "invalid" };
      findings.push(
        finding(
          "model.invalid",
          relPath(run, modelPath),
          "domain-modeling ran but ddd-domain-model-yaml.md did not load",
        ),
      );
    } else {
      model = { status: "available", index: loaded.index };
    }
  }

  const program = buildProgram(runtime, workspaceRoot, assignments);
  const mappingPath = join(run.record_dir, "inception/domain-design/ddd-aggregate-mapping.md");
  const mapping = existsSync(mappingPath) ? parseDeclaration(mappingPath, "aggregate-mapping") : undefined;
  if (mapping && !mapping.ok) program.notes.add("replay.disabled: aggregate mapping is invalid");
  const symbols = buildSymbolTable(program, model, mapping?.ok ? mapping.document.aggregate_mappings : []);

  const targets: InspectionTarget[] = [];
  const skipped: InspectionTarget[] = [];
  const opaque: string[] = [];
  const claimByPath = new Map(rustClaims.filter((c) => c.resolved_path).map((c) => [c.resolved_path as string, c]));

  for (const [root, paths] of [[workspaceRoot, rootClaims]] as [string, string[]][]) {
    for (const claimPath of paths.sort((a, b) => a.localeCompare(b, "en"))) {
      const claim = claimByPath.get(join(root, claimPath)) ?? rustClaims.find((c) => c.path === claimPath);
      if (!claim?.resolved_path) continue;
      const file = claim.path;
      const classification = classifyFile(assignments, file);
      const target: InspectionTarget = { claim, classification };
      if (classification.crate_name) target.crate_name = classification.crate_name;
      const inLayer = config.target_layers.includes(classification.effective_layer as Layer);
      const querySide = config.includes_query_side && classification.cqrs_side === "query";
      if (classification.role === "crate-source" && (inLayer || querySide)) {
        try {
          const tree = parse(runtime, file, readFileSync(join(root, file)));
          target.tree = tree;
          for (const region of tree.opaque_regions) {
            opaque.push(
              `analyzer.macro-opaque: ${region.file}:${region.span.start_line} (${region.macro_name ?? region.reason})`,
            );
          }
        } catch {
          /* unreadable file is skipped */
        }
        targets.push(target);
      } else {
        skipped.push(target);
      }
    }
  }

  const edges = buildEdges(targets, assignments, workspaceRoot, IO_CRATES);
  const layerDiagnostics = [
    ...workspace.diagnostics.map((d) => ({ code: d.code, file: d.file, message: d.message })),
    ...assignments.flatMap((a) => a.diagnostics.map((d) => ({ code: d.code, file: d.file, message: d.message }))),
  ];

  const noteParts: string[] = [];
  if (skipped.length > 0) noteParts.push(`${skipped.length} files outside ${config.target_layers.join("/")}`);
  if (opaque.length > 0) noteParts.push(...opaque);
  if (model.note) noteParts.push(model.note);

  const context: InspectionContext = {
    analyzer: runtime,
    aggregateMapping: mapping,
    run,
    workspace,
    assignments,
    targets,
    skipped,
    symbols,
    program,
    model,
    denylist: IO_CRATES,
    opaque,
    edges,
    layerDiagnostics,
    targetLayers: config.target_layers,
    includesQuerySide: config.includes_query_side,
  };
  if (targets.length === 0 && findings.length === 0) {
    return { kind: "empty", note: "no rust sources claimed" };
  }
  return { kind: "ready", context, findings, ...(noteParts.length > 0 ? { note: noteParts.join("; ") } : {}) };
}
