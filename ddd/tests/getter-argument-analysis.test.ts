/**
 * The forwarding facts rule (d)'s repository-argument exception is decided on (T-10-03).
 *
 * The exception holds only when *every* use of a getter's result reaches a call argument unchanged,
 * so this file fixes both sides of that: the shapes that forward, and the shapes that stop it — an
 * operator, a rebinding, a capture, a macro, a mutable borrow, a mutable binding, a destructuring
 * pattern, and a result nothing consumes. The golden suite fixes what the rule then reports; this
 * fixes what the extractor proves.
 */

import { beforeAll, expect, test } from "bun:test";
import {
  type CallFact,
  classifyDomainFactExtractor,
  type RustFileFacts,
  readDomainFacts,
} from "../tools/ddd/lib/rust/domain-facts/index.ts";

let binaryPath: string;
beforeAll(async () => {
  const outcome = await classifyDomainFactExtractor();
  expect(outcome.kind, "run bun run prepare:native").toBe("ready");
  if (outcome.kind !== "ready") return;
  binaryPath = outcome.binaryPath;
});

const FILE = "flow.rs";

function declarationsFor(body: string): RustFileFacts {
  const result = readDomainFacts(binaryPath, [{ file: FILE, source: `fn run() { ${body} }\n` }]);
  expect(result.kind === "unavailable" ? result.detail : "").toBe("");
  if (result.kind !== "facts") throw new Error("unreachable");
  const declared = result.facts.files.get(FILE);
  if (!declared) throw new Error("the extractor read no declarations for the fixture");
  return declared;
}

for (const [body, forwarded] of [
  ["repo.remove(invoice.id());", true],
  ["repo.by_ref(&(invoice.id()));", true],
  ["let id = invoice.id(); let key = id; repo.remove(key);", true],
  ["let id = invoice.id(); repo.remove(id); repo.remove(id);", true],
  ["let id = invoice.id(); { let id = 0; if id == 0 {} } repo.remove(id);", true],
  ["let id = invoice.id(); let f = |id: i64| id > 0; repo.remove(id);", true],
  ["let id = invoice.id(); if id > 0 { repo.remove(id); }", false],
  ["let id = invoice.id(); let id = id + 1; repo.remove(id);", false],
  ["let id = invoice.id(); let f = || id > 0; repo.remove(id);", false],
  ['let id = invoice.id(); println!("{}", id); repo.remove(id);', false],
  ["let mut id = invoice.id(); repo.remove(id);", false],
  ["let (id,) = invoice.id(); repo.remove(id);", false],
  ["repo.remove(invoice.id() + 1);", false],
  ["repo.by_ref(&mut invoice.id());", false],
  ["let id = invoice.id();", false],
] as const) {
  test(`argument forwarding facts: ${body}`, () => {
    const calls: readonly CallFact[] = declarationsFor(body).calls;
    const getter = calls.find((call) => call.callee_text === "id");
    expect(getter).toBeDefined();
    expect(Boolean(getter?.forwarded_argument_calls.length)).toBe(forwarded);
    // A forwarded span names one of the calls the same answer reports, so the rule can look the
    // consumer up rather than take the extractor's word for what it is.
    for (const span of getter?.forwarded_argument_calls ?? []) {
      expect(
        calls.some(
          (call) =>
            ["remove", "by_ref"].includes(call.callee_text) && JSON.stringify(call.span) === JSON.stringify(span),
        ),
      ).toBe(true);
    }
  });
}
