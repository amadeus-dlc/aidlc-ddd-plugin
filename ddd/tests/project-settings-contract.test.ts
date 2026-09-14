import { expect, test } from "bun:test";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  ReadOutcome,
  SettingsRejection,
  SettingsRejectionReason,
  TypeScriptCodeRepresentation,
  TypeScriptModuleLayout,
} from "../tools/ddd/lib/project-settings/index.ts";
import { readProjectSettings } from "../tools/ddd/lib/project-settings/index.ts";
import {
  legacyDocument,
  modernDocument,
  untouchableUserFiles,
  withWorkspace,
} from "./fixtures/project-settings/workspace.ts";

const DIAGNOSTIC_FIELDS = ["detail", "file", "missing", "reason", "rejectedDocuments", "subject"];
const RUST_ONLY = 'schema_version = 2\nlanguages = ["rust"]\n\n[rust]\nmodule_layout = "file"\n';

function expectRejection(outcome: ReadOutcome, root: string): SettingsRejection {
  if (outcome.kind !== "rejected") throw new Error(`expected a rejection, received ${JSON.stringify(outcome)}`);
  expect(Object.keys(outcome.rejection).sort()).toEqual(DIAGNOSTIC_FIELDS);
  expect(outcome.rejection.file).toBe(join(root, ".ddd.toml"));
  return outcome.rejection;
}

function selectionOf(document: string, extra: Record<string, string> = {}) {
  return withWorkspace({ ".ddd.toml": document, ...extra }, (root) => {
    const outcome = readProjectSettings(root);
    if (outcome.kind !== "validated") throw new Error(`expected a validated read, received ${JSON.stringify(outcome)}`);
    return outcome.selection;
  });
}

test("a Rust-only document yields the Rust choice and no TypeScript value at all", () => {
  withWorkspace({ ".ddd.toml": RUST_ONLY }, (root) => {
    expect(readProjectSettings(root)).toEqual({
      kind: "validated",
      selection: { languages: ["rust"], rust: { moduleLayout: "file" }, typescript: null },
    });
  });
});

test("a TypeScript-only document yields both TypeScript choices and no Rust value at all", () => {
  const document =
    'schema_version = 2\nlanguages = ["typescript"]\n\n[typescript]\nmodule_layout = "index-file"\ncode_representation = "companion"\n';
  withWorkspace({ ".ddd.toml": document }, (root) => {
    expect(readProjectSettings(root)).toEqual({
      kind: "validated",
      selection: {
        languages: ["typescript"],
        rust: null,
        typescript: { moduleLayout: "index-file", codeRepresentation: "companion" },
      },
    });
  });
});

test("a two-language document yields every declared choice", () => {
  const document =
    'schema_version = 2\nlanguages = ["rust", "typescript"]\n\n[rust]\nmodule_layout = "mod-rs"\n\n[typescript]\nmodule_layout = "named-file"\ncode_representation = "class"\n';
  withWorkspace({ ".ddd.toml": document }, (root) => {
    expect(readProjectSettings(root)).toEqual({
      kind: "validated",
      selection: {
        languages: ["rust", "typescript"],
        rust: { moduleLayout: "mod-rs" },
        typescript: { moduleLayout: "named-file", codeRepresentation: "class" },
      },
    });
  });
});

for (const rust of ["file", "mod-rs"] as const)
  for (const moduleLayout of ["named-file", "index-file"] as const)
    for (const codeRepresentation of ["class", "companion"] as const)
      test(`three independent validated values for rust=${rust} ts=${moduleLayout}/${codeRepresentation}`, () => {
        expect(
          selectionOf(
            modernDocument({ rust: { moduleLayout: rust }, typescript: { moduleLayout, codeRepresentation } }),
          ),
        ).toEqual({
          languages: ["rust", "typescript"],
          rust: { moduleLayout: rust },
          typescript: { moduleLayout, codeRepresentation },
        });
      });

test("the declared language order does not change the validated value", () => {
  const reversed =
    'schema_version = 2\nlanguages = ["typescript", "rust"]\n\n[rust]\nmodule_layout = "file"\n\n[typescript]\nmodule_layout = "named-file"\ncode_representation = "class"\n';
  expect(selectionOf(reversed)).toEqual(
    selectionOf(
      modernDocument({
        rust: { moduleLayout: "file" },
        typescript: { moduleLayout: "named-file", codeRepresentation: "class" },
      }),
    ),
  );
});

test("reading does not depend on project sources, so no whole-source analysis or production sensor runs", () => {
  const document = modernDocument({ rust: { moduleLayout: "mod-rs" } });
  const hostileSources = {
    "Cargo.toml": '[package]\nname = "billing"\nversion = "0.1.0"\nedition = "2021"\n',
    "src/lib.rs": "mod invoice;\n",
    "src/invoice.rs": "pub struct {\n",
    "src/invoice/line.rs": "pub struct Line;\n",
    "src/orphan.rs": "pub struct Orphan;\n",
  };
  expect(selectionOf(document, hostileSources)).toEqual(selectionOf(document));
});

