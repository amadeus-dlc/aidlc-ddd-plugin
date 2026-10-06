/**
 * Rust rule evaluators (U5 BR4–BR6). Each evaluator reads U2 syntax facts and
 * the U1/U2 context and explicit declaration bindings. They do not perform
 * compiler inference, trait solving or macro expansion.
 */

import type { CallFact, ParamFact, RustFileFacts, Span } from "../../rust/domain-facts/index.ts";
import { finding } from "../../sensors/common.ts";
import type { FindingInput } from "../../shared/findings.ts";
import {
  EVENT_SOURCING_STORAGE,
  eventSourcingStorageGaps,
  eventStreamElement,
  inMemoryAggregates,
  isAggregateStateElement,
  storedMapValue,
} from "../in-memory.ts";
import { containsMediaWord, toPascal } from "../lists.ts";
import { domainEventTypeNames } from "../mutations.ts";
import {
  ADAPTER_SURFACE,
  EVENT_SOURCING_STORE,
  expandGenericStoreResult,
  repositoryContractProblem,
  resultArguments,
} from "../repository-contract.ts";
import type { DomainTypeSymbol, InspectionContext, InspectionTarget } from "../types.ts";
import { rulePrimaryConstructor } from "./constructors.ts";
import { ruleFactoryNaming } from "./factories.ts";
import { evaluateDomainPackaging } from "./packaging.ts";
import { rulePrimitiveInitialization } from "./primitives.ts";
import { within as withinSpan, withoutReference } from "./program.ts";

function within(span: Span, outer: Span): boolean {
  return (
    span.start_line >= outer.start_line &&
    (span.end_line < outer.end_line || (span.end_line === outer.end_line && span.end_col <= outer.end_col))
  );
}

