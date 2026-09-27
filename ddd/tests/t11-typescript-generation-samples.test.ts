/**
 * The TypeScript code the code-generation instructions teach passes the TypeScript gates (T-11-05).
 *
 * One sample per code representation (`class`, `companion`) and module layout (`named-file`,
 * `index-file`) is written into a fresh project and run through the real entries, as the framework
 * and a CI step run them: the domain gate (T-11-02), the use-case and interface-adapter gates
 * (T-11-03), and the module layout gate and its CI entry (T-11-04). Each sample also has to compile,
 * since it stands for generated code.
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import ts from "typescript";
import {
  type GenerationSample,
  generationSamples,
  otherParentModuleFile,
  parentModuleFile,
} from "./fixtures/typescript-generation/samples.ts";
import { type GoldenCase, materializeCase, runGoldenCase } from "./golden/runner.ts";

const TOOLS = join(import.meta.dir, "../tools");
const CI_ENTRY = join(TOOLS, "ddd-check-typescript-module-layout.ts");

/** Every gate run loads the distributed multi-megabyte compiler in a process of its own. */
const GATE_RUN_TIMEOUT_MS = 30_000;

/** Writes the sample's project alone into a fresh directory; the caller removes it. */
function writeProject(sample: GenerationSample): string {
  const root = mkdtempSync(join(tmpdir(), "ddd-generation-sample-"));
  for (const [path, content] of Object.entries(sample.workspace)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

function parsedConfig(path: string): ts.ParsedCommandLine {
  return ts.parseJsonConfigFileContent(
    ts.readConfigFile(path, ts.sys.readFile).config,
    ts.sys,
    dirname(path),
    undefined,
    path,
  );
}

/**
 * Type checks every package the root `tsconfig.json` references. The package names are mapped to
 * the entries their `package.json` exports only in the program, standing in for the links a package
 * manager installs: written into the sample's own settings, such a mapping would be an alias the
 * domain gate reports.
 */
function typeCheck(root: string): string[] {
  const rootConfig = join(root, "tsconfig.json");
  const references = parsedConfig(rootConfig).projectReferences;
  if (references === undefined || references.length === 0)
    throw new Error(`${rootConfig} references no package, so there is nothing to type check`);
  const paths: Record<string, string[]> = {};
  for (const reference of references) {
    const manifest = JSON.parse(readFileSync(join(reference.path, "package.json"), "utf8")) as {
      name: string;
      exports: Record<string, string>;
    };
    for (const [subpath, target] of Object.entries(manifest.exports))
      paths[subpath === "." ? manifest.name : `${manifest.name}/${subpath.slice(2)}`] = [join(reference.path, target)];
  }
  const diagnostics: string[] = [];
  for (const reference of references) {
    const configuration = parsedConfig(join(reference.path, "tsconfig.json"));
    const program = ts.createProgram(configuration.fileNames, { ...configuration.options, paths });
    for (const diagnostic of [...configuration.errors, ...ts.getPreEmitDiagnostics(program)])
      diagnostics.push(
        `${diagnostic.file?.fileName ?? reference.path}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`,
      );
  }
  return diagnostics;
}

/**
 * Runs a gate that decides the sources of some layers and requires it to pass with no finding. Such
 * a gate also passes with no finding when it inspects nothing — no claimed TypeScript source in a
 * package of its layers — so the sample has to be inspected, not skipped.
 */
function expectInspectedPass(gateCase: GoldenCase): void {
  const result = runGoldenCase(TOOLS, gateCase);
  expect(result.problems).toEqual([]);
  expect(result.verdict?.findings).toEqual([]);
  expect(result.verdict?.note ?? "").not.toContain("no typescript sources claimed");
}

for (const sample of generationSamples()) {
  describe(`generation sample: ${sample.representation} / ${sample.layout}`, () => {
    test(
      "passes the TypeScript domain gate with no finding",
      () => expectInspectedPass(sample.domainCase),
      GATE_RUN_TIMEOUT_MS,
    );

    test(
      "passes the TypeScript use-case gate with no finding",
      () => expectInspectedPass(sample.useCaseCase),
      GATE_RUN_TIMEOUT_MS,
    );

    test(
      "passes the TypeScript interface-adapter gate with no finding",
      () => expectInspectedPass(sample.interfaceAdapterCase),
      GATE_RUN_TIMEOUT_MS,
    );

    test(
      "passes the TypeScript module layout gate with no finding",
      () => {
        const result = runGoldenCase(TOOLS, sample.layoutCase);
        expect(result.problems).toEqual([]);
        expect(result.verdict?.findings).toEqual([]);
      },
      GATE_RUN_TIMEOUT_MS,
    );

    test("the module layout CI entry exits 0", () => {
      const { root } = materializeCase(sample.layoutCase);
      try {
        const proc = Bun.spawnSync([process.execPath, CI_ENTRY, "--project", root], { stdout: "pipe", stderr: "pipe" });
        expect(proc.exitCode, `${proc.stdout.toString()}${proc.stderr.toString()}`).toBe(0);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    test(
      "type checks with no diagnostic",
      () => {
        const root = writeProject(sample);
        try {
          expect(typeCheck(root)).toEqual([]);
        } finally {
          rmSync(root, { recursive: true, force: true });
        }
      },
      GATE_RUN_TIMEOUT_MS,
    );

    test("places the parent module as its layout requires and declares both settings", () => {
      expect(Object.hasOwn(sample.workspace, parentModuleFile(sample.layout))).toBe(true);
      expect(Object.hasOwn(sample.workspace, otherParentModuleFile(sample.layout))).toBe(false);
      const source = sample.workspace[".ddd.toml"];
      if (source === undefined)
        throw new Error(`the ${sample.representation}/${sample.layout} sample has no .ddd.toml`);
      const settings = Bun.TOML.parse(source) as {
        typescript?: { module_layout?: string; code_representation?: string };
      };
      expect(settings.typescript).toEqual({
        module_layout: sample.layout,
        code_representation: sample.representation,
      });
    });
  });
}

test("the samples cover both code representations under both module layouts", () => {
  const combinations = generationSamples().map((sample) => `${sample.representation}/${sample.layout}`);
  expect(combinations.sort()).toEqual([
    "class/index-file",
    "class/named-file",
    "companion/index-file",
    "companion/named-file",
  ]);
});
