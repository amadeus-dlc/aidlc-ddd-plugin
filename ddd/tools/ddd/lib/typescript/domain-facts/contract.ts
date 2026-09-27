/**
 * The facts every TypeScript rule decides on, as plain records. `index.ts` re-exports them as the
 * public surface of the extraction; `extract.ts` builds them. Neither imports the other for them.
 */

/** Lines are 1-based; columns are 1-based UTF-16 code units, and the end column is one past the node. */
export interface Span {
  readonly start_line: number;
  readonly start_col: number;
  readonly end_line: number;
  readonly end_col: number;
}

export type DeclarationKind = "class" | "interface" | "type-alias" | "enum" | "function" | "variable";
export type VariableBinding = "const" | "let" | "var" | "using" | "await-using";
export type Visibility = "public" | "protected" | "private" | "private-name";

export interface MemberFact {
  /** As the source spells it; a private name keeps its `#`. */
  readonly name: string;
  readonly kind: "property" | "method" | "get-accessor" | "set-accessor" | "constructor" | "enum-member";
  readonly visibility: Visibility;
  readonly static: boolean;
  /** Whether the member is declared with the `readonly` modifier. */
  readonly readonly: boolean;
  readonly span: Span;
}

/** One declaration at the top of a file. An `export` written on it is recorded here, not as an export. */
export interface DeclarationFact {
  /** `default` for an anonymous default-exported class or function. */
  readonly name: string;
  readonly kind: DeclarationKind;
  /** The keyword a variable is declared with; present on variables only. */
  readonly binding?: VariableBinding;
  readonly exported: boolean;
  readonly default_export: boolean;
  readonly ambient: boolean;
  readonly span: Span;
  readonly members: readonly MemberFact[];
}

export interface ImportBinding {
  /** The local name. */
  readonly name: string;
  /** The name the module exports it under: `default` for a default import, `*` for a namespace. */
  readonly imported: string;
  readonly type_only: boolean;
}

/** A dependency on a module, whether a statement, an `import("…")` call, or an import type. */
export interface ImportFact {
  readonly specifier: string;
  readonly kind: "named" | "default" | "namespace" | "side-effect" | "dynamic" | "type-query";
  /** Whether the whole dependency is erased: `import type …` and import types are. */
  readonly type_only: boolean;
  readonly bindings: readonly ImportBinding[];
  readonly line: number;
}

export interface ExportName {
  /** The name the module exports. */
  readonly name: string;
  /** The name it has where it comes from: the local binding, the source module's name, or `*`. */
  readonly local: string;
  readonly type_only: boolean;
}

/** An export statement. A declaration written with `export` is carried by the declaration instead. */
export interface ExportFact {
  readonly kind: "named" | "all" | "namespace" | "default-expression";
  /** The module re-exported from; absent when the statement names no module. */
  readonly specifier?: string;
  readonly type_only: boolean;
  readonly names: readonly ExportName[];
  readonly line: number;
}

export interface CallFact {
  readonly kind: "function-call" | "method-call" | "super-call";
  /** The function name, the method name, or `super`. */
  readonly callee_text: string;
  /** The receiver of a method call as the source spells it. */
  readonly receiver_text?: string;
  readonly span: Span;
}

export interface ConstructionFact {
  readonly kind: "new-expression" | "typed-object-literal";
  /** The constructed class or the stated type, as the source spells it. */
  readonly type_text: string;
  readonly span: Span;
}

export type UnresolvedReason =
  | "decorator"
  | "computed-name"
  | "object-spread"
  | "binding-pattern"
  | "import-equals"
  | "export-assignment"
  | "dynamic-import"
  | "namespace"
  | "dynamic-callee";

/** A construct whose declarations, dependencies or callee cannot be decided from its syntax. */
export interface UnresolvedFact {
  readonly line: number;
  readonly reason: UnresolvedReason;
}

/** What one file declares and uses, each list in source order. A file without a record was not read. */
export interface TypeScriptFileFacts {
  readonly declarations: readonly DeclarationFact[];
  readonly imports: readonly ImportFact[];
  readonly exports: readonly ExportFact[];
  readonly calls: readonly CallFact[];
  readonly constructions: readonly ConstructionFact[];
  readonly unresolved: readonly UnresolvedFact[];
}

export interface TypeScriptFactSet {
  /** Workspace-relative file -> its facts. A file whose syntax was rejected has none. */
  readonly files: ReadonlyMap<string, TypeScriptFileFacts>;
  /** One line per construct that could hide a fact from this answer, sorted, each once. */
  readonly notes: readonly string[];
}

/** One source of the inspected program. */
export interface TypeScriptSourceFile {
  /** Workspace-relative path; the answer is keyed by it. A `.tsx` path is parsed as TSX. */
  readonly file: string;
  readonly source: string;
}
