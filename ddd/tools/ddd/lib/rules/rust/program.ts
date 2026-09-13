/** Explicit Rust declarations and bindings; no inference, macro expansion or trait solving. */
import { readFileSync } from "node:fs";
import { inspectModules, type ModuleInventory } from "../../packaging/rust-modules.ts";
import {
  type AnalyzerRuntime,
  type CallSite,
  type FieldDecl,
  type ImplBlock,
  impls,
  type MethodDecl,
  parse,
  type Span,
  type SyntaxTree,
  structs,
  traits,
  typeAliases,
  uses,
} from "../../rust/analyzer.ts";
import type { CrateLayerAssignment, Layer } from "../../workspace/resolver.ts";

export interface LocatedMethod {
  file: string;
  module: string[];
  method: MethodDecl;
  trait?: string;
}
export interface RustType {
  key: string;
  name: string;
  crate: string;
  layer: Layer;
  file: string;
  module: string[];
  kind: "struct" | "enum" | "trait";
  fields: FieldDecl[];
  derives: string[];
  methods: LocatedMethod[];
}
export interface RustFile {
  tree: SyntaxTree;
  crate: string;
  module: string[];
  impls: ImplBlock[];
  localImports: boolean;
}
interface Alias {
  key: string;
  file: string;
  module: string[];
  target: string;
  generic: boolean;
}

export interface RustProgram {
  moduleInventories: Map<string, ModuleInventory>;
  files: Map<string, RustFile>;
  types: RustType[];
  notes: Set<string>;
  resolveType(file: string, module: string[], text: string): RustType | undefined;
  receiver(file: string, call: CallSite): RustType | undefined;
}

export function within(inner: Span, outer: Span): boolean {
  return (
    (inner.start_line > outer.start_line ||
      (inner.start_line === outer.start_line && inner.start_col >= outer.start_col)) &&
    (inner.end_line < outer.end_line || (inner.end_line === outer.end_line && inner.end_col <= outer.end_col))
  );
}

function importNames(text: string, prefix = ""): { name: string; target: string }[] {
  const start = text.indexOf("{");
  if (start !== -1) {
    const path = prefix + text.slice(0, start);
    const body = text.slice(start + 1, text.lastIndexOf("}"));
    const entries: string[] = [];
    let depth = 0;
    let beginning = 0;
    for (let i = 0; i <= body.length; i++) {
      if (body[i] === "{") depth++;
      if (body[i] === "}") depth--;
      if (i === body.length || (body[i] === "," && depth === 0)) {
        entries.push(body.slice(beginning, i).trim());
        beginning = i + 1;
      }
    }
    return entries.filter(Boolean).flatMap((entry) => importNames(entry, path));
  }
  const [path, alias] = text.trim().split(/\s+as\s+/);
  if (!path || path.includes("*")) return [];
  const target = (prefix + path).replace(/::self$/, "");
  return [{ name: alias ?? target.split("::").at(-1) ?? "", target }];
}

