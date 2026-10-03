import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { ALL_CASES } from "./golden/catalog.ts";
import { declaredRules, type GoldenCase, runGoldenCase } from "./golden/runner.ts";
import { RUST_CASES } from "./golden/rust/cases.ts";
import { TYPESCRIPT_CASES } from "./golden/typescript/cases.ts";
import { TYPESCRIPT_INTERFACE_ADAPTER_CASES } from "./golden/typescript/interface-adapter-cases.ts";
import { TYPESCRIPT_USE_CASE_CASES } from "./golden/typescript/use-case-cases.ts";

const root = join(import.meta.dir, "..");
const toolsDir = join(root, "tools");
const sensorsDir = join(root, "sensors");

describe("rust golden cases", () => {
  for (const testCase of RUST_CASES) {
    test(`${testCase.sensor} / ${testCase.name}`, () => {
      const result = runGoldenCase(toolsDir, testCase);
      expect(result.problems).toEqual([]);
    });
  }

  test("every declared rust rule has a violation case", () => {
    const manifests = readdirSync(sensorsDir).filter(
      (name) => name.startsWith("aidlc-ddd-rust-") && name.endsWith(".md"),
    );
    const declared = declaredRules(sensorsDir, manifests);
    const covered = new Set<string>();
    for (const testCase of ALL_CASES) {
      if (!testCase.name.startsWith("violation-")) continue;
      for (const rule of testCase.expect.rules) covered.add(`${testCase.sensor}:${rule}`);
    }
    const missing: string[] = [];
    for (const [sensor, rules] of declared) {
      for (const rule of rules) {
        if (!covered.has(`${sensor}:${rule}`)) missing.push(`${sensor}:${rule}`);
      }
    }
    expect(missing).toEqual([]);
  });

  test("a representative verdict is deterministic across three runs", () => {
    const testCase = RUST_CASES.find((entry: GoldenCase) => entry.name === "violation-d");
    if (!testCase) throw new Error("representative case missing");
    const normalize = () => {
      const verdict = { ...(runGoldenCase(toolsDir, testCase).verdict ?? {}) } as Record<string, unknown>;
      delete verdict.output_path;
      return JSON.stringify(verdict);
    };
    const runs = [normalize(), normalize(), normalize()];
    expect(runs[0]).toBe(runs[1]);
    expect(runs[1]).toBe(runs[2]);
  });
});

/** Every run loads the distributed multi-megabyte compiler in a process of its own. */
const TYPESCRIPT_RUN_TIMEOUT_MS = 30_000;

describe("typescript golden cases", () => {
  for (const testCase of [...TYPESCRIPT_CASES, ...TYPESCRIPT_USE_CASE_CASES, ...TYPESCRIPT_INTERFACE_ADAPTER_CASES]) {
    test(
      `${testCase.sensor} / ${testCase.name}`,
      () => {
        const result = runGoldenCase(toolsDir, testCase);
        expect(result.problems).toEqual([]);
      },
      TYPESCRIPT_RUN_TIMEOUT_MS,
    );
  }

  test("the typescript manifests are shipped and every rule they declare has a violation case", () => {
    const manifests = readdirSync(sensorsDir).filter(
      (name) => name.startsWith("aidlc-ddd-typescript-") && name.endsWith(".md"),
    );
    const declared = declaredRules(sensorsDir, manifests);
    expect([...declared.keys()].sort()).toEqual(
      [
        "ddd-typescript-domain",
        "ddd-typescript-interface-adapter",
        "ddd-typescript-module-layout",
        "ddd-typescript-use-case",
      ].sort(),
    );
    // The layer gates declare exactly the rule ids of their Rust counterparts, less the Rust-only
    // receiver rule: TypeScript has no `&mut self` for a repository write to take.
    const rustOnly = new Set(["repository-mut-self"]);
    for (const layer of ["use-case", "interface-adapter"]) {
      const rust = declaredRules(sensorsDir, [`aidlc-ddd-rust-${layer}.md`]).get(`ddd-rust-${layer}`);
      expect([...(declared.get(`ddd-typescript-${layer}`) ?? [])].sort()).toEqual(
        [...(rust ?? [])].filter((rule) => !rustOnly.has(rule)).sort(),
      );
    }
    expect([...(declared.get("ddd-typescript-use-case") ?? [])].sort()).toEqual([
      "d",
      "g",
      "h",
      "i",
      "repository-result",
      "use-case-name",
    ]);
    expect([...(declared.get("ddd-typescript-interface-adapter") ?? [])].sort()).toEqual(["g", "k", "l", "m", "n"]);
    // The rule ids are the Rust domain gate's, less the Cargo-only mixed-targets diagnostic.
    expect([...(declared.get("ddd-typescript-domain") ?? [])].sort()).toEqual(
      [
        "a",
        "b",
        "c",
        "d",
        "port-placement",
        "g",
        "domain-packaging.declaration",
        "domain-packaging.technical-name",
        "domain-packaging.coverage",
        "domain-packaging.reference",
        "domain-packaging.unresolved",
        "layer.unknown",
        "layer.conflict",
        "layer.unowned",
        "model.invalid",
      ].sort(),
    );
    const covered = new Set<string>();
    for (const testCase of ALL_CASES) {
      if (!testCase.name.startsWith("violation-")) continue;
      for (const rule of testCase.expect.rules) covered.add(`${testCase.sensor}:${rule}`);
    }
    const missing: string[] = [];
    for (const [sensor, rules] of declared) {
      for (const rule of rules) {
        if (!covered.has(`${sensor}:${rule}`)) missing.push(`${sensor}:${rule}`);
      }
    }
    expect(missing).toEqual([]);
  });

  test(
    "a representative verdict is deterministic across three runs",
    () => {
      const testCase = TYPESCRIPT_CASES.find((entry: GoldenCase) => entry.name === "violation-d-companion");
      if (!testCase) throw new Error("representative case missing");
      const normalize = () => {
        const verdict = { ...(runGoldenCase(toolsDir, testCase).verdict ?? {}) } as Record<string, unknown>;
        delete verdict.output_path;
        return JSON.stringify(verdict);
      };
      const runs = [normalize(), normalize(), normalize()];
      expect(runs[0]).toBe(runs[1]);
      expect(runs[1]).toBe(runs[2]);
    },
    TYPESCRIPT_RUN_TIMEOUT_MS,
  );
});
