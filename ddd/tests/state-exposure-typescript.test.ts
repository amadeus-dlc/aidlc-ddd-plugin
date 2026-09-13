import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { inspectStateExposure, type Target } from "../tools/ddd/lib/state-exposure/index.ts";
import { freezeInput } from "../tools/ddd/lib/state-exposure-verification/input.ts";
import {
  createFrozenProgram,
  extractTypeScript,
  extractTypeScriptLocal,
  TS_TOOLCHAIN,
} from "../tools/ddd/lib/typescript/state-evidence/index.ts";

const companion = readFileSync(new URL("fixtures/state-exposure-languages/companion.ts.txt", import.meta.url), "utf8");
function task(content: string, representation: Target["representation"] = "ts-class") {
  return freezeInput({
    language: "typescript",
    target: { file: "model.ts", declarationPath: ["Model"], representation },
    sources: [{ path: "model.ts", content }],
    settings: {},
    toolchain: TS_TOOLCHAIN,
  });
}
function inspect(content: string, representation: Target["representation"] = "ts-class") {
  const frozen = task(content, representation);
  const outcome = inspectStateExposure(frozen.request, {
    status: "completed",
    response: extractTypeScriptLocal(frozen),
  });
  if (outcome.kind !== "evaluated") throw new Error(JSON.stringify(outcome));
  return outcome.result;
}
test("actual Program and TypeChecker use only frozen sources and pinned libs", () => {
  const frozen = task("class Model { #value = 1; }");
  const program = createFrozenProgram(frozen);
  expect(program.getTypeChecker()).toBeDefined();
  expect(
    program.getSourceFiles().every((f) => f.fileName === "/input/model.ts" || f.fileName.startsWith("/lib/lib.")),
  ).toBe(true);
  expect(TS_TOOLCHAIN[1].version).toBe("6.0.3");
});
test("class runtime-private field and operations pass", () => {
  const r = inspect("class Model { #value = 1; increment() { this.#value++; } static label = 'M'; }");
  expect(r.ruleResult).toBe("pass");
  expect(r.checkedEvidence?.targetStatus).toBe("resolved");
});
for (const modifier of ["", "readonly ", "private ", "protected "])
  test(`runtime public ${modifier}`, () => {
    const r = inspect(`class Model { ${modifier}value = 1; }`);
    expect(r.ruleResult).toBe("violation");
    expect(r.findings[0].memberId).toBe("Model::value");
  });
for (const source of [
  "class Model extends Base { #value = 1; }",
  "class Model { declare value: number; }",
  "class Model { get value() { return 1; } }",
  "class Model { [Symbol.iterator]() {} }",
  "abstract class Model { abstract value: number; }",
  "@sealed class Model { #value = 1; }",
])
  test(`unsupported class ${source}`, () => {
    const r = inspect(source);
    expect(r.ruleResult).toBe("unresolved");
    expect(r.unresolvedReasons[0].code).toBe("unsupported-syntax");
  });
for (const [source, code] of [
  ["class Other {}", "target-missing"],
  ["class Model {} class Model {}", "target-ambiguous"],
  ["class Model {", "syntax-error"],
] as const)
  test(code, () => expect(inspect(source).unresolvedReasons[0].code).toBe(code));