function stripType(typeText: string): string {
  let text = typeText.trim();
  text = text.replace(/^&(?:'\w+)?\s*(?:mut\s+)?/, "");
  let changed = true;
  while (changed) {
    changed = false;
    const match = /^(Box|Arc|Rc|Option|Vec)\s*<(.+)>$/.exec(text);
    if (match) {
      text = match[2].trim();
      changed = true;
    }
  }
  return text;
}

function domainTypeSymbol(symbols: InspectionContext["symbols"], typeName: string): DomainTypeSymbol[] {
  return symbols.types.filter((symbol) => symbol.type_name === typeName);
}

/**
 * What the extractor reported for one inspected file. An inspected file always has a record; its
 * absence means the extractor could not read the file, which is not the same answer as "it
 * declares nothing".
 */
function declarationsOf(context: InspectionContext, file: string): RustFileFacts {
  const declared = context.program.facts.files.get(file);
  if (!declared) throw new Error(`the native domain facts carry no declarations for ${file}`);
  return declared;
}

// --- (a) public field -------------------------------------------------------
function ruleA(target: InspectionTarget, context: InspectionContext): FindingInput[] {
  if (!target.file) return [];
  const file = target.file;
  return declarationsOf(context, file).publicMembers.map((member) =>
    finding("a", file, `public field ${member.typeName}.${member.name} in domain layer`, member.line),
  );
}

// --- (b) undeclared mutation ------------------------------------------------
function ruleB(target: InspectionTarget, context: InspectionContext): FindingInput[] {
  if (!target.file) return [];
  const out: FindingInput[] = [];
  for (const symbol of context.symbols.types) {
    for (const mutator of symbol.mutators) {
      if (mutator.file !== target.file) continue;
      if (mutator.classification === "undeclared") {
        out.push(
          finding(
            "b",
            target.file,
            `mutating method ${symbol.type_name}::${mutator.method_name} is not declared as command.${symbol.aggregate_slug}.${mutator.command_slug}`,
            mutator.line,
          ),
        );
      }
    }
  }
  return out;
}

// --- (c) incomplete construction --------------------------------------------
function ruleC(target: InspectionTarget, context: InspectionContext): FindingInput[] {
  if (!target.file) return [];
  const out: FindingInput[] = [];
  const declared = declarationsOf(context, target.file);
  const inherentSpans = new Map<string, Span[]>();
  for (const block of declared.impls) {
    if (block.trait_text !== undefined) continue;
    const list = inherentSpans.get(block.target_type_text) ?? [];
    list.push(block.span);
    inherentSpans.set(block.target_type_text, list);
  }
  for (const site of declared.constructions) {
    if (!context.symbols.type_names.has(site.type_text)) continue;
    if (site.kind === "struct-literal" || site.kind === "update-syntax") {
      const spans = inherentSpans.get(site.type_text) ?? [];
      if (!spans.some((span) => within(site.span, span))) {
        out.push(
          finding(
            "c",
            target.file,
            `domain type ${site.type_text} built outside its inherent impl (${site.kind})`,
            site.span.start_line,
          ),
        );
      }
    } else if (site.kind === "default-call") {
      out.push(
        finding("c", target.file, `domain type ${site.type_text} built via Default (c-default)`, site.span.start_line),
      );
    }
  }
  for (const symbol of context.symbols.types) {
    for (const location of symbol.defaults) {
      if (location.file !== target.file) continue;
      out.push(
        finding(
          "c",
          target.file,
          `domain type ${symbol.type_name} has a Default construction path (c-default)`,
          location.line,
        ),
      );
    }
    for (const mutator of symbol.mutators) {
      if (mutator.file !== target.file) continue;
      if (mutator.classification === "post-init") {
        out.push(
          finding(
            "c",
            target.file,
            `domain type ${symbol.type_name} has a post-init method ${mutator.method_name} (c-post-init)`,
            mutator.line,
          ),
        );
      }
    }
  }
  return out;
}

// --- (d) getter call --------------------------------------------------------
function isRepositoryArgument(
  file: string,
  call: CallFact,
  callSites: readonly CallFact[],
  target: InspectionTarget,
  context: InspectionContext,
): boolean {
  if (target.classification.effective_layer !== "use-case" || !call.forwarded_argument_calls.length || !target.file) {
    return false;
  }
  return call.forwarded_argument_calls.every((span) => {
    const consumer = callSites.find(
      (candidate) => withinSpan(candidate.span, span) && withinSpan(span, candidate.span),
    );
    if (consumer?.kind !== "method-call") return false;
    const port = context.program.receiver(file, consumer);
    if (!port) {
      context.program.notes.add(
        `syntax.unresolved: ${file}:${consumer.span.start_line} repository receiver; rule d exception not proven`,
      );
      return false;
    }
    if (port.kind !== "trait" || port.layer !== "use-case" || !port.name.endsWith("Repository")) {
      return false;
    }
    return port.traitMethods.includes(consumer.callee_text);
  });
}

function ruleD(target: InspectionTarget, context: InspectionContext): FindingInput[] {
  if (!target.file) return [];
  const getterNames = context.symbols.getter_names;
  const out: FindingInput[] = [];
  const callSites = declarationsOf(context, target.file).calls;
  for (const call of callSites) {
    if (call.kind !== "method-call") continue;
    const receiver = (call.receiver_text ?? "").replace(/\s+/g, " ").trim();
    if (["self", "&self", "&mut self", "Self", "&mut  self"].includes(receiver)) continue;
    if (!getterNames.has(call.callee_text)) continue;
    const type = context.program.receiver(target.file, call);
    if (!type) {
      context.program.notes.add(
        `syntax.unresolved: ${target.file}:${call.span.start_line} getter receiver; rule d not evaluated`,
      );
      continue;
    }
    if (
      type.layer === "domain" &&
      type.methods.some((entry) => entry.method.name === call.callee_text && entry.method.returns_field_only)
    ) {
      if (isRepositoryArgument(target.file, call, callSites, target, context)) continue;
      out.push(
        finding(
          "d",
          target.file,
          `getter ${call.callee_text} called from ${target.classification.effective_layer} layer (Tell, Don't Ask)`,
          call.span.start_line,
        ),
      );
    }
  }
  return out;
}

// --- (g) forbidden dependency / external I/O --------------------------------
function ruleG(target: InspectionTarget, context: InspectionContext): FindingInput[] {
  const crate = target.crate_name;
  if (!crate) return [];
  return context.edges
    .filter(
      (edge) => edge.from_crate === crate && (edge.verdict === "layer-forbidden" || edge.verdict === "external-io"),
    )
    .map((edge) =>
      finding(
        "g",
        edge.file,
        `dependency direction ${edge.from_crate} -> ${edge.to_crate} (${edge.verdict})`,
        edge.line,
      ),
    );
}

// --- (h) execute aggregate argument -----------------------------------------
function ruleH(target: InspectionTarget, context: InspectionContext): FindingInput[] {
  if (!target.file) return [];
  if (context.model.status !== "available") return [];
  const out: FindingInput[] = [];
  const file = context.program.files.get(target.file);
  if (!file) return [];
  const check = (name: string, params: readonly ParamFact[], line: number, module: readonly string[]) => {
    if (name !== "execute") return;
    for (const param of params) {
      const stripped = stripType(param.type_text);
      const type = context.program.resolveType(file.file, [...file.module, ...module], param.type_text);
      if (!type && !/^(bool|str|String|[uif](8|16|32|64|128)|[ui]size|\(\))$/.test(stripped)) {
        context.program.notes.add(
          `syntax.unresolved: ${file.file}:${line} parameter ${param.type_text}; rule h not evaluated`,
        );
      }
      if (
        type &&
        context.symbols.types.some((symbol) => symbol.key === type.key && symbol.aggregate_ref !== undefined)
      ) {
        out.push(
          finding("h", file.file, `execute receives aggregate ${stripped} directly; pass ids and value objects`, line),
        );
      }
    }
  };
  const declared = declarationsOf(context, target.file);
  for (const block of declared.impls) {
    for (const method of block.methods) check(method.name, method.params, method.line, block.module);
  }
  for (const fn of declared.functions) check(fn.name, fn.params, fn.line, fn.module);
  return out;
}

// --- (use-case-name) a use case type ends with UseCase ----------------------
// The type an impl block with `execute` belongs to is a use case, and its name ends with `UseCase`
// (`IssueInvoiceUseCase`). A free `fn execute` has no type to name.
function ruleUseCaseName(target: InspectionTarget, context: InspectionContext): FindingInput[] {
  if (!target.file) return [];
  const file = target.file;
  const out: FindingInput[] = [];
  const reported = new Set<string>();
  for (const block of declarationsOf(context, file).impls) {
    if (!block.methods.some((method) => method.name === "execute")) continue;
    const name =
      block.target_type_text
        .replace(/<[\s\S]*$/, "")
        .trim()
        .split("::")
        .pop() ?? "";
    if (name === "" || name.endsWith("UseCase") || reported.has(name)) continue;
    reported.add(name);
    out.push(
      finding(
        "use-case-name",
        file,
        `use case ${name} is not named <Verb><Object>UseCase; name it ${name}UseCase`,
        block.span.start_line,
      ),
    );
  }
  return out;
}

// --- (repository-result) a repository port reports its failures ------------
// Every method of a repository port (a trait named `…Repository`) returns `Result<…>`, spelled bare or
// through a path (`std::result::Result<…>`, `::std::result::Result<…>`). Loading and storing reach
// outside the process and can fail; a `store` that returns `()` leaves the use case no way to see
// that the state it changed was never kept.
function ruleRepositoryResult(target: InspectionTarget, context: InspectionContext): FindingInput[] {
  if (!target.file) return [];
  const file = target.file;
  const out: FindingInput[] = [];
  for (const trait of declarationsOf(context, file).traits) {
    if (!trait.name.endsWith("Repository")) continue;
    for (const signature of trait.signatures) {
      const returned = expandGenericStoreResult(
        signature.return_type_text?.trim(),
        declarationsOf(context, file).aliases,
      );
      if (returned !== undefined && /^(?:::)?(?:\w+::)*Result\s*</.test(returned)) continue;
      out.push(
        finding(
          "repository-result",
          file,
          `repository port method ${trait.name}::${signature.name} returns ${returned ?? "()"}; return Result<…, RepositoryError> so the use case sees a failed load or store`,
          signature.line,
        ),
      );
    }
  }
  return out;
}

// --- (repository-mut-self) a repository port changes its storage through &mut self ----
// A method of a repository port (a trait named `…Repository`) that changes what is stored —
// `store…` or `delete…` — takes `&mut self` by default. Taking `&self` hides the change behind
// interior mutability in every implementation, which ownership would otherwise show. The one
// exception is a port shared across threads, which declares `Sync` as a supertrait and guards its
// storage with a lock.
function ruleRepositoryMutSelf(target: InspectionTarget, context: InspectionContext): FindingInput[] {
  if (!target.file) return [];
  const file = target.file;
  const out: FindingInput[] = [];
  for (const trait of declarationsOf(context, file).traits) {
    if (!trait.name.endsWith("Repository")) continue;
    if (trait.supertraits.some((bound) => /(?:^|::)Sync$/.test(bound.trim()))) continue;
    for (const signature of trait.signatures) {
      if (!/^(?:store|append|delete)/.test(signature.name) || signature.receiver === "mut-self") continue;
      out.push(
        finding(
          "repository-mut-self",
          file,
          `repository port method ${trait.name}::${signature.name} changes what is stored but does not take &mut self; take &mut self, or declare the port Send + Sync when it is shared across threads behind a lock`,
          signature.line,
        ),
      );
    }
  }
  return out;
}

// --- (i) use case chaining --------------------------------------------------
function ruleI(target: InspectionTarget, context: InspectionContext): FindingInput[] {
  if (!target.file) return [];
  const out: FindingInput[] = [];
  for (const call of declarationsOf(context, target.file).calls) {
    if (call.callee_text !== "execute" && !call.callee_text.endsWith("::execute")) continue;
    if (["self", "Self"].includes((call.receiver_text ?? "").trim())) continue;
    const file = context.program.files.get(target.file);
    if (!file) continue;
    const type =
      call.kind === "method-call"
        ? context.program.receiver(target.file, call)
        : context.program.resolveType(target.file, [...file.module, ...call.module], call.callee_text.slice(0, -9));
    if (!type) {
      context.program.notes.add(
        `syntax.unresolved: ${target.file}:${call.span.start_line} execute receiver; rule i not evaluated`,
      );
      continue;
    }
    const caller = file.impls.find((block) => withinSpan(call.span, block.span));
    const callerType =
      caller && context.program.resolveType(target.file, [...file.module, ...caller.module], caller.target_type_text);
    if (callerType?.key === type.key) continue;
    if (
      type.layer === "use-case" &&
      type.kind !== "trait" &&
      type.methods.some((entry) => !entry.trait && entry.method.name === "execute")
    ) {
      out.push(finding("i", target.file, `use case calls ${type.key}::execute`, call.span.start_line));
    }
  }
  return out;
}

// --- (k) cross-side reference -----------------------------------------------
function ruleK(target: InspectionTarget, context: InspectionContext): FindingInput[] {
  const crate = target.crate_name;
  if (!crate) return [];
  return context.edges
    .filter((edge) => edge.from_crate === crate && edge.verdict === "cross-side")
    .map((edge) => finding("k", edge.file, `cross-side reference ${edge.from_crate} -> ${edge.to_crate}`, edge.line));
}

// --- (l) query side domain / repository reference ---------------------------
function ruleL(target: InspectionTarget, context: InspectionContext): FindingInput[] {
  if (!target.file) return [];
  if (target.classification.cqrs_side !== "query") return [];
  const out: FindingInput[] = [];
  const isDomainOrRepo = (name: string) => context.symbols.type_names.has(name) || name.endsWith("Repository");
  for (const use of declarationsOf(context, target.file).uses) {
    const last =
      use.path_text
        .split("::")
        .pop()
        ?.replace(/[{}\s*]/g, "") ?? "";
    if (isDomainOrRepo(last)) {
      out.push(finding("l", target.file, `query side references domain type / repository port ${last}`, use.line));
    }
  }
  for (const symbol of context.symbols.types) {
    if (symbol.file !== target.file) continue;
    for (const typeText of symbol.field_type_texts) {
      const stripped = stripType(typeText);
      if (isDomainOrRepo(stripped)) {
        out.push(finding("l", target.file, `query side references domain type / repository port ${stripped}`));
      }
    }
  }
  return out;
}

// --- (m) repository naming --------------------------------------------------
function ruleM(target: InspectionTarget, context: InspectionContext): FindingInput[] {
  if (!target.file) return [];
  const out: FindingInput[] = [];
  const aggregates = new Set<string>();
  if (context.model.status === "available" && context.model.index) {
    for (const element of context.model.index.elements("aggregate")) {
      aggregates.add(toPascal(element.id.segments[0]));
    }
  }
  if (aggregates.size === 0) {
    for (const name of context.symbols.type_names) aggregates.add(name);
  }
  const matchesAggregate = (name: string): boolean => {
    if (!name.endsWith("Repository")) return true;
    const stem = name.slice(0, -"Repository".length);
    return [...aggregates].some((aggregate) => stem === aggregate || stem.endsWith(aggregate));
  };
  const declared = declarationsOf(context, target.file);
  // Ports (traits): <Aggregate>Repository, free of a storage medium.
  for (const trait of declared.traits) {
    if (!trait.name.endsWith("Repository")) continue;
    if (!matchesAggregate(trait.name)) {
      out.push(finding("m", target.file, `repository port ${trait.name} is not <Aggregate>Repository`, trait.line));
    }
    if (containsMediaWord(trait.name)) {
      out.push(finding("m", target.file, `repository port ${trait.name} names a storage medium`, trait.line));
    }
  }
  // Implementations (structs): a medium prefix is allowed; the trait carries the
  // naming contract.
  for (const decl of declared.types) {
    if (decl.name.endsWith("Repository") && !matchesAggregate(decl.name)) {
      out.push(finding("m", target.file, `repository type ${decl.name} is not <Aggregate>Repository`, decl.line));
    }
  }
  return out;
}

// --- (port-placement) a port belongs to the use-case layer -----------------
// A repository port (a trait named `…Repository`) declared in a domain crate. The use case loads
// and stores through its ports; the domain never declares, holds or calls one.
function rulePortPlacement(target: InspectionTarget, context: InspectionContext): FindingInput[] {
  if (!target.file) return [];
  const file = target.file;
  return declarationsOf(context, file)
    .traits.filter((trait) => trait.name.endsWith("Repository"))
    .map((trait) =>
      finding(
        "port-placement",
        file,
        `repository port ${trait.name} is declared in the domain layer; declare it in the use-case layer`,
        trait.line,
      ),
    );
}

// --- (n) restoration bypass -------------------------------------------------
function ruleN(target: InspectionTarget, context: InspectionContext): FindingInput[] {
  if (!target.file) return [];
  const out: FindingInput[] = [];
  for (const site of declarationsOf(context, target.file).constructions) {
    if (!context.symbols.type_names.has(site.type_text)) continue;
    if (site.kind === "struct-literal" || site.kind === "update-syntax" || site.kind === "default-call") {
      out.push(
        finding(
          "n",
          target.file,
          `adapter constructs ${site.type_text} via ${site.kind} instead of a full constructor`,
          site.span.start_line,
        ),
      );
      continue;
    }
    if (site.kind === "associated-call") {
      const constructors = context.symbols.constructors_by_type.get(site.type_text);
      if (!constructors || !site.callee_text || !constructors.has(site.callee_text)) {
        out.push(
          finding(
            "n",
            target.file,
            `adapter constructs ${site.type_text} via ${site.callee_text ?? "an unknown function"} instead of a full constructor`,
            site.span.start_line,
          ),
        );
      }
    }
  }
  void domainTypeSymbol;
  return out;
}

function ruleRepositoryContract(target: InspectionTarget, context: InspectionContext): FindingInput[] {
  if (!target.file) return [];
  const facts = declarationsOf(context, target.file);
  const ports = facts.traits.filter((entry) => entry.name.endsWith("Repository"));
  if (!ports.length) return [];
  const findings: FindingInput[] = [];
  for (const port of ports) {
    const aggregate = port.name.slice(0, -"Repository".length);
    for (const method of port.signatures) {
      const problem = repositoryContractProblem(
        method.name,
        expandGenericStoreResult(method.return_type_text, facts.aliases),
        aggregate,
        "rust",
      );
      if (problem)
        findings.push(
          finding("repository-result-contract", target.file, `${port.name}::${method.name}: ${problem}`, method.line),
        );
    }
  }
  for (const alias of facts.aliases.filter((entry) => !entry.generic)) {
    const parts = resultArguments(alias.type_text);
    if (parts && parts[1] === "RepositoryError")
      findings.push(
        finding(
          "repository-result-contract",
          target.file,
          `${alias.name} only renames a repository Result; use Result directly or a reusable generic alias`,
        ),
      );
  }
  return findings;
}

/**
 * An Event Sourcing repository port stores the domain event with the aggregate right after it,
 * `fn store(&mut self, event: Event, snapshot: Aggregate)`: the event already carries its aggregate
 * id, and the snapshot lets `find_by_id` replay only the events after it. Either may be borrowed.
 */
function ruleEventSourcingStore(target: InspectionTarget, context: InspectionContext): FindingInput[] {
  if (!target.file || context.rustMapping.kind !== "loaded") return [];
  const file = target.file;
  const source = context.program.files.get(file);
  if (!source) return []; // The program leaves out a file shared by several module namespaces and notes it as syntax.unresolved.
  const facts = declarationsOf(context, file);
  const findings: FindingInput[] = [];
  for (const port of facts.traits.filter((entry) => entry.name.endsWith("Repository"))) {
    const aggregate = context.rustMapping.view.aggregates.find(
      (entry) => entry.persistence_method === "event-sourcing" && `${entry.type}Repository` === port.name,
    );
    if (!aggregate) continue;
    const crate = aggregate.crate.replace(/-/g, "_");
    const eventNames = domainEventTypeNames(context.model, aggregate.aggregate_ref, aggregate.type);
    // A reference is read off the front of the spelling; what remains must be one named type, which
    // `resolveNamedType` follows through aliases without looking inside a `Vec<…>` or an `Option<…>`.
    const resolve = (text: string) =>
      context.program.resolveNamedType(file, [...source.module, ...port.module], withoutReference(text));
    for (const method of port.signatures.filter((entry) => entry.name === "store")) {
      const [event, snapshot] = method.params.map((param) => resolve(param.type_text));
      const eventOk = Boolean(
        event &&
          event.crate === crate &&
          eventNames.has(event.name) &&
          event.name !== aggregate.type &&
          !isAggregateStateElement(context.model, aggregate.aggregate_ref, event.name),
      );
      const snapshotOk = Boolean(snapshot && snapshot.crate === crate && snapshot.name === aggregate.type);
      if (method.params.length === 2 && eventOk && snapshotOk) continue;
      const spelled = method.params.map((param) => `${param.name}: ${param.type_text}`).join(", ");
      findings.push(
        finding("event-sourcing-store", file, `${port.name}::store(${spelled}): ${EVENT_SOURCING_STORE}`, method.line),
      );
    }
  }
  return findings;
}

/** A repository port an impl block implements, and the type it implements it for. */
interface RepositoryImpl {
  readonly port: string;
  /** The identifier of the type the port is implemented for. */
  readonly target: string;
}

/**
 * The impl blocks of `file` that implement a repository port. A trait is a repository port by what
 * it resolves to, so an `as` rename or a qualified path still names it; one the program cannot
 * resolve is judged by how it is spelled. The type is the one the impl's target resolves to, so a
 * qualified path or a rename of it names it too.
 */
function repositoryImpls(context: InspectionContext, file: string): RepositoryImpl[] {
  const source = context.program.files.get(file);
  if (!source) return []; // The program leaves out a file shared by several module namespaces and notes it as syntax.unresolved.
  return source.impls.flatMap((impl) => {
    if (impl.trait_text === undefined) return [];
    const scope = [...source.module, ...impl.module];
    const path = impl.trait_text.replace(/<.*$/, "");
    const trait = context.program.resolveType(file, scope, path);
    const port = trait ? (trait.kind === "trait" ? trait.name : undefined) : path.split("::").pop();
    const target = context.program.resolveType(file, scope, impl.target_type_text.replace(/<.*$/, ""))?.key;
    return port?.endsWith("Repository") && target !== undefined ? [{ port, target }] : [];
  });
}

/**
 * A struct that implements a repository port exposes only that port and its constructors: a public
 * inherent method other than an associated function returning `Self` (an accessor that hands the
 * stored history to tests), or a public field, widens the adapter beyond the use case's contract.
 */
function ruleRepositoryAdapterSurface(target: InspectionTarget, context: InspectionContext): FindingInput[] {
  if (!target.file) return [];
  const file = target.file;
  const source = context.program.files.get(file);
  if (!source) return []; // The program leaves out a file shared by several module namespaces and notes it as syntax.unresolved.
  const facts = declarationsOf(context, file);
  const resolve = (module: readonly string[], text: string) =>
    context.program.resolveType(file, [...source.module, ...module], text);
  // The type a repository port is implemented for is found among the impl blocks of the whole
  // program, so the trait impl may sit in another file than the struct and its inherent impl.
  const adapters = new Set(
    [...context.program.files.keys()].flatMap((other) => repositoryImpls(context, other).map((impl) => impl.target)),
  );
  const findings: FindingInput[] = [];
  for (const type of facts.types.filter((entry) => {
    const key = resolve(entry.module, entry.name)?.key;
    return key !== undefined && adapters.has(key);
  }))
    for (const field of type.fields.filter((entry) => entry.visibility !== "private"))
      findings.push(
        finding(
          "repository-adapter-surface",
          file,
          `${type.name}.${field.name} is not part of its port: ${ADAPTER_SURFACE}`,
          field.line,
        ),
      );
  for (const block of facts.impls.filter((entry) => {
    if (entry.trait_text !== undefined) return false;
    const key = resolve(entry.module, entry.target_type_text.replace(/<.*$/, ""))?.key;
    return key !== undefined && adapters.has(key);
  }))
    for (const method of block.methods) {
      if (method.visibility === "private") continue;
      const returned = method.return_type_text?.trim();
      const constructs =
        method.receiver === "none" &&
        returned !== undefined &&
        (returned === "Self" ||
          context.program.resolveNamedType(file, [...source.module, ...block.module], returned)?.key ===
            resolve(block.module, block.target_type_text)?.key);
      if (constructs) continue;
      findings.push(
        finding(
          "repository-adapter-surface",
          file,
          `${block.target_type_text}::${method.name} is not part of its port: ${ADAPTER_SURFACE}`,
          method.line,
        ),
      );
    }
  return findings;
}

function ruleInMemoryRestoration(target: InspectionTarget, context: InspectionContext): FindingInput[] {
  return inMemoryStorage(target, context, "in-memory-restoration");
}

function ruleEventSourcingStorage(target: InspectionTarget, context: InspectionContext): FindingInput[] {
  return inMemoryStorage(target, context, "event-sourcing-storage");
}

function inMemoryStorage(
  target: InspectionTarget,
  context: InspectionContext,
  rule: "in-memory-restoration" | "event-sourcing-storage",
): FindingInput[] {
  if (!target.file || !target.crate_name || context.rustMapping.kind !== "loaded") return [];
  const file = target.file;
  const references = inMemoryAggregates(context.run, target.crate_name, "rust");
  if (!references.size) return [];
  const facts = declarationsOf(context, target.file);
  const implemented = repositoryImpls(context, file);
  if (!implemented.length) return [];
  const state = rule === "in-memory-restoration";
  const aggregates = context.rustMapping.view.aggregates.filter(
    (entry) =>
      references.has(entry.aggregate_ref) && entry.persistence_method === (state ? "state-sourcing" : "event-sourcing"),
  );
  if (!aggregates.length) return [];
  const source = context.program.files.get(file);
  if (!source) throw new Error(`missing inspected source ${file}`);
  const module = source.module;
  const findings: FindingInput[] = [];
  for (const repository of facts.types) {
    const key = context.program.resolveType(file, [...module, ...repository.module], repository.name)?.key;
    const owned = aggregates.filter((entry) =>
      implemented.some((impl) => impl.target === key && impl.port === `${entry.type}Repository`),
    );
    if (!owned.length) continue;
    let streams = 0;
    let snapshots = 0;
    for (const field of repository.fields) {
      const value = storedMapValue(field.type_text);
      if (value === undefined) continue;
      const element = state ? value : eventStreamElement(value, "rust");
      const type = context.program.resolveType(target.file, [...module, ...repository.module], element ?? value);
      const direct = Boolean(
        type && owned.some((entry) => entry.type === type.name && entry.crate.replace(/-/g, "_") === type.crate),
      );
      const stateElement = Boolean(
        type && owned.some((entry) => isAggregateStateElement(context.model, entry.aggregate_ref, type.name)),
      );
      const domainEvent = Boolean(type && owned.some((entry) => entry.crate.replace(/-/g, "_") === type.crate));
      if (state && direct) continue;
      if (!state && element !== undefined && domainEvent && !direct && !stateElement) {
        streams++;
        continue;
      }
      const snapshot =
        !state && element === undefined
          ? context.program.resolveNamedType(target.file, [...module, ...repository.module], value)
          : undefined;
      if (
        snapshot &&
        owned.some((entry) => entry.type === snapshot.name && entry.crate.replace(/-/g, "_") === snapshot.crate)
      ) {
        snapshots++;
        continue;
      }
      findings.push(
        finding(
          rule,
          target.file,
          `${repository.name}.${field.name} stores ${value}; ${state ? "its map must retain the aggregate directly" : EVENT_SOURCING_STORAGE}`,
          field.line,
        ),
      );
    }
    if (!state)
      for (const problem of eventSourcingStorageGaps(streams, snapshots))
        findings.push(finding(rule, target.file, `${repository.name} ${problem}`, repository.line));
  }
  if (!state) return findings;
  return [
    ...findings,
    ...facts.constructions.flatMap((site) => {
      if (site.kind !== "associated-call" || site.callee_text !== "restore") return [];
      const type = context.program.resolveType(file, module, site.type_text);
      if (
        !type ||
        !aggregates.some((entry) => entry.type === type.name && entry.crate.replace(/-/g, "_") === type.crate)
      )
        return [];
      return [
        finding(
          "in-memory-restoration",
          file,
          `in-memory repository reconstructs ${type.name}; retain the aggregate object directly instead of a persistence record`,
          site.span.start_line,
        ),
      ];
    }),
  ];
}

export const PER_FILE_EVALUATORS: Record<
  string,
  (target: InspectionTarget, context: InspectionContext) => FindingInput[]
> = {
  "primitive-initialization": rulePrimitiveInitialization,
  "factory-naming": ruleFactoryNaming,
  "primary-constructor": rulePrimaryConstructor,
  "repository-result-contract": ruleRepositoryContract,
  "in-memory-restoration": ruleInMemoryRestoration,
  "event-sourcing-storage": ruleEventSourcingStorage,
  "event-sourcing-store": ruleEventSourcingStore,
  "repository-adapter-surface": ruleRepositoryAdapterSurface,
  a: ruleA,
  b: ruleB,
  c: ruleC,
  d: ruleD,
  "port-placement": rulePortPlacement,
  h: ruleH,
  i: ruleI,
  "use-case-name": ruleUseCaseName,
  "repository-result": ruleRepositoryResult,
  "repository-mut-self": ruleRepositoryMutSelf,
  l: ruleL,
  m: ruleM,
  n: ruleN,
};

export const CONTEXT_EVALUATORS: Record<
  string,
  (target: InspectionTarget, context: InspectionContext) => FindingInput[]
> = {
  g: ruleG,
  k: ruleK,
  "domain-packaging": evaluateDomainPackaging,
};
