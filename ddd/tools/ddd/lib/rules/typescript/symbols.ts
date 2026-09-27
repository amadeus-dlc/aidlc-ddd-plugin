/**
 * The domain types of the TypeScript domain gate, read off the facts of every domain source: each
 * class, and each companion — a type literal and a `const` object literal of the same name in one
 * file. A companion's instances are the literals written inside that object for its type: a literal
 * typed as the type, or an untyped one keyed by the same identifier the type literal is keyed by.
 *
 * A type name written in a claimed source is resolved without a type checker: a declaration of the
 * same file, else the import binding it names — by its imported name, among the domain types of the
 * package the import leads to — else a namespace import `ns.Name` the same way.
 */

import { join } from "node:path";
import type {
  DeclarationFact,
  KeyedLiteralFact,
  MemberFact,
  Span,
  TypeScriptFileFacts,
} from "../../typescript/domain-facts/index.ts";
import { type ProjectPackages, packageContaining, resolveSpecifier } from "./edges.ts";
import { modulePathOf } from "./packages.ts";
import type { TsDomainType, TsMethod, TsSymbolTable } from "./types.ts";

/** Whether `inner` lies within `outer`. */
export function within(inner: Span, outer: Span): boolean {
  const startsAfter =
    inner.start_line > outer.start_line ||
    (inner.start_line === outer.start_line && inner.start_col >= outer.start_col);
  const endsBefore =
    inner.end_line < outer.end_line || (inner.end_line === outer.end_line && inner.end_col <= outer.end_col);
  return startsAfter && endsBefore;
}

function methodsOf(file: string, members: readonly MemberFact[]): TsMethod[] {
  return members.flatMap((member) =>
    member.kind === "method" && !member.static && member.writes !== undefined
      ? [
          {
            name: member.name,
            file,
            span: member.span,
            params: member.params ?? [],
            writes: member.writes,
            returns_state_only: member.returns_state_only === true,
          },
        ]
      : [],
  );
}

/** A companion: the type literal alias and the `const` object literal of the same name. */
export interface CompanionPair {
  readonly type: DeclarationFact;
  readonly value: DeclarationFact;
}

export function companionsOf(facts: TypeScriptFileFacts): CompanionPair[] {
  return facts.declarations.flatMap((type) => {
    if (type.kind !== "type-alias" || type.type_literal !== true) return [];
    const value = facts.declarations.find(
      (entry) =>
        entry.kind === "variable" &&
        entry.name === type.name &&
        entry.binding === "const" &&
        entry.initializer?.kind === "object-literal",
    );
    return value ? [{ type, value }] : [];
  });
}

/** A literal written inside a companion's object for its type. */
interface CompanionInstance {
  readonly members: readonly MemberFact[];
  readonly opaque: boolean;
  readonly span: Span;
  /** How a typed instance is typed; absent for a keyed literal. */
  readonly form?: "annotation" | "assertion" | "satisfies";
}

export function instancesOf(facts: TypeScriptFileFacts, pair: CompanionPair): CompanionInstance[] {
  const keys = new Set(pair.type.members.flatMap((member) => (member.computed_key ? [member.computed_key] : [])));
  const typed = facts.constructions.flatMap((entry): CompanionInstance[] =>
    entry.kind === "typed-object-literal" && entry.type_text === pair.type.name && within(entry.span, pair.value.span)
      ? [{ members: entry.members, opaque: entry.opaque, span: entry.span, form: entry.form }]
      : [],
  );
  const keyed = facts.keyed_literals.filter(
    (entry: KeyedLiteralFact) =>
      within(entry.span, pair.value.span) &&
      entry.members.some((member) => member.computed_key !== undefined && keys.has(member.computed_key)),
  );
  return [...typed, ...keyed].sort(
    (a, b) => a.span.start_line - b.span.start_line || a.span.start_col - b.span.start_col,
  );
}

/** Every class and companion the facts of the domain sources declare. */
export function buildSymbolTable(
  packages: ProjectPackages,
  files: ReadonlyMap<string, TypeScriptFileFacts>,
): TsSymbolTable {
  const types: TsDomainType[] = [];
  for (const [file, facts] of [...files].sort((a, b) => a[0].localeCompare(b[0], "en"))) {
    const absolute = join(packages.workspaceRoot, file);
    const pkg = packageContaining(packages, absolute);
    if (!pkg) throw new Error(`no package of the project holds ${file}`);
    const module = modulePathOf(pkg, absolute);
    for (const declaration of facts.declarations) {
      if (declaration.kind !== "class") continue;
      types.push({
        key: `${file}#${declaration.name}`,
        name: declaration.name,
        kind: "class",
        default_export: declaration.default_export,
        file,
        pkg,
        module,
        home: declaration.span,
        members: declaration.members,
        methods: methodsOf(file, declaration.members),
      });
    }
    for (const pair of companionsOf(facts)) {
      types.push({
        key: `${file}#${pair.type.name}`,
        name: pair.type.name,
        kind: "companion",
        default_export: false,
        file,
        pkg,
        module,
        home: pair.value.span,
        members: pair.type.members,
        methods: instancesOf(facts, pair).flatMap((instance) => methodsOf(file, instance.members)),
      });
    }
  }
  const getters = new Set(
    types.flatMap((type) => type.methods.filter((method) => method.returns_state_only).map((method) => method.name)),
  );
  return { types, getter_names: getters };
}

