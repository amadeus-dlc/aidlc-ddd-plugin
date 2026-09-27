/**
 * The TypeScript fact set (T-11-01): what one file declares, imports, exports, calls and constructs,
 * what it leaves unresolved, and that the extraction starts from a tools tree alone.
 *
 * Every case reads its facts through the one entry rules will read them through, over the compiler
 * the distribution carries, so a fact that holds here is the fact a rule is handed.
 */

import { afterEach, beforeAll, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ToolUnavailableError } from "../tools/ddd/lib/runtime/runtime.ts";
import { classifyTypeScriptExtractor } from "../tools/ddd/lib/typescript/compiler/launch.ts";
import { requireTypeScriptFacts, type UnresolvedReason } from "../tools/ddd/lib/typescript/domain-facts/index.ts";
import { PROBE, PROBE_CONSTRUCTED_TYPE, writeTypeScriptProject } from "./fixtures/typescript-facts/project.ts";

const SUPPORTED_WORKSPACE = resolve(import.meta.dir, "fixtures/operation-error-set/typescript-class-workspace");
const PRODUCT_TOOLS_DIR = resolve(import.meta.dir, "../tools");
/** Loading the multi-megabyte compiler, or copying the tree that carries it, is bounded real work. */
const LAUNCH_TIMEOUT_MS = 60_000;
const FILE = "src/model.ts";

type Outcome = Awaited<ReturnType<typeof classifyTypeScriptExtractor>>;
let ready: Outcome;
beforeAll(async () => {
  ready = await classifyTypeScriptExtractor(SUPPORTED_WORKSPACE);
  if (ready.kind !== "ready") throw new Error(`the distributed compiler did not launch: ${ready.kind}`);
}, LAUNCH_TIMEOUT_MS);

const temporary: string[] = [];
afterEach(() => {
  for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true });
});
function temporaryDir(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  temporary.push(root);
  return root;
}

function factSet(sources: readonly { file: string; source: string }[]) {
  return requireTypeScriptFacts(ready, sources);
}

function factsOf(source: string, file: string = FILE) {
  const set = factSet([{ file, source }]);
  const facts = set.files.get(file);
  if (!facts) throw new Error(`${file} was not read: ${set.notes.join("; ")}`);
  return facts;
}

function declared(source: string, name: string) {
  const declaration = factsOf(source).declarations.find((entry) => entry.name === name);
  if (!declaration) throw new Error(`${name} is not declared`);
  return declaration;
}

// Declarations

const DECLARATIONS = `export class Invoice {}
interface Shown {}
export type Money = { amount: number };
enum Status { Open, Closed }
export default function issue() {}
declare const ambientFlag: boolean;
let counter = 0;
var legacy = 1;
`;

test("every declaration kind is recorded with the line it opens on", () => {
  const byName = new Map(factsOf(DECLARATIONS).declarations.map((entry) => [entry.name, entry]));
  expect(
    ["Invoice", "Shown", "Money", "Status", "issue", "ambientFlag", "counter", "legacy"].map((name) => [
      name,
      byName.get(name)?.kind,
      byName.get(name)?.span.start_line,
    ]),
  ).toEqual([
    ["Invoice", "class", 1],
    ["Shown", "interface", 2],
    ["Money", "type-alias", 3],
    ["Status", "enum", 4],
    ["issue", "function", 5],
    ["ambientFlag", "variable", 6],
    ["counter", "variable", 7],
    ["legacy", "variable", 8],
  ]);
});

test("a declaration records whether it is exported, the default export, or ambient", () => {
  expect(declared(DECLARATIONS, "Invoice")).toMatchObject({ exported: true, default_export: false, ambient: false });
  expect(declared(DECLARATIONS, "Shown")).toMatchObject({ exported: false, default_export: false, ambient: false });
  expect(declared(DECLARATIONS, "issue")).toMatchObject({ default_export: true });
  expect(declared(DECLARATIONS, "ambientFlag")).toMatchObject({ exported: false, ambient: true });
});

