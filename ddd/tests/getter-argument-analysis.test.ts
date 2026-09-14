import { beforeAll, expect, test } from "bun:test";
import { calls, initAnalyzer, parse } from "../tools/ddd/lib/rust/analyzer.ts";

let runtime: Awaited<ReturnType<typeof initAnalyzer>>;
beforeAll(async () => {
  runtime = await initAnalyzer();
  expect(runtime.state).toBe("ready");
});

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
    const tree = parse(runtime, "flow.rs", new TextEncoder().encode(`fn run() { ${body} }`));
    const sites = calls(tree);
    const getter = sites.find((call) => call.callee_text === "id");
    expect(getter).toBeDefined();
    expect(Boolean(getter?.forwarded_argument_calls?.length)).toBe(forwarded);
    for (const span of getter?.forwarded_argument_calls ?? []) {
      expect(
        sites.some(
          (call) =>
            ["remove", "by_ref"].includes(call.callee_text) && JSON.stringify(call.span) === JSON.stringify(span),
        ),
      ).toBe(true);
    }
  });
}