test("class mixed evidence retains exposed data beside unsupported member", () => {
  const r = inspect("class Model { value = 1; get computed() { return 2; } }");
  expect(r.ruleResult).toBe("unresolved");
  expect(r.findings).toHaveLength(1);
});
test("agreed local const instance + success wrapper ignores nested returns", () => {
  const r = inspect(companion, "ts-companion");
  expect(r.ruleResult).toBe("pass");
  expect(r.findings).toEqual([]);
});
test("companion direct and local object returns", () => {
  for (const body of [
    "return { [brand]: true, increment() { return; } };",
    "const instance: Model = { [brand]: true, increment() { return; } }; return instance;",
  ]) {
    const source = `const brand: unique symbol = Symbol(); export type Model = { readonly [brand]: true; increment(): void }; export const Model = { create(): Model { ${body} } };`;
    expect(inspect(source, "ts-companion").ruleResult).toBe("pass");
  }
});
test("companion readonly public state is exposure", () => {
  const source = companion
    .replace("increment(): Result", "readonly value: number; increment(): Result")
    .replace("[brand]: true,", "[brand]: true, value: state.value,");
  const r = inspect(source, "ts-companion");
  expect(r.ruleResult).toBe("violation");
  expect(r.findings[0].memberId).toBe("Model::value");
});
for (const [label, source] of [
  ["exported brand", companion.replace("const brand:", "export const brand:")],
  ["export alias", `${companion}\nexport { brand as exposed };`],
  [
    "shadow brand",
    companion.replace("const instance: Model", "const brand: unique symbol = Symbol(); const instance: Model"),
  ],
  ["assertion", companion.replace("value: instance", "value: instance as Model")],
  ["external return", companion.replace("value: instance", "value: external()")],
  ["let instance", companion.replace("const instance:", "let instance:")],
  [
    "unknown path",
    companion.replace(
      "return { ok: true, value: instance };",
      "if (initial > 0) return { ok: true, value: instance };",
    ),
  ],
  [
    "alias mutation",
    companion.replace(
      "return { ok: true, value: instance };",
      "const alias = instance; return { ok: true, value: instance };",
    ),
  ],
])
  test(`unsupported companion ${label}`, () => {
    const r = inspect(source, "ts-companion");
    expect(r.ruleResult).toBe("unresolved");
    expect(r.unresolvedReasons[0].code).toBe("unsupported-syntax");
  });
test("companion spread and computed name retain independent state exposure", () => {
  for (const extra of ["...{other: 1},", "[Symbol.iterator]: 1,"]) {
    const source = companion
      .replace("increment(): Result", "value: number; increment(): Result")
      .replace("[brand]: true,", `[brand]: true, value: state.value, ${extra}`);
    const r = inspect(source, "ts-companion");
    expect(r.ruleResult).toBe("unresolved");
    expect(r.findings).toHaveLength(1);
  }
});
test("Unicode and every common newline use byte positions", () => {
  for (const newline of ["\r\n", "\n", "\r", "\u2028", "\u2029"]) {
    const source = `// 日本語${newline}class Model { 名前 = '🦀'; }${newline}`;
    const r = inspect(source);
    const loc = r.findings[0].evidence[0];
    expect(loc.line).toBe(2);
    expect(Buffer.from(source).subarray(loc.byteStart, loc.byteEnd).toString()).toBe("名前 = '🦀';");
  }
});
test("real child process preserves evidence", async () => {
  const frozen = task(companion, "ts-companion");
  const result = await extractTypeScript(frozen);
  expect(result.execution.status).toBe("completed");
  const inspected = inspectStateExposure(frozen.request, result.execution);
  expect(inspected.kind).toBe("evaluated");
  if (inspected.kind === "evaluated") expect(inspected.result.ruleResult).toBe("pass");
});
test("explicit constructor assignments establish declared runtime fields", () => {
  expect(
    inspect("class Model { #value: number; constructor(value: number) { this.#value = value; } }").ruleResult,
  ).toBe("pass");
  expect(
    inspect("class Model { private value: number; constructor(value: number) { this.value = value; } }").ruleResult,
  ).toBe("violation");
  expect(
    inspect("class Model { #value: number; constructor(value: number) { if (value) this.#value = value; } }")
      .ruleResult,
  ).toBe("unresolved");
});
test("pinned standard library supplies Number and Symbol types", () => {
  const program = createFrozenProgram(task(companion, "ts-companion"));
  const file = program.getSourceFile("/input/model.ts");
  expect(program.getSemanticDiagnostics(file)).toHaveLength(0);
  expect(program.getSourceFiles().length).toBeGreaterThan(2);
});
test("factory return type must identify the target successful value", () => {
  const wrong = companion.replace(
    'Result<Model, "invalid">',
    "{ ok: true; value: unknown } | { ok: false; error: string }",
  );
  expect(inspect(wrong, "ts-companion").ruleResult).toBe("unresolved");
});
test("extractor rejects a claimed compiler version different from actual", () => {
  const frozen = task("class Model {}");
  const wrong = freezeInput({ ...frozen.input, toolchain: [{ name: "typescript", version: "7.0.2" }] });
  expect(() => extractTypeScriptLocal(wrong)).toThrow("toolchain identity mismatch");
});
test("a unique-symbol annotation cannot hide an incompatible initializer", () => {
  for (const initializer of ['"not a symbol"', "{} as any"]) {
    const source = companion.replace('Symbol("Model")', initializer);
    expect(inspect(source, "ts-companion").ruleResult).toBe("unresolved");
  }
});
test("instance construction through a field initializer is not silently complete", () => {
  expect(inspect("class Model { #value = Object.assign(this, { publicState: 1 }); }").ruleResult).toBe("unresolved");
});
for (const [label, initializer, prelude] of [
  ["nested as", '("publicBrand" as unknown as symbol)', ""],
  ["angle assertion", '(<symbol><unknown>"publicBrand")', ""],
  ["satisfies", '(Symbol("Model") satisfies symbol)', ""],
  ["assertion in argument", 'Symbol(("Model" as string))', ""],
  ["global registry", 'Symbol.for("Model")', ""],
  ["shadowed Symbol", 'Symbol("Model")', "const Symbol = (name: string): symbol => name as unknown as symbol;"],
  ["aliased Symbol", 'createSymbol("Model")', "const createSymbol = Symbol;"],
  ["alias hides assertion", "fakeBrand", 'const fakeBrand = "publicBrand" as unknown as symbol;'],
  [
    "factory hides assertion",
    "makeBrand()",
    'function makeBrand(): symbol { return "publicBrand" as unknown as symbol; }',
  ],
])
  test(`brand creation must prove fresh standard Symbol: ${label}`, () => {
    const source = `${prelude}\n${companion.replace('Symbol("Model")', initializer)}`;
    const result = inspect(source, "ts-companion");
    expect(result.ruleResult).toBe("unresolved");
    expect(result.unresolvedReasons[0].code).toBe("unsupported-syntax");
    expect(result.findings).toEqual([]);
  });