test("a variable declaration records the binding keyword it was declared with", () => {
  expect(
    ["ambientFlag", "counter", "legacy"].map((name) => (declared(DECLARATIONS, name) as { binding?: string }).binding),
  ).toEqual(["const", "let", "var"]);
});

// Members

const ACCOUNT = `class Account {
  id = 1;
  protected owner = "";
  private secret = 0;
  #token = "";
  static readonly limit = 10;
  constructor(private readonly ledger: string, public name: string) {}
  deposit() {}
}
`;

test("class members carry their visibility, including private names and parameter properties", () => {
  const members = declared(ACCOUNT, "Account").members;
  const member = (name: string) => members.find((entry) => entry.name === name);
  expect(member("id")).toMatchObject({ visibility: "public", static: false, readonly: false });
  expect(member("owner")).toMatchObject({ visibility: "protected", static: false, readonly: false });
  expect(member("secret")).toMatchObject({ visibility: "private", static: false, readonly: false });
  expect(member("#token")).toMatchObject({ visibility: "private-name", static: false, readonly: false });
  expect(member("limit")).toMatchObject({ visibility: "public", static: true, readonly: true });
  expect(member("ledger")).toMatchObject({ visibility: "private", static: false, readonly: true });
  expect(member("name")).toMatchObject({ visibility: "public", static: false, readonly: false });
  expect(member("deposit")).toMatchObject({ visibility: "public", static: false });
  expect(member("deposit")?.span.start_line).toBe(8);
});

test("interface, type literal, enum and object literal members are recorded by name", () => {
  const source = `interface Shown { readonly label: string; show(): void }
type Money = { amount: number; currency: string };
enum Status { Open, Closed }
const policy = { limit: 1, check() {} };
`;
  const names = (name: string) => declared(source, name).members.map((entry) => entry.name);
  expect(names("Shown")).toEqual(["label", "show"]);
  expect(names("Money")).toEqual(["amount", "currency"]);
  expect(names("Status")).toEqual(["Open", "Closed"]);
  expect(names("policy")).toEqual(["limit", "check"]);
  expect(declared(source, "Shown").members[0]).toMatchObject({ visibility: "public", readonly: true });
});

// Imports

test("type-only imports and type positions are type-only dependencies; value bindings are not", () => {
  const imports = factsOf(`import type { A } from "a";
import { type B, C } from "b";
let x: import("c").D;
`).imports;
  const from = (specifier: string) => imports.find((entry) => entry.specifier === specifier);
  expect(from("a")).toMatchObject({ kind: "named", type_only: true, line: 1 });
  expect(from("a")?.bindings.map((entry) => entry.name)).toEqual(["A"]);
  expect(from("b")).toMatchObject({ kind: "named", type_only: false, line: 2 });
  expect(from("b")?.bindings).toEqual([
    { name: "B", imported: "B", type_only: true },
    { name: "C", imported: "C", type_only: false },
  ]);
  expect(from("c")).toMatchObject({ kind: "type-query", type_only: true, line: 3 });
});

test("a value dynamic import is a dependency that is not type-only; an unspelled specifier is unresolved", () => {
  const facts = factsOf(`async function load(name: string) {
  await import("d");
  await import(name);
}
`);
  expect(facts.imports).toEqual([
    expect.objectContaining({ specifier: "d", kind: "dynamic", type_only: false, line: 2 }),
  ]);
  expect(facts.unresolved).toContainEqual({ line: 3, reason: "dynamic-import" });
});

test("default, namespace, side-effect and renamed imports keep the names they bind", () => {
  const imports = factsOf(`import Def from "def";
import * as ns from "ns";
import "side";
import { a as b } from "m";
`).imports;
  const from = (specifier: string) => imports.find((entry) => entry.specifier === specifier);
  expect(from("def")).toMatchObject({ kind: "default", type_only: false, line: 1 });
  expect(from("def")?.bindings.map((entry) => entry.name)).toEqual(["Def"]);
  expect(from("ns")).toMatchObject({ kind: "namespace", type_only: false, line: 2 });
  expect(from("ns")?.bindings.map((entry) => entry.name)).toEqual(["ns"]);
  expect(from("side")).toMatchObject({ kind: "side-effect", type_only: false, bindings: [], line: 3 });
  expect(from("m")?.bindings).toEqual([{ name: "b", imported: "a", type_only: false }]);
});

