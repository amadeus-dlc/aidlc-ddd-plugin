import { expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { FIXTURES, loadCases, type VerificationCase } from "../tools/ddd/lib/state-exposure-verification/cases.ts";
import { parseOptions } from "../tools/ddd/lib/state-exposure-verification/options.ts";
import { DEFAULT_LIMITS, issue, observeProcess } from "../tools/ddd/lib/state-exposure-verification/process.ts";
import { compareResult, exitCode, newReport } from "../tools/ddd/lib/state-exposure-verification/report.ts";
import { type RunnerDependencies, runVerification } from "../tools/ddd/lib/state-exposure-verification/run.ts";

const definitions = JSON.parse(readFileSync(resolve(FIXTURES, "cases.json"), "utf8"));
const privateCase = () => loadCases().find((c) => c.caseId === "ts-class-private") as VerificationCase;
function dependencies(entry = privateCase()): RunnerDependencies {
  return {
    load: () => [entry],
    probe: async () => [{ name: "controlled-common-result", version: "1" }],
    extract: async () => {
      if (entry.expected.kind !== "evaluated") throw new Error("fixture kind");
      return {
        execution: {
          status: "completed",
          response: {
            schemaVersion: "state-exposure/1",
            requestIdentity: entry.task.request.requestIdentity,
            evidence: entry.expected.result.checkedEvidence,
          },
        },
        stdout: "",
        diagnostic: "",
      };
    },
  };
}
test("options defaults and explicit bounds", () => {
  expect(parseOptions([])).toEqual({ ...DEFAULT_LIMITS, caseId: "all" });
  expect(parseOptions(["--case", "ts-class-private", "--timeout-ms", "500", "--max-output-bytes", "4096"])).toEqual({
    caseId: "ts-class-private",
    timeoutMs: 500,
    maxOutputBytes: 4096,
  });
});
for (const args of [
  ["--unknown", "1"],
  ["--case"],
  ["--case", "all", "--case", "all"],
  ["--timeout-ms", "0"],
  ["--timeout-ms", "-1"],
  ["--timeout-ms", "1.5"],
  ["--timeout-ms", "1e3"],
  ["--max-output-bytes", "9007199254740992"],
])
  test(`invalid args ${args.join(" ")}`, () => expect(() => parseOptions(args)).toThrow());
test("case validation rejects empty, duplicate, invalid expectation before execution", async () => {
  expect(() => loadCases([])).toThrow();
  expect(() => loadCases([definitions[0], definitions[0]])).toThrow();
  const malformed = structuredClone(definitions[0]);
  delete malformed.expected.result.checkedEvidence;
  expect(() => loadCases([malformed])).toThrow();
  let calls = 0;
  const deps = dependencies();
  deps.load = () => loadCases([]);
  deps.probe = async () => {
    calls++;
    return [];
  };
  const report = await runVerification([], deps);
  expect(exitCode(report)).toBe(2);
  expect(calls).toBe(0);
});
test("full outcome comparison and JSON preserve pass evidence", () => {
  const entry = privateCase();
  const actual = structuredClone(entry.expected);
  expect(compareResult(entry.caseId, entry.expected, actual).status).toBe("passed");
  const report = newReport([]);
  report.cases.push(compareResult(entry.caseId, entry.expected, actual));
  expect(JSON.parse(JSON.stringify(report)).cases[0].actual).toEqual(actual);
  if (actual.kind !== "evaluated" || actual.result.checkedEvidence?.targetStatus !== "resolved")
    throw new Error("fixture");
  const changed = {
    ...actual,
    result: {
      ...actual.result,
      checkedEvidence: {
        ...actual.result.checkedEvidence,
        targetEvidence: [{ file: "model.ts", line: 1, byteStart: 1, byteEnd: 27 }],
      },
    },
  };
  expect(compareResult(entry.caseId, entry.expected, changed).differences).toEqual(["result.checkedEvidence"]);
});
test("a different unresolved reason is a mismatch", () => {
  const entry = loadCases().find((c) => c.caseId === "rust-target-missing");
  if (entry?.expected.kind !== "evaluated") throw new Error("fixture");
  const changed = {
    ...entry.expected,
    result: { ...entry.expected.result, unresolvedReasons: [issue("timeout", "extractor")] },
  };
  expect(compareResult(entry.caseId, entry.expected, changed).status).toBe("mismatch");
});
test("controlled common result verifies reporting independently of language extraction", async () => {
  const report = await runVerification([], dependencies());
  expect(exitCode(report)).toBe(0);
  expect(report.cases[0].status).toBe("passed");
  expect(report.cases[0].actual).toEqual(privateCase().expected);
});
test("actual preparation failure never counts as intentional failure", async () => {
  const entry = loadCases().find((c) => c.caseId === "execution-unavailable");
  if (!entry) throw new Error("fixture");
  const deps = dependencies(entry);
  deps.probe = async () => {
    throw new Error("missing real tool");
  };
  const report = await runVerification([], deps);
  expect(exitCode(report)).toBe(3);
  expect(report.cases[0].actual).toBeNull();
  expect(report.cases[0].status).toBe("not-run");
  expect(report.toolchain).toEqual([]);
});
test("unexpected execution exception is not a fabricated C1 outcome", async () => {
  const deps = dependencies();
  deps.extract = async () => {
    throw new Error("implementation failure");
  };
  const report = await runVerification([], deps);
  expect(exitCode(report)).toBe(3);
  expect(report.cases[0].actual).toBeNull();
});
test("unexpected source process failure is execution error", async () => {
  const deps = dependencies();
  deps.extract = async () => ({
    execution: { status: "failed", reasons: [issue("timeout", "extractor")] },
    stdout: "",
    diagnostic: "",
  });
  const report = await runVerification([], deps);
  expect(exitCode(report)).toBe(3);
  expect(report.cases[0].status).toBe("not-run");
});
test("unknown case and empty case collection are usage errors", async () => {
  expect(exitCode(await runVerification(["--case", "unknown"], dependencies()))).toBe(2);
  const deps = dependencies();
  deps.load = () => [];
  expect(exitCode(await runVerification([], deps))).toBe(2);
});
for (const [mode, code] of [
  ["failed", "execution-failed"],
  ["timeout", "timeout"],
  ["overflow", "output-limit"],
  ["resource", "resource-limit"],
] as const)
  test(`real controlled process ${mode}`, async () => {
    const observed = await observeProcess([process.execPath, resolve(FIXTURES, "child.ts"), mode], "", {
      timeoutMs: 100,
      maxOutputBytes: 1024,
    });
    expect(observed.execution.status).toBe("failed");
    if (observed.execution.status !== "completed") expect(observed.execution.reasons[0].code).toBe(code);
  });
test("startup failure is unavailable, not failed", async () => {
  const observed = await observeProcess([resolve(FIXTURES, "missing")], "", DEFAULT_LIMITS);
  expect(observed.execution.status).toBe("unavailable");
});
test("safe integer deadlines beyond timer range do not overflow", async () => {
  const result = await observeProcess([process.execPath, "-e", "setTimeout(() => console.log('{}'), 25)"], "", {
    timeoutMs: 2_147_483_648,
    maxOutputBytes: 1024,
  });
  expect(result.execution.status).toBe("completed");
});

async function cli(args: string[], cwd = resolve(import.meta.dir, "..")) {
  const child = Bun.spawn([process.execPath, "scripts/verify-state-exposure.ts", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { code, report: JSON.parse(stdout), stdout, stderr };
}
test("real C2 all executes both languages and intentional failures, then reproduces all outcomes", async () => {
  const first = await cli(["--case", "all"]);
  const second = await cli(["--case", "all"]);
  expect(first.code).toBe(0);
  expect(second.code).toBe(0);
  expect(first.report.cases).toHaveLength(23);
  expect(first.stdout.trim().split("\n")).toHaveLength(1);
  expect(first.report.cases).toEqual(second.report.cases);
  expect(first.report.runId).not.toBe(second.report.runId);
  expect(first.report.cases.every((c: { status: string }) => c.status === "passed")).toBe(true);
  for (const id of ["execution-empty", "execution-whitespace", "execution-invalid", "execution-multiple"]) {
    const entry = first.report.cases.find((c: { caseId: string }) => c.caseId === id);
    expect(entry.actual.result.executionState).toBe("completed");
    expect(entry.actual.result.ruleResult).toBe("unresolved");
  }
}, 90_000);
for (const args of [
  ["--case", "missing"],
  ["--case", "all", "--case", "all"],
  ["--timeout-ms", "0"],
])
  test(`CLI exit2 ${args.join(" ")}`, async () => {
    const result = await cli(args);
    expect(result.code).toBe(2);
    expect(result.report.status).toBe("usage-error");
    expect(result.stdout.trim().split("\n")).toHaveLength(1);
  });
test("CLI exit3 on actual deadline exhaustion", async () => {
  const result = await cli(["--case", "ts-class-private", "--timeout-ms", "1"]);
  expect(result.code).toBe(3);
  expect(result.report.cases[0].status).toBe("not-run");
});
function isolatedCli() {
  const root = resolve(import.meta.dir, "..");
  const sandbox = mkdtempSync(resolve(tmpdir(), "ddd-state-verification-"));
  for (const path of [
    "tools/ddd/lib/state-exposure",
    "tools/ddd/lib/state-exposure-verification",
    "tools/ddd/lib/rust/state-evidence",
    "tools/ddd/lib/typescript/state-evidence",
    "tests/fixtures/state-exposure-languages",
  ])
    cpSync(resolve(root, path), resolve(sandbox, path), { recursive: true });
  mkdirSync(resolve(sandbox, "scripts"));
  cpSync(resolve(root, "scripts/verify-state-exposure.ts"), resolve(sandbox, "scripts/verify-state-exposure.ts"));
  symlinkSync(resolve(root, "node_modules"), resolve(sandbox, "node_modules"));
  return sandbox;
}
test("CLI exit1 preserves an independently introduced evidence-only mismatch", async () => {
  const sandbox = isolatedCli();
  try {
    const path = resolve(sandbox, "tests/fixtures/state-exposure-languages/cases.json");
    const definitions = JSON.parse(readFileSync(path, "utf8"));
    const selected = definitions.find((c: { caseId: string }) => c.caseId === "ts-class-private");
    selected.expected.result.checkedEvidence.targetEvidence[0].byteStart++;
    writeFileSync(path, JSON.stringify(definitions));
    const result = await cli(["--case", "ts-class-private"], sandbox);
    expect(result.code).toBe(1);
    expect(result.report.cases[0].differences).toEqual(["result.checkedEvidence"]);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});
test("CLI exit3 on missing real binary and no fabricated tool version", async () => {
  const sandbox = isolatedCli();
  try {
    const result = await cli(["--case", "rust-named-private"], sandbox);
    expect(result.code).toBe(3);
    expect(result.report.cases[0].actual).toBeNull();
    expect(result.report.toolchain).toEqual([]);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});
test("CLI distinguishes an unstarted controlled failure from the intended failure branch", async () => {
  const sandbox = isolatedCli();
  try {
    const binary = "experiments/rust-syn/target/state-exposure/ddd-rust-syn-spike";
    mkdirSync(resolve(sandbox, "experiments/rust-syn/target/state-exposure"), { recursive: true });
    symlinkSync(resolve(import.meta.dir, "..", binary), resolve(sandbox, binary));
    writeFileSync(
      resolve(sandbox, "tests/fixtures/state-exposure-languages/child.ts"),
      "throw new Error('before scenario');",
    );
    const result = await cli(["--case", "execution-failed"], sandbox);
    expect(result.code).toBe(3);
    expect(result.report.cases[0].status).toBe("not-run");
    expect(result.report.cases[0].differences).toContain("controlled scenario did not start");
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});
test("CLI usage errors precede loading a missing compiler dependency", async () => {
  const sandbox = isolatedCli();
  try {
    rmSync(resolve(sandbox, "node_modules"));
    const usage = await cli(["--timeout-ms", "0"], sandbox);
    expect(usage.code).toBe(2);
    const unavailable = await cli(["--case", "ts-class-private"], sandbox);
    expect(unavailable.code).toBe(3);
    expect(unavailable.report.toolchain).toEqual([]);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});
