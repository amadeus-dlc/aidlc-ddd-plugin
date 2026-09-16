import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
/** States one dependency selector for the package this workspace's use case depends on. */
function dependOn(root: string, selector: string): void {
  rewrite(root, "billing-use-case/package.json", (document) => {
    (document.dependencies as Record<string, unknown>)["billing-domain"] = selector;
  });
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

  test.each([["0.1.0"], ["workspace:0.1.0"], ["workspace:*"], ["workspace:^"], ["workspace:~"]])(
    "records a dependency whose selector accepts the version this project carries: %s",
    (selector) => {
      const condition = inCopy((root) => dependOn(root, selector), resolved);
      expect(pick(condition, "billing-use-case").dependencies).toEqual([pick(condition, "billing-domain").packageId]);
    },
  );
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

  test.each([
    ["leaves the package", "./../billing-use-case/src/index.ts"],
    ["walks out and back through a dot segment", "./src/../result.ts"],
    ["carries a dot segment", "./src/./result.ts"],
    ["carries an empty segment", "./src//result.ts"],
  ])("refuses an entry point target that %s", (_label, target) => {
    const reasons = inCopy(
      (root) =>
        rewrite(root, "billing-domain/package.json", (document) => {
          (document.exports as Record<string, unknown>)["./result"] = target;
        }),
      unavailable,
    );
    expect(reasons.map((reason) => reason.code)).toContain("unsupported-syntax");
    expect(reasons.map((reason) => reason.subject)).toContain('billing-domain/package.json.exports["./result"]');
  });

  /**
   * A reference to the project's own parent is the one path outside the project
   * that no `../` prefix announces, so it stands apart from the cases above.
   */
  test("refuses a referenced package that is the project's own parent directory", () => {
    const temporary = mkdtempSync(join(tmpdir(), "ddd-error-contract-ts-parent-"));
    try {
      const workspaceRoot = join(temporary, "workspace");
      cpSync(TYPESCRIPT_WORKSPACE, workspaceRoot, { recursive: true });
      mkdirSync(join(temporary, "src"));
      writeFileSync(join(temporary, "src", "index.ts"), "export const outer = 1;\n");
      writeFileSync(
        join(temporary, "package.json"),
        `${JSON.stringify(
          {
            name: "billing-outer",
            version: "0.1.0",
            private: true,
            type: "module",
            exports: { ".": "./src/index.ts" },
          },
          null,
          2,
        )}\n`,
      );
      writeFileSync(
        join(temporary, "tsconfig.json"),
        `${JSON.stringify({ extends: "./workspace/tsconfig.base.json", include: ["src/**/*.ts"] }, null, 2)}\n`,
      );
      rewrite(workspaceRoot, "tsconfig.json", (document) => {
        document.references = [...(document.references as unknown[]), { path: ".." }];
      });
      const reasons = unavailable(workspaceRoot);
      expect(reasons.map((reason) => reason.code)).toContain("unsupported-syntax");
      expect(reasons.map((reason) => reason.subject)).toContain("reference");
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });

  test.each([
    ["names another version", "0.2.0"],
    ["states a range", "^0.1.0"],
    ["states a comparator set", ">=0.1.0 <1.0.0"],
    ["states a tag", "latest"],
    ["accepts any version from anywhere", "*"],
    ["links a directory", "link:../billing-domain"],
    ["states a workspace version that is not the one carried", "workspace:0.2.0"],
  ])("refuses a dependency selector that %s", (_label, selector) => {
    const reasons = inCopy((root) => dependOn(root, selector), unavailable);
    expect(reasons.map((reason) => reason.code)).toContain("unsupported-syntax");
    expect(reasons.map((reason) => reason.subject)).toContain(
      "billing-use-case/package.json.dependencies.billing-domain",
    );
  });

  test("refuses a dependency selector that is not a string", () => {
    const reasons = inCopy(
      (root) =>
        rewrite(root, "billing-use-case/package.json", (document) => {
          (document.dependencies as Record<string, unknown>)["billing-domain"] = { version: "0.1.0" };
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
