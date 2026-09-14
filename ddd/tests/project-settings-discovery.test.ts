import { expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { ProjectSelection } from "../tools/ddd/lib/project-settings/index.ts";
import { readProjectSettings } from "../tools/ddd/lib/project-settings/index.ts";
import { modernDocument, withWorkspace } from "./fixtures/project-settings/workspace.ts";

const ROOT_DOCUMENT = modernDocument({ rust: { moduleLayout: "file" } });
const ROOT_SELECTION: ProjectSelection = { languages: ["rust"], rust: { moduleLayout: "file" }, typescript: null };
const NESTED_DOCUMENT = modernDocument({ rust: { moduleLayout: "mod-rs" } });
const EXCLUDED_DIRECTORIES = ["node_modules", "target", "vendor", "dist", "aidlc"];

test("a nested document inside the searched tree is rejected and named, and the root choice is not adopted", () => {
  const nested = ["packages/billing/.ddd.toml", "packages/billing/deep/nested/.ddd.toml"];
  withWorkspace(
    {
      ".ddd.toml": ROOT_DOCUMENT,
      ...Object.fromEntries(nested.map((path) => [path, NESTED_DOCUMENT])),
    },
    (root) => {
      const outcome = readProjectSettings(root);
      if (outcome.kind !== "rejected") throw new Error(`expected a rejection, received ${JSON.stringify(outcome)}`);
      expect(outcome.rejection.reason).toBe("nested-config-found");
      expect([...outcome.rejection.rejectedDocuments].sort()).toEqual(nested.map((path) => join(root, path)).sort());
    },
  );
});

for (const directory of EXCLUDED_DIRECTORIES)
  test(`a document under ${directory}/ is neither adopted nor reported`, () => {
    withWorkspace(
      {
        ".ddd.toml": ROOT_DOCUMENT,
        [`${directory}/package/.ddd.toml`]: NESTED_DOCUMENT,
        [`${directory}/package/source/.ddd.toml`]: NESTED_DOCUMENT,
      },
      (root) => {
        expect(readProjectSettings(root)).toEqual({ kind: "validated", selection: ROOT_SELECTION });
      },
    );
  });

test("a document under a hidden directory is neither adopted nor reported", () => {
  withWorkspace(
    {
      ".ddd.toml": ROOT_DOCUMENT,
      ".hidden/.ddd.toml": NESTED_DOCUMENT,
      ".git/objects/.ddd.toml": NESTED_DOCUMENT,
    },
    (root) => {
      expect(readProjectSettings(root)).toEqual({ kind: "validated", selection: ROOT_SELECTION });
    },
  );
});

test("a document under a directory outside the exclusion list is still reported", () => {
  withWorkspace({ ".ddd.toml": ROOT_DOCUMENT, "lib/.ddd.toml": NESTED_DOCUMENT }, (root) => {
    const outcome = readProjectSettings(root);
    if (outcome.kind !== "rejected") throw new Error(`expected a rejection, received ${JSON.stringify(outcome)}`);
    expect(outcome.rejection.reason).toBe("nested-config-found");
    expect(outcome.rejection.rejectedDocuments).toEqual([join(root, "lib/.ddd.toml")]);
  });
});

test("a directory that merely carries the document name is not a nested document", () => {
  withWorkspace({ ".ddd.toml": ROOT_DOCUMENT }, (root) => {
    mkdirSync(join(root, "packages/x/.ddd.toml"), { recursive: true });
    expect(readProjectSettings(root)).toEqual({ kind: "validated", selection: ROOT_SELECTION });
  });
});
