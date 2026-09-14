/**
 * Line-weighted coverage floor over the lcov report `bun test --coverage`
 * writes.
 *
 * Bun's own `coverageThreshold` cannot express this gate: it is evaluated per
 * file, so any floor high enough to be meaningful fails on the least-covered
 * file rather than on the state of the codebase. Bun's printed "All files"
 * figure is no substitute either -- it is the unweighted mean of the per-file
 * percentages, so a one-line helper counts as much as a thousand-line module.
 *
 * The file set is whatever bunfig.toml's coveragePathIgnorePatterns left in
 * the report; this script does no filtering of its own.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const FLOORS = { line: 80, function: 80 } as const;

const root = resolve(import.meta.dir, "..");
const report = join(root, "coverage/lcov.info");
if (!existsSync(report)) {
  console.error(`missing ${report}; run the test suite with --coverage first`);
  process.exit(1);
}

interface Counts {
  found: number;
  hit: number;
}
const files = new Map<string, { line: Counts; function: Counts }>();
let current: string | undefined;
for (const raw of readFileSync(report, "utf8").split("\n")) {
  const entry = raw.trim();
  const [tag, value] = [entry.slice(0, entry.indexOf(":")), entry.slice(entry.indexOf(":") + 1)];
  if (tag === "SF") {
    current = value;
    files.set(current, { line: { found: 0, hit: 0 }, function: { found: 0, hit: 0 } });
    continue;
  }
  const counts = current === undefined ? undefined : files.get(current);
  if (!counts) continue;
  if (tag === "LF") counts.line.found = Number(value);
  else if (tag === "LH") counts.line.hit = Number(value);
  else if (tag === "FNF") counts.function.found = Number(value);
  else if (tag === "FNH") counts.function.hit = Number(value);
}
if (files.size === 0) {
  console.error(`${report} lists no files; coverage was not recorded`);
  process.exit(1);
}

const percent = (hit: number, found: number) => (found === 0 ? 100 : (100 * hit) / found);
const failures: string[] = [];
for (const metric of ["line", "function"] as const) {
  const found = [...files.values()].reduce((total, file) => total + file[metric].found, 0);
  const hit = [...files.values()].reduce((total, file) => total + file[metric].hit, 0);
  const actual = percent(hit, found);
  const floor = FLOORS[metric];
  const verdict = actual >= floor ? "ok" : "BELOW FLOOR";
  console.log(`${metric.padEnd(8)} ${hit}/${found} = ${actual.toFixed(2)}% (floor ${floor}%) ${verdict}`);
  if (actual < floor) failures.push(`${metric} coverage ${actual.toFixed(2)}% is below the ${floor}% floor`);
}
console.log(`${files.size} files, weighted by lines rather than averaged per file`);

if (failures.length > 0) {
  const worst = [...files]
    .filter(([, file]) => file.line.found >= 20)
    .sort((a, b) => percent(a[1].line.hit, a[1].line.found) - percent(b[1].line.hit, b[1].line.found))
    .slice(0, 5);
  console.error("\nleast-covered files by line:");
  for (const [path, file] of worst)
    console.error(
      `  ${percent(file.line.hit, file.line.found).toFixed(1)}%  ${file.line.hit}/${file.line.found}  ${path}`,
    );
  for (const failure of failures) console.error(`\nerror: ${failure}`);
  process.exit(1);
}
