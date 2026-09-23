import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { classifyNativeExtractor, nativeIssue } from "../tools/ddd/lib/rust/native/launch.ts";
import { NATIVE_BIN_DIR, PLATFORM_KEY } from "../tools/ddd/lib/rust/native/manifest.ts";
import { RUST_TOOLCHAIN } from "../tools/ddd/lib/rust/state-evidence/index.ts";
import { inspectStateExposure } from "../tools/ddd/lib/state-exposure/index.ts";
import { freezeInput } from "../tools/ddd/lib/state-exposure-verification/input.ts";

/** The two protocol identities the installed extractor answers, fixed by the inspection contract. */
const ERROR_CONTRACT = { flag: "--error-contract-version", version: 3 };
const STATE_EXPOSURE = { flag: "--state-exposure-version", version: 2 };

const EXTRACTOR_NAME = "ddd-rust-syn-spike";
const HOST_KEY = `${process.platform}-${process.arch}`;
const PRODUCT_BIN_DIR = resolve(import.meta.dir, "../tools/ddd/bin");

const temporary: string[] = [];
afterEach(() => {
  for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true });
});

interface FixtureOptions {
  /** Omit the host row from the manifest, leaving this platform unrecorded. */
  readonly recorded?: false;
  /** Leave the installation directory without the extractor file. */
  readonly present?: false;
  /** Install the file without any execute bit. */
  readonly executable?: false;
  /** Record a digest the installed bytes do not produce. */
  readonly digest?: "stale";
  /** Answer the error contract probe with a protocol the adapter does not accept. */
  readonly errorContractProtocol?: number;
  /** Leave the error contract probe without an answer by exiting non-zero. */
  readonly errorContractProbe?: "fails";
}

function extractorScript(options: FixtureOptions): string {
  const answer = (version: number) => `echo '{"protocol_version":${version},"extractor":"0.0.0","syn":"3.0.5"}'`;
  const errorContract =
    options.errorContractProbe === "fails" ? "exit 1" : answer(options.errorContractProtocol ?? ERROR_CONTRACT.version);
  return [
    "#!/bin/sh",
    'case "$1" in',
    `  ${ERROR_CONTRACT.flag}) ${errorContract} ;;`,
    `  ${STATE_EXPOSURE.flag}) ${answer(STATE_EXPOSURE.version)} ;;`,
    "  *) exit 1 ;;",
    "esac",
    "",
  ].join("\n");
}

/** A private installation directory shaped like the product one, so every condition is reproducible. */
function installation(options: FixtureOptions = {}): string {
  const root = mkdtempSync(join(tmpdir(), "ddd-native-extractor-"));
  temporary.push(root);
  const body = extractorScript(options);
  const recorded = createHash("sha256")
    .update(options.digest === "stale" ? `${body}# recorded from other bytes\n` : body)
    .digest("hex");
  const rows = options.recorded === false ? {} : { [HOST_KEY]: { target: "unit-test-triple", sha256: recorded } };
  writeFileSync(join(root, "manifest.json"), `${JSON.stringify(rows, null, 2)}\n`);
  if (options.present !== false) {
    mkdirSync(join(root, HOST_KEY), { recursive: true });
    const binary = join(root, HOST_KEY, EXTRACTOR_NAME);
    writeFileSync(binary, body);
    chmodSync(binary, options.executable === false ? 0o644 : 0o755);
  }
  return root;
}

function stateExposureRequest() {
  return freezeInput({
    language: "rust",
    target: { file: "model.rs", declarationPath: ["Model"], representation: "rust-struct" },
    sources: [{ path: "model.rs", content: "struct Model;" }],
    settings: {},
    toolchain: RUST_TOOLCHAIN,
  }).request;
}