// Exports

const EXPORTS = `const a = 1, b = 2;
type T = string;
export { a, b as c };
export type { T };
export { type T as U, a as d };
export * from "all";
export * as nsx from "space";
export { Re } from "re";
export default a + b;
export class Declared {}
`;

test("export statements are recorded with their kind, source and type-only names", () => {
  const exports = factsOf(EXPORTS).exports;
  const at = (line: number) => exports.find((entry) => entry.line === line);
  expect(at(3)).toMatchObject({
    kind: "named",
    type_only: false,
    names: [
      { name: "a", local: "a", type_only: false },
      { name: "c", local: "b", type_only: false },
    ],
  });
  expect(at(3)?.specifier).toBeUndefined();
  expect(at(4)).toMatchObject({ kind: "named", type_only: true });
  expect(at(4)?.names.map((entry) => entry.name)).toEqual(["T"]);
  expect(at(5)?.names).toEqual([
    { name: "U", local: "T", type_only: true },
    { name: "d", local: "a", type_only: false },
  ]);
  expect(at(6)).toMatchObject({ kind: "all", specifier: "all", type_only: false });
  expect(at(7)).toMatchObject({ kind: "namespace", specifier: "space", type_only: false });
  expect(at(8)).toMatchObject({ kind: "named", specifier: "re", type_only: false });
  expect(at(9)).toMatchObject({ kind: "default-expression", type_only: false });
});

test("an export written on a declaration is carried by the declaration, not as an export statement", () => {
  expect(factsOf(EXPORTS).exports.map((entry) => entry.line)).toEqual([3, 4, 5, 6, 7, 8, 9]);
  expect(declared(EXPORTS, "Declared")).toMatchObject({ exported: true, default_export: false });
});

// Calls and constructions

test("constructions and calls in code, including inside template substitutions, are facts", () => {
  const facts = factsOf(`const a = new Invoice(); issue(); const s = \`\${new Money()}\`;\n`);
  expect(facts.constructions.map((entry) => [entry.kind, entry.type_text])).toEqual([
    ["new-expression", "Invoice"],
    ["new-expression", "Money"],
  ]);
  expect(facts.calls.map((entry) => [entry.kind, entry.callee_text])).toEqual([["function-call", "issue"]]);
});

test("the same spelling inside comments, strings, templates and regular expressions is no fact", () => {
  const facts = factsOf(`// new Invoice()
/** issue() */
const text = "new Invoice()";
const tpl = \`new Invoice() issue()\`;
const re = /new Invoice\\(\\)/;
/* issue() */
`);
  expect(facts.constructions).toEqual([]);
  expect(facts.calls).toEqual([]);
});

test("method calls name their receiver and super calls are told apart", () => {
  const calls = factsOf(`order.submit();
class Ledger extends Base {
  constructor() {
    super();
  }
}
`).calls;
  expect(calls.find((entry) => entry.span.start_line === 1)).toMatchObject({
    kind: "method-call",
    callee_text: "submit",
    receiver_text: "order",
  });
  expect(calls.find((entry) => entry.span.start_line === 4)).toMatchObject({ kind: "super-call" });
});

test("an object literal typed by an assertion, satisfies or an annotated binding is a typed construction", () => {
  const facts = factsOf(`const m = { amount: 1 } as Money;
const n = { amount: 2 } satisfies Money;
const o: Money = { amount: 3 };
const p = { amount: 4 };
const q: Money = make();
`);
  expect(facts.constructions.map((entry) => [entry.kind, entry.type_text, entry.span.start_line])).toEqual([
    ["typed-object-literal", "Money", 1],
    ["typed-object-literal", "Money", 2],
    ["typed-object-literal", "Money", 3],
  ]);
});