/** A type name resolved in one file: a domain type, not a domain type, or not decidable. */
type TypeResolution =
  | { readonly kind: "domain"; readonly type: TsDomainType }
  | { readonly kind: "other" }
  | { readonly kind: "undecided"; readonly reason: string };

const SIMPLE_REFERENCE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?$/;

/** The domain types named `name` in the package a module specifier written in `file` leads to. */
function importedType(
  packages: ProjectPackages,
  symbols: TsSymbolTable,
  file: string,
  specifier: string,
  name: string,
): TypeResolution {
  const absolute = join(packages.workspaceRoot, file);
  const from = packageContaining(packages, absolute);
  if (!from) throw new Error(`no package of the project holds ${file}`);
  const target = resolveSpecifier(packages, from, absolute, specifier);
  if (target.kind === "unresolved") return { kind: "undecided", reason: target.reason };
  if (target.kind !== "package") return { kind: "other" };
  const { assignment } = target.pkg;
  if (assignment.layer === "domain" && !assignment.is_composition_root && !packages.described.has(target.pkg.root))
    return {
      kind: "undecided",
      reason: `${target.pkg.name} is a domain package whose sources were not read, since the root tsconfig.json does not reference it`,
    };
  const candidates = symbols.types.filter(
    (type) => type.pkg.root === target.pkg.root && (name === "default" ? type.default_export : type.name === name),
  );
  if (candidates.length > 1)
    return { kind: "undecided", reason: `${name} names more than one domain type of ${target.pkg.name}` };
  return candidates.length === 1 ? { kind: "domain", type: candidates[0] } : { kind: "other" };
}

/**
 * What the type `text`, written in `file`, names. Only a type reference spelled by one name, or by a
 * namespace and a name, is resolved; any other type — a union, an application, a literal — is not
 * decidable without a type checker.
 */
export function resolveTypeName(
  packages: ProjectPackages,
  symbols: TsSymbolTable,
  file: string,
  facts: TypeScriptFileFacts,
  text: string,
): TypeResolution {
  const spelled = text.trim();
  if (!SIMPLE_REFERENCE.test(spelled))
    return { kind: "undecided", reason: `the type ${spelled} is not one named type` };
  const [first, second] = spelled.split(".");
  if (second !== undefined) {
    const namespace = facts.imports.find((entry) =>
      entry.bindings.some((binding) => binding.name === first && binding.imported === "*"),
    );
    return namespace ? importedType(packages, symbols, file, namespace.specifier, second) : { kind: "other" };
  }
  const local = symbols.types.find((type) => type.file === file && type.name === first);
  if (local) return { kind: "domain", type: local };
  if (facts.declarations.some((entry) => entry.name === first)) return { kind: "other" };
  for (const entry of facts.imports) {
    const binding = entry.bindings.find((candidate) => candidate.name === first && candidate.imported !== "*");
    if (binding) return importedType(packages, symbols, file, entry.specifier, binding.imported);
  }
  return { kind: "other" };
}

const TYPE_NAMES = /[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?/g;

/** Splits `text` at the `|` that stand outside any bracket, or returns it whole. */
function topLevelUnion(text: string): string[] {
  const members: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if ("<([{".includes(char)) depth++;
    else if (">)]}".includes(char)) depth--;
    else if (char === "|" && depth === 0) {
      members.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  members.push(text.slice(start).trim());
  return members.filter((member) => member.length > 0);
}

/** `inner` when `text` is `Readonly<inner>` as a whole, with its brackets balanced. */
function readonlyInner(text: string): string | undefined {
  if (!text.startsWith("Readonly<") || !text.endsWith(">")) return undefined;
  const inner = text.slice("Readonly<".length, -1);
  let depth = 0;
  for (const char of inner) {
    if ("<([{".includes(char)) depth++;
    else if (">)]}".includes(char) && --depth < 0) return undefined;
  }
  return depth === 0 ? inner.trim() : undefined;
}

/**
 * The type a construction builds, once the wrappings that build that same type are removed:
 * `Readonly<T>`, and a union of `T` with `null` or `undefined`. Any other type is left as written.
 */
function builtType(text: string): string {
  let current = text.trim();
  for (;;) {
    const inner = readonlyInner(current);
    if (inner !== undefined) {
      current = inner;
      continue;
    }
    const members = topLevelUnion(current);
    const kept = members.filter((member) => member !== "null" && member !== "undefined");
    if (members.length > 1 && kept.length === 1) {
      current = kept[0];
      continue;
    }
    return current;
  }
}

/**
 * The domain type a construction is written against. The type is resolved as `resolveTypeName`
 * resolves it once `Readonly<…>` and a union with `null` or `undefined` are removed, since those
 * build the type they wrap. Any other type that still names a domain type — an application such as
 * `Record<string, Invoice>`, a type literal holding one — does not build it, and cannot be told
 * from one that does without a type checker, so it is undecided rather than passed or reported.
 */
export function resolveConstructedType(
  packages: ProjectPackages,
  symbols: TsSymbolTable,
  file: string,
  facts: TypeScriptFileFacts,
  text: string,
): TypeResolution {
  const built = builtType(text);
  if (SIMPLE_REFERENCE.test(built)) return resolveTypeName(packages, symbols, file, facts, built);
  for (const name of built.match(TYPE_NAMES) ?? []) {
    const resolved = resolveTypeName(packages, symbols, file, facts, name);
    if (resolved.kind === "domain")
      return { kind: "undecided", reason: `the type ${built} names ${name} but is not one it builds` };
    if (resolved.kind === "undecided") return resolved;
  }
  return { kind: "other" };
}
