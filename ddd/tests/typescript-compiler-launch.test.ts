/**
 * The launch of the distributed TypeScript Compiler API (T-11-01): which conditions keep the fact
 * extraction from starting, how each is reported, and that every one of them stops a sensor as an
 * uninspectable run instead of passing it.
 *
 * Each condition is reproduced in a private vendor directory or a private project, so the product
 * installation is read only by the cases that need a compiler which actually loads.
 */

import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runSensor, type SensorIO } from "../tools/ddd/lib/runtime/runtime.ts";
import {
  classifyTypeScriptExtractor,
  TYPESCRIPT_VENDOR_DIR,
  type TypeScriptExtractorFailureKind,
  type TypeScriptExtractorIssue,
  typeScriptExtractorIssue,
} from "../tools/ddd/lib/typescript/compiler/launch.ts";
import { SUPPORTED_COMPILER_API_VERSION } from "../tools/ddd/lib/typescript/compiler/settings.ts";
import { requireTypeScriptFacts } from "../tools/ddd/lib/typescript/domain-facts/index.ts";
import { SUPPORTED_COMPILER_OPTIONS, writeTypeScriptProject } from "./fixtures/typescript-facts/project.ts";

const PRODUCT_VENDOR_DIR = resolve(import.meta.dir, "../tools/ddd/lib/typescript/vendor");
const COMPILER_NAME = "typescript.js";
const MANIFEST_NAME = "manifest.json";
/** A prepared project whose packages state exactly the supported compiler settings. */
const SUPPORTED_WORKSPACE = resolve(import.meta.dir, "fixtures/operation-error-set/typescript-class-workspace");
/** Loading the multi-megabyte compiler is real work, bounded so a hung load still fails. */
const LAUNCH_TIMEOUT_MS = 30_000;

const temporary: string[] = [];
afterEach(() => {
  for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true });
});
function temporaryDir(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  temporary.push(root);
  return root;
}

const sha256 = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");

/** A compiler module that evaluates and reports `version`, and nothing else. */
const reporting = (version: string) => `module.exports = { version: ${JSON.stringify(version)} };\n`;
/** A compiler module whose evaluation throws. */
const THROWING = 'throw new Error("the vendored compiler failed to evaluate");\n';
/** A compiler module that leaves `marker` behind when it is evaluated at all. */
const marking = (marker: string) =>
  `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "evaluated");\n${reporting(SUPPORTED_COMPILER_API_VERSION)}`;

interface VendorOptions {
  readonly body: string;
  /** Leave the manifest out, or write one that is not a digest record. */
  readonly manifest?: "absent" | "invalid";
  /** Leave the compiler file out while the manifest still records it. */
  readonly compiler?: "absent";
  /** Record a digest the vendored bytes do not produce. */
  readonly digest?: "stale";
}

/**
 * A private vendor directory shaped like the product one. The manifest records the sha256 of the
 * compiler file under the file's own name, as the preparation script writes it.
 */
function vendor(options: VendorOptions): string {
  const root = temporaryDir("ddd-typescript-vendor-");
  const recorded = sha256(options.digest === "stale" ? `${options.body}// recorded from other bytes\n` : options.body);
  if (options.manifest === "invalid") writeFileSync(join(root, MANIFEST_NAME), "not a digest record\n");
  else if (options.manifest !== "absent")
    writeFileSync(join(root, MANIFEST_NAME), `${JSON.stringify({ [COMPILER_NAME]: { sha256: recorded } }, null, 2)}\n`);
  if (options.compiler !== "absent") writeFileSync(join(root, COMPILER_NAME), options.body);
  return root;
}

/** A project one of whose packages states `module: commonjs`, outside the supported range. */
function commonJsProject(): string {
  return writeTypeScriptProject(temporaryDir("ddd-typescript-project-"), [
    { name: "billing-domain", compilerOptions: { ...SUPPORTED_COMPILER_OPTIONS, module: "commonjs" } },
  ]);
}

type Classified = Awaited<ReturnType<typeof classifyTypeScriptExtractor>>;

