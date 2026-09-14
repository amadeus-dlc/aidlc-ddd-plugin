import { expect, test } from "bun:test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
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

// Dropping read permission is the only way to make the search fail, and it does nothing for a
// superuser, whose open succeeds regardless. Skipping there keeps the test honest: it either
// observes the refusal or does not run at all.
const RUNNING_AS_SUPERUSER = process.getuid?.() === 0;

test.skipIf(RUNNING_AS_SUPERUSER)("a directory the search cannot list refuses the read instead of throwing", () => {
  withWorkspace({ ".ddd.toml": ROOT_DOCUMENT }, (root) => {
    const sealed = join(root, "packages");
    mkdirSync(sealed, { recursive: true });
    chmodSync(sealed, 0o000);
    try {
      const outcome = readProjectSettings(root);
      if (outcome.kind !== "rejected") throw new Error(`expected a rejection, received ${JSON.stringify(outcome)}`);
      expect(outcome.rejection.reason).toBe("unreadable");
      expect(outcome.rejection.detail).toContain(sealed);
    } finally {
      // Restore before the fixture removes the tree, or the cleanup inherits the same refusal.
      chmodSync(sealed, 0o755);
    }
  });
});

test.skipIf(RUNNING_AS_SUPERUSER)(
  "an unlistable directory is refused rather than treated as holding no document",
  () => {
    withWorkspace({ ".ddd.toml": ROOT_DOCUMENT }, (root) => {
      const sealed = join(root, "packages");
      mkdirSync(join(sealed, "billing"), { recursive: true });
      // A nested document the search would have reported, placed where the search cannot reach it.
      writeFileSync(join(sealed, "billing/.ddd.toml"), NESTED_DOCUMENT);
      chmodSync(sealed, 0o000);
      try {
        const outcome = readProjectSettings(root);
        expect(outcome.kind).toBe("rejected");
        if (outcome.kind === "rejected") expect(outcome.rejection.reason).toBe("unreadable");
      } finally {
        chmodSync(sealed, 0o755);
      }
    });
  },
);
