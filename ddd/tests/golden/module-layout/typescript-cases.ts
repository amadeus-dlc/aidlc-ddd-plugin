import type { GoldenCase } from "../runner.ts";

export const TYPESCRIPT_LAYOUT_SENSOR = "ddd-typescript-module-layout";

export const typescriptLayoutConfig = (mode = "named-file") =>
  `schema_version = 2\nlanguages = ["typescript"]\n\n[typescript]\nmodule_layout = "${mode}"\ncode_representation = "class"\n`;
const packageManifest = (name = "billing") => `{ "name": "${name}" }\n`;
const output = "construction/code-generation/code-summary.md";

type LayoutCase = GoldenCase & { workspace: Record<string, string> };

/**
 * One TypeScript package at the project root with a single leaf module `src/invoice.ts`. `extra` is
 * merged over that base; a `null` value removes a base entry, so a case states the tree it inspects
 * rather than patching the base afterwards.
 */
function specimen(
  name: string,
  mode = "named-file",
  extra: Record<string, string | null> = {},
  expected: [string, string][] = [],
): LayoutCase {
  const workspace: Record<string, string> = {
    ".ddd.toml": typescriptLayoutConfig(mode),
    "package.json": packageManifest(),
    "src/invoice.ts": "export class Invoice {}\n",
  };
  for (const [path, text] of Object.entries(extra)) {
    if (text === null) delete workspace[path];
    else workspace[path] = text;
  }
  return {
    sensor: TYPESCRIPT_LAYOUT_SENSOR,
    name,
    stage: "code-generation",
    output,
    files: { [output]: "# Code summary\n" },
    // Layout depends on neither a source manifest nor a domain model.
    state: "## Stage Progress\n- [ ] ddd-domain-modeling — SKIP\n",
    workspace,
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

/** A parent module `invoice` with the child `line`, placed as `index.ts` inside its directory. */
const indexParent = {
  "src/invoice.ts": null,
  "src/invoice/index.ts": 'export * from "./line";\n',
  "src/invoice/line.ts": "export class Line {}\n",
};
/** The same parent placed as the named file beside its directory. */
const namedParent = { "src/invoice/line.ts": "export class Line {}\n" };
/** A workspace whose root manifest has no `src`, holding one package under `packages/billing`. */
const workspacePackage = {
  "src/invoice.ts": null,
  "package.json": '{ "name": "workspace", "private": true, "workspaces": ["packages/*"] }\n',
  "packages/billing/package.json": packageManifest(),
  "packages/billing/src/invoice.ts": "export class Invoice {}\n",
};

const cases: LayoutCase[] = [
  // --- clean placements -----------------------------------------------------------------------
  specimen("clean-named-file-leaf"),
  specimen("clean-index-file-leaf", "index-file"),
  specimen("clean-named-file-parent", "named-file", namedParent),
  specimen("clean-index-file-parent", "index-file", indexParent),
  specimen("clean-nested-named-parents", "named-file", {
    "src/invoice/line.ts": "export class Line {}\n",
    "src/invoice/line/amount.ts": "export class Amount {}\n",
  }),
  specimen("clean-nested-index-parents", "index-file", {
    ...indexParent,
    "src/invoice/line.ts": null,
    "src/invoice/line/index.ts": 'export * from "./amount";\n',
    "src/invoice/line/amount.ts": "export class Amount {}\n",
  }),
  // The package's own entry is not a module the layout places, in either policy.
  specimen("clean-package-entry", "named-file", { "src/index.ts": 'export * from "./invoice";\n' }),
  specimen("clean-package-entry-index-file", "index-file", { "src/index.ts": 'export * from "./invoice";\n' }),
  specimen("clean-multi-package-workspace", "named-file", {
    ...workspacePackage,
    "packages/billing/src/invoice/line.ts": "export class Line {}\n",
  }),
  // Only `src` under a package root is a source root: the same shapes elsewhere are not modules.
  specimen("clean-sources-outside-src", "named-file", {
    ...workspacePackage,
    "packages/billing/test/invoice/index.ts": 'import "../../src/invoice";\n',
    "packages/billing/test/invoice/line.ts": "export {};\n",
    "packages/billing/vite.config.ts": "export default {};\n",
    "scripts/build/index.ts": "export {};\n",
  }),
  specimen("clean-excluded-artifacts", "named-file", {
    "node_modules/x/index.ts": "export {};\n",
    "node_modules/x/y.ts": "export {};\n",
    "dist/invoice/index.ts": "export {};\n",
    "dist/invoice/line.ts": "export {};\n",
    ".cache/stale/index.ts": "export {};\n",
    "aidlc/example/index.ts": "export {};\n",
    "src/.generated/index.ts": "export {};\n",
    "src/dist/invoice/index.ts": "export {};\n",
  }),
  // A file other than TypeScript does not give a module children.
  specimen("clean-non-typescript-in-module-directory", "index-file", { "src/invoice/data.json": "{}\n" }),

  // --- a parent placed the other policy's way ----------------------------------------------------
  specimen("violation-index-parent-in-named-file", "named-file", indexParent, [violation("src/invoice/index.ts")]),
  specimen("violation-named-parent-in-index-file", "index-file", namedParent, [violation("src/invoice.ts")]),
  specimen(
    "violation-index-parent-in-workspace-package",
    "named-file",
    {
      ...workspacePackage,
      "packages/billing/src/invoice.ts": null,
      "packages/billing/src/invoice/index.ts": 'export * from "./line";\n',
      "packages/billing/src/invoice/line.ts": "export class Line {}\n",
    },
    [violation("packages/billing/src/invoice/index.ts")],
  ),

  // --- an index file left behind once its children moved away ------------------------------------
  specimen("violation-index-leaf-named-file", "named-file", { ...indexParent, "src/invoice/line.ts": null }, [
    violation("src/invoice/index.ts"),
  ]),
  specimen("violation-index-leaf-index-file", "index-file", { ...indexParent, "src/invoice/line.ts": null }, [
    violation("src/invoice/index.ts"),
  ]),

  // --- a module directory whose own file is missing -------------------------------------------------
  specimen("violation-missing-parent-named-file", "named-file", { ...indexParent, "src/invoice/index.ts": null }, [
    unresolved("src/invoice"),
  ]),
  specimen("violation-missing-parent-index-file", "index-file", { ...indexParent, "src/invoice/index.ts": null }, [
    unresolved("src/invoice"),
  ]),

  // --- one module placed in both files ---------------------------------------------------------------
  specimen(
    "violation-ambiguous-parent-named-file",
    "named-file",
    { ...indexParent, "src/invoice.ts": "export class Invoice {}\n" },
    [unresolved("src/invoice.ts"), unresolved("src/invoice/index.ts")],
  ),
  specimen(
    "violation-ambiguous-parent-index-file",
    "index-file",
    { ...indexParent, "src/invoice.ts": "export class Invoice {}\n" },
    [unresolved("src/invoice.ts"), unresolved("src/invoice/index.ts")],
  ),
  specimen("violation-ambiguous-leaf-named-file", "named-file", { "src/invoice/index.ts": "export {};\n" }, [
    unresolved("src/invoice.ts"),
    unresolved("src/invoice/index.ts"),
  ]),

  // --- sources the layout cannot place ---------------------------------------------------------------
  specimen(
    "violation-unplaceable-source-name",
    "named-file",
    {
      "src/invoice.test.ts": "export {};\n",
      "src/view.tsx": "export {};\n",
      "src/types.d.ts": "export {};\n",
      "src/esm.mts": "export {};\n",
      "src/common.cts": "export {};\n",
    },
    [
      unresolved("src/invoice.test.ts"),
      unresolved("src/view.tsx"),
      unresolved("src/types.d.ts"),
      unresolved("src/esm.mts"),
      unresolved("src/common.cts"),
    ],
  ),
  specimen("violation-invalid-directory-name", "named-file", { "src/1invoice/line.ts": "export {};\n" }, [
    unresolved("src/1invoice"),
  ]),
  // A package inside another package's source root belongs to neither, so its tree is not judged.
  specimen(
    "violation-nested-package-in-src",
    "named-file",
    { "src/sub/package.json": packageManifest("sub"), "src/sub/src/money.ts": "export {};\n" },
    [unresolved("src/sub/package.json")],
  ),
  // A TypeScript project whose sources sit in no package `src` has nothing the check can place.
  specimen(
    "violation-no-package",
    "named-file",
    { "src/invoice.ts": null, "lib/invoice.ts": "export class Invoice {}\n", "tsconfig.json": "{}\n" },
    [unresolved(".")],
  ),

  // --- settings ----------------------------------------------------------------------------------------
  specimen(
    "violation-config-no-typescript",
    "named-file",
    { ".ddd.toml": 'schema_version = 2\nlanguages = ["rust"]\n\n[rust]\nmodule_layout = "file"\n' },
    invalid,
  ),
  specimen("violation-config-unknown-layout", "flat", {}, invalid),
  specimen(
    "violation-config-legacy",
    "named-file",
    { ".ddd.toml": 'schema_version = 1\n[rust]\nmodule_layout = "file"\n' },
    invalid,
  ),
  specimen("violation-config-missing", "named-file", { ".ddd.toml": null }, invalid),
  specimen("violation-nested-config", "named-file", { "nested/.ddd.toml": typescriptLayoutConfig("index-file") }, [
    ["module-layout.configuration", "nested/.ddd.toml"],
  ]),
];

// A symbolic link inside the inspected project is not followed, wherever it points.
const outsideLink = specimen(
  "violation-symlink-outside-package",
  "named-file",
  { ...workspacePackage, "shared/money.ts": "export class Money {}\n" },
  [unresolved("packages/billing/src/shared")],
);
outsideLink.links = { "packages/billing/src/shared": "../../../shared" };
cases.push(outsideLink);
const insideLink = specimen("violation-symlink-in-src", "named-file", {}, [unresolved("src/alias.ts")]);
insideLink.links = { "src/alias.ts": "invoice.ts" };
cases.push(insideLink);

for (const mode of ["named-file", "index-file"]) {
  const entry = cases.find((candidate) => candidate.name === `clean-${mode}-leaf`);
  if (!entry) throw new Error(`leaf fixture missing: ${mode}`);
  entry.expect.note_contains = mode;
}

for (const [stage, artifact] of [
  ["build-and-test", "build-and-test-summary.md"],
  ["ci-pipeline", "quality-gates.md"],
]) {
  for (const originalName of [
    "clean-named-file-leaf",
    "violation-index-parent-in-named-file",
    "violation-config-missing",
  ]) {
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
export const TYPESCRIPT_MODULE_LAYOUT_CASES = cases;