test("fresh standard Symbol without a description or within parentheses is supported", () => {
  for (const initializer of ["Symbol()", '(Symbol("Model"))'])
    expect(inspect(companion.replace('Symbol("Model")', initializer), "ts-companion").ruleResult).toBe("pass");
});

for (const [label, construction] of [
  ["direct call", "Object.assign(this, { publicState: 1 });"],
  ["immediate arrow", "(() => { Object.assign(this, { publicState: 1 }); })();"],
  ["synchronous callback", "[1].forEach(() => { Object.assign(this, { publicState: 1 }); });"],
]) {
  for (const exposed of [false, true]) {
    test(`R-01 untracked constructor ${label}, confirmed exposure=${exposed}`, () => {
      const publicDeclaration = exposed ? "declaredState = 2;" : "";
      const source = `class Model { #value = 1; ${publicDeclaration} constructor() { ${construction} } }`;
      const frozen = task(source);
      expect(createFrozenProgram(frozen).getSemanticDiagnostics()).toHaveLength(0);
      const result = inspect(source);
      expect(result.executionState).toBe("completed");
      expect(result.ruleResult).toBe("unresolved");
      const checked = result.checkedEvidence;
      expect(checked?.targetStatus).toBe("resolved");
      if (checked?.targetStatus !== "resolved") throw new Error("expected identified class");
      expect(checked.members.completeness).toBe("partial");
      expect(checked.members.reasons).toHaveLength(1);
      const reason = checked.members.reasons[0];
      expect(reason.code).toBe("unsupported-syntax");
      expect(reason.subject).toBe("Model");
      expect(reason.location).not.toBeNull();
      if (!reason.location) throw new Error("expected construction location");
      expect(Buffer.from(source).subarray(reason.location.byteStart, reason.location.byteEnd).toString()).toContain(
        "this",
      );
      expect(result.unresolvedReasons).toEqual(checked.members.reasons);
      expect(checked.members.items.find((member) => member.memberId === "Model::#value")?.stateExposure.status).toBe(
        "resolved",
      );
      expect(result.findings.map((finding) => finding.memberId)).toEqual(exposed ? ["Model::declaredState"] : []);
      if (exposed) {
        const location = result.findings[0].evidence[0];
        expect(Buffer.from(source).subarray(location.byteStart, location.byteEnd).toString()).toBe(publicDeclaration);
      }
    });
  }
}
test("constructor-local returns without instance capture are not factory returns", () => {
  const result = inspect("class Model { #value = 1; constructor() { const value = (() => { return 1; })(); } }");
  expect(result.ruleResult).toBe("pass");
  expect(result.unresolvedReasons).toEqual([]);
});