interface FailureCase {
  readonly label: string;
  readonly kind: TypeScriptExtractorFailureKind;
  readonly code: TypeScriptExtractorIssue["code"];
  readonly classify: () => Classified | Promise<Classified>;
}

/** Every condition the order distinguishes, with the reported subject kind and reason code it owns. */
const FAILURES: FailureCase[] = [
  {
    label: "a vendor directory without a manifest",
    kind: "compiler-missing",
    code: "tool-unavailable",
    classify: () =>
      classifyTypeScriptExtractor(
        SUPPORTED_WORKSPACE,
        vendor({ body: reporting(SUPPORTED_COMPILER_API_VERSION), manifest: "absent" }),
      ),
  },
  {
    label: "a manifest that is not a digest record",
    kind: "compiler-missing",
    code: "tool-unavailable",
    classify: () =>
      classifyTypeScriptExtractor(
        SUPPORTED_WORKSPACE,
        vendor({ body: reporting(SUPPORTED_COMPILER_API_VERSION), manifest: "invalid" }),
      ),
  },
  {
    label: "a manifest whose compiler file is absent",
    kind: "compiler-missing",
    code: "tool-unavailable",
    classify: () =>
      classifyTypeScriptExtractor(
        SUPPORTED_WORKSPACE,
        vendor({ body: reporting(SUPPORTED_COMPILER_API_VERSION), compiler: "absent" }),
      ),
  },
  {
    label: "compiler bytes the manifest does not record",
    kind: "checksum-mismatch",
    code: "tool-unavailable",
    classify: () =>
      classifyTypeScriptExtractor(
        SUPPORTED_WORKSPACE,
        vendor({ body: reporting(SUPPORTED_COMPILER_API_VERSION), digest: "stale" }),
      ),
  },
  {
    label: "a recorded compiler whose evaluation throws",
    kind: "load-failed",
    code: "tool-unavailable",
    classify: () => classifyTypeScriptExtractor(SUPPORTED_WORKSPACE, vendor({ body: THROWING })),
  },
  {
    label: "a recorded compiler of another version",
    kind: "version-mismatch",
    code: "unknown-version",
    classify: () => classifyTypeScriptExtractor(SUPPORTED_WORKSPACE, vendor({ body: reporting("5.9.3") })),
  },
  {
    label: "a project whose package states module commonjs",
    kind: "project-condition-mismatch",
    code: "unsupported-syntax",
    classify: () => classifyTypeScriptExtractor(commonJsProject()),
  },
  {
    label: "a project whose packages state different resolution conditions",
    kind: "project-condition-mismatch",
    code: "unsupported-syntax",
    classify: () =>
      classifyTypeScriptExtractor(
        writeTypeScriptProject(temporaryDir("ddd-typescript-project-"), [
          { name: "billing-domain", compilerOptions: { ...SUPPORTED_COMPILER_OPTIONS, customConditions: ["billing"] } },
          { name: "billing-ledger", compilerOptions: { ...SUPPORTED_COMPILER_OPTIONS, customConditions: ["ledger"] } },
        ]),
      ),
  },
  {
    label: "a project whose root references a package config that is not its tsconfig.json",
    kind: "project-condition-mismatch",
    code: "unsupported-syntax",
    classify: () => {
      const root = writeTypeScriptProject(temporaryDir("ddd-typescript-project-"));
      writeFileSync(
        join(root, "billing-domain/tsconfig.build.json"),
        readFileSync(join(root, "billing-domain/tsconfig.json")),
      );
      writeFileSync(
        join(root, "tsconfig.json"),
        `${JSON.stringify({ files: [], references: [{ path: "./billing-domain/tsconfig.build.json" }] })}\n`,
      );
      return classifyTypeScriptExtractor(root);
    },
  },
  {
    label: "a project root without a tsconfig.json",
    kind: "project-condition-mismatch",
    code: "tool-unavailable",
    classify: () => classifyTypeScriptExtractor(temporaryDir("ddd-typescript-project-")),
  },
];

