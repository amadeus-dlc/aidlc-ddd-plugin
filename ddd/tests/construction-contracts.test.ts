import { expect, test } from "bun:test";
import { join } from "node:path";
import { CONSTRUCTION_CASES } from "./golden/construction-cases.ts";
import { runGoldenCase } from "./golden/runner.ts";

for (const entry of CONSTRUCTION_CASES)
  test(`${entry.sensor}: ${entry.name}`, () => {
    const result = runGoldenCase(join(import.meta.dir, "../tools"), entry);
    expect(result.problems, JSON.stringify(result.verdict)).toEqual([]);
  }, 30000);

for (const base of CONSTRUCTION_CASES.filter((entry) =>
  /clean-construction-(class|companion|rust)-clean$/.test(entry.name),
)) {
  test(`${base.sensor}: a DP cannot omit its checked factory mapping`, () => {
    const entry = structuredClone(base);
    const model = "inception/ddd-domain-modeling/ddd-domain-model-yaml.md";
    const mapping = "inception/domain-design/ddd-aggregate-mapping.md";
    entry.files[model] = entry.files[model].replace(
      / {10}- element_id: factory\.invoice\.parse-money[\s\S]*?(?= {10}- element_id: factory\.invoice\.open)/,
      "",
    );
    entry.files[mapping] = entry.files[mapping].replace(
      / {6}- operation_ref: factory\.invoice\.parse-money[\s\S]*?(?= {6}- operation_ref: factory\.invoice\.open)/,
      "",
    );
    const file = Object.keys(entry.workspace ?? {}).find((path) => /\/src\/money\.(rs|ts)$/.test(path));
    if (!file) throw new Error("missing Money source");
    entry.expect = { pass: false, rules: ["primitive-initialization"], files: { "primitive-initialization": file } };
    const result = runGoldenCase(join(import.meta.dir, "../tools"), entry);
    expect(result.problems, JSON.stringify(result.verdict)).toEqual([]);
  });
}

for (const base of CONSTRUCTION_CASES.filter((entry) =>
  /clean-construction-(class|companion|rust)-repository-clean$/.test(entry.name),
)) {
  test(`${base.sensor}: accepts a reusable generic StoreResult`, () => {
    const entry = structuredClone(base);
    const workspace = entry.workspace;
    if (!workspace) throw new Error("missing repository workspace");
    const rust = entry.sensor.includes("-rust-");
    const file = Object.keys(workspace).find((path) => /\/src\/invoice[-_]repository\.(rs|ts)$/.test(path));
    if (!file) throw new Error("missing repository source");
    const unit = rust ? "()" : "void";
    workspace[file] =
      workspace[file].replace(`Result<${unit}, RepositoryError>`, "StoreResult<RepositoryError>") +
      `\n${rust ? "type" : "export type"} StoreResult<E> = Result<${unit}, E>;\n`;
    const result = runGoldenCase(join(import.meta.dir, "../tools"), entry);
    expect(result.problems, JSON.stringify(result.verdict)).toEqual([]);
  });
}

test("TypeScript rejects multiple primary constructor implementations", () => {
  const base = CONSTRUCTION_CASES.find((entry) => entry.name === "clean-construction-class-clean");
  if (!base?.workspace) throw new Error("missing class fixture");
  const entry = structuredClone(base);
  const file = Object.keys(base.workspace).find((path) => path.endsWith("/src/money.ts"));
  if (!file || !entry.workspace) throw new Error("missing Money fixture");
  const primarySource = "  private constructor(value: number) {\n    this.#value = value;\n  }";
  entry.workspace[file] = entry.workspace[file].replace(primarySource, `${primarySource}\n${primarySource}`);
  entry.expect = { pass: false, rules: ["primary-constructor"], files: { "primary-constructor": file } };
  const result = runGoldenCase(join(import.meta.dir, "../tools"), entry);
  expect(result.problems, JSON.stringify(result.verdict)).toEqual([]);
});

test("Rust rejects multiple raw primary constructors", () => {
  const base = CONSTRUCTION_CASES.find((entry) => entry.name === "clean-construction-rust-clean");
  if (!base?.workspace) throw new Error("missing Rust fixture");
  const entry = structuredClone(base);
  const file = Object.keys(base.workspace).find((path) => path.endsWith("/src/invoice.rs"));
  if (!file || !entry.workspace) throw new Error("missing Invoice fixture");
  entry.workspace[file] = entry.workspace[file].replace(
    "impl Invoice {",
    "impl Invoice {\n    fn alternate(id: String, sequence_number: u64, customer: String, lines: Vec<InvoiceLine>, issued: bool) -> Self { Self { id, sequence_number, customer, lines, issued } }\n",
  );
  entry.expect = { pass: false, rules: ["primary-constructor"], files: { "primary-constructor": file } };
  const result = runGoldenCase(join(import.meta.dir, "../tools"), entry);
  expect(result.problems, JSON.stringify(result.verdict)).toEqual([]);
});

test("TypeScript constructor overload signatures keep one primary implementation", () => {
  const base = CONSTRUCTION_CASES.find((entry) => entry.name === "clean-construction-class-clean");
  if (!base?.workspace) throw new Error("missing class fixture");
  const entry = structuredClone(base);
  const file = Object.keys(base.workspace).find((path) => path.endsWith("/src/money.ts"));
  if (!file || !entry.workspace) throw new Error("missing Money fixture");
  entry.workspace[file] = entry.workspace[file].replace(
    "  private constructor(value: number) {",
    "  private constructor(value: number);\n  private constructor(value: number) {",
  );
  const result = runGoldenCase(join(import.meta.dir, "../tools"), entry);
  expect(result.problems, JSON.stringify(result.verdict)).toEqual([]);
});

test("Rust excludes cfg(test) helper structs from construction rules", () => {
  const base = CONSTRUCTION_CASES.find((entry) => entry.name === "clean-construction-rust-clean");
  if (!base?.workspace) throw new Error("missing Rust fixture");
  const entry = structuredClone(base);
  const file = Object.keys(base.workspace).find((path) => path.endsWith("/src/invoice.rs"));
  if (!file || !entry.workspace) throw new Error("missing Invoice fixture");
  entry.workspace[file] +=
    "\n#[cfg(test)] struct Fixture { value: i64 }\n#[cfg(test)] mod tests { struct Helper { value: i64 } }\n";
  const result = runGoldenCase(join(import.meta.dir, "../tools"), entry);
  expect(result.problems, JSON.stringify(result.verdict)).toEqual([]);
});
