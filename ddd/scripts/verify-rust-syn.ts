/** Opt-in experiment; does not replace or install production sensors. */
import { deepStrictEqual, ok, strictEqual } from "node:assert";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import cases from "../experiments/rust-syn/cases.json";
import { runGoldenCase } from "../tests/golden/runner.ts";
import { RUST_CASES } from "../tests/golden/rust/cases.ts";
import { impls, initAnalyzer, parse, structs } from "../tools/ddd/lib/rust/analyzer.ts";

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
  const buildStart = performance.now();
  command([
    "cargo",
    "build",
    "--locked",
    "--release",
    "--manifest-path",
    manifest,
    "--target-dir",
    join(experiment, "target"),
  ]);
  const buildMs = performance.now() - buildStart;
  const executable = `ddd-rust-syn-spike${process.platform === "win32" ? ".exe" : ""}`;
  const original = join(experiment, "target/release", executable);
  const relocated = join(temp, executable);
  copyFileSync(original, relocated);
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
  const runtime = await initAnalyzer();
  strictEqual(runtime.state, "ready");
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
    const tree = parse(runtime, path, new TextEncoder().encode(entry.source));
    const legacyFields = structs(tree)
      .filter((type) => type.kind === "struct")
      .flatMap((type) =>
        type.fields
          .filter((field) => field.visibility !== "private")
          .map((field) => `${canonical(type.name)}.${canonical(field.name)}@${field.span.start_line}`),
      )
      .sort();
    if (entry.compare !== false)
      deepStrictEqual(legacyFields, [...(entry.legacyFields ?? entry.fields)].sort(), `${entry.name}: legacy`);
    if (entry.getters) {
      deepStrictEqual(
        result.facts.methods
          .filter((method) => method.returns_field_only)
          .map((method) => method.name)
          .sort(),
        entry.getters,
      );
      const legacyGetters = impls(tree)
        .flatMap((block) =>
          block.methods.filter((method) => method.body_shape === "returns-field-only").map((method) => method.name),
        )
        .sort();
      deepStrictEqual(legacyGetters, entry.legacyGetters ?? entry.getters);
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
      legacy_fields: entry.compare === false ? null : legacyFields,
      unresolved,
      compiler,
      signature_checks: entry.methods ?? [],
      getter_comparison: entry.getters ? { syn: entry.getters, legacy: entry.legacyGetters ?? entry.getters } : null,
    });
  }

  // Use the actual source sensor on existing golden inputs and on the same
  // inputs with tuple fields. This is not a whole-sensor parity claim.
  const clean = RUST_CASES.find((entry) => entry.name === "clean-domain");
  const violation = RUST_CASES.find((entry) => entry.name === "violation-a");
  ok(clean && violation);
  const domainPath = "packages/domain/billing-domain/src/lib.rs";
  const goldenRows = [];
  for (const entry of [
    clean,
    violation,
    ...cases
      .filter((entry) => entry.legacyFields)
      .map((entry) => ({
        ...clean,
        name: entry.name,
        workspace: { ...clean.workspace, [domainPath]: entry.source },
      })),
  ]) {
    const baseline = runGoldenCase(join(root, "tools"), entry);
    ok(baseline.ok, `${entry.name}: ${baseline.problems.join("; ")}`);
    const source = entry.workspace?.[domainPath];
    ok(source);
    const native = invoke(JSON.stringify({ protocol_version: 1, files: [{ path: domainPath, source }] }));
    strictEqual(native.exitCode, 0);
    const nativeResult = (JSON.parse(native.stdout.toString()) as { files: Result[] }).files[0];
    const existingCount = baseline.verdict?.findings.filter((finding) => finding.rule_id === "a").length;
    const nativeCount = nativeResult.field_inspection.candidates.length;
    strictEqual(nativeCount, entry === clean ? 0 : 1);
    strictEqual(existingCount, entry === violation ? 1 : 0);
    goldenRows.push({ name: entry.name, existing_a_count: existingCount, syn_a_count: nativeCount });
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
      ["Cargo.toml", "Cargo.lock", "src/main.rs", "src/analysis.rs", "cases.json"].map((file) => [
        file,
        hash(join(experiment, file)),
      ]),
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
      first_batch_ms: Math.round(batchMs),
      warm_batch_median_ms: Math.round(nativeTimes[5]),
      timing_scope: "local warm filesystem; includes process startup and JSON; no performance comparison",
    },
    malformed_requests: badRequests.length,
    deterministic_output: true,
    cases: rows,
    actual_sensor_comparisons: goldenRows,
    unverified: [
      "full sensor parity",
      "Cargo and cross-file resolution",
      "type inference and trait solving",
      "macro expansion and cfg selection",
      "source edition selection",
      "Linux/Windows/x86_64",
      "minimum OS/Rust versions",
      "WASM distribution",
      "plugin installation and gate integration",
    ],
  };
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (process.argv.includes("--write"))
    writeFileSync(join(root, "docs/developers/evidence/rust-syn-spike.json"), output);
  console.log(output);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