test(
  "the distributed compiler is ready for a project inside the supported range",
  async () => {
    expect((await classifyTypeScriptExtractor(SUPPORTED_WORKSPACE)).kind).toBe("ready");
    const written = writeTypeScriptProject(temporaryDir("ddd-typescript-project-"));
    expect((await classifyTypeScriptExtractor(written, TYPESCRIPT_VENDOR_DIR)).kind).toBe("ready");
    // A reference may name the package's tsconfig.json itself rather than its directory.
    const byFile = writeTypeScriptProject(temporaryDir("ddd-typescript-project-"));
    writeFileSync(
      join(byFile, "tsconfig.json"),
      `${JSON.stringify({ files: [], references: [{ path: "./billing-domain/tsconfig.json" }] })}\n`,
    );
    expect((await classifyTypeScriptExtractor(byFile, TYPESCRIPT_VENDOR_DIR)).kind).toBe("ready");
  },
  LAUNCH_TIMEOUT_MS,
);

test.each(FAILURES.map((entry) => [entry.label, entry] as const))(
  "%s is classified on its own with its own subject and reason code",
  async (_label, entry) => {
    const outcome = await entry.classify();
    expect(outcome.kind).toBe(entry.kind);
    if (outcome.kind === "ready") throw new Error("a blocked launch was classified as ready");
    expect(typeScriptExtractorIssue(outcome)).toEqual({
      code: entry.code,
      subject: `typescript-extractor:${entry.kind}`,
      message: outcome.detail,
      location: null,
    });
    expect(outcome.detail.length).toBeGreaterThan(0);
  },
  LAUNCH_TIMEOUT_MS,
);

test(
  "the five conditions never share a subject",
  async () => {
    const subjects = new Set<string>();
    for (const entry of FAILURES) subjects.add(typeScriptExtractorIssue(await entry.classify()).subject);
    expect([...subjects].sort()).toEqual([
      "typescript-extractor:checksum-mismatch",
      "typescript-extractor:compiler-missing",
      "typescript-extractor:load-failed",
      "typescript-extractor:project-condition-mismatch",
      "typescript-extractor:version-mismatch",
    ]);
  },
  LAUNCH_TIMEOUT_MS,
);

test(
  "a ready launch has no issue to report",
  async () => {
    const outcome = await classifyTypeScriptExtractor(SUPPORTED_WORKSPACE);
    expect(() => typeScriptExtractorIssue(outcome)).toThrow();
  },
  LAUNCH_TIMEOUT_MS,
);

/** A launch blocked by more than one condition still reports exactly one, chosen by the fixed order. */
test("an unrecorded compiler outside a project is reported as missing alone", async () => {
  const outcome = await classifyTypeScriptExtractor(
    temporaryDir("ddd-typescript-project-"),
    vendor({ body: THROWING, manifest: "absent" }),
  );
  expect(typeScriptExtractorIssue(outcome).subject).toBe("typescript-extractor:compiler-missing");
});

test("changed compiler bytes are reported as a checksum mismatch without being evaluated", async () => {
  const marker = join(temporaryDir("ddd-typescript-marker-"), "evaluated");
  const outcome = await classifyTypeScriptExtractor(
    SUPPORTED_WORKSPACE,
    vendor({ body: `${marking(marker)}${THROWING}`, digest: "stale" }),
  );
  expect(typeScriptExtractorIssue(outcome).subject).toBe("typescript-extractor:checksum-mismatch");
  expect(existsSync(marker)).toBe(false);
});

test("a compiler that fails to load for an unsupported project is reported as a load failure alone", async () => {
  const outcome = await classifyTypeScriptExtractor(commonJsProject(), vendor({ body: THROWING }));
  expect(typeScriptExtractorIssue(outcome).subject).toBe("typescript-extractor:load-failed");
});

