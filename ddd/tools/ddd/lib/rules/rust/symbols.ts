/** Domain summaries joined across explicitly resolved Rust declarations and impls. */
import type { MethodDecl } from "../../rust/analyzer.ts";
import type { Aggregate } from "../../schema/model.ts";
import type { AggregateMapping } from "../../sensors/declaration.ts";
import { POST_INIT, snakeToKebab, toKebab, toPascal } from "../lists.ts";
import type { DomainSymbolTable, DomainTypeSymbol, ModelAvailability, MutatorSymbol } from "../types.ts";
import type { LocatedMethod, RustProgram, RustType } from "./program.ts";

function isConstructor(method: MethodDecl, typeName: string): boolean {
  if (method.receiver !== "none") return false;
  const ret = method.return_type_text ?? "";
  const outer = ret.replace(/^Result<|^Option<|^Box<|^Arc<|^Rc</, "").trim();
  return (
    ret === "Self" ||
    ret === typeName ||
    /^(Result|Option)<.*\bSelf\b/.test(ret) ||
    ret.includes("Self") ||
    outer === typeName
  );
}

function matchesLocation(type: RustType, mapping: AggregateMapping): boolean {
  const module = mapping.module
    .replace(/^crate(?:::|$)/, "")
    .split("::")
    .filter(Boolean);
  return mapping.crate.replace(/-/g, "_") === type.crate && module.join("::") === type.module.join("::");
}

function aggregateFor(
  type: RustType,
  program: RustProgram,
  model: ModelAvailability,
  mappings: readonly AggregateMapping[],
): { aggregate?: string; ambiguous: boolean } {
  if (!model.index) return { ambiguous: false };
  const matches = model.index.elements("aggregate").filter((entry) => {
    const aggregate = entry.node as Aggregate;
    const root = model.index?.byId(aggregate.root_element);
    return root && (root.name === type.name || toPascal(root.id.segments.join("-")) === type.name);
  });
  if (matches.length === 0) return { ambiguous: false };
  const sameNames = program.types.filter((candidate) => candidate.layer === "domain" && candidate.name === type.name);
  const explicit = matches.filter((entry) =>
    mappings.some((mapping) => mapping.aggregate_ref === entry.id.value && matchesLocation(type, mapping)),
  );
  if (explicit.length === 1) return { aggregate: explicit[0].id.value, ambiguous: false };
  if (matches.length !== 1 || sameNames.length !== 1) {
    program.notes.add(`model.unresolved: ${type.key} has an ambiguous model/type binding`);
    return { ambiguous: true };
  }
  return { aggregate: matches[0].id.value, ambiguous: false };
}

export function buildSymbolTable(
  program: RustProgram,
  model: ModelAvailability,
  mappings: readonly AggregateMapping[] = [],
): DomainSymbolTable {
  const types: DomainTypeSymbol[] = [];
  const getterNames = new Set<string>();
  const typeNames = new Set<string>();
  const constructorsByType = new Map<string, Set<string>>();
  for (const type of program.types) {
    if (type.layer !== "domain" || type.kind === "trait") continue;
    const binding = aggregateFor(type, program, model, mappings);
    const aggregate = binding.aggregate;
    const inherent = type.methods.filter((entry) => !entry.trait);
    const getters = inherent
      .filter((entry) => entry.method.body_shape === "returns-field-only")
      .map((entry) => entry.method.name);
    const constructors = inherent
      .filter((entry) => isConstructor(entry.method, type.name))
      .map((entry) => entry.method.name);
    const mutators = type.methods
      .filter((entry) => entry.method.receiver === "mut-self")
      .map((entry) =>
        classifyMutator(
          entry,
          aggregate,
          model,
          isReplay(entry, type, aggregate, model, program, mappings),
          binding.ambiguous,
        ),
      );
    const defaults = type.methods
      .filter((entry) => entry.trait === "Default" || entry.trait?.endsWith("::Default"))
      .map((entry) => ({ file: entry.file, line: entry.method.span.start_line }));
    if (type.derives.includes("Default")) defaults.push({ file: type.file, line: 1 });
    types.push({
      key: type.key,
      type_name: type.name,
      crate_name: type.crate.replace(/_/g, "-"),
      file: type.file,
      kind: type.kind,
      aggregate_slug: aggregate?.slice("aggregate.".length) ?? toKebab(type.name),
      aggregate_ref: aggregate,
      getters,
      constructors,
      mutators,
      has_default: defaults.length > 0,
      defaults,
      non_private_field_lines: type.fields
        .filter((field) => field.visibility !== "private")
        .map((field) => field.span.start_line),
      field_type_texts: type.fields.map((field) => field.type_text),
    });
    for (const getter of getters) getterNames.add(getter);
    typeNames.add(type.name);
    const known = constructorsByType.get(type.name) ?? new Set<string>();
    for (const factory of constructors) known.add(factory);
    constructorsByType.set(type.name, known);
  }
  types.sort((a, b) => a.key.localeCompare(b.key, "en"));
  return {
    crates: [...new Set(types.map((type) => type.crate_name))].sort(),
    types,
    getter_names: getterNames,
    type_names: typeNames,
    constructors_by_type: constructorsByType,
    file_count: new Set(types.map((type) => type.file)).size,
  };
}

function isReplay(
  entry: LocatedMethod,
  type: RustType,
  aggregate: string | undefined,
  model: ModelAvailability,
  program: RustProgram,
  mappings: readonly AggregateMapping[],
): boolean {
  if (!aggregate || !model.index || entry.method.params.length !== 1) return false;
  const declarations = mappings.filter((mapping) => mapping.aggregate_ref === aggregate);
  if (declarations.length !== 1) return false;
  const mapping = declarations[0];
  if (mapping.persistence_method !== "event-sourcing" || !matchesLocation(type, mapping)) return false;
  const methods = mapping.replay_methods.filter((replay) => replay.method === entry.method.name);
  if (methods.length !== 1) return false;
  const event = model.index.resolve(methods[0].event_ref, "event");
  if (!event.ok || event.element.owner !== aggregate) return false;
  const eventType = program.resolveType(entry.file, entry.module, entry.method.params[0].type_text);
  return (
    eventType !== undefined &&
    eventType.kind !== "trait" &&
    eventType.layer === "domain" &&
    eventType.crate === type.crate &&
    program.types.filter(
      (candidate) =>
        candidate.layer === "domain" && candidate.crate === eventType.crate && candidate.name === eventType.name,
    ).length === 1 &&
    (eventType.name === event.element.name || eventType.name === toPascal(event.element.id.segments.join("-")))
  );
}

function classifyMutator(
  entry: LocatedMethod,
  aggregate: string | undefined,
  model: ModelAvailability,
  replay: boolean,
  ambiguous: boolean,
): MutatorSymbol {
  const method = entry.method;
  const command_slug = snakeToKebab(method.name);
  const base = { method_name: method.name, command_slug, line: method.span.start_line, file: entry.file };
  if (ambiguous) return { ...base, classification: "unknown" };
  if (replay) return { ...base, classification: "replay-exempt" };
  if (POST_INIT.has(method.name)) return { ...base, classification: "post-init" };
  if (model.status !== "available" || !model.index) return { ...base, classification: "unknown" };
  const declared =
    aggregate !== undefined &&
    model.index
      .commandsOf(aggregate)
      .some(
        (command) =>
          command.element_id.split(".").slice(2).join("-") === command_slug ||
          command.element_id.endsWith(`.${command_slug}`),
      );
  return { ...base, classification: declared ? "declared-command" : "undeclared" };
}
