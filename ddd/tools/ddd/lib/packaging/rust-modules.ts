import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { type AnalyzerRuntime, moduleLayout, parse } from "../rust/analyzer.ts";
import type { CrateLayerAssignment } from "../workspace/resolver.ts";

export interface DomainModule {
  parts: string[];
  physical: string[];
  file: string;
  line: number;
}
export interface ModuleInventory {
  modules: DomainModule[];
  sources: { file: string; path: string; parts: string[] }[];
  files: Set<string>;
  problems: { file: string; line: number; reason: string }[];
}
const AUXILIARY = new Set(["tests", "benches", "examples", "vendor", "target"]);
const posix = (path: string) => path.split(sep).join("/");
function inside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`));
}

/** Follow Rust mod declarations from this crate's lib/bin roots, never from unrelated crates. */
export function inspectModules(
  runtime: AnalyzerRuntime,
  workspace: string,
  crate: CrateLayerAssignment,
): ModuleInventory {
  const workspaceRoot = realpathSync(workspace);
  const root = realpathSync(join(workspace, crate.path));
  const inventory: ModuleInventory = { modules: [], sources: [], files: new Set(), problems: [] };
  const location = (path: string) => posix(relative(workspaceRoot, path));
  const physical = (path: string) =>
    posix(relative(root, path))
      .split("/")
      .filter((part) => part !== "src")
      .map((part) => part.replace(/\.rs$/, ""))
      .filter((part) => !["lib", "main", "mod"].includes(part));
  const problem = (file: string, line: number, reason: string) =>
    inventory.problems.push({ file: location(file), line, reason });

  function visit(path: string, namespace: string[], stack: Set<string>, ownsDirectory = false): void {
    let actual: string;
    try {
      actual = realpathSync(path);
      if (!inside(root, actual) || !statSync(actual).isFile())
        throw new Error("module is outside its crate or is not a file");
      if (stack.has(actual)) throw new Error("cyclic module path");
    } catch (error) {
      problem(path, 1, error instanceof Error ? error.message : String(error));
      return;
    }
    const segments = posix(relative(root, actual)).split("/");
    if (segments.some((part) => AUXILIARY.has(part))) return;
    inventory.files.add(location(path));
    inventory.files.add(location(actual));
    const tree = parse(runtime, location(actual), readFileSync(actual));
    const layout = moduleLayout(tree);
    if (layout.auxiliary) return;
    inventory.sources.push({ file: location(path), path: actual, parts: namespace });
    inventory.modules.push({ parts: namespace, physical: physical(actual), file: location(path), line: 1 });
    if (tree.has_parse_error) {
      problem(path, 1, "Rust module could not be parsed");
      return;
    }
    for (const span of layout.opaque)
      problem(path, span.start_line, "item macro may declare modules; expansion is not available");
    const nextStack = new Set(stack).add(actual);
    const childBase =
      ownsDirectory || basename(actual) === "mod.rs" ? dirname(actual) : join(dirname(actual), basename(actual, ".rs"));
    const bases = new Map<string, string>([["", childBase]]);
    for (const mod of layout.modules) {
      if (mod.auxiliary) continue;
      const scope = mod.module_path.join("::");
      const base = bases.get(scope);
      if (!base || mod.local || mod.unresolved_path) {
        problem(path, mod.span.start_line, "module scope or path attribute cannot be resolved");
        continue;
      }
      const parts = [...namespace, ...mod.module_path, mod.name];
      let destination: string;
      if (mod.path !== undefined) destination = resolve(scope === "" ? dirname(actual) : base, mod.path);
      else destination = join(base, mod.name);
      if (!inside(root, destination)) {
        problem(path, mod.span.start_line, "module path escapes the crate");
        continue;
      }
      inventory.modules.push({
        parts,
        physical: physical(destination),
        file: location(path),
        line: mod.span.start_line,
      });
      if (mod.inline) {
        bases.set([...mod.module_path, mod.name].join("::"), destination);
        continue;
      }
      const candidates = mod.path !== undefined ? [destination] : [`${destination}.rs`, join(destination, "mod.rs")];
      const existing = candidates.filter((candidate) => existsSync(candidate));
      if (existing.length !== 1) {
        problem(path, mod.span.start_line, "external module needs exactly one source file");
        continue;
      }
      visit(existing[0], parts, nextStack, mod.path !== undefined);
    }
  }
  for (const target of crate.targets) {
    if (target.kind === "lib" || target.kind === "bin") visit(join(root, target.src_path), [], new Set(), true);
  }
  return inventory;
}
