import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CargoCondition, CargoPackage } from "../tools/ddd/lib/error-contract/contract.ts";
import { WORKSPACE } from "../tools/ddd/lib/error-contract-verification/scenario.ts";
import { resolveCargoCondition } from "../tools/ddd/lib/rust/error-contract/cargo-condition.ts";

const MANIFEST = join(WORKSPACE, "Cargo.toml");
const LOCKFILE = join(WORKSPACE, "Cargo.lock");

function hostTriple(): string {
  const probe = Bun.spawnSync(["rustc", "-vV"], { stdout: "pipe", stderr: "pipe" });
  const host = /^host: (.+)$/m.exec(probe.stdout.toString())?.[1];
  if (!host) throw new Error("rustc host target unavailable");
  return host;
}
const TRIPLE = hostTriple();

async function resolved(manifestPath: string, features: readonly string[] = []): Promise<CargoCondition> {
  const outcome = await resolveCargoCondition({ manifestPath, targetTriple: TRIPLE, features });
  if (outcome.kind !== "resolved") throw new Error(JSON.stringify(outcome));
  return outcome.condition;
}
function pick(condition: CargoCondition, name: string): CargoPackage {
  const found = condition.packages.find((entry) => entry.name === name);
  if (!found) throw new Error(`condition has no package ${name}`);
  return found;
}
function digestOf(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

describe("the recorded Cargo condition of the fixed scenario", () => {
  test("records package identity, Cargo targets, per-package edition and dependency renames", async () => {
    const condition = await resolved(MANIFEST);
    expect(condition.targetTriple).toBe(TRIPLE);
    expect(condition.packages).toHaveLength(2);

    const domain = pick(condition, "billing-domain");
    const useCase = pick(condition, "billing-use-case");
    expect(domain.packageId).not.toBe(useCase.packageId);
    for (const entry of [domain, useCase]) expect(entry.packageId.length).toBeGreaterThan(0);

    expect(domain.edition).toBe("2021");
    expect(useCase.edition).toBe("2024");

    expect(domain.targets).toEqual([{ kind: "lib", name: "billing_domain", srcPath: "billing-domain/src/lib.rs" }]);
    expect(useCase.targets).toEqual([
      { kind: "lib", name: "billing_use_case", srcPath: "billing-use-case/src/lib.rs" },
    ]);

    expect(domain.dependencyRenames).toEqual([]);
    expect(useCase.dependencyRenames).toEqual([{ alias: "billing", packageId: domain.packageId }]);
  });
  test("keeps owned source paths project relative so a location can name a source", async () => {
    const condition = await resolved(MANIFEST);
    for (const entry of condition.packages)
      for (const target of entry.targets) {
        expect(target.srcPath.startsWith("/")).toBe(false);
        expect(existsSync(join(WORKSPACE, target.srcPath))).toBe(true);
      }
  });
  test("resolves the same condition to the same record twice in one process", async () => {
    expect(await resolved(MANIFEST)).toEqual(await resolved(MANIFEST));
  });
  test("records the selected feature set of one build condition at a time", async () => {
    const without = await resolved(MANIFEST);
    const selected = await resolved(MANIFEST, ["billing-use-case/extra-case"]);
    expect(pick(without, "billing-domain").features).toEqual([]);
    expect(pick(without, "billing-use-case").features).toEqual([]);
    expect(pick(selected, "billing-domain").features).toEqual(["extra-case"]);
    expect(pick(selected, "billing-use-case").features).toEqual(["extra-case"]);
    expect(selected).not.toEqual(without);
  });
});

describe("inspection does not prepare dependencies", () => {
  test("leaves the lockfile and the workspace directory untouched", async () => {
    const before = digestOf(LOCKFILE);
    const entries = readdirSync(WORKSPACE).sort();
    await resolved(MANIFEST);
    await resolved(MANIFEST, ["billing-use-case/extra-case"]);
    expect(digestOf(LOCKFILE)).toBe(before);
    expect(readdirSync(WORKSPACE).sort()).toEqual(entries);
  });
  test("reports an unresolved condition instead of writing a missing lockfile", async () => {
    const temp = mkdtempSync(join(tmpdir(), "ddd-error-contract-"));
    try {
      cpSync(WORKSPACE, temp, { recursive: true });
      rmSync(join(temp, "Cargo.lock"));
      const outcome = await resolveCargoCondition({
        manifestPath: join(temp, "Cargo.toml"),
        targetTriple: TRIPLE,
        features: [],
      });
      expect(outcome.kind).toBe("unavailable");
      if (outcome.kind === "unavailable") {
        expect(outcome.reasons.length).toBeGreaterThan(0);
        expect(outcome.reasons[0].code).toBe("tool-unavailable");
      }
      expect(existsSync(join(temp, "Cargo.lock"))).toBe(false);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
  test("reports an unresolved condition for a manifest that is not there", async () => {
    const outcome = await resolveCargoCondition({
      manifestPath: join(WORKSPACE, "absent", "Cargo.toml"),
      targetTriple: TRIPLE,
      features: [],
    });
    expect(outcome.kind).toBe("unavailable");
  });
});

/** Resolution enters a package through its library crate root, so only that target is recorded. */
describe("the inspected Cargo target", () => {
  async function inCopy(edit: (root: string) => void): Promise<CargoCondition> {
    const temp = mkdtempSync(join(tmpdir(), "ddd-error-contract-"));
    try {
      cpSync(WORKSPACE, temp, { recursive: true });
      edit(temp);
      return await resolved(join(temp, "Cargo.toml"));
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  }

  test("records the library target and leaves a binary target of the same package out", async () => {
    const condition = await inCopy((root) => {
      writeFileSync(
        join(root, "billing-domain/Cargo.toml"),
        `${readFileSync(join(root, "billing-domain/Cargo.toml"), "utf8")}\n[[bin]]\nname = "probe"\npath = "src/main.rs"\n`,
      );
      writeFileSync(join(root, "billing-domain/src/main.rs"), "fn main() {}\n");
    });
    expect(pick(condition, "billing-domain").targets).toEqual([
      { kind: "lib", name: "billing_domain", srcPath: "billing-domain/src/lib.rs" },
    ]);
  });

  test("leaves a package with no library target out of the condition", async () => {
    const condition = await inCopy((root) => {
      const manifest = join(root, "billing-use-case/Cargo.toml");
      const replaced = readFileSync(manifest, "utf8").replace(
        '[lib]\nname = "billing_use_case"\npath = "src/lib.rs"\n',
        '[[bin]]\nname = "probe"\npath = "src/main.rs"\n',
      );
      expect(replaced).not.toContain("[lib]");
      writeFileSync(manifest, replaced);
      // Cargo discovers `src/lib.rs` on its own, so the file has to go with the section.
      rmSync(join(root, "billing-use-case/src/lib.rs"));
      writeFileSync(join(root, "billing-use-case/src/main.rs"), "fn main() {}\n");
    });
    expect(condition.packages.map((entry) => entry.name)).toEqual(["billing-domain"]);
  });
});