test("both languages may choose different layouts without being treated as a mixed-mode violation", () => {
  expect(
    selectionOf(
      modernDocument({
        rust: { moduleLayout: "mod-rs" },
        typescript: { moduleLayout: "index-file", codeRepresentation: "class" },
      }),
    ),
  ).toEqual({
    languages: ["rust", "typescript"],
    rust: { moduleLayout: "mod-rs" },
    typescript: { moduleLayout: "index-file", codeRepresentation: "class" },
  });
});

for (const moduleLayout of ["named-file", "index-file"] as const)
  for (const codeRepresentation of ["class", "companion"] as const)
    test(`TypeScript layout and representation do not determine each other from ${moduleLayout}/${codeRepresentation}`, () => {
      const otherLayout: TypeScriptModuleLayout = moduleLayout === "named-file" ? "index-file" : "named-file";
      const otherRepresentation: TypeScriptCodeRepresentation = codeRepresentation === "class" ? "companion" : "class";
      const read = (layout: TypeScriptModuleLayout, representation: TypeScriptCodeRepresentation) =>
        selectionOf(modernDocument({ typescript: { moduleLayout: layout, codeRepresentation: representation } }))
          .typescript;
      expect(read(moduleLayout, codeRepresentation)).toEqual({ moduleLayout, codeRepresentation });
      expect(read(otherLayout, codeRepresentation)).toEqual({ moduleLayout: otherLayout, codeRepresentation });
      expect(read(moduleLayout, otherRepresentation)).toEqual({
        moduleLayout,
        codeRepresentation: otherRepresentation,
      });
    });

test("choosing the companion representation neither reads nor rewrites the aggregate execution model", () => {
  const files = untouchableUserFiles();
  const mapping = "construction/code-generation/ddd-aggregate-mapping.md";
  withWorkspace(
    {
      ".ddd.toml": modernDocument({ typescript: { moduleLayout: "named-file", codeRepresentation: "companion" } }),
      ...files,
    },
    (root) => {
      expect(readProjectSettings(root)).toEqual({
        kind: "validated",
        selection: {
          languages: ["typescript"],
          rust: null,
          typescript: { moduleLayout: "named-file", codeRepresentation: "companion" },
        },
      });
      expect(readFileSync(join(root, mapping), "utf8")).toBe(files[mapping]);
    },
  );
});

interface RejectionCase {
  readonly label: string;
  readonly document: string;
  readonly reason: SettingsRejectionReason;
  readonly subject: string | null;
  readonly missing: readonly string[];
  readonly extra?: Record<string, string>;
}

