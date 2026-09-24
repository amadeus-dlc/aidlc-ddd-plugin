/**
 * The `domain-facts/1` adapter (T-10-02): what it accepts from the extractor and what it refuses.
 *
 * The gate tests in `t10-rust-domain-facts.test.ts` observe the launch conditions at the sensor
 * boundary. This file observes the step after a launch succeeded — the run and the conversion —
 * because that is where an answer could quietly become an empty fact set, and an empty fact set
 * reads as "nothing public is declared" at every rule that consumes it.
 */

import { afterEach, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  classifyDomainFactExtractor,
  methodKey,
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
  const body = { path: LIB, parsed: true, members: [], methods: [], unresolved: [], ...overrides };
  return `echo '${JSON.stringify({ protocol_version: 4, files: [body] })}'`;
}

test("the installed extractor answers a batch with the members and method facts the rules join on", async () => {
  const outcome = await classifyDomainFactExtractor();
  expect(outcome.kind, "run bun run prepare:native").toBe("ready");
  if (outcome.kind !== "ready") return;
  const result = readDomainFacts(outcome.binaryPath, REQUEST);
  expect(result.kind === "unavailable" ? result.detail : "").toBe("");
  if (result.kind !== "facts") return;
  expect(result.facts.publicMembers.get(LIB)).toEqual([{ typeName: "Invoice", name: "0", line: 1 }]);
  const key = (trait: string | null, name: string, line: number) => methodKey(LIB, [], "Invoice", trait, name, line);
  expect(result.facts.fieldReturns.get(key(null, "total", 4))).toBe(true);
  expect(result.facts.fieldReturns.get(key(null, "doubled", 4))).toBe(false);
  // The trait implementation is a separate entry, so rule (d) can leave it out of the getter set.
  expect(result.facts.fieldReturns.get(key("Shown", "shown", 3))).toBe(true);
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
  expect(result.facts.publicMembers.get(file)).toEqual([{ typeName: "Invoice", name: "amount", line: 2 }]);
  expect(result.facts.notes).toEqual([`domain-facts.unresolved: ${file}:2 conditional-compilation`]);
});

test("a file the extractor could not parse carries no member record, and says why", () => {
  const result = answered(record({ parsed: false, unresolved: [{ reason: "syntax-error", line: 1 }] }));
  expect(result.kind).toBe("facts");
  if (result.kind !== "facts") return;
  expect(result.facts.publicMembers.has(LIB)).toBe(false);
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
    `echo '${JSON.stringify({ protocol_version: 4, files: [] })}'`,
  ],
  ["the answer names a file that was not asked about", record({ path: "packages/domain/billing-domain/src/other.rs" })],
  ["a member carries no line", record({ members: [{ type: "Invoice", member: "0" }] })],
  ["a member carries a line before the first", record({ members: [{ type: "Invoice", member: "0", line: 0 }] })],
  [
    "a method carries no verdict",
    record({ methods: [{ module: [], owner_type_text: "Invoice", trait_text: null, name: "total", line: 4 }] }),
  ],
  [
    "a method carries no line, so its declaration cannot be told from another of the same name",
    record({
      methods: [{ module: [], owner_type_text: "Invoice", trait_text: null, name: "total", returns_field_only: true }],
    }),
  ],
  [
    "one declaration carries two different verdicts",
    record({
      methods: [
        { module: [], owner_type_text: "Invoice", trait_text: null, name: "total", line: 4, returns_field_only: true },
        { module: [], owner_type_text: "Invoice", trait_text: null, name: "total", line: 4, returns_field_only: false },
      ],
    }),
  ],
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
  expect([result.facts.publicMembers.size, result.facts.fieldReturns.size, result.facts.notes.length]).toEqual([
    0, 0, 0,
  ]);
});

test("the join identity ignores whitespace in the type and trait, and keeps identifiers as written", () => {
  expect(methodKey(LIB, [], "Vec < u8 >", "core :: fmt :: Debug", "total", 1)).toBe(
    methodKey(LIB, [], "Vec<u8>", "core::fmt::Debug", "total", 1),
  );
  expect(methodKey(LIB, [], "Invoice", null, "r#total", 1)).not.toBe(methodKey(LIB, [], "Invoice", null, "total", 1));
  expect(methodKey(LIB, ["a"], "Invoice", null, "total", 1)).not.toBe(
    methodKey(LIB, ["b"], "Invoice", null, "total", 1),
  );
  // An inherent method and a trait method of the same name are different entries.
  expect(methodKey(LIB, [], "Invoice", null, "shown", 1)).not.toBe(methodKey(LIB, [], "Invoice", "Shown", "shown", 1));
  // Two declarations of one name are two entries: a function body may declare its own type, and
  // the module path names no function, so only the line tells them apart.
  expect(methodKey(LIB, ["tests"], "Stub", null, "total", 7)).not.toBe(
    methodKey(LIB, ["tests"], "Stub", null, "total", 12),
  );
});
