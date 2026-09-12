import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { CONTRACT_CASES } from "./golden/contract/cases.ts";
import { DESIGN_CASES } from "./golden/design/cases.ts";
import { PACKAGING_CASES } from "./golden/packaging/cases.ts";
import { declaredRules, type GoldenCase, runGoldenCase, runGoldenCases } from "./golden/runner.ts";

const root = join(import.meta.dir, "..");
const toolsDir = join(root, "tools");
const sensorsDir = join(root, "sensors");

// Unresolved model references are rejected by the loader before these defensive checks.
// The contract matrix names the actual rejecting rule and its executable reproduction.
const UNREACHABLE = new Set(["model-completeness.iv", "model-presence.unresolved"]);

describe("design golden cases", () => {
  for (const testCase of DESIGN_CASES) {
    test(`${testCase.sensor} / ${testCase.name}`, () => {
      const result = runGoldenCase(toolsDir, testCase);
      expect(result.problems).toEqual([]);
    });
  }

  test("every declared rule has a violation case", () => {
    const manifests = readdirSync(sensorsDir).filter(
      (name) => name.startsWith("aidlc-ddd-") && name.endsWith(".md") && !name.startsWith("aidlc-ddd-rust-"),
    );
    const declared = declaredRules(sensorsDir, manifests);
    const covered = new Set<string>();
    for (const testCase of [...DESIGN_CASES, ...PACKAGING_CASES, ...CONTRACT_CASES]) {
      if (!testCase.name.startsWith("violation-")) continue;
      for (const rule of testCase.expect.rules) covered.add(`${testCase.sensor}:${rule}`);
    }
    const missing: string[] = [];
    for (const [sensor, rules] of declared) {
      for (const rule of rules) {
        if (UNREACHABLE.has(rule)) continue;
        if (!covered.has(`${sensor}:${rule}`)) missing.push(`${sensor}:${rule}`);
      }
    }
    expect(missing).toEqual([]);
  });

  test("a representative verdict is deterministic across three runs", () => {
    const testCase = DESIGN_CASES.find((entry: GoldenCase) => entry.name === "violation-f-missing");
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

  test("the whole suite runs through the real entry point", () => {
    const results = runGoldenCases(toolsDir, DESIGN_CASES);
    expect(results.every((result) => result.ok)).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(DESIGN_CASES.length);
  });
});
