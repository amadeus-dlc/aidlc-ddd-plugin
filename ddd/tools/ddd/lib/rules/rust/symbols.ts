/**
 * DomainSymbolTable — the domain type / getter / constructor / mutator summary
 * built from every domain-layer crate in the workspace (U5 BR3).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { type AnalyzerRuntime, impls, type MethodDecl, parse, structs } from "../../rust/analyzer.ts";
import type { CrateLayerAssignment } from "../../workspace/resolver.ts";
import { POST_INIT, REPLAY_EXEMPT, snakeToKebab, toKebab } from "../lists.ts";
import type { DomainSymbolTable, DomainTypeSymbol, ModelAvailability, MutatorSymbol } from "../types.ts";

function listRustFiles(dir: string): string[] {
  const out: string[] = [];
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listRustFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".rs")) out.push(full);
  }
  return out.sort((a, b) => a.localeCompare(b, "en"));
}

function isConstructor(method: MethodDecl, typeName: string): boolean {
  if (method.receiver !== "none") return false;
  const ret = method.return_type_text ?? "";
  if (ret === "") return false;
  const outer = ret.replace(/^Result<|^Option<|^Box<|^Arc<|^Rc</, "").trim();
  if (ret === "Self" || ret === typeName) return true;
  return /^(Result|Option)<.*\bSelf\b/.test(ret) || ret.includes("Self") || outer === typeName;
}

export function buildSymbolTable(
  runtime: AnalyzerRuntime,
  workspaceRoot: string,
  assignments: readonly CrateLayerAssignment[],
  model: ModelAvailability,
): DomainSymbolTable {
  const types: DomainTypeSymbol[] = [];
  const crates: string[] = [];
  const getterNames = new Set<string>();
  const typeNames = new Set<string>();
  const constructorsByType = new Map<string, Set<string>>();
  let fileCount = 0;

  for (const assignment of assignments) {
    if (assignment.layer !== "domain") continue;
    crates.push(assignment.crate_name);
    const crateDir = assignment.path === "." ? workspaceRoot : join(workspaceRoot, assignment.path);
    const roots = new Set<string>();
    for (const target of assignment.targets) {
      if (target.kind === "lib" || target.kind === "bin") roots.add(dirname(join(crateDir, target.src_path)));
    }
    for (const root of roots) {
      for (const file of listRustFiles(root)) {
        fileCount++;
        const tree = parse(runtime, file, readFileSync(file));
        const structDecls = structs(tree);
        const implBlocks = impls(tree);
        for (const decl of structDecls) {
          const inherent = implBlocks.filter(
            (block) => block.target_type_text === decl.name && block.trait_text === undefined,
          );
          const traitImpls = implBlocks.filter(
            (block) => block.target_type_text === decl.name && block.trait_text !== undefined,
          );
          const methods = inherent.flatMap((block) => block.methods);
          const getters = methods
            .filter((method) => method.body_shape === "returns-field-only")
            .map((method) => method.name);
          const constructors = methods
            .filter((method) => isConstructor(method, decl.name))
            .map((method) => method.name);
          const mutators: MutatorSymbol[] = methods
            .filter((method) => method.receiver === "mut-self")
            .map((method) => classifyMutator(method, decl.name, model));
          const hasDefault =
            decl.derives.includes("Default") ||
            traitImpls.some((block) => (block.trait_text ?? "").endsWith("Default"));
          const nonPrivate = decl.fields.filter((field) => field.visibility !== "private");

          const typeSymbol: DomainTypeSymbol = {
            type_name: decl.name,
            crate_name: assignment.crate_name,
            file: relative(workspaceRoot, file).split(sep).join("/"),
            kind: decl.kind,
            aggregate_slug: toKebab(decl.name),
            getters,
            constructors,
            mutators,
            has_default: hasDefault,
            non_private_field_lines: nonPrivate.map((field) => field.span.start_line),
            field_type_texts: decl.fields.map((field) => field.type_text),
          };
          types.push(typeSymbol);
          for (const getter of getters) getterNames.add(getter);
          typeNames.add(decl.name);
          const existing = constructorsByType.get(decl.name) ?? new Set<string>();
          for (const ctor of constructors) existing.add(ctor);
          constructorsByType.set(decl.name, existing);
        }
      }
    }
  }

  types.sort((a, b) => `${a.crate_name}:${a.type_name}`.localeCompare(`${b.crate_name}:${b.type_name}`, "en"));
  return {
    crates: [...new Set(crates)].sort((a, b) => a.localeCompare(b, "en")),
    types,
    getter_names: getterNames,
    type_names: typeNames,
    constructors_by_type: constructorsByType,
    file_count: fileCount,
  };
}

function classifyMutator(method: MethodDecl, typeName: string, model: ModelAvailability): MutatorSymbol {
  const command_slug = snakeToKebab(method.name);
  const base = { method_name: method.name, command_slug, line: method.span.start_line };
  if (REPLAY_EXEMPT.has(method.name)) return { ...base, classification: "replay-exempt" };
  if (POST_INIT.has(method.name)) return { ...base, classification: "post-init" };
  if (model.status !== "available" || !model.index) return { ...base, classification: "unknown" };
  const aggregateId = `aggregate.${toKebab(typeName)}`;
  if (!model.index.resolve(aggregateId, "aggregate").ok) return { ...base, classification: "undeclared" };
  const declared = model.index
    .commandsOf(aggregateId)
    .some(
      (command) =>
        command.element_id.split(".").slice(2).join("-") === command_slug ||
        command.element_id.endsWith(`.${command_slug}`),
    );
  return { ...base, classification: declared ? "declared-command" : "undeclared" };
}
