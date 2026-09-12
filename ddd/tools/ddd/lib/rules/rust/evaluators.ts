/**
 * Rust rule evaluators (U5 BR4–BR6). Each evaluator reads U2 syntax facts and
 * the U1/U2 context and explicit declaration bindings. They do not perform
 * compiler inference, trait solving or macro expansion.
 */

import { evaluateDomainPackaging } from "../../packaging/evaluate.ts";
import { calls, constructions, fns, impls, type Span, structs, traits, uses } from "../../rust/analyzer.ts";
import { finding } from "../../sensors/common.ts";
import type { FindingInput } from "../../shared/findings.ts";
import { containsMediaWord, toPascal } from "../lists.ts";
import type { DomainTypeSymbol, InspectionContext, InspectionTarget } from "../types.ts";
import { within as withinSpan } from "./program.ts";

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

// --- (a) public field -------------------------------------------------------
function ruleA(target: InspectionTarget, context: InspectionContext): FindingInput[] {
  if (!target.tree) return [];
  const out: FindingInput[] = [];
  for (const decl of structs(target.tree)) {
    if (decl.kind !== "struct") continue;
    for (const field of decl.fields) {
      if (field.visibility !== "private") {
        out.push(
          finding(
            "a",
            target.tree.file,
            `public field ${decl.name}.${field.name} in domain layer`,
            field.span.start_line,
          ),
        );
      }
    }
    void context;
  }
  return out;
}

