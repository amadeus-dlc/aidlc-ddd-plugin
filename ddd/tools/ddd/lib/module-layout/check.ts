import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";
import { inspectModules } from "../packaging/rust-modules.ts";
import type { AnalyzerRuntime } from "../rust/analyzer.ts";
import { finding } from "../sensors/common.ts";
import type { FindingInput } from "../shared/findings.ts";
import { scanWorkspace } from "../workspace/resolver.ts";

export type ModuleLayout = "file" | "mod-rs";
const EXCLUDED = new Set(["node_modules", "target", "vendor", "dist", "aidlc"]);
const posix = (path: string) => path.split(sep).join("/");
const within = (root: string, path: string) => {
  const rel = relative(root, path);
  return !isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`);
};
export interface LayoutResult {
  findings: FindingInput[];
  crates: number;
  files: number;
  mode?: ModuleLayout;
}

/** Whole-project check: no source claims, model, layer assignment, or edition-based style inference. */
export function checkModuleLayout(
  runtime: AnalyzerRuntime,
  project: string,
  checkBudget: () => void = () => {},
): LayoutResult {
  const root = realpathSync(project);
  if (!statSync(root).isDirectory()) throw new Error("project must be a directory");
  const result: LayoutResult = { findings: [], crates: 0, files: 0 };
  const report = (rule: string, file: string, message: string, line?: number) =>
    result.findings.push(finding(`module-layout.${rule}`, posix(relative(root, file)) || ".", message, line));
  const manifests: string[] = [];
  const sources: string[] = [];
  function discover(directory: string): void {
    checkBudget();
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === ".ddd.toml" && directory !== root)
        report(
          "configuration",
          join(directory, entry.name),
          "nested layout configuration is not allowed; use the project-root .ddd.toml",
        );
      if (entry.name.startsWith(".") || EXCLUDED.has(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        report("unresolved", path, "symbolic links in the inspected project are not supported");
      } else if (entry.isDirectory()) discover(path);
      else if (entry.isFile()) {
        if (entry.name === "Cargo.toml") manifests.push(path);
        if (entry.name.endsWith(".rs")) sources.push(path);
      }
    }
  }
  discover(root);
  const configPath = join(root, ".ddd.toml");
  if (manifests.length === 0 && sources.length === 0 && !existsSync(configPath)) return result;
  try {
    const config = Bun.TOML.parse(readFileSync(configPath, "utf8"));
    const rust = config.rust as Record<string, unknown> | undefined;
    if (
      config.schema_version !== 1 ||
      !rust ||
      Object.keys(config).some((key) => !["schema_version", "rust"].includes(key)) ||
      Object.keys(rust).some((key) => key !== "module_layout") ||
      typeof rust.module_layout !== "string" ||
      !["file", "mod-rs"].includes(rust.module_layout)
    )
      throw new Error(
        'expected schema_version = 1 and [rust] module_layout = "file" or "mod-rs"; no overrides or mixed mode',
      );
    result.mode = rust.module_layout as ModuleLayout;
  } catch (error) {
    report(
      "configuration",
      configPath,
      `Choose one project-wide layout in .ddd.toml: ${error instanceof Error ? error.message : String(error)}`,
    );
    return result;
  }
  const covered = new Set<string>();
  const crates = new Set<string>();
  for (const manifest of manifests.sort()) {
    checkBudget();
    const directory = dirname(manifest);
    const workspace = scanWorkspace(directory);
    for (const diagnostic of workspace.diagnostics)
      report("unresolved", join(directory, diagnostic.file), diagnostic.message);
    for (const crate of workspace.members) {
      const path = realpathSync(join(directory, crate.path));
      if (!within(root, path)) {
        report("unresolved", manifest, "Cargo member is outside the inspected project");
        continue;
      }
      if (crates.has(path)) continue;
      crates.add(path);
      result.crates++;
      if (crate.targets.length === 0)
        report("unresolved", join(path, "Cargo.toml"), "Cargo package has no inspectable targets");
      const inventory = inspectModules(
        runtime,
        root,
        {
          crate_name: crate.name,
          path: relative(root, path),
          targets: crate.targets,
          layer: "unknown",
          layer_source: "none",
          cqrs_side: "none",
          cqrs_source: "none",
          is_composition_root: false,
          diagnostics: [],
        },
        { includeAuxiliary: true, checkBudget },
      );
      for (const issue of inventory.problems) report("unresolved", join(root, issue.file), issue.reason, issue.line);
      for (const source of inventory.sources) {
        covered.add(source.path);
        if (source.root) continue;
        const moduleName = source.parts.at(-1);
        const isMod = basename(source.path) === "mod.rs";
        const useMod = result.mode === "mod-rs" && source.hasChildren;
        const correctName = useMod
          ? isMod && basename(dirname(source.path)) === moduleName
          : basename(source.path) === `${moduleName}.rs`;
        if (!correctName) {
          const parent = isMod ? dirname(dirname(source.path)) : dirname(source.path);
          const expected = useMod ? join(parent, moduleName ?? "", "mod.rs") : join(parent, `${moduleName}.rs`);
          report(
            "violation",
            source.path,
            `${result.mode} layout requires ${posix(relative(root, expected))}; move this module and update its mod/path declarations, preserving child resolution`,
          );
        }
      }
    }
  }
  for (const source of sources) {
    if (!covered.has(source))
      report(
        "unresolved",
        source,
        "Rust source is not reachable from a Cargo target; register it or remove the stale file",
      );
  }
  result.files = covered.size;
  if (result.crates === 0 && manifests.length === 0)
    report("unresolved", root, "No Cargo project found for the configured Rust module check");
  const seen = new Set<string>();
  result.findings = result.findings.filter((entry) => {
    const key = `${entry.rule_id}:${entry.file}:${entry.line ?? 0}:${entry.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return result;
}
