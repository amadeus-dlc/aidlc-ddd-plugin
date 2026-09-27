/**
 * TypeScript rule evaluators of the domain gate: undeclared mutation (b), incomplete construction
 * (c), getter calls (d) and domain packaging, each in the words the Rust domain gate reports them
 * in. State hiding (a) is in `state-hiding.ts` and the dependency direction (g) in `edges.ts`.
 *
 * Nothing here infers a type. A receiver or a constructed type is what a declaration, an import or
 * an annotation spells, and what those do not decide is left undecided rather than passed.
 */

import { join } from "node:path";
import { type AggregateMappingView, mappingPathOf } from "../../aggregate-mapping/index.ts";
import { SPELLINGS } from "../../aggregate-mapping/language.ts";
import {
  type DeclaredPackages,
  type PackagingModule,
  type PackagingProblem,
  packagingFindings,
} from "../../packaging/evaluate.ts";
import { relPath } from "../../sensors/common.ts";
import type { FindingInput } from "../../shared/findings.ts";
import { type CallFact, COLLECTION_MUTATORS, type TypeScriptFileFacts } from "../../typescript/domain-facts/index.ts";
import { toKebab } from "../lists.ts";
import { bindAggregate, classifyMutation, declaredReplayEventNames } from "../mutations.ts";
import type { MutatorSymbol } from "../types.ts";
import { modulePathOf, PACKAGE_MANIFEST, packageSources, posixRelative, type TsPackage } from "./packages.ts";
import { resolveConstructedType, resolveTypeName, within } from "./symbols.ts";
import type { TsDomainType, TsInspection, TsMethod, TsTarget } from "./types.ts";

function factsOf(inspection: TsInspection, file: string): TypeScriptFileFacts {
  const facts = inspection.facts.files.get(file);
  if (!facts) throw new Error(`the TypeScript facts carry no record for ${file}`);
  return facts;
}

// --- (b) undeclared mutation and (c) post-init --------------------------------------------------

const COLLECTION_TYPE = /^(?:Array|Map|Set)\s*<|\[\]$/;

/**
 * Whether a class method changes state: it writes state, or it calls a changing method of a field
 * the class states is an array, a `Map` or a `Set`.
 */
