/**
 * The `domain-facts` adapter (T-10-03): what it accepts from the extractor and what it refuses.
 *
 * The gate tests in `t10-rust-domain-facts.test.ts` observe the launch conditions at the sensor
 * boundary. This file observes the step after a launch succeeded — the run and the conversion —
 * because that is where an answer could quietly become an empty fact set, and an empty fact set
 * reads as "this file declares nothing" at every rule that consumes it.
 */

import { afterEach, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  classifyDomainFactExtractor,
  type RustSourceFile,
  readDomainFacts,
} from "../tools/ddd/lib/rust/domain-facts/index.ts";

const temporary: string[] = [];
afterEach(() => {
  for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** An extractor that consumes the request and answers with exactly `answer`. */
function stub(answer: string): string {
  const root = mkdtempSync(join(tmpdir(), "ddd-domain-facts-stub-"));
  temporary.push(root);
  const path = join(root, "extractor");
  writeFileSync(path, `#!/bin/sh\ncat >/dev/null\n${answer}\n`);
  chmodSync(path, 0o755);
  return path;
}

const LIB = "packages/domain/billing-domain/src/lib.rs";
const SOURCE = `pub struct Invoice(pub u64);
pub trait Shown { fn shown(&self) -> u64; }
impl Shown for Invoice { fn shown(&self) -> u64 { self.0 } }
impl Invoice { pub fn total(&self) -> u64 { return self.0; } pub fn doubled(&self) -> u64 { self.0 * 2 } }
`;
const REQUEST: RustSourceFile[] = [{ file: LIB, source: SOURCE }];

function answered(answer: string, sources: readonly RustSourceFile[] = REQUEST) {
  return readDomainFacts(stub(answer), sources);
}

/** One record, shaped as the protocol defines it, with the parts a case wants replaced. */
function record(overrides: Record<string, unknown> = {}): string {
  const body = {
    path: LIB,
    parsed: true,
    auxiliary: false,
    members: [],
    unresolved: [],
    types: [],
    traits: [],
    impls: [],
    uses: [],
    aliases: [],
    constructions: [],
    calls: [],
    modules: [],
    item_macros: [],
    ...overrides,
  };
  return `echo '${JSON.stringify({ protocol_version: 5, files: [body] })}'`;
}

const SPAN = { start_line: 1, start_col: 1, end_line: 1, end_col: 2 };
const METHOD = { name: "total", receiver: "ref-self", params: [], return_type_text: null, line: 4 };

test("the installed extractor answers a batch with the declarations the rules decide on", async () => {
  const outcome = await classifyDomainFactExtractor();
  expect(outcome.kind, "run bun run prepare:native").toBe("ready");
  if (outcome.kind !== "ready") return;
  const result = readDomainFacts(outcome.binaryPath, REQUEST);
  expect(result.kind === "unavailable" ? result.detail : "").toBe("");
  if (result.kind !== "facts") return;
  const declared = result.facts.files.get(LIB);
  expect(declared).toBeDefined();
  if (!declared) return;
  expect(declared.publicMembers).toEqual([{ typeName: "Invoice", name: "0", line: 1 }]);
  // A tuple element is reached by position, so the type declares no field a rule resolves through.
  expect(declared.types).toEqual([{ name: "Invoice", kind: "struct", module: [], fields: [], derives: [] }]);
  expect(declared.traits).toEqual([{ name: "Shown", module: [], methods: ["shown"] }]);
  // The trait implementation is a separate block, so rule (d) can leave it out of the getter set.
  expect(
    declared.impls.map((block) => [
      block.trait_text ?? null,
      block.methods.map((method) => [method.name, method.receiver, method.returns_field_only, method.line]),
    ]),
  ).toEqual([
    ["Shown", [["shown", "ref-self", true, 3]]],
    [
      null,
      [
        ["total", "ref-self", true, 4],
        ["doubled", "ref-self", false, 4],
      ],
    ],
  ]);
  expect(result.facts.notes).toEqual([]);
});

/**
 * The line a finding sends a reader to is the line of the file on disk. A shebang is the one prefix
 * that takes a whole line of its own, so it is where that line could drift once the parser has
 * consumed it; the answer keeps the reader's line because the shebang is cut at its newline rather
 * than past it. It is observed here, against the installed file, because a fix to the extractor
 * source that is not rebuilt into `tools/ddd/bin` would leave every gate running the old answer.
 */
test("the installed extractor reports the line of the original file, not of what it parsed", async () => {
  const outcome = await classifyDomainFactExtractor();
  expect(outcome.kind, "run bun run prepare:native").toBe("ready");
  if (outcome.kind !== "ready") return;
  const file = "packages/domain/billing-domain/src/script.rs";
  const source = `#!/usr/bin/env rust-script\npub struct Invoice { #[cfg(feature = "x")] pub amount: u64 }\n`;
  const result = readDomainFacts(outcome.binaryPath, [{ file, source }]);
  expect(result.kind === "unavailable" ? result.detail : "").toBe("");
  if (result.kind !== "facts") return;
  expect(result.facts.files.get(file)?.publicMembers).toEqual([{ typeName: "Invoice", name: "amount", line: 2 }]);
  expect(result.facts.notes).toEqual([`domain-facts.unresolved: ${file}:2 conditional-compilation`]);
});

/**
 * A text fact is the slice of source it covers rather than re-printed tokens, because the rule
 * layer matches it against the shapes a reader writes. Re-printing would separate those tokens and
 * stop every one of those matches.
 */
test("the installed extractor reports text as the source writes it, not as tokens", async () => {
  const outcome = await classifyDomainFactExtractor();
  expect(outcome.kind, "run bun run prepare:native").toBe("ready");
  if (outcome.kind !== "ready") return;
  const file = "packages/domain/billing-domain/src/text.rs";
  const source = `use crate::billing::{Invoice, Ledger as Book};
#[derive(Clone, serde::Serialize)]
pub struct Batch { entries: Box<Vec<Invoice>> }
type Alias = Option<Invoice>;
fn build() -> Batch { Batch { entries: crate::billing::Invoice::all() } }
`;
  const result = readDomainFacts(outcome.binaryPath, [{ file, source }]);
  expect(result.kind === "unavailable" ? result.detail : "").toBe("");
  if (result.kind !== "facts") return;
  const declared = result.facts.files.get(file);
  expect(declared?.uses.map((entry) => entry.path_text)).toEqual(["crate::billing::{Invoice, Ledger as Book}"]);
  expect(declared?.types[0]?.derives).toEqual(["Clone", "serde::Serialize"]);
  expect(declared?.types[0]?.fields.map((field) => field.type_text)).toEqual(["Box<Vec<Invoice>>"]);
  expect(declared?.aliases.map((entry) => entry.type_text)).toEqual(["Option<Invoice>"]);
  expect(declared?.constructions.map((entry) => [entry.kind, entry.type_text])).toEqual([
    ["struct-literal", "Batch"],
    ["associated-call", "crate::billing::Invoice"],
  ]);
});

test("a file the extractor could not parse carries no declarations, and says why", () => {
  const result = answered(
    `echo '${JSON.stringify({
      protocol_version: 5,
      files: [{ path: LIB, parsed: false, unresolved: [{ reason: "syntax-error", line: 1 }] }],
    })}'`,
  );
  expect(result.kind).toBe("facts");
  if (result.kind !== "facts") return;
  expect(result.facts.files.has(LIB)).toBe(false);
  expect(result.facts.notes).toEqual([`domain-facts.unresolved: ${LIB}:1 syntax-error`]);
});

test("the same unresolved construct reported twice becomes one note", () => {
  const reasons = [
    { reason: "conditional-compilation", line: 3 },
    { reason: "conditional-compilation", line: 3 },
    { reason: "macro-expansion", line: 9 },
  ];
  const result = answered(record({ unresolved: reasons }));
  expect(result.kind).toBe("facts");
  if (result.kind !== "facts") return;
  expect(result.facts.notes).toEqual([
    `domain-facts.unresolved: ${LIB}:3 conditional-compilation`,
    `domain-facts.unresolved: ${LIB}:9 macro-expansion`,
  ]);
});

/** Each way an answer can fail to cover the request. None of them may become an empty fact set. */
const REFUSED: [string, string][] = [
  ["the run does not finish", "exit 3"],
  ["the answer is not JSON", "echo 'not json'"],
  ["the answer is empty", "true"],
  ["the answer is another protocol", `echo '${JSON.stringify({ protocol_version: 2, files: [] })}'`],
  [
    "the answer covers fewer files than were asked about",
    `echo '${JSON.stringify({ protocol_version: 5, files: [] })}'`,
  ],
  ["the answer names a file that was not asked about", record({ path: "packages/domain/billing-domain/src/other.rs" })],
  ["the answer does not say whether the file is auxiliary", record({ auxiliary: undefined })],
  ["a member carries no line", record({ members: [{ type: "Invoice", member: "0" }] })],
  ["a member carries a line before the first", record({ members: [{ type: "Invoice", member: "0", line: 0 }] })],
  // A line is the part of a declaration's identity that tells two declarations of one name apart, so
  // a value that is not a line at all cannot be narrowed to one and reported.
  [
    "a member carries a line that is not a whole number",
    record({ members: [{ type: "Invoice", member: "0", line: 1.5 }] }),
  ],
  ["a type carries no kind", record({ types: [{ name: "Invoice", module: [], fields: [], derives: [] }] })],
  [
    "a type carries a kind this protocol does not name",
    record({ types: [{ name: "Invoice", kind: "union", module: [], fields: [], derives: [] }] }),
  ],
  [
    "a field carries a visibility this protocol does not name",
    record({
      types: [
        {
          name: "Invoice",
          kind: "struct",
          module: [],
          derives: [],
          fields: [{ name: "id", visibility: "open", type_text: "u64", line: 1 }],
        },
      ],
    }),
  ],
  ["a trait carries no method list", record({ traits: [{ name: "Shown", module: [] }] })],
  [
    "an impl carries no span, so nothing built inside it can be told from outside",
    record({ impls: [{ module: [], target_type_text: "Invoice", trait_text: null, methods: [] }] }),
  ],
  [
    "an impl span carries a column before the first",
    record({
      impls: [
        {
          module: [],
          target_type_text: "Invoice",
          trait_text: null,
          methods: [],
          span: { ...SPAN, start_col: 0 },
        },
      ],
    }),
  ],
  [
    "a method carries no verdict about its body",
    record({
      impls: [{ module: [], target_type_text: "Invoice", trait_text: null, methods: [METHOD], span: SPAN }],
    }),
  ],
  [
    "a method carries a receiver this protocol does not name",
    record({
      impls: [
        {
          module: [],
          target_type_text: "Invoice",
          trait_text: null,
          span: SPAN,
          methods: [{ ...METHOD, receiver: "borrowed", returns_field_only: true }],
        },
      ],
    }),
  ],
  [
    "a method carries no line, so its declaration cannot be told from another of the same name",
    record({
      impls: [
        {
          module: [],
          target_type_text: "Invoice",
          trait_text: null,
          span: SPAN,
          methods: [{ ...METHOD, line: undefined, returns_field_only: true }],
        },
      ],
    }),
  ],
  [
    "a use path does not say whether it is local to a function",
    record({ uses: [{ module: [], path_text: "std::io", line: 1 }] }),
  ],
  [
    "a type alias does not say whether it is generic",
    record({ aliases: [{ module: [], name: "Alias", type_text: "u64", local: false }] }),
  ],
  [
    "a construction carries a kind this protocol does not name",
    record({ constructions: [{ kind: "builder-call", type_text: "Invoice", callee_text: null, span: SPAN }] }),
  ],
  [
    "a call carries no forwarding list, so an unproven one reads as proven",
    record({
      calls: [
        {
          module: [],
          kind: "method-call",
          callee_text: "total",
          receiver_text: "invoice",
          receiver_binding_type: null,
          span: SPAN,
        },
      ],
    }),
  ],
  [
    "a module declaration does not say whether its path resolves",
    record({
      modules: [{ name: "invoice", module: [], inline: false, path: null, auxiliary: false, local: false, line: 1 }],
    }),
  ],
  ["an item macro carries no line", record({ item_macros: [{ auxiliary: false }] })],
  ["the parse state is neither answered nor refused", record({ parsed: "maybe" })],
];

test.each(REFUSED)("the batch is unavailable, not empty, when %s", (_label, answer) => {
  const result = answered(answer);
  expect(result.kind).toBe("unavailable");
});

test("a request larger than the extractor accepts is refused before it is sent", () => {
  const oversized = [{ file: LIB, source: "a".repeat(9 * 1024 * 1024) }];
  // The path is never launched: refusing the batch is decided from its size alone.
  const result = readDomainFacts(join(tmpdir(), "ddd-domain-facts-absent"), oversized);
  expect(result.kind).toBe("unavailable");
  expect(result.kind === "unavailable" && result.detail).toContain("request limit");
});

test("a batch with no sources is answered without launching the extractor", () => {
  const result = readDomainFacts(join(tmpdir(), "ddd-domain-facts-absent"), []);
  expect(result.kind).toBe("facts");
  if (result.kind !== "facts") return;
  expect([result.facts.files.size, result.facts.notes.length]).toEqual([0, 0]);
});