/** Every condition the order distinguishes, with the reported subject and reason code it owns. */
const FAILURES: [string, FixtureOptions, string, string][] = [
  ["unsupported-platform", { recorded: false }, "native-extractor:unsupported-platform", "tool-unavailable"],
  ["binary-missing", { present: false }, "native-extractor:binary-missing", "tool-unavailable"],
  ["binary-not-executable", { executable: false }, "native-extractor:binary-not-executable", "tool-unavailable"],
  ["checksum-mismatch", { digest: "stale" }, "native-extractor:checksum-mismatch", "tool-unavailable"],
  ["probe-failed", { errorContractProbe: "fails" }, "native-extractor:probe-failed", "execution-failed"],
  ["protocol-mismatch", { errorContractProtocol: 2 }, "native-extractor:protocol-mismatch", "unknown-version"],
];

test("a recorded, executable, unchanged extractor answering the probe is ready to launch", async () => {
  const root = installation();
  const outcome = await classifyNativeExtractor(root, HOST_KEY, ERROR_CONTRACT);
  expect(outcome.kind).toBe("ready");
  expect(outcome.binaryPath).toBe(join(root, HOST_KEY, EXTRACTOR_NAME));
});

test("one installed file answers both entry protocols, so both entries share one installation", async () => {
  const root = installation();
  const errorContract = await classifyNativeExtractor(root, HOST_KEY, ERROR_CONTRACT);
  const stateExposure = await classifyNativeExtractor(root, HOST_KEY, STATE_EXPOSURE);
  expect([errorContract.kind, stateExposure.kind]).toEqual(["ready", "ready"]);
  expect(stateExposure.binaryPath).toBe(errorContract.binaryPath);
});

test.each(FAILURES)("%s is classified on its own", async (kind, options) => {
  expect((await classifyNativeExtractor(installation(options), HOST_KEY, ERROR_CONTRACT)).kind).toBe(kind);
});

test("a platform the manifest does not record is not presented as an installed extractor", async () => {
  const outcome = await classifyNativeExtractor(installation({ recorded: false }), HOST_KEY, ERROR_CONTRACT);
  expect(outcome.kind).toBe("unsupported-platform");
  expect(outcome.binaryPath).toBeNull();
});

test.each(FAILURES)("%s reports its own subject and reason code", async (_kind, options, subject, code) => {
  const outcome = await classifyNativeExtractor(installation(options), HOST_KEY, ERROR_CONTRACT);
  const reported = nativeIssue(outcome);
  expect(reported.subject).toBe(subject);
  expect(reported.code).toBe(code);
});

test("the six conditions never share a subject", async () => {
  const subjects = await Promise.all(
    FAILURES.map(
      async ([, options]) =>
        nativeIssue(await classifyNativeExtractor(installation(options), HOST_KEY, ERROR_CONTRACT)).subject,
    ),
  );
  expect(new Set(subjects).size).toBe(FAILURES.length);
});

/** A launch blocked by more than one condition still reports exactly one, chosen by the fixed order. */
test.each([
  [
    "an unrecorded platform whose file is absent",
    { recorded: false, present: false } as FixtureOptions,
    "unsupported-platform",
  ],
  [
    "a file that is neither executable nor unchanged",
    { executable: false, digest: "stale" } as FixtureOptions,
    "binary-not-executable",
  ],
])("%s reports %s alone", async (_label, options, kind) => {
  const outcome = await classifyNativeExtractor(installation(options), HOST_KEY, ERROR_CONTRACT);
  expect(outcome.kind).toBe(kind);
  expect(nativeIssue(outcome).subject).toBe(`native-extractor:${kind}`);
});

test.each(FAILURES)("%s stops the inspection instead of passing it", async (_kind, options, subject) => {
  const outcome = await classifyNativeExtractor(installation(options), HOST_KEY, ERROR_CONTRACT);
  const inspected = inspectStateExposure(stateExposureRequest(), {
    status: "unavailable",
    reasons: [nativeIssue(outcome)],
  });
  if (inspected.kind !== "evaluated") throw new Error(JSON.stringify(inspected));
  expect(inspected.result.executionState).toBe("unavailable");
  expect(inspected.result.ruleResult).toBe("unresolved");
  expect(inspected.result.unresolvedReasons.map((reason) => reason.subject)).toEqual([subject]);
});