function mutates(type: TsDomainType, method: TsMethod, calls: readonly CallFact[]): boolean {
  if (method.writes.length > 0) return true;
  if (type.kind !== "class") return false;
  return calls.some((call) => {
    if (call.kind !== "method-call" || !within(call.span, method.span) || !COLLECTION_MUTATORS.has(call.callee_text))
      return false;
    const field = /^this\.(#?[A-Za-z_$][\w$]*)$/.exec((call.receiver_text ?? "").replace(/\s+/g, ""))?.[1];
    const member = field === undefined ? undefined : type.members.find((entry) => entry.name === field);
    return member?.kind === "property" && COLLECTION_TYPE.test((member.type_text ?? "").trim());
  });
}

function aggregateMappings(inspection: TsInspection): readonly AggregateMappingView[] {
  return inspection.mapping.kind === "loaded" ? inspection.mapping.view.aggregates : [];
}

function locatedAt(type: TsDomainType) {
  return (mapping: AggregateMappingView) =>
    mapping.package === type.pkg.name && mapping.module.join("/") === type.module.join("/");
}

/** Whether the one parameter of a declared replay method is the declared event's domain type. */
function isReplay(inspection: TsInspection, type: TsDomainType, method: TsMethod, aggregate?: string): boolean {
  const names = declaredReplayEventNames(
    method.name,
    method.params.length,
    aggregate,
    inspection.model,
    aggregateMappings(inspection),
    locatedAt(type),
  );
  const stated = method.params[0]?.type_text;
  if (!names || stated === undefined) return false;
  const resolved = resolveTypeName(
    inspection.packages,
    inspection.symbols,
    method.file,
    factsOf(inspection, method.file),
    stated,
  );
  if (resolved.kind !== "domain") return false;
  const event = resolved.type;
  return (
    event.pkg.root === type.pkg.root &&
    inspection.symbols.types.filter((entry) => entry.pkg.root === event.pkg.root && entry.name === event.name)
      .length === 1 &&
    names.includes(event.name)
  );
}

interface TypeMutators {
  readonly type: TsDomainType;
  readonly slug: string;
  readonly mutators: readonly MutatorSymbol[];
}

/** The mutating methods of the domain types declared in `file`, each classified against the model. */
function mutatorsIn(inspection: TsInspection, file: string): TypeMutators[] {
  const calls = factsOf(inspection, file).calls;
  const mappings = aggregateMappings(inspection);
  return inspection.symbols.types
    .filter((type) => type.file === file)
    .map((type) => {
      const sameNames = inspection.symbols.types.filter((entry) => entry.name === type.name).length;
      const binding = bindAggregate(type, sameNames, inspection.model, mappings, locatedAt(type), inspection.notes);
      const mutators = type.methods
        .filter((method) => mutates(type, method, calls))
        .map((method) =>
          classifyMutation(
            { name: method.name, file, line: method.span.start_line },
            binding.aggregate,
            inspection.model,
            isReplay(inspection, type, method, binding.aggregate),
            binding.ambiguous,
          ),
        );
      return { type, slug: binding.aggregate?.slice("aggregate.".length) ?? toKebab(type.name), mutators };
    });
}

export function ruleB(inspection: TsInspection, target: TsTarget): FindingInput[] {
  return mutatorsIn(inspection, target.file).flatMap(({ type, slug, mutators }) =>
    mutators
      .filter((mutator) => mutator.classification === "undeclared")
      .map((mutator) => ({
        rule_id: "b",
        file: target.file,
        message: `mutating method ${type.name}.${mutator.method_name} is not declared as command.${slug}.${mutator.command_slug}`,
        line: mutator.line,
      })),
  );
}

// --- (c) incomplete construction -----------------------------------------------------------------

export function ruleC(inspection: TsInspection, target: TsTarget): FindingInput[] {
  const findings: FindingInput[] = [];
  const facts = factsOf(inspection, target.file);
  for (const site of facts.constructions) {
    const resolved = resolveConstructedType(
      inspection.packages,
      inspection.symbols,
      target.file,
      facts,
      site.type_text,
    );
    if (resolved.kind === "undecided") {
      inspection.undecided.add(target.file, site.span.start_line, `constructed type: ${resolved.reason}`);
      continue;
    }
    if (resolved.kind !== "domain") continue;
    const type = resolved.type;
    // Only a class is constructed by `new`; inside its own class or companion object, a type is
    // made the way it is meant to be, and an assertion there is left to rule (a) as undecided.
    if (site.kind === "new-expression" && type.kind !== "class") continue;
    if (type.file === target.file && within(site.span, type.home)) continue;
    findings.push({
      rule_id: "c",
      file: target.file,
      message: `domain type ${type.name} built outside its ${type.kind} (${site.kind})`,
      line: site.span.start_line,
    });
  }
  for (const { type, mutators } of mutatorsIn(inspection, target.file))
    for (const mutator of mutators.filter((entry) => entry.classification === "post-init"))
      findings.push({
        rule_id: "c",
        file: target.file,
        message: `domain type ${type.name} has a post-init method ${mutator.method_name} (c-post-init)`,
        line: mutator.line,
      });
  return findings;
}

// --- (d) getter call -----------------------------------------------------------------------------

/** The type a receiver is stated to have: an annotated binding, or a field of the enclosing class. */
function receiverType(inspection: TsInspection, file: string, call: CallFact): string | undefined {
  const receiver = (call.receiver_text ?? "").replace(/\s+/g, "");
  if (/^[A-Za-z_$][\w$]*$/.test(receiver)) return call.receiver_binding_type;
  const field = /^this\.(#?[A-Za-z_$][\w$]*)$/.exec(receiver)?.[1];
  if (field === undefined) return undefined;
  const owner = inspection.symbols.types.find(
    (type) => type.file === file && type.kind === "class" && within(call.span, type.home),
  );
  return owner?.members.find((member) => member.name === field && member.kind === "property")?.type_text;
}

export function ruleD(inspection: TsInspection, target: TsTarget): FindingInput[] {
  const findings: FindingInput[] = [];
  const facts = factsOf(inspection, target.file);
  for (const call of facts.calls) {
    if (call.kind !== "method-call" || !inspection.symbols.getter_names.has(call.callee_text)) continue;
    if ((call.receiver_text ?? "").trim() === "this") continue;
    const line = call.span.start_line;
    const stated = receiverType(inspection, target.file, call);
    if (stated === undefined) {
      inspection.undecided.add(
        target.file,
        line,
        `getter ${call.callee_text} called on ${call.receiver_text}, whose type is not stated`,
      );
      continue;
    }
    const resolved = resolveTypeName(inspection.packages, inspection.symbols, target.file, facts, stated);
    if (resolved.kind === "undecided") {
      inspection.undecided.add(target.file, line, `getter ${call.callee_text} receiver: ${resolved.reason}`);
      continue;
    }
    if (
      resolved.kind === "domain" &&
      resolved.type.methods.some((method) => method.name === call.callee_text && method.returns_state_only)
    )
      findings.push({
        rule_id: "d",
        file: target.file,
        message: `getter ${call.callee_text} called from domain layer (Tell, Don't Ask)`,
        line,
      });
  }
  return findings;
}

// --- domain packaging --------------------------------------------------------------------------

const TYPESCRIPT = SPELLINGS.typescript;

/** The modules of a domain package as its `src/` files lay them out, and the files that name none. */
function modulesOf(
  inspection: TsInspection,
  pkg: TsPackage,
): { modules: PackagingModule[]; problems: PackagingProblem[] } {
  const byPath = new Map<string, string[]>();
  const problems: PackagingProblem[] = [];
  const modules: PackagingModule[] = [];
  for (const absolute of packageSources(pkg)) {
    const file = posixRelative(inspection.packages.workspaceRoot, absolute);
    const parts = modulePathOf(pkg, absolute);
    const invalid = parts.find((part) => !TYPESCRIPT.isModuleSegment(part));
    if (invalid !== undefined) {
      problems.push({ file, reason: `${invalid} is not a module segment of a TypeScript package` });
      continue;
    }
    const key = parts.join("/");
    const files = byPath.get(key);
    if (files) {
      files.push(file);
      continue;
    }
    byPath.set(key, [file]);
    const technical = parts.map((part) => TYPESCRIPT.technicalSegment(part)).find((name) => name !== undefined);
    modules.push({ parts, file, ...(technical ? { technical } : {}) });
  }
  const collided = new Set<string>();
  for (const [key, files] of byPath) {
    if (files.length < 2) continue;
    collided.add(key);
    problems.push({
      file: files[0],
      reason: `${files.join(" and ")} both name the module path [${key.split("/").join(", ")}]`,
    });
  }
  return { modules: modules.filter((module) => !collided.has(module.parts.join("/"))), problems };
}

export function ruleDomainPackaging(inspection: TsInspection, pkg: TsPackage): FindingInput[] {
  const { modules, problems } = modulesOf(inspection, pkg);
  const mapping = inspection.mapping;
  const declared: DeclaredPackages =
    mapping.kind === "loaded" ? { kind: "loaded", packages: mapping.view.packages } : mapping;
  const technicalName = TYPESCRIPT.technicalPackage(pkg.name);
  return packagingFindings(
    {
      name: pkg.name,
      manifestFile: join(pkg.path, PACKAGE_MANIFEST),
      unit: "package",
      separator: "/",
      ...(technicalName ? { technicalName } : {}),
      modules,
      problems,
    },
    declared,
    relPath(inspection.run, mappingPathOf(inspection.run.record_dir)),
  );
}
