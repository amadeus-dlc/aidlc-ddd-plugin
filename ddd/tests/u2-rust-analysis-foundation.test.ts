import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import {
  assignLayers,
  classifyFile,
  conventions,
  isAllowed,
  permissionTable,
  scanWorkspace,
} from "../tools/ddd/lib/workspace/resolver.ts";

const tempDirs: string[] = [];
function makeTemp(): string {
  const dir = mkdtempSync(join(tmpdir(), "ddd-u2-"));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop() as string, { recursive: true, force: true });
});

function write(root: string, rel: string, content: string): void {
  const path = join(root, rel);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content);
}

interface CrateSpec {
  path: string;
  name: string;
  lib?: boolean;
  bin?: boolean;
  deps?: string[];
}

function buildWorkspace(specs: CrateSpec[]): string {
  const root = makeTemp();
  const members = specs.map((s) => `"${s.path}"`).join(", ");
  write(root, "Cargo.toml", `[workspace]\nmembers = [${members}]\nresolver = "2"\n\n[workspace.dependencies]\n`);
  for (const spec of specs) {
    const depLines = (spec.deps ?? [])
      .map((dep) => {
        const target = specs.find((s) => s.name === dep);
        if (!target) throw new Error(`unknown dependency ${dep}`);
        const rel = relative(spec.path, target.path).split("\\").join("/");
        return `${dep} = { path = "${rel}" }`;
      })
      .join("\n");
    write(
      root,
      `${spec.path}/Cargo.toml`,
      `[package]\nname = "${spec.name}"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n${depLines}\n`,
    );
    if (spec.lib !== false) write(root, `${spec.path}/src/lib.rs`, "pub fn probe() {}\n");
    if (spec.bin) write(root, `${spec.path}/src/main.rs`, "fn main() {}\n");
  }
  return root;
}

function layerOf(assignments: ReturnType<typeof assignLayers>, name: string) {
  const found = assignments.find((a) => a.crate_name === name);
  if (!found) throw new Error(`no assignment for ${name}`);
  return found;
}

describe("scanWorkspace", () => {
  test.each([{ members: [] }, { members: ["."] }, { members: [".", "crates/*"] }])(
    "registers the root package once with %j",
    ({ members }) => {
      const root = makeTemp();
      write(
        root,
        "Cargo.toml",
        `[package]\nname = "billing-domain"\nversion = "0.1.0"\n[workspace]\nmembers = ${JSON.stringify(members)}\n`,
      );
      write(root, "src/lib.rs", "pub struct Invoice;\n");
      if (members.includes("crates/*")) {
        write(root, "crates/money/Cargo.toml", '[package]\nname = "money-domain"\nversion = "0.1.0"\n');
        write(root, "crates/money/src/lib.rs", "pub struct Money;\n");
      }
      const workspace = scanWorkspace(root);
      expect(workspace.diagnostics).toEqual([]);
      expect(workspace.members.filter((member) => member.path === ".")).toHaveLength(1);
      expect(workspace.members).toHaveLength(members.includes("crates/*") ? 2 : 1);
      expect(assignLayers(workspace).filter((assignment) => assignment.crate_name === "billing-domain")).toHaveLength(
        1,
      );
    },
  );

  test("resolves members, targets and path dependencies", () => {
    const root = buildWorkspace([
      { path: "packages/domain/billing-domain", name: "billing-domain" },
      { path: "packages/use-case/billing-use-case", name: "billing-use-case", deps: ["billing-domain"] },
      { path: "crates/util", name: "util", bin: true },
    ]);
    const workspace = scanWorkspace(root);
    expect(workspace.diagnostics).toEqual([]);
    expect(workspace.members.map((m) => m.name).sort()).toEqual(["billing-domain", "billing-use-case", "util"]);
    const domain = workspace.members.find((m) => m.name === "billing-domain");
    expect(domain?.targets.some((t) => t.kind === "lib" && t.src_path === "src/lib.rs")).toBe(true);
    const useCase = workspace.members.find((m) => m.name === "billing-use-case");
    expect(useCase?.internal_dependencies).toEqual(["billing-domain"]);
    const util = workspace.members.find((m) => m.name === "util");
    expect(util?.targets.some((t) => t.kind === "bin" && t.src_path === "src/main.rs")).toBe(true);
  });

  test("reports an unreadable root", () => {
    const root = makeTemp();
    const workspace = scanWorkspace(root);
    expect(workspace.members).toEqual([]);
    expect(workspace.diagnostics[0].code).toBe("workspace.unreadable");
  });
});