// --- (b) undeclared mutation ------------------------------------------------
function ruleB(target: InspectionTarget, context: InspectionContext): FindingInput[] {
  if (!target.tree) return [];
  const out: FindingInput[] = [];
  for (const symbol of context.symbols.types) {
    for (const mutator of symbol.mutators) {
      if (mutator.file !== target.tree.file) continue;
      if (mutator.classification === "undeclared") {
        out.push(
          finding(
            "b",
            target.tree.file,
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
  if (!target.tree) return [];
  const out: FindingInput[] = [];
  const inherentSpans = new Map<string, Span[]>();
  for (const block of impls(target.tree)) {
    if (block.trait_text !== undefined) continue;
    const list = inherentSpans.get(block.target_type_text) ?? [];
    list.push(block.span);
    inherentSpans.set(block.target_type_text, list);
  }
  for (const site of constructions(target.tree)) {
    if (!context.symbols.type_names.has(site.type_text)) continue;
    if (site.kind === "struct-literal" || site.kind === "update-syntax") {
      const spans = inherentSpans.get(site.type_text) ?? [];
      if (!spans.some((span) => within(site.span, span))) {
        out.push(
          finding(
            "c",
            target.tree.file,
            `domain type ${site.type_text} built outside its inherent impl (${site.kind})`,
            site.span.start_line,
          ),
        );
      }
    } else if (site.kind === "default-call") {
      out.push(
        finding(
          "c",
          target.tree.file,
          `domain type ${site.type_text} built via Default (c-default)`,
          site.span.start_line,
        ),
      );
    }
  }
  for (const symbol of context.symbols.types) {
    for (const location of symbol.defaults) {
      if (location.file !== target.tree.file) continue;
      out.push(
        finding(
          "c",
          target.tree.file,
          `domain type ${symbol.type_name} has a Default construction path (c-default)`,
          location.line,
        ),
      );
    }
    for (const mutator of symbol.mutators) {
      if (mutator.file !== target.tree.file) continue;
      if (mutator.classification === "post-init") {
        out.push(
          finding(
            "c",
            target.tree.file,
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
function ruleD(target: InspectionTarget, context: InspectionContext): FindingInput[] {
  if (!target.tree) return [];
  const out: FindingInput[] = [];
  for (const call of calls(target.tree)) {
    if (call.kind !== "method-call") continue;
    const receiver = (call.receiver_text ?? "").replace(/\s+/g, " ").trim();
    if (["self", "&self", "&mut self", "Self", "&mut  self"].includes(receiver)) continue;
    if (!context.symbols.getter_names.has(call.callee_text)) continue;
    const type = context.program.receiver(target.tree.file, call);
    if (!type) {
      context.program.notes.add(
        `syntax.unresolved: ${target.tree.file}:${call.span.start_line} getter receiver; rule d not evaluated`,
      );
      continue;
    }
    if (
      type.layer === "domain" &&
      type.methods.some(
        (entry) => entry.method.name === call.callee_text && entry.method.body_shape === "returns-field-only",
      )
    ) {
      out.push(
        finding(
          "d",
          target.tree.file,
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
  if (!target.tree) return [];
  if (context.model.status !== "available") return [];
  const out: FindingInput[] = [];
  const file = context.program.files.get(target.tree.file);
  if (!file) return [];
  const check = (name: string, params: { name: string; type_text: string }[], line: number, module: string[]) => {
    if (name !== "execute") return;
    for (const param of params) {
      const stripped = stripType(param.type_text);
      const type = context.program.resolveType(file.tree.file, [...file.module, ...module], param.type_text);
      if (!type && !/^(bool|str|String|[uif](8|16|32|64|128)|[ui]size|\(\))$/.test(stripped)) {
        context.program.notes.add(
          `syntax.unresolved: ${file.tree.file}:${line} parameter ${param.type_text}; rule h not evaluated`,
        );
      }
      if (
        type &&
        context.symbols.types.some((symbol) => symbol.key === type.key && symbol.aggregate_ref !== undefined)
      ) {
        out.push(
          finding(
            "h",
            target.tree?.file ?? "",
            `execute receives aggregate ${stripped} directly; pass ids and value objects`,
            line,
          ),
        );
      }
    }
  };
  for (const block of impls(target.tree)) {
    for (const method of block.methods) check(method.name, method.params, method.span.start_line, block.module_path);
  }
  for (const fn of fns(target.tree)) check(fn.name, fn.params, fn.span.start_line, fn.module_path);
  return out;
}

// --- (i) use case chaining --------------------------------------------------
function ruleI(target: InspectionTarget, context: InspectionContext): FindingInput[] {
  if (!target.tree) return [];
  const out: FindingInput[] = [];
  for (const call of calls(target.tree)) {
    if (call.callee_text !== "execute" && !call.callee_text.endsWith("::execute")) continue;
    if (["self", "Self"].includes((call.receiver_text ?? "").trim())) continue;
    const file = context.program.files.get(target.tree.file);
    if (!file) continue;
    const type =
      call.kind === "method-call"
        ? context.program.receiver(target.tree.file, call)
        : context.program.resolveType(
            target.tree.file,
            [...file.module, ...call.module_path],
            call.callee_text.slice(0, -9),
          );
    if (!type) {
      context.program.notes.add(
        `syntax.unresolved: ${target.tree.file}:${call.span.start_line} execute receiver; rule i not evaluated`,
      );
      continue;
    }
    const caller = file.impls.find((block) => withinSpan(call.span, block.span));
    const callerType =
      caller &&
      context.program.resolveType(target.tree.file, [...file.module, ...caller.module_path], caller.target_type_text);
    if (callerType?.key === type.key) continue;
    if (
      type.layer === "use-case" &&
      type.kind !== "trait" &&
      type.methods.some((entry) => !entry.trait && entry.method.name === "execute")
    ) {
      out.push(finding("i", target.tree.file, `use case calls ${type.key}::execute`, call.span.start_line));
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
  if (!target.tree) return [];
  if (target.classification.cqrs_side !== "query") return [];
  const out: FindingInput[] = [];
  const isDomainOrRepo = (name: string) => context.symbols.type_names.has(name) || name.endsWith("Repository");
  for (const use of uses(target.tree)) {
    const last =
      use.path_text
        .split("::")
        .pop()
        ?.replace(/[{}\s*]/g, "") ?? "";
    if (isDomainOrRepo(last)) {
      out.push(
        finding(
          "l",
          target.tree.file,
          `query side references domain type / repository port ${last}`,
          use.span.start_line,
        ),
      );
    }
  }
  for (const symbol of context.symbols.types) {
    if (symbol.file !== target.tree.file) continue;
    for (const typeText of symbol.field_type_texts) {
      const stripped = stripType(typeText);
      if (isDomainOrRepo(stripped)) {
        out.push(finding("l", target.tree.file, `query side references domain type / repository port ${stripped}`));
      }
    }
  }
  return out;
}

// --- (m) repository naming --------------------------------------------------
function ruleM(target: InspectionTarget, context: InspectionContext): FindingInput[] {
  if (!target.tree) return [];
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
  // Ports (traits): <Aggregate>Repository, free of a storage medium.
  for (const trait of traits(target.tree)) {
    if (!trait.name.endsWith("Repository")) continue;
    if (!matchesAggregate(trait.name)) {
      out.push(
        finding(
          "m",
          target.tree.file,
          `repository port ${trait.name} is not <Aggregate>Repository`,
          trait.span.start_line,
        ),
      );
    }
    if (containsMediaWord(trait.name)) {
      out.push(
        finding("m", target.tree.file, `repository port ${trait.name} names a storage medium`, trait.span.start_line),
      );
    }
  }
  // Implementations (structs): a medium prefix is allowed; the trait carries the
  // naming contract.
  for (const decl of structs(target.tree)) {
    if (decl.name.endsWith("Repository") && !matchesAggregate(decl.name)) {
      out.push(
        finding(
          "m",
          target.tree.file,
          `repository type ${decl.name} is not <Aggregate>Repository`,
          decl.span.start_line,
        ),
      );
    }
  }
  return out;
}

// --- (n) restoration bypass -------------------------------------------------
function ruleN(target: InspectionTarget, context: InspectionContext): FindingInput[] {
  if (!target.tree) return [];
  const out: FindingInput[] = [];
  for (const site of constructions(target.tree)) {
    if (!context.symbols.type_names.has(site.type_text)) continue;
    if (site.kind === "struct-literal" || site.kind === "update-syntax" || site.kind === "default-call") {
      out.push(
        finding(
          "n",
          target.tree.file,
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
            target.tree.file,
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

export const PER_FILE_EVALUATORS: Record<
  string,
  (target: InspectionTarget, context: InspectionContext) => FindingInput[]
> = {
  a: ruleA,
  b: ruleB,
  c: ruleC,
  d: ruleD,
  h: ruleH,
  i: ruleI,
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
