/**
 * The Cargo boundary of the business-error contract. One build condition is
 * resolved here and handed on already decided; nothing below this file asks
 * Cargo again.
 */

import { relative, sep } from "node:path";
import type { CargoCondition, CargoPackage, CargoTarget, DependencyRename, Issue } from "../../error-contract/index.ts";

export interface CargoConditionOptions {
  readonly manifestPath: string;
  readonly targetTriple: string;
  readonly features: readonly string[];
}
export type CargoConditionResolution =
  | { readonly kind: "resolved"; readonly condition: CargoCondition }
  | { readonly kind: "unavailable"; readonly reasons: readonly Issue[] };

/**
 * The one target an inspection can enter. Resolution starts from a package's
 * library crate root, so a binary, test or example target is not inspected.
 */
const INSPECTED_KIND = "lib";

function unavailable(message: string): CargoConditionResolution {
  return {
    kind: "unavailable",
    reasons: [{ code: "tool-unavailable", subject: "cargo-metadata", message, location: null }],
  };
}

function table(value: unknown, subject: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${subject}: expected an object`);
  return value as Record<string, unknown>;
}
function list(value: unknown, subject: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${subject}: expected an array`);
  return value;
}
function text(value: unknown, subject: string): string {
  if (typeof value !== "string" || !value.length) throw new Error(`${subject}: expected a nonempty string`);
  return value;
}

function projectRelative(workspaceRoot: string, absolute: string, subject: string): string {
  const path = relative(workspaceRoot, absolute).split(sep).join("/");
  if (!path.length || path.startsWith("../")) throw new Error(`${subject}: source is outside the workspace`);
  return path;
}

function cargoTargets(pkg: Record<string, unknown>, workspaceRoot: string): CargoTarget[] {
  const targets: CargoTarget[] = [];
  for (const entry of list(pkg.targets, "package.targets")) {
    const item = table(entry, "package.targets[]");
    const kinds = list(item.kind, "package.targets[].kind").map((kind) => text(kind, "package.targets[].kind[]"));
    if (!kinds.includes(INSPECTED_KIND)) continue;
    if (kinds.length !== 1) throw new Error("a Cargo target with more than one kind is outside this condition");
    targets.push({
      kind: kinds[0],
      name: text(item.name, "package.targets[].name"),
      srcPath: projectRelative(
        workspaceRoot,
        text(item.src_path, "package.targets[].src_path"),
        "package.targets[].src_path",
      ),
    });
  }
  return targets;
}

function dependencyRenames(pkg: Record<string, unknown>, node: Record<string, unknown>): DependencyRename[] {
  const externNames = new Map<string, string>();
  for (const entry of list(node.deps ?? [], "resolve.nodes[].deps")) {
    const item = table(entry, "resolve.nodes[].deps[]");
    externNames.set(text(item.name, "resolve.nodes[].deps[].name"), text(item.pkg, "resolve.nodes[].deps[].pkg"));
  }
  const renames = new Map<string, string>();
  for (const entry of list(pkg.dependencies, "package.dependencies")) {
    const item = table(entry, "package.dependencies[]");
    if (typeof item.rename !== "string" || !item.rename.length) continue;
    const packageId = externNames.get(item.rename);
    if (!packageId) throw new Error(`renamed dependency ${item.rename} is not in the resolve graph`);
    renames.set(item.rename, packageId);
  }
  return [...renames].map(([alias, packageId]) => ({ alias, packageId })).sort((a, b) => (a.alias < b.alias ? -1 : 1));
}

function condition(raw: unknown, targetTriple: string): CargoCondition {
  const metadata = table(raw, "metadata");
  const workspaceRoot = text(metadata.workspace_root, "metadata.workspace_root");
  const owned = new Set(
    list(metadata.workspace_members, "metadata.workspace_members").map((id) =>
      text(id, "metadata.workspace_members[]"),
    ),
  );
  const nodes = new Map<string, Record<string, unknown>>();
  for (const entry of list(table(metadata.resolve, "metadata.resolve").nodes, "metadata.resolve.nodes")) {
    const item = table(entry, "metadata.resolve.nodes[]");
    nodes.set(text(item.id, "metadata.resolve.nodes[].id"), item);
  }
  const packages: CargoPackage[] = [];
  for (const entry of list(metadata.packages, "metadata.packages")) {
    const pkg = table(entry, "metadata.packages[]");
    const packageId = text(pkg.id, "metadata.packages[].id");
    if (!owned.has(packageId)) continue;
    // A package with no inspected target offers no crate root, so the condition
    // leaves it out instead of recording a package no inspection can enter.
    const targets = cargoTargets(pkg, workspaceRoot);
    if (!targets.length) continue;
    const node = nodes.get(packageId);
    if (!node) throw new Error(`the resolve graph has no node for ${packageId}`);
    packages.push({
      packageId,
      name: text(pkg.name, "metadata.packages[].name"),
      edition: text(pkg.edition, "metadata.packages[].edition"),
      targets,
      features: list(node.features, "resolve.nodes[].features")
        .map((feature) => text(feature, "resolve.nodes[].features[]"))
        .sort(),
      dependencyRenames: dependencyRenames(pkg, node),
    });
  }
  if (!packages.length) throw new Error("the workspace owns no inspected package");
  packages.sort((a, b) => (a.packageId < b.packageId ? -1 : 1));
  return { targetTriple, packages };
}

export async function resolveCargoCondition(options: CargoConditionOptions): Promise<CargoConditionResolution> {
  // --frozen forbids writing the lockfile and fetching, so inspection never prepares dependencies.
  const command = [
    "cargo",
    "metadata",
    "--format-version",
    "1",
    "--frozen",
    "--manifest-path",
    options.manifestPath,
    "--filter-platform",
    options.targetTriple,
    ...(options.features.length ? ["--features", options.features.join(",")] : []),
  ];
  const child = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
  const [stdout, diagnostic, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0) return unavailable(`cargo metadata exited with ${code}: ${diagnostic.trim()}`);
  try {
    return { kind: "resolved", condition: condition(JSON.parse(stdout), options.targetTriple) };
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : String(error));
  }
}
