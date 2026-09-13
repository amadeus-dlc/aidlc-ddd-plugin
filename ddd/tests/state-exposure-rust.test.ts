import { expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  convertRustResponse,
  extractRust,
  RUST_TOOLCHAIN,
  rustVersions,
} from "../tools/ddd/lib/rust/state-evidence/index.ts";
import { inspectStateExposure } from "../tools/ddd/lib/state-exposure/index.ts";
import { freezeInput } from "../tools/ddd/lib/state-exposure-verification/input.ts";
import { DEFAULT_LIMITS } from "../tools/ddd/lib/state-exposure-verification/process.ts";

function task(content: string, declarationPath = ["Model"]) {
  return freezeInput({
    language: "rust",
    target: { file: "model.rs", declarationPath, representation: "rust-struct" },
    sources: [{ path: "model.rs", content }],
    settings: {},
    toolchain: RUST_TOOLCHAIN,
  });
}
async function inspect(content: string, path?: string[]) {
  const frozen = task(content, path);
  const observed = await extractRust(frozen);
  const outcome = inspectStateExposure(frozen.request, observed.execution);
  if (outcome.kind !== "evaluated") throw new Error(JSON.stringify(outcome));
  return outcome.result;
}
test("native version probe matches actual fixed parser", async () =>
  expect(await rustVersions()).toEqual(RUST_TOOLCHAIN));
for (const source of ["struct Model { value: u8 }", "struct Model(u8);"])
  test(`private ${source}`, async () => expect((await inspect(source)).ruleResult).toBe("pass"));
for (const visibility of ["pub", "pub(crate)", "pub(super)", "pub(in crate::m)"])
  for (const tuple of [false, true])
    test(`${visibility} tuple=${tuple}`, async () => {
      const result = await inspect(
        tuple ? `struct Model(${visibility} u8);` : `struct Model { ${visibility} value: u8 }`,
      );
      expect(result.ruleResult).toBe("violation");
      expect(result.findings[0].memberId).toBe(tuple ? "Model::tuple:0" : "Model::field:value");
    });
for (const [source, reason] of [
  ["struct Other;", "target-missing"],
  ["struct Model; struct Model;", "target-ambiguous"],
  ["struct Model {", "syntax-error"],
  ["#[cfg(unix)] struct Model;", "unsupported-syntax"],
  ["make!(); struct Model;", "unsupported-syntax"],
] as const)
  test(reason, async () => expect((await inspect(source)).unresolvedReasons[0].code).toBe(reason));
test("inline module target is exact", async () =>
  expect((await inspect("struct Model { pub x: u8 } mod m { struct Model(u8); }", ["m", "Model"])).ruleResult).toBe(
    "pass",
  ));
test("mixed evidence retains confirmed public field", async () => {
  const result = await inspect("struct Model { pub a: u8, #[cfg(unix)] pub b: u8 }");
  expect(result.ruleResult).toBe("unresolved");
  expect(result.findings).toHaveLength(1);
  expect(result.unresolvedReasons[0].subject).toBe("Model::field:b");
});
test("native Unicode CRLF bytes match original source", async () => {
  const source = "// 日本語\r\nstruct Model { pub 名前: u8 }\n";
  const result = await inspect(source);
  const loc = result.findings[0].evidence[0];
  expect(loc.line).toBe(2);
  expect(Buffer.from(source).subarray(loc.byteStart, loc.byteEnd).toString()).toBe("pub 名前: u8");
});
test("native response validates identity, target, digest and required fields", async () => {
  const frozen = task("struct Model(u8);");
  const observation = await extractRust(frozen);
  const raw = JSON.parse(observation.stdout);
  for (const change of [
    { protocol_version: 1 },
    { request_identity: "bad" },
    { source_digest: "bad" },
    { target: {} },
    { members: null },
    { completeness: "partial" },
  ])
    expect(convertRustResponse({ ...raw, ...change }, frozen)).toBe("invalid-native-response");
});
for (const mode of ["empty", "whitespace", "invalid", "multiple", "null"])
  test(`normal termination with ${mode} response`, async () => {
    const frozen = task("struct Model;");
    const observed = await extractRust(frozen, DEFAULT_LIMITS, [
      process.execPath,
      resolve(import.meta.dir, "fixtures/state-exposure-languages/child.ts"),
      mode,
    ]);
    expect(observed.execution.status).toBe("completed");
    if (observed.execution.status === "completed")
      expect(observed.execution.response).toBe(
        mode === "empty" || mode === "whitespace" ? null : "invalid-native-response",
      );
    const result = inspectStateExposure(frozen.request, observed.execution);
    expect(result.kind).toBe("evaluated");
    if (result.kind === "evaluated") expect(result.result.unresolvedReasons[0].code).toBe("invalid-response");
  });
for (const prefix of ["\ufeff", "#!/usr/bin/env rust-script\n", "\ufeff#!/bin/rust\r\n"])
  test(`BOM/shebang native offsets ${JSON.stringify(prefix)}`, async () => {
    const source = `${prefix}struct Model { pub 名前: u8 }\n`;
    const r = await inspect(source);
    const location = r.findings[0].evidence[0];
    expect(Buffer.from(source).subarray(location.byteStart, location.byteEnd).toString()).toBe("pub 名前: u8");
    expect(location.line).toBe(prefix.includes("\n") ? 2 : 1);
  });
for (const collision of ["type Model = u8;", "enum Model {}", "union Model { x: u8 }"])
  test(`type namespace collision ${collision}`, async () => {
    const r = await inspect(`struct Model; ${collision}`);
    expect(r.ruleResult).toBe("unresolved");
    expect(r.unresolvedReasons[0].code).toBe("target-ambiguous");
  });
test("frozen source changes and false parser versions are rejected before extraction", async () => {
  const frozen = task("struct Model;");
  const wrong = freezeInput({ ...frozen.input, toolchain: [{ name: "syn", version: "1" }] });
  await expect(extractRust(wrong)).rejects.toThrow("toolchain identity mismatch");
  const changed = {
    ...frozen,
    input: { ...frozen.input, sources: [{ path: "model.rs", content: "struct Model(pub u8);" }] },
  };
  await expect(extractRust(changed)).rejects.toThrow("frozen input identity mismatch");
});
