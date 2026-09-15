/**
 * Verifies the fixed business-error contract scenario and records its evidence.
 *
 * Syntax success and compiler acceptance are measured separately: the native
 * extractor never compiles, and rustc is the only source of acceptance here.
 */
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { CargoCondition, ReasonCode, SourceInput } from "../tools/ddd/lib/error-contract/index.ts";
import { resolveErrorContract } from "../tools/ddd/lib/error-contract/index.ts";
import { freezeInput } from "../tools/ddd/lib/error-contract-verification/input.ts";
import {
  LAYOUT,
  type PackageName,
  WORKSPACE,
  workspaceSources,
} from "../tools/ddd/lib/error-contract-verification/scenario.ts";
import { projectSettingsPayload } from "../tools/ddd/lib/project-settings/payload.ts";
import { resolveCargoCondition } from "../tools/ddd/lib/rust/error-contract/cargo-condition.ts";
import { extractRust, RUST_TOOLCHAIN } from "../tools/ddd/lib/rust/error-contract/index.ts";

const root = resolve(import.meta.dir, "..");
const LOCKFILE = join(WORKSPACE, "Cargo.lock");

function command(argv: string[], cwd = root) {
  const result = Bun.spawnSync(argv, { cwd, stdout: "pipe", stderr: "pipe", timeout: 180_000 });
  return { code: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}
function digestOf(path: string): string {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

/** Each case states both outcomes, so syntax success can never stand in for acceptance. */
const CASES: {
  name: string;
  source: string;
  operation: string;
  syntax: boolean;
  compiles: boolean;
  expected: ReasonCode | null;
}[] = [
  {
    name: "supported-reference",
    source:
      "pub enum E { Only }\npub struct Invoice;\nimpl Invoice { pub fn issue(&mut self) -> Result<(), E> { Ok(()) } }\n",
    operation: "issue",
    syntax: true,
    compiles: true,
    expected: null,
  },
  {
    name: "cyclic-alias",
    source:
      "pub enum E { Only }\npub type A<T> = B<T>;\npub type B<T> = A<T>;\npub struct Invoice;\nimpl Invoice { pub fn issue(&mut self) -> A<()> { loop {} } }\n",
    operation: "issue",
    syntax: true,
    compiles: false,
    expected: "alias-cycle",
  },
  {
    name: "missing-referent",
    source:
      "use missing::E;\npub struct Invoice;\nimpl Invoice { pub fn issue(&mut self) -> Result<(), E> { loop {} } }\n",
    operation: "issue",
    syntax: true,
    compiles: false,
    expected: "missing-referent",
  },
  {
    name: "ambiguous-glob",
    source:
      "pub mod a { pub enum E { One } }\npub mod b { pub enum E { Two } }\npub use a::*;\npub use b::*;\npub struct Invoice;\nimpl Invoice { pub fn issue(&mut self) -> Result<(), E> { loop {} } }\n",
    operation: "issue",
    syntax: true,
    compiles: false,
    expected: "ambiguous-candidate",
  },
  {
    name: "alias-argument-count",
    source:
      "pub enum E { Only }\npub type Outcome<T> = Result<T, E>;\npub struct Invoice;\nimpl Invoice { pub fn issue(&mut self) -> Outcome<(), E> { loop {} } }\n",
    operation: "issue",
    syntax: true,
    compiles: false,
    expected: "unsupported-type-argument",
  },
  {
    name: "standard-result-one-argument",
    source: "pub enum E { Only }\npub struct Invoice;\nimpl Invoice { pub fn create() -> Result<Self> { loop {} } }\n",
    operation: "create",
    syntax: true,
    compiles: false,
    expected: "unsupported-type-argument",
  },
  {
    name: "unparsable",
    source: "pub struct Invoice {\n",
    operation: "issue",
    syntax: false,
    compiles: false,
    expected: "syntax-error",
  },
];

async function inspect(
  condition: CargoCondition,
  sources: readonly SourceInput[],
  target: string,
  path: string[],
  operation: string,
  owner: PackageName,
) {
  const entry = condition.packages.find((candidate) => candidate.name === owner);
  if (!entry) throw new Error(`condition has no package ${owner}`);
  const frozen = freezeInput({
    language: "rust",
    cargoCondition: condition,
    target: {
      packageId: entry.packageId,
      targetName: entry.targets[0].name,
      file: target,
      declarationPath: path,
      operation,
    },
    sources,
    settings: projectSettingsPayload({ languages: ["rust"], rust: { moduleLayout: LAYOUT[owner] }, typescript: null }),
    toolchain: RUST_TOOLCHAIN,
  });
  const observed = await extractRust(frozen);
  const outcome = resolveErrorContract(frozen.request, observed.execution);
  if (outcome.kind !== "evaluated") throw new Error(`contract rejected the request: ${JSON.stringify(outcome)}`);
  return outcome.result;
}

const problems: string[] = [];
const temporary = mkdtempSync(join(tmpdir(), "ddd-error-contract-"));
try {
  const host = /^host: (.+)$/m.exec(command(["rustc", "-vV"]).stdout)?.[1];
  if (!host) throw new Error("rustc host target unavailable");
  const before = digestOf(LOCKFILE);
  const sources = workspaceSources();

  const conditions: Record<string, CargoCondition> = {};
  for (const [label, features] of [
    ["no-feature", []],
    ["extra-case", ["billing-use-case/extra-case"]],
  ] as const) {
    const outcome = await resolveCargoCondition({
      manifestPath: join(WORKSPACE, "Cargo.toml"),
      targetTriple: host,
      features,
    });
    if (outcome.kind !== "resolved") throw new Error(`Cargo condition unavailable: ${JSON.stringify(outcome.reasons)}`);
    conditions[label] = outcome.condition;
  }

  // The same operation under two build conditions must not reuse the earlier case set.
  const conditionEvidence = [];
  for (const [label, expected] of [
    ["no-feature", ["AlreadyIssued", "Empty"]],
    ["extra-case", ["AlreadyIssued", "Empty", "Rejected"]],
  ] as const) {
    const result = await inspect(
      conditions[label],
      sources,
      "billing-domain/src/invoice.rs",
      ["invoice", "Invoice"],
      "issue",
      "billing-domain",
    );
    const cases =
      result.evidence?.operationStatus === "resolved" && result.evidence.errorCases.status === "resolved"
        ? result.evidence.errorCases.value.items.map((item) => item.name)
        : [];
    if (JSON.stringify(cases) !== JSON.stringify(expected))
      problems.push(`${label}: expected cases ${expected.join(",")} but read ${cases.join(",")}`);
    conditionEvidence.push({ condition: label, request_identity: result.requestIdentity, error_cases: cases });
  }
  if (conditionEvidence[0].request_identity === conditionEvidence[1].request_identity)
    problems.push("a changed build condition did not change the request identity");

  const rows = [];
  for (const entry of CASES) {
    const result = await inspect(
      conditions["no-feature"],
      [{ path: "billing-domain/src/lib.rs", content: entry.source }],
      "billing-domain/src/lib.rs",
      ["Invoice"],
      entry.operation,
      "billing-domain",
    );
    const codes = result.unresolvedReasons.map((reason) => reason.code);
    const parsed = !codes.includes("syntax-error");
    const probe = join(temporary, `${entry.name}.rs`);
    await Bun.write(probe, entry.source);
    const checked = command([
      "rustc",
      "--crate-name",
      "probe",
      "--crate-type",
      "lib",
      "--edition",
      "2021",
      "--emit",
      "metadata",
      "--error-format",
      "json",
      "-A",
      "warnings",
      probe,
      "-o",
      join(temporary, `${entry.name}.rmeta`),
    ]);
    const accepted = checked.code === 0;
    const diagnostics = [
      ...new Set(
        checked.stderr
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => (JSON.parse(line) as { code?: { code: string } }).code?.code)
          .filter(Boolean),
      ),
    ];
    if (parsed !== entry.syntax) problems.push(`${entry.name}: syntax parsing was ${parsed}, expected ${entry.syntax}`);
    if (accepted !== entry.compiles)
      problems.push(`${entry.name}: compiler acceptance was ${accepted}, expected ${entry.compiles}`);
    if (entry.expected && !codes.includes(entry.expected))
      problems.push(`${entry.name}: expected reason ${entry.expected}, read ${codes.join(",") || "none"}`);
    rows.push({
      name: entry.name,
      syntax_parsed: parsed,
      compiler_accepted: accepted,
      compiler_diagnostics: diagnostics,
      reasons: codes,
    });
  }

  // The fixed scenario itself is compiled only here, never on an inspection.
  const scenario = [];
  for (const [label, features] of [
    ["no-feature", []],
    ["extra-case", ["--features", "billing-use-case/extra-case"]],
  ] as const) {
    const built = command([
      "cargo",
      "build",
      "--frozen",
      "--manifest-path",
      join(WORKSPACE, "Cargo.toml"),
      "--target-dir",
      join(temporary, "target"),
      ...features,
    ]);
    if (built.code !== 0) problems.push(`${label}: the fixed scenario did not compile`);
    scenario.push({ condition: label, compiler_accepted: built.code === 0 });
  }

  const after = digestOf(LOCKFILE);
  if (after !== before) problems.push("inspection changed the lockfile");

  const report = {
    contract: "error-contract/1",
    protocol_version: 3,
    platform: `${process.platform}-${process.arch}`,
    versions: {
      rustc: command(["rustc", "--version"]).stdout.trim(),
      cargo: command(["cargo", "--version"]).stdout.trim(),
      bun: Bun.version,
      syn: "3.0.5",
    },
    lockfile: { before, after, unchanged: before === after },
    build_conditions: conditionEvidence,
    fixed_scenario: scenario,
    cases: rows,
    unverified: [
      "trait implementation selection",
      "associated type projection",
      "general expression inference",
      "macro expansion",
      "conditional compilation beyond the selected features",
      "more than one build condition at a time",
      "production sensor migration and distribution",
    ],
  };
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (process.argv.includes("--write"))
    await Bun.write(join(root, "docs/developers/evidence/error-contract.json"), output);
  console.log(output);
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
