// Verify the BUILT plugin tools (ddd/dist/<harness>/tools) by running the
// design and rust golden cases through them, as a child process — the same
// entry point the dispatcher uses. This checks the projected artifacts, not the
// source tools (tests/u4-*.test.ts and tests/u5-*.test.ts already cover those).
//
// Usage: bun scripts/verify-dist.ts [harness ...]
//        (default: claude codex)
import { chmodSync, existsSync, readdirSync } from "node:fs";
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

/**
 * Grants the execute bit on the projected native extractor, as the installer does.
 *
 * Projection writes payload bytes without a mode, so `dist/<harness>/tools/ddd/bin/` carries an
 * extractor no process can launch; placement is the installer's responsibility, and it grants the
 * bit inside its candidate tree. The gates here launch that extractor, so verifying the projected
 * tools means running them in the mode an installed project has, not the mode projection leaves.
 * Whether the installer actually grants it is a different contract, covered by the install tests.
 */
function grantExtractorExecuteBit(toolsDir: string): void {
  const binDir = join(toolsDir, "ddd", "bin");
  if (!existsSync(binDir)) return;
  for (const entry of readdirSync(binDir, { withFileTypes: true })) {
    // `bin/<platform-key>/<extractor>` holds the executables; `bin/manifest.json` is data beside them.
    if (!entry.isDirectory()) continue;
    const platformDir = join(binDir, entry.name);
    for (const file of readdirSync(platformDir, { withFileTypes: true })) {
      if (file.isFile()) chmodSync(join(platformDir, file.name), 0o755);
    }
  }
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
  grantExtractorExecuteBit(toolsDir);
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