test("positions are 1-based lines and 1-based UTF-16 columns", () => {
  const [construction] = factsOf('const s = "😀"; new Invoice();\n').constructions;
  expect(construction.span).toEqual({ start_line: 1, start_col: 17, end_line: 1, end_col: 30 });
});

// Unresolved constructs

const UNRESOLVED: [UnresolvedReason, string][] = [
  ["decorator", "@sealed class A {}"],
  ["computed-name", "class A { [keys.main]() {} }"],
  ["object-spread", "const policy = { ...defaults, limit: 1 };"],
  ["binding-pattern", "const { a } = source;"],
  ["import-equals", 'import fs = require("fs");'],
  ["export-assignment", "export = foo;"],
  ["dynamic-import", "import(name);"],
  ["namespace", "namespace N { export const x = 1; }"],
  ["dynamic-callee", "handlers[kind]();"],
];

test.each(UNRESOLVED)("%s is returned as unresolved with its line and noted", (reason, snippet) => {
  const set = factSet([{ file: FILE, source: `// lead\n${snippet}\n` }]);
  expect(set.files.get(FILE)?.unresolved).toContainEqual({ line: 2, reason });
  expect(set.notes).toContain(`domain-facts.unresolved: ${FILE}:2 ${reason}`);
});

// Facts the TypeScript domain gate decides on (T-11-02)

test("a computed name spelled by one identifier is a member carrying its key, not an unresolved name", () => {
  const facts = factsOf(`const brand: unique symbol = Symbol("Invoice");
type Invoice = { readonly [brand]: true; issue(): void };
`);
  const members = facts.declarations.find((entry) => entry.name === "Invoice")?.members ?? [];
  expect(members[0]).toMatchObject({ name: "[brand]", computed_key: "brand", readonly: true });
  expect(members[1]).toMatchObject({ name: "issue", kind: "method" });
  expect(facts.unresolved).toEqual([]);
});

test("a variable records its stated type and whether it is initialized by a plain call", () => {
  const source = `const brand: unique symbol = Symbol("Invoice");
const bare = Symbol();
const registered = Symbol.for("Invoice");
const other = { limit: 1 };
`;
  expect(declared(source, "brand")).toMatchObject({
    type_text: "unique symbol",
    initializer: { kind: "call", callee_text: "Symbol", arguments: ["string-literal"] },
  });
  expect(declared(source, "bare")).toMatchObject({
    initializer: { kind: "call", callee_text: "Symbol", arguments: [] },
  });
  expect((declared(source, "bare") as { type_text?: string }).type_text).toBeUndefined();
  expect(declared(source, "registered")).toMatchObject({ initializer: { kind: "other" } });
  expect(declared(source, "other")).toMatchObject({ initializer: { kind: "object-literal" } });
});

test("a class records what it extends and implements", () => {
  expect(declared("class A extends B implements C {}\n", "A")).toMatchObject({
    heritage: [
      { kind: "extends", type_text: "B" },
      { kind: "implements", type_text: "C" },
    ],
  });
});

test("a member records declare, abstract, its stated type and its parameters", () => {
  const members = declared(
    "abstract class A {\n  declare x: number;\n  abstract y: string;\n  amount: number = 0;\n  add(value: number, note) {}\n}\n",
    "A",
  ).members;
  const member = (name: string) => members.find((entry) => entry.name === name);
  expect(member("x")).toMatchObject({ ambient: true, abstract: false, type_text: "number" });
  expect(member("y")).toMatchObject({ ambient: false, abstract: true, type_text: "string" });
  expect(member("amount")).toMatchObject({ ambient: false, abstract: false, type_text: "number" });
  expect(member("add")).toMatchObject({ params: [{ name: "value", type_text: "number" }, { name: "note" }] });
});

