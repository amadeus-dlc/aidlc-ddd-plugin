import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import type { TypeScriptCondition, TypeScriptPackage } from "../tools/ddd/lib/error-contract/contract.ts";
import {
  TYPESCRIPT_RESULT,
  TYPESCRIPT_WORKSPACE,
} from "../tools/ddd/lib/error-contract-verification/typescript-scenario.ts";
import { resolveTypeScriptCondition } from "../tools/ddd/lib/typescript/error-contract/index.ts";

function resolved(workspaceRoot: string): TypeScriptCondition {
  const outcome = resolveTypeScriptCondition({ workspaceRoot, resultDefinition: TYPESCRIPT_RESULT });
  if (outcome.kind !== "resolved") throw new Error(JSON.stringify(outcome));
  return outcome.condition;
}
function pick(condition: TypeScriptCondition, name: string): TypeScriptPackage {
  const found = condition.packages.find((entry) => entry.name === name);
  if (!found) throw new Error(`condition has no package ${name}`);
  return found;
}
/** Every file of the workspace with its content digest, so a write of any kind is visible. */
function workspaceState(root: string): string[] {
  const entries: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else
        entries.push(
          `${relative(root, full).split(sep).join("/")}:${createHash("sha256").update(readFileSync(full)).digest("hex")}`,
        );
    }
  };
  walk(root);
  return entries;
}
function inCopy<T>(edit: (root: string) => void, read: (root: string) => T): T {
  const temporary = mkdtempSync(join(tmpdir(), "ddd-error-contract-ts-"));
  try {
    cpSync(TYPESCRIPT_WORKSPACE, temporary, { recursive: true });
    edit(temporary);
    return read(temporary);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
function unavailable(root: string) {
  const outcome = resolveTypeScriptCondition({ workspaceRoot: root, resultDefinition: TYPESCRIPT_RESULT });
  if (outcome.kind !== "unavailable") throw new Error(`expected an unavailable condition: ${JSON.stringify(outcome)}`);
  return outcome.reasons;
}
function rewrite(root: string, file: string, edit: (document: Record<string, unknown>) => void): void {
  const path = join(root, file);
  const document = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  edit(document);
  writeFileSync(path, `${JSON.stringify(document, null, 2)}\n`);
}

describe("the recorded project condition of the fixed scenario", () => {
  test("records package identity, version, roots, entry points, references and dependencies", () => {
    const condition = resolved(TYPESCRIPT_WORKSPACE);
    expect(condition.packages).toHaveLength(2);

    const domain = pick(condition, "billing-domain");
    const useCase = pick(condition, "billing-use-case");
    expect(domain.packageId).not.toBe(useCase.packageId);
    for (const entry of [domain, useCase]) expect(entry.packageId.length).toBeGreaterThan(0);

    expect(domain.version).toBe("0.1.0");
    expect(domain.packageRoot).toBe("billing-domain");
    expect(domain.tsconfigPath).toBe("billing-domain/tsconfig.json");
    expect(domain.entryPoints).toEqual([
      { subpath: ".", target: "billing-domain/src/index.ts" },
      { subpath: "./result", target: "billing-domain/src/result.ts" },
    ]);
    expect(domain.projectReferences).toEqual([]);
    expect(domain.dependencies).toEqual([]);

    expect(useCase.packageRoot).toBe("billing-use-case");
    expect(useCase.tsconfigPath).toBe("billing-use-case/tsconfig.json");
    expect(useCase.entryPoints).toEqual([{ subpath: ".", target: "billing-use-case/src/index.ts" }]);
    expect(useCase.projectReferences).toEqual([domain.packageId]);
    expect(useCase.dependencies).toEqual([domain.packageId]);
  });

  test("records the supported Compiler API version and the module resolution conditions", () => {
    const condition = resolved(TYPESCRIPT_WORKSPACE);
    expect(condition.compilerApiVersion).toBe(ts.version);
    expect(condition.compilerApiVersion).toBe("6.0.3");
    expect(condition.module).toBe("esnext");
    expect(condition.moduleResolution).toBe("bundler");
    expect(condition.target).toBe("esnext");
    expect(condition.strict).toBe(true);
    expect(condition.resolutionConditions).toEqual(["development"]);
  });

  test("records the configured language-support result as a declaration of a recorded package", () => {
    const condition = resolved(TYPESCRIPT_WORKSPACE);
    expect(condition.resultDefinition).toEqual({
      packageId: pick(condition, "billing-domain").packageId,
      modulePath: "billing-domain/src/result.ts",
      typeName: "Result",
    });
  });

  test("keeps every recorded path project relative so a location can name a source", () => {
    const condition = resolved(TYPESCRIPT_WORKSPACE);
    const paths = condition.packages.flatMap((entry) => [
      entry.packageRoot,
      entry.tsconfigPath,
      ...entry.entryPoints.map((point) => point.target),
    ]);
    for (const path of [...paths, condition.resultDefinition.modulePath]) {
      expect(path.startsWith("/")).toBe(false);
      expect(path.includes("\\")).toBe(false);
      expect(path.startsWith("..")).toBe(false);
    }
  });

  test("resolves the same condition to the same record twice in one process", () => {
    expect(resolved(TYPESCRIPT_WORKSPACE)).toEqual(resolved(TYPESCRIPT_WORKSPACE));
  });

  test("reads the compiler options a package tsconfig inherits rather than only its own keys", () => {
    // Each package tsconfig states no compiler option of its own, so a base
    // config the recorded condition ignored could not change what it records.
    const changed = inCopy(
      (root) =>
        rewrite(root, "tsconfig.base.json", (document) => {
          (document.compilerOptions as Record<string, unknown>).customConditions = ["production"];
        }),
      resolved,
    );
    expect(changed.resolutionConditions).toEqual(["production"]);
  });
});

describe("inspection reads the project without preparing it", () => {
  test("leaves every workspace file and the directory tree untouched", () => {
    const before = workspaceState(TYPESCRIPT_WORKSPACE);
    resolved(TYPESCRIPT_WORKSPACE);
    resolved(TYPESCRIPT_WORKSPACE);
    expect(workspaceState(TYPESCRIPT_WORKSPACE)).toEqual(before);
  });

  test("reports an unresolved condition for a workspace root that has no tsconfig", () => {
    const reasons = inCopy((root) => rmSync(join(root, "tsconfig.json")), unavailable);
    expect(reasons.length).toBeGreaterThan(0);
    expect(reasons[0].code).toBe("tool-unavailable");
  });

  test("reports an unresolved condition for a referenced package that is not there", () => {
    const reasons = inCopy((root) => rmSync(join(root, "billing-use-case"), { recursive: true }), unavailable);
    expect(reasons.length).toBeGreaterThan(0);
    expect(reasons[0].code).toBe("tool-unavailable");
  });
});

describe("a project configuration the condition does not model", () => {
  test.each([
    ["module resolution", "moduleResolution", "node16"],
    ["module kind", "module", "commonjs"],
    ["language target", "target", "es2020"],
  ])("refuses to record an unsupported %s instead of narrowing it", (_label, key, value) => {
    const reasons = inCopy(
      (root) =>
        rewrite(root, "tsconfig.base.json", (document) => {
          (document.compilerOptions as Record<string, unknown>)[key] = value;
        }),
      unavailable,
    );
    expect(reasons.map((reason) => reason.code)).toContain("unsupported-syntax");
  });

  test("refuses a project that does not type check strictly", () => {
    const reasons = inCopy(
      (root) =>
        rewrite(root, "tsconfig.base.json", (document) => {
          (document.compilerOptions as Record<string, unknown>).strict = false;
        }),
      unavailable,
    );
    expect(reasons.map((reason) => reason.code)).toContain("unsupported-syntax");
  });

  test("refuses a language-support result that no recorded package declares", () => {
    const outcome = resolveTypeScriptCondition({
      workspaceRoot: TYPESCRIPT_WORKSPACE,
      resultDefinition: { ...TYPESCRIPT_RESULT, modulePath: "src/absent.ts" },
    });
    expect(outcome.kind).toBe("unavailable");
    if (outcome.kind === "unavailable") expect(outcome.reasons.length).toBeGreaterThan(0);
  });
});
