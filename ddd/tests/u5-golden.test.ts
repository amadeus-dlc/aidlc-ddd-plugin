import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { CONTRACT_CASES } from "./golden/contract/cases.ts";
import { PACKAGING_CASES } from "./golden/packaging/cases.ts";
import { declaredRules, type GoldenCase, runGoldenCase } from "./golden/runner.ts";
import { RUST_CASES } from "./golden/rust/cases.ts";

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
    for (const testCase of [...RUST_CASES, ...PACKAGING_CASES, ...CONTRACT_CASES]) {
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