test("a method records the state it writes and whether it only returns state", () => {
  const members = declared(
    `class A {
  #x = 0;
  bump() { this.#x += 1; }
  read() { return this.#x; }
  local() { let n = 0; n = 1; return n; }
}
`,
    "A",
  ).members;
  const member = (name: string) => members.find((entry) => entry.name === name) as unknown as Record<string, unknown>;
  expect(member("bump").writes).toEqual([{ target: "this", name: "#x" }]);
  expect(member("bump").returns_state_only).toBeFalsy();
  expect(member("read").writes ?? []).toEqual([]);
  expect(member("read").returns_state_only).toBe(true);
  // A local of the method is not state the method keeps.
  expect(member("local").writes ?? []).toEqual([]);
  expect(member("local").returns_state_only).toBeFalsy();
});

test("a typed literal records how it is typed, its members and what its methods do to captured state", () => {
  const facts = factsOf(`function open(): Invoice {
  const state = { amount: 0, issued: false };
  const instance: Invoice = {
    issue() { state.issued = true; },
    total() { return state.amount; },
  };
  return instance;
}
const m = { amount: 1 } as Money;
const n = { amount: 2 } satisfies Money;
`);
  const typed = facts.constructions.filter((entry) => entry.kind === "typed-object-literal") as unknown as {
    form: string;
    members: { name: string; writes?: { target: string }[]; returns_state_only?: boolean }[];
  }[];
  expect(typed.map((entry) => entry.form)).toEqual(["annotation", "assertion", "satisfies"]);
  const issue = typed[0].members.find((entry) => entry.name === "issue");
  const total = typed[0].members.find((entry) => entry.name === "total");
  expect(issue?.writes?.map((entry) => entry.target)).toEqual(["captured"]);
  expect(total?.returns_state_only).toBe(true);
});

test("closure state is written through a collection method and returned whole; module state is not returned state", () => {
  const facts = factsOf(`const LIMIT = 10;
function open(amount: number): Invoice {
  const lines: string[] = [];
  const instance: Invoice = {
    add(line: string) { lines.push(line); },
    total() { return amount; },
    limit() { return LIMIT; },
  };
  return instance;
}
`);
  const typed = facts.constructions.find((entry) => entry.kind === "typed-object-literal") as unknown as {
    members: { name: string; writes?: { target: string; name: string }[]; returns_state_only?: boolean }[];
  };
  const member = (name: string) => typed.members.find((entry) => entry.name === name);
  expect(member("add")?.writes).toEqual([{ target: "captured", name: "lines" }]);
  expect(member("total")?.returns_state_only).toBe(true);
  expect(member("limit")?.returns_state_only).toBe(false);
});

test("an assertion to a type is a construction; an assertion to const or unknown is not", () => {
  const facts = factsOf(`const a = value as Invoice;
const b = [1] as const;
const c = value as unknown;
const d = <Invoice>value;
`);
  expect(facts.constructions.map((entry) => [entry.kind, entry.type_text, entry.span.start_line])).toEqual([
    ["type-assertion", "Invoice", 1],
    ["type-assertion", "Invoice", 4],
  ]);
});

test("an untyped object literal keyed by an identifier is recorded with its members", () => {
  const facts = factsOf(`function make() {
  return { [brand]: true, issue() {} };
}
const plain = { limit: 1 };
`) as unknown as { keyed_literals: { members: { name: string }[]; span: { start_line: number } }[] };
  expect(facts.keyed_literals).toHaveLength(1);
  expect(facts.keyed_literals[0].members.map((entry) => entry.name)).toEqual(["[brand]", "issue"]);
  expect(facts.keyed_literals[0].span.start_line).toBe(2);
});

test("a method call on one identifier records the type the nearest binding states for it", () => {
  const calls = factsOf(`function peek(invoice: Invoice) {
  return invoice.total();
}
function other() {
  const invoice = make();
  return invoice.total();
}
`).calls.filter((entry) => entry.kind === "method-call") as unknown as { receiver_binding_type?: string }[];
  expect(calls.map((entry) => entry.receiver_binding_type)).toEqual(["Invoice", undefined]);
});