test("resolution, verification and launch complete without a Rust toolchain on the path", () => {
  const root = installation();
  const emptyPath = mkdtempSync(join(tmpdir(), "ddd-native-extractor-path-"));
  temporary.push(emptyPath);
  const probe = Bun.spawnSync(
    [
      process.execPath,
      resolve(import.meta.dir, "fixtures/native-extractor/probe.ts"),
      root,
      HOST_KEY,
      ERROR_CONTRACT.flag,
      String(ERROR_CONTRACT.version),
    ],
    { stdout: "pipe", stderr: "pipe", env: { ...process.env, PATH: emptyPath } },
  );
  expect(probe.exitCode, probe.stderr.toString()).toBe(0);
  expect(JSON.parse(probe.stdout.toString()).kind).toBe("ready");
});

/**
 * The two entries resolve and classify the installation separately, so the handoff from a blocked
 * launch to what an entry hands its consumers is observed per entry. The state-evidence side is
 * covered by the isolated CLI in `state-exposure-verification.test.ts`; this covers the other one.
 */
test("the error-contract entry hands its consumers one unavailable execution when the extractor is absent", () => {
  const sandbox = mkdtempSync(join(tmpdir(), "ddd-error-contract-entry-"));
  temporary.push(sandbox);
  const root = resolve(import.meta.dir, "..");
  for (const path of [
    "tools/ddd/lib/error-contract",
    "tools/ddd/lib/error-contract-verification",
    "tools/ddd/lib/project-settings",
    "tools/ddd/lib/rust/error-contract",
    "tools/ddd/lib/rust/native",
    "tools/ddd/lib/state-exposure",
    "tools/ddd/lib/state-exposure-verification",
    "tests/fixtures/error-contract/workspace",
    "tests/fixtures/native-extractor",
  ])
    cpSync(join(root, path), join(sandbox, path), { recursive: true });
  // The manifest records this platform and no binary is installed beside it, so the entry meets a
  // covered platform whose extractor is absent rather than one the distribution never covered.
  mkdirSync(join(sandbox, "tools/ddd/bin"), { recursive: true });
  cpSync(join(PRODUCT_BIN_DIR, "manifest.json"), join(sandbox, "tools/ddd/bin/manifest.json"));
  symlinkSync(join(root, "node_modules"), join(sandbox, "node_modules"));

  const triple = JSON.parse(readFileSync(join(PRODUCT_BIN_DIR, "manifest.json"), "utf8"))[HOST_KEY].target;
  const probe = Bun.spawnSync(
    [process.execPath, join(sandbox, "tests/fixtures/native-extractor/error-contract-extract.ts"), triple],
    { stdout: "pipe", stderr: "pipe" },
  );
  expect(probe.exitCode, probe.stderr.toString()).toBe(0);
  const execution = JSON.parse(probe.stdout.toString());
  expect(execution.status).toBe("unavailable");
  expect(execution.reasons.map((reason: { code: string; subject: string }) => [reason.code, reason.subject])).toEqual([
    ["tool-unavailable", "native-extractor:binary-missing"],
  ]);
});

test("the product installation sits in the distributed tools tree and answers both probes", async () => {
  expect(PLATFORM_KEY).toBe(HOST_KEY);
  expect(NATIVE_BIN_DIR).toBe(PRODUCT_BIN_DIR);
  const errorContract = await classifyNativeExtractor(NATIVE_BIN_DIR, PLATFORM_KEY, ERROR_CONTRACT);
  const stateExposure = await classifyNativeExtractor(NATIVE_BIN_DIR, PLATFORM_KEY, STATE_EXPOSURE);
  expect([errorContract.kind, stateExposure.kind]).toEqual(["ready", "ready"]);
  expect(errorContract.binaryPath).toBe(join(PRODUCT_BIN_DIR, PLATFORM_KEY, EXTRACTOR_NAME));
  expect(stateExposure.binaryPath).toBe(errorContract.binaryPath);
});
