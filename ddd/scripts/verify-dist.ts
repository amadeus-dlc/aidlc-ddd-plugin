// Verify the BUILT plugin tools (ddd/dist/<harness>/tools) by running the
// design and rust golden cases through them, as a child process — the same
// entry point the dispatcher uses. This checks the projected artifacts, not the
// source tools (tests/u4-*.test.ts and tests/u5-*.test.ts already cover those).
//
// Usage: bun scripts/verify-dist.ts [harness ...]
//        (default: claude codex)
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { ALL_CASES } from "../tests/golden/catalog.ts";
import { runGoldenCase } from "../tests/golden/runner.ts";

const dddRoot = resolve(import.meta.dir, "..");
const harnesses = process.argv.slice(2);
const supported = ["claude", "codex"];
const targets = harnesses.length > 0 ? harnesses : supported;
const unsupported = targets.filter((target) => !supported.includes(target));
if (unsupported.length > 0) {
  console.error(`Unsupported harness: ${unsupported.join(", ")}. Supported: ${supported.join(", ")}.`);
  process.exit(1);
}
const cases = ALL_CASES;

interface HarnessResult {
  harness: string;
  total: number;
  failed: number;
  problems: string[];
}

const results: HarnessResult[] = [];
for (const harness of targets) {
  const toolsDir = join(dddRoot, "dist", harness, "tools");
  if (!existsSync(toolsDir)) {
    results.push({
      harness,
      total: 0,
      failed: 0,
      problems: [`dist/${harness}/tools is missing — run build:${harness} first`],
    });
    continue;
  }
  const entry: HarnessResult = { harness, total: 0, failed: 0, problems: [] };
  for (const testCase of cases) {
    entry.total++;
    const result = runGoldenCase(toolsDir, testCase);
    if (!result.ok) {
      entry.failed++;
      entry.problems.push(`${testCase.sensor}/${testCase.name}: ${result.problems.join("; ")}`);
    }
  }
  results.push(entry);
}

console.log(JSON.stringify({ cases: cases.length, results }, null, 2));
const failed = results.some((entry) => entry.failed > 0 || entry.problems.length > 0);
process.exitCode = failed ? 1 : 0;
