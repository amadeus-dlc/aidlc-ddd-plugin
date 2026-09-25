/** Opt-in experiment; does not replace or install production sensors. */
import { deepStrictEqual, ok, strictEqual } from "node:assert";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import cases from "../experiments/rust-syn/cases.json";
import { runGoldenCase } from "../tests/golden/runner.ts";
import { RUST_CASES } from "../tests/golden/rust/cases.ts";

const root = resolve(import.meta.dir, "..");
const experiment = join(root, "experiments/rust-syn");
const manifest = join(experiment, "Cargo.toml");
const temp = mkdtempSync(join(tmpdir(), "ddd-rust-syn-"));
const canonical = (text: string) => text.replace(/\s+/g, "").replace(/r#/g, "");
const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
function command(argv: string[]) {
  const result = Bun.spawnSync(argv, { cwd: root, stdout: "pipe", stderr: "pipe", timeout: 60_000 });
  strictEqual(result.exitCode, 0, `${argv[0]} failed: ${result.stderr.toString()}`);
  return result.stdout.toString().trim();
}

interface Result {
  file: string;
  parsed: boolean;
  semantic_analysis: string;
  field_inspection: { state: string; candidates: { type: string; field: string; line: number }[] };
  unresolved: { reason: string; line: number }[];
  facts: {
    methods: { name: string; receiver: string; return_type_text: string | null; returns_field_only: boolean }[];
    aliases: { name: string; resolution: string }[];
    imports: { resolution: string }[];
    modules: { name: string; inline: boolean }[];
    calls: { method: string; receiver_resolution: string }[];
  };
}

try {
  const rustHost = /^host: (.+)$/m.exec(command(["rustc", "-vV"]))?.[1];
  ok(rustHost, "rustc must report the native host target");
  const buildStart = performance.now();
  command([
    "cargo",
    "build",
    "--locked",
    "--offline",
    "--release",
    "--manifest-path",
    manifest,
    "--target-dir",
    join(experiment, "target"),
    "--target",
    rustHost,
  ]);
  const buildMs = performance.now() - buildStart;
  const executable = `ddd-rust-syn-spike${process.platform === "win32" ? ".exe" : ""}`;
  const original = join(experiment, "target", rustHost, "release", executable);
  const relocated = join(temp, executable);
  copyFileSync(original, relocated);
  // macOS may defer a newly copied executable in dyld before main. Keep this
  // explicit preparation separate from the unchanged 10-second v1 test limit.
  const warmupStart = performance.now();
  const warmup = Bun.spawnSync([relocated, "--state-exposure-version"], {
    cwd: temp,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 180_000,
  });
  strictEqual(warmup.exitCode, 0, "relocated native executable did not become ready");
  strictEqual(JSON.parse(warmup.stdout.toString()).protocol_version, 2);
  const warmupMs = performance.now() - warmupStart;
  const emptyPath = join(temp, "empty-path");
  mkdirSync(emptyPath);
  const request = JSON.stringify({
    protocol_version: 1,
    files: cases.map((entry) => ({ path: entry.path ?? `${entry.name}.rs`, source: entry.source })),
  });
  function invoke(input: string) {
    return Bun.spawnSync([relocated], {
      cwd: temp,
      env: { PATH: emptyPath },
      stdin: new TextEncoder().encode(input),
      stdout: "pipe",
      stderr: "pipe",
      timeout: 10_000,
    });
  }
  const start = performance.now();
  const execution = invoke(request);
  const batchMs = performance.now() - start;
  strictEqual(execution.exitCode, 0, execution.stderr.toString());
  const response = JSON.parse(execution.stdout.toString()) as { protocol_version: number; files: Result[] };
  strictEqual(response.protocol_version, 1);
  strictEqual(response.files.length, cases.length);
  deepStrictEqual(invoke(request).stdout, execution.stdout, "output must be deterministic");
  const badRequests = [
    "{",
    JSON.stringify({ protocol_version: 2, files: [] }),
    JSON.stringify({ protocol_version: 1, files: [] }),
    JSON.stringify({ protocol_version: 1, files: [{ path: "x.rs" }] }),
    JSON.stringify({ protocol_version: 1, files: [{ path: "x.rs", source: "", extra: true }] }),
    " ".repeat(8 * 1024 * 1024 + 1),
  ];
  for (const input of badRequests) {
    const bad = invoke(input);
    strictEqual(bad.exitCode, 2);
    strictEqual(bad.stdout.length, 0);
    ok(bad.stderr.length > 0);
  }
  const rows = [];
  for (const [index, entry] of cases.entries()) {
    const result = response.files[index];
    const path = entry.path ?? `${entry.name}.rs`;
    strictEqual(result.file, path);
    strictEqual(result.parsed, entry.parsed ?? true, entry.name);
    strictEqual(result.semantic_analysis, "unsupported");
    const fields = result.field_inspection.candidates
      .map((field) => `${field.type}.${field.field}@${field.line}`)
      .sort();
    deepStrictEqual(fields, [...entry.fields].sort(), entry.name);
    const unresolved = [...new Set(result.unresolved.map((item) => item.reason))].sort();
    deepStrictEqual(unresolved, [...(entry.unresolved ?? [])].sort(), entry.name);
    strictEqual(result.field_inspection.state, unresolved.length ? "unresolved" : fields.length ? "violation" : "pass");
    if (entry.getters) {
      deepStrictEqual(
        result.facts.methods
          .filter((method) => method.returns_field_only)
          .map((method) => method.name)
          .sort(),
        entry.getters,
      );
    }
    for (const method of entry.methods ?? []) {
      const fact = result.facts.methods.find((candidate) => candidate.name === method.name);
      ok(fact, `${entry.name}: missing method ${method.name}`);
      strictEqual(fact.receiver, method.receiver);
      strictEqual(fact.return_type_text === null ? null : canonical(fact.return_type_text), method.returnType);
    }
    if (entry.aliases)
      deepStrictEqual(
        result.facts.aliases.map((alias) => alias.name),
        entry.aliases,
      );
    if (entry.imports !== undefined) strictEqual(result.facts.imports.length, entry.imports);
    if (entry.modules)
      deepStrictEqual(
        result.facts.modules.map((mod) => `${mod.name}:${mod.inline ? "inline" : "external"}`),
        entry.modules,
      );
    if (entry.calls)
      deepStrictEqual(
        result.facts.calls.map((call) => call.method),
        entry.calls,
      );
    for (const alias of result.facts.aliases) strictEqual(alias.resolution, "unsupported");
    for (const entry of result.facts.imports) strictEqual(entry.resolution, "unsupported");
    for (const call of result.facts.calls) strictEqual(call.receiver_resolution, "unsupported");
    const compiler = [];
    if (entry.compile !== undefined) {
      const source = join(temp, `${entry.name}.rs`);
      writeFileSync(source, entry.source);
      for (const edition of entry.editions ?? ["2021"]) {
        const checked = Bun.spawnSync(
          [
            "rustc",
            "--crate-name",
            "probe",
            "--crate-type",
            "lib",
            "--edition",
            edition,
            "--emit",
            "metadata",
            "--error-format",
            "json",
            "-A",
            "warnings",
            source,
            "-o",
            join(temp, "probe.rmeta"),
          ],
          { stdout: "pipe", stderr: "pipe", timeout: 10_000 },
        );
        strictEqual(checked.exitCode, entry.compile ? 0 : 1, `${entry.name}: ${checked.stderr.toString()}`);
        const codes = [
          ...new Set(
            checked.stderr
              .toString()
              .trim()
              .split("\n")
              .filter(Boolean)
              .map((line) => (JSON.parse(line) as { code?: { code: string } }).code?.code)
              .filter(Boolean),
          ),
        ];
        if (entry.compilerCode) ok(codes.includes(entry.compilerCode), `${entry.name}: compiler diagnostic`);
        compiler.push({ edition, success: checked.exitCode === 0, codes });
      }
    }
    rows.push({
      name: entry.name,
      parsed: result.parsed,
      state: result.field_inspection.state,
      fields,
      unresolved,
      compiler,
      signature_checks: entry.methods ?? [],
      getters: entry.getters ?? null,
    });
  }

  // Use the actual source sensor on existing golden inputs and on the same inputs with the two
  // forms rules (a) and (d) used to miss. This is not a whole-sensor parity claim. The sensor
  // counts and the spike extractor's own candidate count answer different questions and are
  // recorded apart: the gate decides (a) from the declaration's members and (d) at the call, while
  // this extractor reports only the field candidates of the one file it was handed.
  //
  // Which experiment cases are also run through the sensor is read from this table: an entry here is
  // a form whose gate answer is worth recording beside the extractor's own.
  const SENSOR_EXPECTATIONS: Record<string, { sensor_a: number; sensor_d: number; syn_fields: number }> = {
    "clean-domain": { sensor_a: 0, sensor_d: 0, syn_fields: 0 },
    "violation-a": { sensor_a: 1, sensor_d: 0, syn_fields: 1 },
    "public-tuple": { sensor_a: 1, sensor_d: 0, syn_fields: 1 },
    "restricted-tuple": { sensor_a: 1, sensor_d: 0, syn_fields: 1 },
    "explicit-return-getter": { sensor_a: 0, sensor_d: 1, syn_fields: 0 },
  };
  const clean = RUST_CASES.find((entry) => entry.name === "clean-domain");
  const violation = RUST_CASES.find((entry) => entry.name === "violation-a");
  ok(clean && violation);
  const domainPath = "packages/domain/billing-domain/src/lib.rs";
  const goldenRows = [];
  for (const entry of [
    clean,
    violation,
    ...cases
      .filter((entry) => Object.hasOwn(SENSOR_EXPECTATIONS, entry.name))
      .map((entry) => {
        // The filter admits only a name this table carries. The guard the loop below applies to every
        // entry is the one that can fail, because `clean` and `violation` reach it from RUST_CASES
        // rather than through this filter.
        const expected = SENSOR_EXPECTATIONS[entry.name];
        const rules = [...(expected.sensor_a ? ["a"] : []), ...(expected.sensor_d ? ["d"] : [])];
        return {
          ...clean,
          name: entry.name,
          workspace: { ...clean.workspace, [domainPath]: entry.source },
          expect: {
            pass: rules.length === 0,
            rules,
            files: Object.fromEntries(rules.map((rule) => [rule, domainPath])),
          },
        };
      }),
  ]) {
    const expected = SENSOR_EXPECTATIONS[entry.name];
    ok(expected, `${entry.name}: no sensor expectation recorded`);
    const baseline = runGoldenCase(join(root, "tools"), entry);
    ok(baseline.ok, `${entry.name}: ${baseline.problems.join("; ")}`);
    const source = entry.workspace?.[domainPath];
    ok(source);
    const native = invoke(JSON.stringify({ protocol_version: 1, files: [{ path: domainPath, source }] }));
    strictEqual(native.exitCode, 0);
    const nativeResult = (JSON.parse(native.stdout.toString()) as { files: Result[] }).files[0];
    const count = (rule: string) => baseline.verdict?.findings.filter((finding) => finding.rule_id === rule).length;
    strictEqual(nativeResult.field_inspection.candidates.length, expected.syn_fields, `${entry.name}: syn fields`);
    strictEqual(count("a"), expected.sensor_a, `${entry.name}: sensor rule a`);
    strictEqual(count("d"), expected.sensor_d, `${entry.name}: sensor rule d`);
    goldenRows.push({
      name: entry.name,
      sensor_a_count: count("a"),
      sensor_d_count: count("d"),
      syn_field_candidate_count: nativeResult.field_inspection.candidates.length,
    });
  }
  const nativeTimes = Array.from({ length: 10 }, () => {
    const start = performance.now();
    strictEqual(invoke(request).exitCode, 0);
    return performance.now() - start;
  }).sort((a, b) => a - b);
  const report = {
    experiment: "rust-syn",
    recorded_at: new Date().toISOString(),
    base_commit: command(["git", "rev-parse", "HEAD"]),
    versions: {
      rustc: command(["rustc", "--version"]),
      cargo: command(["cargo", "--version"]),
      bun: Bun.version,
      syn: "3.0.5",
    },
    platform: `${process.platform}-${process.arch}`,
    inputs: Object.fromEntries(
      [
        "Cargo.toml",
        "Cargo.lock",
        "src/main.rs",
        "src/analysis.rs",
        "src/domain_facts.rs",
        "src/domain_facts_tests.rs",
        "src/state_evidence.rs",
        "src/state_evidence_tests.rs",
        "cases.json",
      ].map((file) => [file, hash(join(experiment, file))]),
    ),
    verifier_sha256: hash(import.meta.path),
    native: {
      bytes: statSync(original).size,
      sha256: hash(original),
      relocated_empty_path: true,
      binary_dependencies:
        process.platform === "darwin"
          ? command(["otool", "-L", original])
              .split("\n")
              .slice(1)
              .map((line) => line.trim())
          : null,
      build_ms: Math.round(buildMs),
      relocated_warmup_ms: Math.round(warmupMs),
      first_batch_ms: Math.round(batchMs),
      warm_batch_median_ms: Math.round(nativeTimes[5]),
      timing_scope: "local warm filesystem; includes process startup and JSON; no performance comparison",
    },
    malformed_requests: badRequests.length,
    deterministic_output: true,
    cases: rows,
    actual_sensor_comparisons: goldenRows,
    // What this backend has still not been measured on. T-10-06 removed one entry and narrowed
    // another; [rust-syn spike](../docs/developers/rust-syn-spike.md) records the command and
    // output each change was read from. An entry leaves this list only on a measurement, never on
    // an argument that a measurement would probably pass.
    unverified: [
      "sensor answers for inputs the golden catalog does not carry",
      "Cargo and cross-file resolution",
      "type inference and trait solving",
      "macro expansion and cfg selection",
      "source edition selection",
      "Linux/Windows/x86_64",
      "minimum OS/Rust versions",
      "WASM distribution",
    ],
  };
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (process.argv.includes("--write"))
    writeFileSync(join(root, "docs/developers/evidence/rust-syn-spike.json"), output);
  console.log(output);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
