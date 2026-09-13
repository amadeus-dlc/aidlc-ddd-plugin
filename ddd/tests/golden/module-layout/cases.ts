import type { GoldenCase } from "../runner.ts";

export const layoutConfig = (mode = "file") => `schema_version = 1\n[rust]\nmodule_layout = "${mode}"\n`;
const manifest = '[package]\nname = "billing"\nversion = "0.1.0"\nedition = "2021"\n';
const output = "construction/code-generation/code-summary.md";
function specimen(
  name: string,
  mode = "file",
  extra: Record<string, string> = {},
  expected: [string, string][] = [],
): GoldenCase & { workspace: Record<string, string> } {
  return {
    sensor: "ddd-rust-module-layout",
    name,
    stage: "code-generation",
    output,
    files: { [output]: "# Code summary\n" },
    // Deliberately no source-manifest or domain model: layout is independent of both.
    state: "## Stage Progress\n- [ ] ddd-domain-modeling — SKIP\n",
    workspace: {
      ".ddd.toml": layoutConfig(mode),
      "Cargo.toml": manifest,
      "src/lib.rs": "mod invoice;\n",
      "src/invoice.rs": "pub struct Invoice;\n",
      ...extra,
    },
    expect: {
      pass: expected.length === 0,
      rules: [...new Set(expected.map(([rule]) => rule))],
      locations: expected.map(([rule, file]) => ({ rule, file })),
    },
  };
}
const violation = (file: string): [string, string] => ["module-layout.violation", file];
const unresolved = (file: string): [string, string] => ["module-layout.unresolved", file];
const invalid: [string, string][] = [["module-layout.configuration", ".ddd.toml"]];
const cases: ReturnType<typeof specimen>[] = [
  specimen("clean-file"),
  specimen("clean-mod-rs-leaf", "mod-rs"),
  specimen("clean-file-parent", "file", {
    "src/invoice.rs": "mod line;\n",
    "src/invoice/line.rs": "pub struct Line;\n",
  }),
  specimen(
    "violation-file-parent-in-mod-mode",
    "mod-rs",
    { "src/invoice.rs": "mod line;\n", "src/invoice/line.rs": "pub struct Line;\n" },
    [violation("src/invoice.rs")],
  ),
  specimen("violation-file-parent-inline-child", "mod-rs", { "src/invoice.rs": "mod line {}\n" }, [
    violation("src/invoice.rs"),
  ]),
  specimen("clean-inline", "file", { "src/lib.rs": "mod invoice { pub struct Invoice; }\n" }),
  specimen("violation-missing-module", "file", { "src/invoice.rs": "mod missing;\n" }, [unresolved("src/invoice.rs")]),
  specimen("violation-duplicate-module", "file", { "src/invoice/mod.rs": "pub struct Other;\n" }, [
    unresolved("src/lib.rs"),
    unresolved("src/invoice.rs"),
    unresolved("src/invoice/mod.rs"),
  ]),
  specimen("violation-orphan-mod-rs", "file", { "src/forgotten/mod.rs": "pub struct Forgotten;\n" }, [
    unresolved("src/forgotten/mod.rs"),
  ]),
  specimen("violation-unregistered-source", "file", { "src/forgotten.rs": "pub struct Forgotten;\n" }, [
    unresolved("src/forgotten.rs"),
  ]),
  specimen("violation-config-mixed", "mixed", {}, invalid),
  specimen("violation-config-unknown", "auto", {}, invalid),
  specimen("violation-config-malformed", "file", { ".ddd.toml": "[" }, invalid),
  specimen(
    "violation-config-version",
    "file",
    { ".ddd.toml": 'schema_version=2\n[rust]\nmodule_layout="file"\n' },
    invalid,
  ),
  specimen(
    "violation-config-array",
    "file",
    { ".ddd.toml": 'schema_version=1\n[rust]\nmodule_layout=["file"]\n' },
    invalid,
  ),
  specimen(
    "violation-config-override",
    "file",
    { ".ddd.toml": `${layoutConfig()}[rust.crates.billing]\nmodule_layout="mod-rs"\n` },
    invalid,
  ),
  specimen(
    "violation-cfg-path",
    "file",
    { "src/lib.rs": '#[cfg_attr(feature="custom", path="other.rs")]\nmod invoice;\n' },
    [unresolved("src/lib.rs"), unresolved("src/invoice.rs")],
  ),
  specimen("violation-module-macro", "file", { "src/invoice.rs": "define_modules!();\n" }, [
    unresolved("src/invoice.rs"),
  ]),
  specimen("violation-parse-error", "file", { "src/invoice.rs": "pub struct {\n" }, [unresolved("src/invoice.rs")]),
  specimen("clean-test-target", "file", {
    "tests/smoke.rs": "mod support;\n",
    "tests/support.rs": "pub fn help() {}\n",
  }),
  specimen(
    "violation-test-mod-rs",
    "file",
    { "tests/smoke.rs": "mod support;\n", "tests/support/mod.rs": "pub fn help() {}\n" },
    [violation("tests/support/mod.rs")],
  ),
  specimen(
    "violation-cfg-test-mod-rs",
    "file",
    { "src/invoice.rs": "#[cfg(test)] mod tests;\n", "src/invoice/tests/mod.rs": "#[test] fn test() {}\n" },
    [violation("src/invoice/tests/mod.rs")],
  ),
  specimen("clean-excluded-artifacts", "file", {
    "target/generated/mod.rs": "",
    "vendor/external/mod.rs": "",
    ".codex/tools/Cargo.toml": "invalid",
    "aidlc/example.rs": "",
  }),
  specimen(
    "violation-unclaimed-other-layer",
    "file",
    {
      "other/Cargo.toml": manifest.replace('"billing"', '"billing-use-case"'),
      "other/src/lib.rs": "mod execute;\n",
      "other/src/execute/mod.rs": "pub fn run() {}\n",
    },
    [violation("other/src/execute/mod.rs")],
  ),
];
// Inline modules have no external source; remove the otherwise orphaned fixture file.
const inlineCase = cases.find((entry) => entry.name === "clean-inline");
if (!inlineCase) throw new Error("inline fixture missing");
delete inlineCase.workspace["src/invoice.rs"];
for (const [mode, name, parent, expected] of [
  ["mod-rs", "clean-mod-rs-parent", true, []],
  ["file", "violation-mod-rs-in-file-mode", true, [violation("src/invoice/mod.rs")]],
  ["mod-rs", "violation-mod-rs-leaf", false, [violation("src/invoice/mod.rs")]],
] as const) {
  const entry = specimen(name, mode, { "src/invoice/mod.rs": parent ? "mod line;\n" : "pub struct Invoice;\n" }, [
    ...expected,
  ]);
  delete entry.workspace["src/invoice.rs"];
  if (parent) entry.workspace["src/invoice/line.rs"] = "pub struct Line;\n";
  cases.push(entry);
}
const missing = specimen("violation-config-missing", "file", {}, invalid);
delete missing.workspace[".ddd.toml"];
cases.push(missing);
for (const edition of ["2015", "2018", "2021", "2024"]) {
  cases.push(
    specimen(`clean-edition-${edition}`, "file", { "Cargo.toml": manifest.replace('"2021"', `"${edition}"`) }),
  );
}
const path = specimen("clean-path-attribute", "file", {
  "src/lib.rs": '#[path="billing/invoice.rs"] mod invoice;\n',
  "src/billing/invoice.rs": "pub struct Invoice;\n",
});
delete path.workspace["src/invoice.rs"];
cases.push(path);
const badPath = structuredClone(path);
badPath.name = "violation-path-name-bypass";
badPath.workspace["src/lib.rs"] = '#[path="billing/record.rs"] mod invoice;\n';
badPath.workspace["src/billing/record.rs"] = badPath.workspace["src/billing/invoice.rs"];
delete badPath.workspace["src/billing/invoice.rs"];
badPath.expect = {
  pass: false,
  rules: ["module-layout.violation"],
  locations: [{ rule: "module-layout.violation", file: "src/billing/record.rs" }],
};
cases.push(badPath);
const rooted = specimen("clean-workspace-root-package", "file", {
  "Cargo.toml": `${manifest}\n[workspace]\nmembers = []\n`,
});
cases.push(rooted);
const nested = specimen("clean-nested-project");
nested.workspace = Object.fromEntries(
  Object.entries(nested.workspace).map(([file, value]) => [file === ".ddd.toml" ? file : `backend/${file}`, value]),
);
cases.push(nested);
cases.push(
  specimen("violation-nested-config", "file", { "nested/.ddd.toml": layoutConfig("mod-rs") }, [
    ["module-layout.configuration", "nested/.ddd.toml"],
  ]),
);
const absentEdition = specimen("clean-edition-omitted", "file", {
  "Cargo.toml": manifest.replace('edition = "2021"\n', ""),
});
cases.push(absentEdition);
const inheritedEdition = specimen("clean-edition-inherited", "file", {
  "Cargo.toml": `${manifest.replace('edition = "2021"', "edition.workspace = true")}\n[workspace.package]\nedition = "2024"\n`,
});
cases.push(inheritedEdition);
const custom = specimen("clean-custom-target", "file", {
  "Cargo.toml": `${manifest}\n[lib]\npath = "code/root.rs"\n`,
  "code/root.rs": "mod invoice;\n",
  "code/invoice.rs": "pub struct Invoice;\n",
});
delete custom.workspace["src/lib.rs"];
delete custom.workspace["src/invoice.rs"];
cases.push(custom);
const multi = specimen("clean-multi-crate-workspace", "file", {
  "Cargo.toml": '[workspace]\nmembers = ["billing"]\n',
  "billing/Cargo.toml": manifest,
  "billing/src/lib.rs": "mod invoice;\n",
  "billing/src/invoice.rs": "pub struct Invoice;\n",
});
delete multi.workspace["src/lib.rs"];
delete multi.workspace["src/invoice.rs"];
cases.push(multi);
for (const [stage, artifact] of [
  ["build-and-test", "build-and-test-summary.md"],
  ["ci-pipeline", "quality-gates.md"],
]) {
  for (const originalName of ["clean-file", "violation-mod-rs-in-file-mode", "violation-config-missing"]) {
    const original = cases.find((entry) => entry.name === originalName);
    if (!original) throw new Error("stage fixture missing");
    const entry = structuredClone(original);
    entry.name = `${originalName}-${stage}`;
    entry.stage = stage;
    entry.output = `construction/${stage}/${artifact}`;
    entry.files = { [entry.output]: "# Layout check\n" };
    cases.push(entry);
  }
}
cases.push(
  specimen(
    "violation-stale-default-target",
    "file",
    {
      "Cargo.toml": `${manifest}\n[lib]\npath = "code/root.rs"\n`,
      "code/root.rs": "pub struct Current;\n",
    },
    [unresolved("src/lib.rs"), unresolved("src/invoice.rs")],
  ),
);
cases.push(
  specimen("clean-directory-test-target", "file", {
    "tests/smoke/main.rs": "mod support;\n",
    "tests/smoke/support.rs": "pub fn help() {}\n",
  }),
);
cases.push(
  specimen(
    "violation-disabled-build-script",
    "file",
    { "Cargo.toml": `${manifest}build = false\n`, "build.rs": "fn main() {}\n" },
    [unresolved("build.rs")],
  ),
);
export const MODULE_LAYOUT_CASES = cases;