function bareType(text: string): string {
  return text
    .trim()
    .replace(/^&\s*(?:'\w+\s*)?(?:mut\s+)?/, "")
    .replace(/^(impl|dyn)\s+/, "")
    .trim();
}

export function buildProgram(
  runtime: AnalyzerRuntime,
  root: string,
  assignments: readonly CrateLayerAssignment[],
): RustProgram {
  const files = new Map<string, RustFile>();
  const types: RustType[] = [];
  const aliases: Alias[] = [];
  const notes = new Set<string>();
  const moduleInventories = new Map<string, ModuleInventory>();
  for (const assignment of assignments) {
    if (!["domain", "use-case", "interface-adapter", "rmu"].includes(assignment.layer)) continue;
    const crate = assignment.crate_name.replace(/-/g, "_");
    const inventory = inspectModules(runtime, root, assignment);
    moduleInventories.set(assignment.crate_name, inventory);
    for (const issue of inventory.problems) notes.add(`syntax.unresolved: ${issue.file}:${issue.line} ${issue.reason}`);
    const sources = inventory.sources;
    for (const entry of sources) {
      const { path, file } = entry;
      if (files.has(file)) continue;
      const namespaces = new Set(
        sources.filter((candidate) => candidate.file === file).map((candidate) => candidate.parts.join("::")),
      );
      if (namespaces.size > 1) {
        notes.add(`syntax.unresolved: ${file} is used in multiple module namespaces`);
        continue;
      }
      const module = entry.parts;
      const tree = parse(runtime, file, readFileSync(path));
      const imports = uses(tree);
      files.set(file, {
        tree,
        crate,
        module,
        impls: impls(tree),
        localImports: imports.some((entry) => entry.local),
      });
      if (tree.has_parse_error) notes.add(`syntax.unresolved: ${file} has parse errors`);
      for (const decl of structs(tree)) {
        const scope = [...module, ...decl.module_path];
        types.push({
          key: [crate, ...scope, decl.name].join("::"),
          name: decl.name,
          crate,
          layer: assignment.layer,
          file,
          module: scope,
          kind: decl.kind,
          fields: decl.fields,
          derives: decl.derives,
          methods: [],
        });
      }
      for (const decl of traits(tree)) {
        const scope = [...module, ...decl.module_path];
        types.push({
          key: [crate, ...scope, decl.name].join("::"),
          name: decl.name,
          crate,
          layer: assignment.layer,
          file,
          module: scope,
          kind: "trait",
          fields: [],
          derives: [],
          methods: [],
        });
      }
      for (const entry of imports.filter((item) => !item.local)) {
        const scope = [...module, ...entry.module_path];
        for (const binding of importNames(entry.path_text)) {
          aliases.push({
            key: [crate, ...scope, binding.name].join("::"),
            file,
            module: scope,
            target: binding.target,
            generic: false,
          });
        }
      }
      for (const entry of typeAliases(tree)) {
        const scope = [...module, ...entry.module_path];
        aliases.push({
          key: [crate, ...scope, entry.name].join("::"),
          file,
          module: scope,
          target: entry.type_text,
          generic: entry.generic,
        });
      }
    }
  }
  const crates = new Set(assignments.map((entry) => entry.crate_name.replace(/-/g, "_")));
  function lookup(file: string, module: string[], raw: string, seen: Set<string>): RustType | undefined {
    const owner = files.get(file);
    if (!owner || owner.tree.has_parse_error || owner.localImports) return undefined;
    const text = bareType(raw);
    const wrapper = /^(?:(?:std|core|alloc)::(?:boxed|sync|rc|option|vec)::)?(Box|Arc|Rc|Option|Vec)\s*<(.+)>$/.exec(
      text,
    );
    if (wrapper) {
      const key = [owner.crate, ...module, wrapper[1]].join("::");
      const imported = aliases.filter((alias) => alias.key === key);
      const standard = /^(std|core|alloc)::(boxed|sync|rc|option|vec)::(Box|Arc|Rc|Option|Vec)$/;
      const qualified = standard.test(text.slice(0, text.indexOf("<")).trim());
      const shadowed = types.some((type) => type.key === key);
      if (
        qualified ||
        (!shadowed && (imported.length === 0 || (imported.length === 1 && standard.test(imported[0].target))))
      ) {
        return lookup(file, module, wrapper[2], seen);
      }
    }
    const path = text.replace(/<.*>$/, "").replace(/^::/, "").split("::");
    if (!path.every((part) => /^[A-Za-z_]\w*$/.test(part))) return undefined;
    let parts: string[];
    if (path[0] === "crate") parts = [owner.crate, ...path.slice(1)];
    else if (path[0] === "self") parts = [owner.crate, ...module, ...path.slice(1)];
    else if (path[0] === "super") {
      const parent = [...module];
      while (path[0] === "super") {
        if (!parent.length) return undefined;
        parent.pop();
        path.shift();
      }
      parts = [owner.crate, ...parent, ...path];
    } else if (crates.has(path[0])) parts = path;
    else parts = [owner.crate, ...module, ...path];
    const key = parts.join("::");
    if (seen.has(key)) return undefined;
    const next = new Set(seen).add(key);
    const matches = types.filter((type) => type.key === key);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) return undefined;
    for (let n = parts.length; n >= 2; n--) {
      const candidates = aliases.filter((alias) => alias.key === parts.slice(0, n).join("::"));
      if (!candidates.length) continue;
      if (candidates.length !== 1 || candidates[0].generic) return undefined;
      const alias = candidates[0];
      return lookup(alias.file, alias.module, [alias.target, ...parts.slice(n)].join("::"), next);
    }
    return undefined;
  }
  const resolveType = (file: string, module: string[], text: string) => lookup(file, module, text, new Set());
  for (const [file, data] of files) {
    for (const block of data.impls) {
      const module = [...data.module, ...block.module_path];
      const type = resolveType(file, module, block.target_type_text);
      if (!type) {
        notes.add(`syntax.unresolved: ${file}:${block.span.start_line} impl ${block.target_type_text}`);
        continue;
      }
      for (const method of block.methods) type.methods.push({ file, module, method, trait: block.trait_text });
    }
  }
  function receiver(file: string, call: CallSite): RustType | undefined {
    const data = files.get(file);
    if (!data) return undefined;
    const scope = [...data.module, ...call.module_path];
    const parts = (call.receiver_text ?? "").trim().split(".");
    let type: RustType | undefined;
    if (parts[0] === "self") {
      const block = data.impls.find((block) => within(call.span, block.span));
      if (block) type = resolveType(file, scope, block.target_type_text);
    } else if (call.receiver_binding_type) type = resolveType(file, scope, call.receiver_binding_type);
    for (const part of parts.slice(1)) {
      if (!type) return undefined;
      const field = type.fields.find((field) => field.name === part);
      type = field ? resolveType(type.file, type.module, field.type_text) : undefined;
    }
    return type;
  }
  return { files, types, notes, moduleInventories, resolveType, receiver };
}