describe("assignLayers", () => {
  test("applies the representative decision table", () => {
    const root = buildWorkspace([
      { path: "packages/domain/billing-domain", name: "billing-domain" },
      { path: "packages/use-case/billing-domain", name: "conflicting-domain" },
      { path: "packages/command/use-case/billing-command-use-case", name: "billing-command-use-case" },
      { path: "packages/query/domain/billing-query-domain", name: "billing-query-domain" },
      { path: "packages/rmu/billing-rmu", name: "billing-rmu" },
      { path: "apps/billing-app", name: "billing-app", lib: false, bin: true },
      { path: "crates/util", name: "util" },
    ]);
    const assignments = assignLayers(scanWorkspace(root));

    const domain = layerOf(assignments, "billing-domain");
    expect(domain.layer).toBe("domain");
    expect(domain.layer_source).toBe("both");

    const conflicting = layerOf(assignments, "conflicting-domain");
    expect(conflicting.layer).toBe("unknown");
    expect(conflicting.diagnostics.map((d) => d.code)).toContain("layer.conflict");

    const commandUseCase = layerOf(assignments, "billing-command-use-case");
    expect(commandUseCase.layer).toBe("use-case");
    expect(commandUseCase.cqrs_side).toBe("command");
    expect(commandUseCase.layer_source).toBe("both");

    const queryDomain = layerOf(assignments, "billing-query-domain");
    expect(queryDomain.cqrs_side).toBe("query");
    expect(queryDomain.diagnostics.map((d) => d.code)).toContain("cqrs.query-domain");

    const rmu = layerOf(assignments, "billing-rmu");
    expect(rmu.layer).toBe("rmu");
    expect(rmu.layer_source).toBe("marker");

    const app = layerOf(assignments, "billing-app");
    expect(app.is_composition_root).toBe(true);
    expect(app.layer).toBe("composition-root");

    const util = layerOf(assignments, "util");
    expect(util.layer).toBe("unknown");
    expect(util.diagnostics.map((d) => d.code)).toContain("layer.unknown");
  });

  test("flags a crate with both bin and lib targets", () => {
    const root = buildWorkspace([{ path: "crates/mixed", name: "mixed", bin: true }]);
    const assignments = assignLayers(scanWorkspace(root));
    const mixed = layerOf(assignments, "mixed");
    expect(mixed.diagnostics.map((d) => d.code)).toContain("layer.mixed-targets");
  });
});

describe("classifyFile", () => {
  test("classifies crate sources, auxiliary files and unowned files", () => {
    const root = buildWorkspace([{ path: "packages/domain/billing-domain", name: "billing-domain" }]);
    const assignments = assignLayers(scanWorkspace(root));

    const source = classifyFile(assignments, "packages/domain/billing-domain/src/lib.rs");
    expect(source.crate_name).toBe("billing-domain");
    expect(source.role).toBe("crate-source");
    expect(source.effective_layer).toBe("domain");
    expect(source.target_kind).toBe("lib");

    const test = classifyFile(assignments, "packages/domain/billing-domain/tests/it.rs");
    expect(test.role).toBe("auxiliary");
    expect(test.effective_layer).toBe("auxiliary");

    const unowned = classifyFile(assignments, "scripts/tool.rs");
    expect(unowned.role).toBe("unowned");
  });
});

describe("permissions", () => {
  test("publishes the dependency permission table and isAllowed", () => {
    const table = permissionTable();
    expect(table.find((r) => r.from_layer === "use-case" && r.to_layer === "domain")?.allowed).toBe(true);
    expect(table.find((r) => r.from_layer === "domain" && r.to_layer === "use-case")?.allowed).toBe(false);
    expect(table.find((r) => r.from_layer === "rmu" && r.to_layer === "domain")?.cross_side_allowed).toBe(true);

    const assignments = assignLayers(
      scanWorkspace(
        buildWorkspace([
          { path: "packages/use-case/billing-command-use-case", name: "billing-command-use-case" },
          { path: "packages/domain/billing-query-domain", name: "billing-query-domain" },
        ]),
      ),
    );
    const command = assignments.find((a) => a.crate_name === "billing-command-use-case");
    const query = assignments.find((a) => a.crate_name === "billing-query-domain");
    if (!command || !query) throw new Error("fixtures missing");
    expect(isAllowed(command, query).reason).toBe("cross-side");
    expect(conventions().layer_suffixes).toBeDefined();
  });
});