test("a file with a syntax error has no facts and is noted, while the other files are read", () => {
  const set = factSet([
    { file: "src/broken.ts", source: "const ok = 1;\nconst = ;\n" },
    { file: FILE, source: "export class Invoice {}\n" },
  ]);
  expect(set.files.has("src/broken.ts")).toBe(false);
  expect(set.files.get(FILE)?.declarations.map((entry) => entry.name)).toEqual(["Invoice"]);
  expect(set.notes).toEqual(["domain-facts.unresolved: src/broken.ts:2 syntax-error"]);
});

test("a spread in a recorded object literal is unresolved while the members it spells are recorded", () => {
  const set = factSet([{ file: FILE, source: "export const policy = { ...defaults, limit: 1 };\n" }]);
  const facts = set.files.get(FILE);
  expect(facts?.declarations.find((entry) => entry.name === "policy")?.members.map((entry) => entry.name)).toEqual([
    "limit",
  ]);
  expect(facts?.unresolved).toEqual([{ line: 1, reason: "object-spread" }]);
  expect(set.notes).toEqual([`domain-facts.unresolved: ${FILE}:1 object-spread`]);
});

test("an object literal without a spread leaves nothing unresolved", () => {
  const facts = factsOf("const policy = { limit: 1, check() {} };\n");
  expect(facts.declarations[0].members.map((entry) => entry.name)).toEqual(["limit", "check"]);
  expect(facts.unresolved).toEqual([]);
});

const VALID = "export class Invoice {}\n";
const BROKEN = "const = ;\n";
test.each([
  ["a broken text before a valid one", BROKEN, VALID],
  ["a valid text before a broken one", VALID, BROKEN],
  ["two valid texts", VALID, VALID],
  ["two broken texts", BROKEN, BROKEN],
])("a request naming one file twice, %s, has no facts", (_label, first, second) => {
  expect(() =>
    factSet([
      { file: FILE, source: first },
      { file: FILE, source: second },
    ]),
  ).toThrow(ToolUnavailableError);
});

test("a .tsx file is parsed as TSX and any other file as TypeScript", () => {
  const source = "export const view = <div>{new Invoice()}</div>;\n";
  const set = factSet([
    { file: "src/view.tsx", source },
    { file: "src/view.ts", source },
  ]);
  expect(set.files.get("src/view.tsx")?.constructions.map((entry) => entry.type_text)).toEqual(["Invoice"]);
  expect(set.files.has("src/view.ts")).toBe(false);
});

test("notes are sorted and each construct is noted once", () => {
  const set = factSet([
    { file: "src/b.ts", source: "// lead\n@first @second class X {}\n" },
    { file: "src/a.ts", source: "namespace N {}\n" },
  ]);
  expect(set.notes).toEqual([
    "domain-facts.unresolved: src/a.ts:1 namespace",
    "domain-facts.unresolved: src/b.ts:2 decorator",
  ]);
});

test("a request without sources answers with no files and no notes", () => {
  const set = factSet([]);
  expect(set.files.size).toBe(0);
  expect(set.notes).toEqual([]);
});

// Launch from the distributed tree alone

test(
  "a copy of the tools tree with no TypeScript package in reach launches and extracts facts",
  () => {
    const root = temporaryDir("ddd-typescript-tools-");
    const tools = join(root, "tools");
    cpSync(PRODUCT_TOOLS_DIR, tools, { recursive: true });
    const project = join(root, "project");
    mkdirSync(project);
    writeTypeScriptProject(project);

    // The control: nothing above the copy resolves a TypeScript package, so a launch that succeeds
    // below cannot have loaded one from outside the tree.
    const control = join(tools, "resolve-typescript.ts");
    writeFileSync(control, 'await import("typescript");\n');
    const unresolved = Bun.spawnSync([process.execPath, "--no-install", control], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(unresolved.exitCode).not.toBe(0);

    const probe = Bun.spawnSync([process.execPath, "--no-install", PROBE, tools, project], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(probe.exitCode, probe.stderr.toString()).toBe(0);
    expect(JSON.parse(probe.stdout.toString())).toEqual({ kind: "ready", constructions: [PROBE_CONSTRUCTED_TYPE] });
  },
  LAUNCH_TIMEOUT_MS,
);
