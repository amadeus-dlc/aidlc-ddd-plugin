/**
 * TypeScript rule evaluators of the domain gate: undeclared mutation (b), incomplete construction
 * (c), getter calls (d) and domain packaging, each in the words the Rust domain gate reports them
 * in. State hiding (a) is in `state-hiding.ts` and the dependency direction (g) in `edges.ts`.
 * Getter calls (d) are decided the same way over a use-case source, where a getter result handed
 * unchanged to a repository port is the one call the rule permits. What the rules of every gate read
 * off a file's facts is in `file-facts.ts`, and the binding of a type to a model aggregate in
 * `aggregate-binding.ts`.
 *
 * Nothing here infers a type. A receiver or a constructed type is what a declaration, an import or
 * an annotation spells, and what those do not decide is left undecided rather than passed.
 */

import { join } from "node:path";
import { mappingPathOf } from "../../aggregate-mapping/index.ts";
import { SPELLINGS } from "../../aggregate-mapping/language.ts";
import {
  type DeclaredPackages,
  type PackagingModule,
  type PackagingProblem,
  packagingFindings,
} from "../../packaging/evaluate.ts";
import { relPath } from "../../sensors/common.ts";
import type { FindingInput } from "../../shared/findings.ts";
import {
  type CallFact,
  COLLECTION_MUTATORS,
  type Span,
  type TypeScriptFileFacts,
} from "../../typescript/domain-facts/index.ts";
import { toKebab } from "../lists.ts";
import { classifyMutation, declaredReplayEventNames } from "../mutations.ts";
import type { MutatorSymbol } from "../types.ts";
import { aggregateBinding, aggregateMappings, locatedAt } from "./aggregate-binding.ts";
import { factsOf, receiverType } from "./file-facts.ts";
import { modulePathOf, PACKAGE_MANIFEST, packageSources, posixRelative, type TsPackage } from "./packages.ts";
import { isPortDeclaration, resolveConstructedType, resolveDeclaredType, resolveTypeName, within } from "./symbols.ts";
import type { TsDomainType, TsInspection, TsMethod, TsTarget } from "./types.ts";

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
  return inspection.symbols.types
    .filter((type) => type.file === file)
    .map((type) => {
      const binding = aggregateBinding(inspection, type);
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

function sameSpan(a: Span, b: Span): boolean {
  return within(a, b) && within(b, a);
}

/**
 * Whether the result of a getter call written in a use-case source reaches nothing but repository
 * ports: every call it is handed to unchanged is a method a port declares — an interface or a type
 * literal alias of the domain or use-case layer named `…Repository` — called on a receiver stated to
 * be that port. What
 * cannot be proven so leaves the getter call a finding rather than undecided, as the Rust gate
 * leaves an unproven forwarding.
 */
function isRepositoryForwarding(
  inspection: TsInspection,
  target: TsTarget,
  facts: TypeScriptFileFacts,
  call: CallFact,
): boolean {
  if (target.pkg.assignment.layer !== "use-case" || !call.forwarded_to?.length) return false;
  return call.forwarded_to.every((span) => {
    const consumer = facts.calls.find((candidate) => sameSpan(candidate.span, span));
    if (consumer?.kind !== "method-call") return false;
    const stated = receiverType(facts, consumer);
    if (stated === undefined) return false;
    const port = resolveDeclaredType(inspection.packages, inspection.declarations, target.file, facts, stated);
    if (port.kind !== "found") return false;
    const { declaration, pkg } = port.entry;
    return (
      isPortDeclaration(declaration) &&
      (pkg.assignment.layer === "domain" || pkg.assignment.layer === "use-case") &&
      declaration.name.endsWith("Repository") &&
      declaration.members.some((member) => member.kind === "method" && member.name === consumer.callee_text)
    );
  });
}

/** Getter calls of a claimed source, reported from the layer of its package. */
export function ruleD(inspection: TsInspection, target: TsTarget): FindingInput[] {
  const findings: FindingInput[] = [];
  const facts = factsOf(inspection, target.file);
  for (const call of facts.calls) {
    if (call.kind !== "method-call" || !inspection.symbols.getter_names.has(call.callee_text)) continue;
    if ((call.receiver_text ?? "").trim() === "this") continue;
    const line = call.span.start_line;
    const stated = receiverType(facts, call);
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
      resolved.type.methods.some((method) => method.name === call.callee_text && method.returns_state_only) &&
      !isRepositoryForwarding(inspection, target, facts, call)
    )
      findings.push({
        rule_id: "d",
        file: target.file,
        message: `getter ${call.callee_text} called from ${target.pkg.assignment.layer} layer (Tell, Don't Ask)`,
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
