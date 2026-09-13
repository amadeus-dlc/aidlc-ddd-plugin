import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import {
  calls,
  constructions,
  fns,
  impls,
  initAnalyzer,
  opaqueRegions,
  parse,
  structs,
  uses,
} from "../tools/ddd/lib/rust/analyzer.ts";
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

describe("RustSyntaxAnalyzer", () => {
  const sample = `use crate::domain::Order;
use billing_query_dao::OrderDao as Dao;

pub struct Order {
    pub id: String,
    total: i64,
}

#[derive(Clone, Debug)]
pub struct Money(u64);

impl Order {
    pub fn new(id: String, total: i64) -> Self {
        Order { id, total }
    }

    pub fn total(&self) -> i64 {
        self.total
    }

    pub fn set_total(&mut self, value: i64) {
        self.total = value;
    }
}

pub fn make_order() -> Order {
    let dao: OrderDao = Default::default();
    Order::new("1".to_string(), 42)
}
`;

  test("extracts struct, impl, fn, use, call and construction facts", async () => {
    const runtime = await initAnalyzer();
    expect(runtime.state).toBe("ready");
    const tree = parse(runtime, "sample.rs", new TextEncoder().encode(sample));

    const structFacts = structs(tree);
    const order = structFacts.find((s) => s.name === "Order");
    expect(order?.kind).toBe("struct");
    expect(order?.visibility).toBe("pub");
    expect(order?.fields.map((f) => [f.name, f.visibility])).toEqual([
      ["id", "pub"],
      ["total", "private"],
    ]);
    const money = structFacts.find((s) => s.name === "Money");
    expect(money?.derives).toEqual(["Clone", "Debug"]);

    const implBlock = impls(tree).find((i) => i.target_type_text === "Order");
    const byName = Object.fromEntries((implBlock?.methods ?? []).map((m) => [m.name, m]));
    expect(byName.new.receiver).toBe("none");
    expect(byName.total.receiver).toBe("ref-self");
    expect(byName.total.body_shape).toBe("returns-field-only");
    expect(byName.set_total.receiver).toBe("mut-self");
    expect(byName.set_total.body_shape).toBe("assigns-field");

    expect(fns(tree).map((f) => f.name)).toContain("make_order");

    const usePaths = uses(tree).map((u) => u.path_text);
    expect(usePaths).toContain("crate::domain::Order");
    expect(uses(tree).find((u) => u.alias === "Dao")?.first_segment).toBe("billing_query_dao");

    const callKinds = calls(tree).map((c) => `${c.kind}:${c.callee_text}`);
    expect(callKinds).toContain("path-call:Order::new");
    expect(callKinds).toContain("method-call:to_string");

    const kinds = constructions(tree).map((c) => `${c.kind}:${c.type_text}`);
    expect(kinds).toContain("struct-literal:Order");
    expect(kinds).toContain("associated-call:Order");
    expect(opaqueRegions(tree).length).toBe(0);
    expect(tree.has_parse_error).toBe(false);
  });

  test("reports parse errors and macro regions without throwing", async () => {
    const runtime = await initAnalyzer();
    const broken = parse(runtime, "broken.rs", new TextEncoder().encode('fn main( { println!("x"); }\n'));
    expect(broken.has_parse_error).toBe(true);
    expect(opaqueRegions(broken).some((r) => r.reason === "parse-error")).toBe(true);
    expect(opaqueRegions(broken).some((r) => r.reason === "macro-expression")).toBe(true);
  });

  test("shares the parse by content hash but labels each tree with its file", async () => {
    const runtime = await initAnalyzer();
    const bytes = new TextEncoder().encode("fn a() {}\n");
    const first = parse(runtime, "a.rs", bytes);
    const second = parse(runtime, "b.rs", bytes);
    expect(second).not.toBe(first);
    expect(second.file).toBe("b.rs");
    expect(second.content_hash).toBe(first.content_hash);
  });

  test("keeps use paths literal and reports their first segment and alias", async () => {
    const runtime = await initAnalyzer();
    const source = `use crate::domain::Order;
use billing_query_dao::OrderDao as Dao;
use billing_domain::{Order, Line};
use ::std::collections::HashMap;
`;
    const tree = parse(runtime, "uses.rs", new TextEncoder().encode(source));
    const facts = uses(tree);

    const plain = facts.find((u) => u.path_text === "crate::domain::Order");
    expect(plain?.first_segment).toBe("crate");
    expect(plain?.alias).toBeUndefined();

    const aliased = facts.find((u) => u.alias === "Dao");
    expect(aliased?.path_text).toBe("billing_query_dao::OrderDao as Dao");
    expect(aliased?.first_segment).toBe("billing_query_dao");

    const braced = facts.find((u) => u.path_text.includes("{"));
    expect(braced?.path_text).toBe("billing_domain::{Order, Line}");
    expect(braced?.first_segment).toBe("billing_domain");

    expect(facts.find((u) => u.path_text === "::std::collections::HashMap")?.first_segment).toBe("std");
  });

  test("keeps builtin attributes transparent and separates item from expression macros", async () => {
    const runtime = await initAnalyzer();
    const source = `#[derive(Clone, Debug)]
#[cfg(test)]
#[custom_attribute]
pub struct Widget {
    pub id: String,
}

report_metrics!();

pub fn render() {
    println!("{}", 1);
}
`;
    const tree = parse(runtime, "macros.rs", new TextEncoder().encode(source));
    expect(tree.has_parse_error).toBe(false);

    const regions = opaqueRegions(tree);
    expect(regions.filter((r) => r.reason === "attribute-macro").map((r) => r.macro_name)).toEqual([
      "custom_attribute",
    ]);
    expect(regions.find((r) => r.macro_name === "report_metrics")?.reason).toBe("macro-item");
    expect(regions.find((r) => r.macro_name === "println")?.reason).toBe("macro-expression");

    expect(structs(tree).find((s) => s.name === "Widget")?.derives).toEqual(["Clone", "Debug"]);
  });

  test("classifies method bodies and construction sites", async () => {
    const runtime = await initAnalyzer();
    const source = `pub struct Order {
    pub id: String,
    pub total: i64,
}

impl Order {
    pub fn id(&self) -> String {
        self.id.clone()
    }

    pub fn total(&self) -> i64 {
        self.total
    }

    pub fn rename(&mut self, id: String) {
        self.id = id;
    }

    pub fn append(&mut self, suffix: &str) {
        self.id.push_str(suffix);
    }

    pub fn hash(&self) -> usize {
        self.id.len()
    }

    pub fn describe(&self) -> String {
        format!("{}:{}", self.id, self.total)
    }
}

pub fn build() -> Order {
    let base = Order { id: "1".to_string(), total: 0 };
    let copy = Order { total: 1, ..base };
    let fresh: Order = Default::default();
    let zero = Order::default();
    Order::new("2".to_string(), 3)
}
`;
    const tree = parse(runtime, "bodies.rs", new TextEncoder().encode(source));
    const shapes = Object.fromEntries(
      (impls(tree).find((i) => i.target_type_text === "Order")?.methods ?? []).map((m) => [m.name, m.body_shape]),
    );
    expect(shapes.id).toBe("returns-field-only");
    expect(shapes.total).toBe("returns-field-only");
    expect(shapes.rename).toBe("assigns-field");
    expect(shapes.append).toBe("assigns-field");
    expect(shapes.hash).toBe("other");
    expect(shapes.describe).toBe("opaque");

    const kinds = constructions(tree).map((c) => `${c.kind}:${c.type_text}`);
    expect(kinds).toContain("struct-literal:Order");
    expect(kinds).toContain("update-syntax:Order");
    expect(kinds).toContain("default-call:Default");
    expect(kinds).toContain("default-call:Order");
    expect(kinds).toContain("associated-call:Order");
  });
});