test("a compiler of another version for an unsupported project is reported as a version mismatch alone", async () => {
  const outcome = await classifyTypeScriptExtractor(commonJsProject(), vendor({ body: reporting("5.9.3") }));
  expect(typeScriptExtractorIssue(outcome)).toMatchObject({
    code: "unknown-version",
    subject: "typescript-extractor:version-mismatch",
  });
});

function sensorWorkspace(): string {
  const root = temporaryDir("ddd-typescript-sensor-");
  const record = join(root, "aidlc", "spaces", "default", "intents", "i1");
  const output = join(record, "construction", "u1", "artifact.md");
  mkdirSync(join(record, "construction", "u1"), { recursive: true });
  writeFileSync(join(record, "aidlc-state.md"), "## Stage Progress\n- [x] code-generation — EXECUTE\n");
  writeFileSync(output, "body\n");
  return output;
}

function capture(): { io: SensorIO; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { stdout: (text) => out.push(text), stderr: (text) => err.push(text) }, out, err };
}

const SOURCES = [{ file: "src/invoice.ts", source: "export const invoice = new Invoice();\n" }];

test.each(FAILURES.map((entry) => [entry.label, entry] as const))(
  "%s stops the sensor as uninspectable instead of passing it",
  async (_label, entry) => {
    const outcome = await entry.classify();
    const { io, out, err } = capture();
    const code = runSensor(
      {
        sensor_id: "typescript-demo",
        severity: "blocking",
        evaluate: () => {
          const facts = requireTypeScriptFacts(outcome, SOURCES);
          return { findings: [], note: `read ${facts.files.size} file` };
        },
      },
      ["--stage", "code-generation", "--output-path", sensorWorkspace()],
      io,
    );
    expect(code).toBe(127);
    expect(out).toEqual([]);
    expect(err.join("")).toContain(`tool unavailable: ${typeScriptExtractorIssue(outcome).message}`);
  },
  LAUNCH_TIMEOUT_MS,
);

test(
  "a ready launch lets the sensor decide on the facts it read",
  async () => {
    const outcome = await classifyTypeScriptExtractor(SUPPORTED_WORKSPACE);
    const { io, out } = capture();
    const code = runSensor(
      {
        sensor_id: "typescript-demo",
        severity: "blocking",
        evaluate: () => {
          const facts = requireTypeScriptFacts(outcome, SOURCES);
          return { findings: [], note: `read ${facts.files.size} file` };
        },
      },
      ["--stage", "code-generation", "--output-path", sensorWorkspace()],
      io,
    );
    expect(code).toBe(0);
    const verdict = JSON.parse(out.join("").trim());
    expect(verdict.pass).toBe(true);
    expect(verdict.note).toBe("read 1 file");
  },
  LAUNCH_TIMEOUT_MS,
);

test("a ready outcome this launch did not classify yields no facts, not even for no sources", () => {
  const forged = { kind: "ready" } as const;
  expect(() => requireTypeScriptFacts(forged, [])).toThrow();
  expect(() => requireTypeScriptFacts(forged, SOURCES)).toThrow();
});

test("the distributed compiler sits in the tools tree beside the extractor that loads it", () => {
  expect(TYPESCRIPT_VENDOR_DIR).toBe(PRODUCT_VENDOR_DIR);
});

test("the supported Compiler API version is the one the development dependency pins", () => {
  const manifest = JSON.parse(readFileSync(resolve(import.meta.dir, "../package.json"), "utf8"));
  expect(manifest.devDependencies.typescript).toBe(SUPPORTED_COMPILER_API_VERSION);
});

test("the distributed compiler is the development dependency's compiler, recorded by its digest", () => {
  const distributed = readFileSync(join(PRODUCT_VENDOR_DIR, COMPILER_NAME));
  const dependency = readFileSync(resolve(import.meta.dir, "../node_modules/typescript/lib/typescript.js"));
  expect(sha256(distributed)).toBe(sha256(dependency));
  const recorded = JSON.parse(readFileSync(join(PRODUCT_VENDOR_DIR, MANIFEST_NAME), "utf8"));
  expect(recorded[COMPILER_NAME].sha256).toBe(sha256(distributed));
});
