/**
 * What the TypeScript domain rules are evaluated over: the claimed domain sources, the packages of
 * the project, the facts of every source the rules decide from, and the domain types those facts
 * declare. Assembled once by `context.ts`; the rules only read it.
 */

import type { MappingViewLoad } from "../../aggregate-mapping/index.ts";
import type { SensorRunContext } from "../../runtime/context.ts";
import type { FindingInput } from "../../shared/findings.ts";
import type { MemberFact, ParamFact, Span, TypeScriptFactSet, WriteFact } from "../../typescript/domain-facts/index.ts";
import type { ModelAvailability } from "../types.ts";
import type { ProjectPackages } from "./edges.ts";
import type { TsPackage } from "./packages.ts";

/** A claimed domain source the per-file rules decide over; `file` is project-root relative. */
export interface TsTarget {
  readonly file: string;
  readonly pkg: TsPackage;
}

/** A method of a domain type that has a body, as the rules judge it. */
export interface TsMethod {
  readonly name: string;
  readonly file: string;
  readonly span: Span;
  readonly params: readonly ParamFact[];
  readonly writes: readonly WriteFact[];
  readonly returns_state_only: boolean;
}

/**
 * A domain type: a class, or a companion — a type literal and a `const` object literal of the same
 * name in one file, whose instances are the literals written inside that object.
 */
export interface TsDomainType {
  /** `<file>#<name>`: the type as a note names it. */
  readonly key: string;
  readonly name: string;
  readonly kind: "class" | "companion";
  /** Whether the type is its module's default export, which an import names `default`. */
  readonly default_export: boolean;
  readonly file: string;
  readonly pkg: TsPackage;
  readonly module: readonly string[];
  /** Where code may construct the type: the class body, or the companion's `const` object. */
  readonly home: Span;
  /** The class members, or the companion's type literal members. */
  readonly members: readonly MemberFact[];
  /** Instance methods with a body: the class's, or those the companion's instances write. */
  readonly methods: readonly TsMethod[];
}

export interface TsSymbolTable {
  readonly types: readonly TsDomainType[];
  /** The instance methods of any domain type whose body only returns state. */
  readonly getter_names: ReadonlySet<string>;
}

/**
 * The constructs a rule could not decide, each as `<file>:<line> <what>`. Any of them stops the
 * gate as uninspectable once every rule has run, so no verdict is given over them.
 */
export class Undecided {
  readonly items: string[] = [];

  /** `line` is absent for a construct of a file that has no line of its own, such as a manifest entry. */
  add(file: string, line: number | undefined, what: string): void {
    this.items.push(`${file}${line === undefined ? "" : `:${line}`} ${what}`);
  }
}

export interface TsInspection {
  readonly run: SensorRunContext;
  readonly packages: ProjectPackages;
  readonly targets: readonly TsTarget[];
  readonly facts: TypeScriptFactSet;
  readonly symbols: TsSymbolTable;
  readonly model: ModelAvailability;
  readonly mapping: MappingViewLoad;
  /** Coverage notes the verdict carries, such as an ambiguous model binding. */
  readonly notes: Set<string>;
  readonly undecided: Undecided;
  readonly layerDiagnostics: readonly FindingInput[];
}