const REJECTIONS: readonly RejectionCase[] = [
  {
    label: "malformed TOML syntax",
    document: "[",
    reason: "malformed-syntax",
    subject: null,
    missing: [],
  },
  {
    label: "the same key redefined",
    document: 'schema_version = 2\nlanguages = ["rust"]\n\n[rust]\nmodule_layout = "file"\nmodule_layout = "mod-rs"\n',
    reason: "malformed-syntax",
    subject: null,
    missing: [],
  },
  {
    label: "a missing version, with sources present that must not be used to fill it in",
    document: 'languages = ["rust"]\n\n[rust]\nmodule_layout = "file"\n',
    reason: "version-missing",
    subject: null,
    missing: ["schema_version"],
    extra: { "src/lib.rs": "mod invoice;\n", "src/invoice.rs": "pub struct Invoice;\n" },
  },
  {
    label: "an unknown version",
    document: 'schema_version = 3\nlanguages = ["rust"]\n\n[rust]\nmodule_layout = "file"\n',
    reason: "version-unknown",
    subject: "schema_version",
    missing: [],
  },
  {
    label: "a version value of the wrong kind",
    document: 'schema_version = "2"\nlanguages = ["rust"]\n\n[rust]\nmodule_layout = "file"\n',
    reason: "version-unknown",
    subject: "schema_version",
    missing: [],
  },
  {
    label: "an unknown key beside an otherwise valid document",
    document: 'schema_version = 2\nlanguages = ["rust"]\nstrict = true\n\n[rust]\nmodule_layout = "file"\n',
    reason: "unknown-key-or-value",
    subject: "strict",
    missing: [],
  },
  {
    label: "an unknown key inside a language table",
    document: 'schema_version = 2\nlanguages = ["rust"]\n\n[rust]\nmodule_layout = "file"\nstrictness = "high"\n',
    reason: "unknown-key-or-value",
    subject: "rust.strictness",
    missing: [],
  },
  {
    label: "a table for a language that is not in use",
    document:
      'schema_version = 2\nlanguages = ["rust"]\n\n[rust]\nmodule_layout = "file"\n\n[typescript]\nmodule_layout = "named-file"\ncode_representation = "class"\n',
    reason: "unknown-key-or-value",
    subject: "typescript",
    missing: [],
  },
  {
    label: "an unknown value on a known axis",
    document: 'schema_version = 2\nlanguages = ["rust"]\n\n[rust]\nmodule_layout = "auto"\n',
    reason: "unknown-key-or-value",
    subject: "rust.module_layout",
    missing: [],
  },
  {
    label: "a choice axis holding the wrong type",
    document: 'schema_version = 2\nlanguages = ["rust"]\n\n[rust]\nmodule_layout = 1\n',
    reason: "type-mismatch",
    subject: "rust.module_layout",
    missing: [],
  },
  {
    label: "the language list holding the wrong type",
    document: 'schema_version = 2\nlanguages = "rust"\n\n[rust]\nmodule_layout = "file"\n',
    reason: "type-mismatch",
    subject: "languages",
    missing: [],
  },
  {
    label: "a single-element array on a choice axis",
    document: 'schema_version = 2\nlanguages = ["rust"]\n\n[rust]\nmodule_layout = ["file"]\n',
    reason: "type-mismatch",
    subject: "rust.module_layout",
    missing: [],
  },
  {
    label: "no language in use",
    document: "schema_version = 2\nlanguages = []\n",
    reason: "required-choice-missing",
    subject: null,
    missing: ["languages"],
  },
  {
    label: "no language list at all",
    document: "schema_version = 2\n",
    reason: "required-choice-missing",
    subject: null,
    missing: ["languages"],
  },
  {
    label: "a language table that is not a table",
    document: 'schema_version = 2\nlanguages = ["rust"]\nrust = 1\n',
    reason: "type-mismatch",
    subject: "rust",
    missing: [],
  },
  {
    label: "a language in use whose required choice is absent, with sources that must not fill it in",
    document:
      'schema_version = 2\nlanguages = ["rust", "typescript"]\n\n[rust]\nmodule_layout = "file"\n\n[typescript]\nmodule_layout = "named-file"\n',
    reason: "required-choice-missing",
    subject: null,
    missing: ["typescript.code_representation"],
    extra: { "src/model.ts": "export class Model {}\n" },
  },
  {
    label: "two methods on one axis of one language",
    document: 'schema_version = 2\nlanguages = ["rust"]\n\n[rust]\nmodule_layout = ["file", "mod-rs"]\n',
    reason: "duplicate-choice-on-axis",
    subject: "rust.module_layout",
    missing: [],
  },
  {
    label: "the legacy version alone",
    document: legacyDocument(),
    reason: "legacy-modern-mixed",
    subject: null,
    missing: [],
  },
  {
    label: "the legacy version mixed with new keys",
    document: 'schema_version = 1\nlanguages = ["rust"]\n\n[rust]\nmodule_layout = "file"\n',
    reason: "legacy-modern-mixed",
    subject: null,
    missing: [],
  },
  {
    label: "an aggregate execution model leaking into the document",
    document:
      'schema_version = 2\nlanguages = ["rust"]\nprogramming_model = "class"\n\n[rust]\nmodule_layout = "file"\n',
    reason: "aggregate-mapping-leak",
    subject: "programming_model",
    missing: [],
  },
  {
    label: "an aggregate persistence method leaking into a language table",
    document:
      'schema_version = 2\nlanguages = ["typescript"]\n\n[typescript]\nmodule_layout = "named-file"\ncode_representation = "class"\npersistence_method = "event-sourced"\n',
    reason: "aggregate-mapping-leak",
    subject: "typescript.persistence_method",
    missing: [],
  },
];

for (const entry of REJECTIONS)
  test(`rejects ${entry.label}`, () => {
    withWorkspace({ ".ddd.toml": entry.document, ...entry.extra }, (root) => {
      const rejection = expectRejection(readProjectSettings(root), root);
      expect(rejection.reason).toBe(entry.reason);
      expect(rejection.subject).toBe(entry.subject);
      expect(rejection.missing).toEqual(entry.missing);
      expect(rejection.rejectedDocuments).toEqual([]);
      if (rejection.subject !== null) expect(entry.document).toContain(rejection.subject.split(".").at(-1) ?? "");
    });
  });

test("an unknown version and a version value of the wrong kind stay distinguishable", () => {
  const detail = (document: string) =>
    withWorkspace({ ".ddd.toml": document }, (root) => expectRejection(readProjectSettings(root), root).detail);
  expect(detail('schema_version = 3\nlanguages = ["rust"]\n\n[rust]\nmodule_layout = "file"\n')).not.toBe(
    detail('schema_version = "2"\nlanguages = ["rust"]\n\n[rust]\nmodule_layout = "file"\n'),
  );
});

test("rejects an absent document without inventing a source for it", () => {
  withWorkspace({ "src/lib.rs": "mod invoice;\n" }, (root) => {
    const rejection = expectRejection(readProjectSettings(root), root);
    expect(rejection.reason).toBe("file-absent");
    expect(rejection.subject).toBeNull();
    expect(rejection.rejectedDocuments).toEqual([]);
  });
});

test("rejects a document that cannot be read", () => {
  withWorkspace({ "src/lib.rs": "mod invoice;\n" }, (root) => {
    mkdirSync(join(root, ".ddd.toml"));
    const rejection = expectRejection(readProjectSettings(root), root);
    expect(rejection.reason).toBe("unreadable");
    expect(rejection.subject).toBeNull();
  });
});
