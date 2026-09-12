import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { PACKAGING_CASES } from "./golden/packaging/cases.ts";
import { runGoldenCase } from "./golden/runner.ts";

describe("domain packaging", () => {
  for (const entry of PACKAGING_CASES) {
    test(`${entry.sensor} / ${entry.name}`, () => {
      expect(runGoldenCase(join(import.meta.dir, "../tools"), entry).problems).toEqual([]);
    });
  }
});
