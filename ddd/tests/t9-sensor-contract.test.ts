import { expect, test } from "bun:test";
import { join } from "node:path";
import { reportProblems } from "../scripts/report-sensor-coverage.ts";
import { ALL_CASES } from "./golden/catalog.ts";
import { CONTRACT_CASES } from "./golden/contract/cases.ts";
import { COVERAGE, coverageProblems } from "./golden/contract/coverage.ts";
import { runGoldenCase } from "./golden/runner.ts";

for (const entry of CONTRACT_CASES) {
  test(`${entry.sensor}/${entry.name}`, () => {
    expect(runGoldenCase(join(import.meta.dir, "../tools"), entry).problems).toEqual([]);
  });
}

test("every sensor/rule has normal, negative, and justified boundary evidence", () => {
  expect(coverageProblems()).toEqual([]);
});
test("another sensor cannot cover a missing dependency violation", () => {
  const remaining = ALL_CASES.filter(
    (entry) => !(entry.sensor === "ddd-rust-interface-adapter" && entry.expect.rules.includes("g")),
  );
  expect(coverageProblems(remaining)).toContain("Missing negative case: ddd-rust-interface-adapter/g");
});
test("removing a positive or boundary case invalidates the matrix", () => {
  const row = COVERAGE.find((entry) => entry.sensor === "ddd-rust-domain" && entry.rule === "c");
  if (!row) throw new Error("Constructor coverage row missing");
  for (const name of [row.normal, row.boundary]) {
    const remaining = ALL_CASES.filter((entry) => !(entry.sensor === row.sensor && entry.name === name));
    expect(coverageProblems(remaining).some((issue) => issue.endsWith(`${row.sensor}/${row.rule}`))).toBe(true);
  }
});
test("the dependency contract includes use and Cargo evidence for every inspected source layer", () => {
  const sources = ["domain", "use-case", "interface-adapter", "rmu"];
  const destinations = [...sources, "infrastructure", "composition-root"];
  for (const from of sources)
    for (const to of destinations)
      for (const evidence of ["use", "cargo"]) {
        expect(CONTRACT_CASES.filter((entry) => entry.name.endsWith(`g-${from}-to-${to}-${evidence}`))).toHaveLength(1);
      }
});
test("all reserved package names have design and code violation cases", () => {
  const names = [
    "aggregate",
    "aggregates",
    "impl",
    "impls",
    "implementation",
    "implementations",
    "vo",
    "vos",
    "entity",
    "entities",
    "value_object",
    "value_objects",
    "valueobject",
    "valueobjects",
  ];
  for (const sensor of ["ddd-rust-domain", "ddd-mapping-declarations"])
    for (const name of names) {
      const expected =
        sensor === "ddd-rust-domain" ? `violation-packaging-mod-${name}` : `violation-packaging-name-${name}`;
      expect(
        ALL_CASES.some(
          (entry) =>
            entry.sensor === sensor &&
            (entry.name === expected || entry.name === `violation-package-reserved-${name}`) &&
            entry.expect.rules.includes("domain-packaging.technical-name"),
        ),
      ).toBe(true);
    }
});

test("English and Japanese coverage reports match the executable matrix", () => {
  expect(reportProblems()).toEqual([]);
});
