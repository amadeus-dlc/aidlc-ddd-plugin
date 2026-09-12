import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const pluginRoot = join(import.meta.dir, "..");

/** FR11.1 fixes the contributed faces: exactly these five, none added, none missing. */
const CONTRIBUTES: Record<string, string> = {
  stages: "stages/",
  overlays: "contributions/",
  sensors: "sensors/",
  knowledge: "knowledge/",
  tools: "tools/",
};

/** FR11.2 keeps logical artifact names in a flat namespace behind the `ddd-` prefix. */
const LOGICAL_NAME_PREFIX = "ddd-";

/** FR11.3 requires these four scripts; `check` bundles three of them in this order. */
const REQUIRED_SCRIPTS = ["validate", "build:claude", "build:codex", "check"];
const CHECK_STEPS = ["bun run check:biome", "bun run validate", "bun run test"];

/** FR11.5 forbids relying on these: `adds.required_sections` is not enforced and `adds.requires_stage` is deferred. */
const UNIMPLEMENTED_ADD_KEYS = ["requires_stage", "required_sections"];

type PluginManifest = {
  name: string;
  version: string;
  dependencies: string[];
  aidlc: { contributes: Record<string, string> };
};

const plugin = JSON.parse(readFileSync(join(pluginRoot, ".aidlc-plugin/plugin.json"), "utf8")) as PluginManifest;
const manifest = JSON.parse(readFileSync(join(pluginRoot, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

/** Every file under a contributed face, as a path relative to the plugin root. */
function walk(relativeDir: string): string[] {
  const found: string[] = [];
  const visit = (absoluteDir: string): void => {
    for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
      const absolute = join(absoluteDir, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) found.push(absolute.slice(pluginRoot.length + 1));
    }
  };
  visit(join(pluginRoot, relativeDir));
  return found;
}

function markdownFiles(relativeDir: string): string[] {
  return walk(relativeDir).filter((path) => path.endsWith(".md"));
}

function readText(relativePath: string): string {
  return readFileSync(join(pluginRoot, relativePath), "utf8");
}

function frontmatterOf(relativePath: string): string {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(readText(relativePath));
  if (match === null) throw new Error(`${relativePath} declares no frontmatter`);
  return match[1];
}

/** The scalar `- value` items sitting directly under a key path, ignoring nested mappings. */
function valuesUnder(frontmatter: string, keyPath: string[]): string[] {
  const values: string[] = [];
  const trail: { indent: number; key: string }[] = [];
  let collecting = false;
  let collectIndent = -1;
  for (const line of frontmatter.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const indent = line.length - line.trimStart().length;
    if (trimmed.startsWith("- ")) {
      if (collecting && indent > collectIndent) values.push(trimmed.slice(2).trim());
      continue;
    }
    const separator = trimmed.indexOf(":");
    if (separator === -1) continue;
    while (trail.length > 0 && trail[trail.length - 1].indent >= indent) trail.pop();
    trail.push({ indent, key: trimmed.slice(0, separator).trim() });
    collecting = trail.length === keyPath.length && trail.every((node, index) => node.key === keyPath[index]);
    if (collecting) collectIndent = indent;
  }
  return values;
}

/** The mapping keys sitting directly under a key path; an empty path means top-level keys. */
function keysUnder(frontmatter: string, keyPath: string[]): string[] {
  const keys: string[] = [];
  const trail: { indent: number; key: string }[] = [];
  for (const line of frontmatter.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("- ")) continue;
    const separator = trimmed.indexOf(":");
    if (separator === -1) continue;
    const indent = line.length - line.trimStart().length;
    while (trail.length > 0 && trail[trail.length - 1].indent >= indent) trail.pop();
    trail.push({ indent, key: trimmed.slice(0, separator).trim() });
    if (trail.length !== keyPath.length + 1) continue;
    if (keyPath.every((key, index) => trail[index].key === key)) keys.push(trail[trail.length - 1].key);
  }
  return keys;
}

describe("plugin scaffold", () => {
  test("FR11.1: contributes declares exactly the five faces, with no agents and no scopes", () => {
    expect(plugin.aidlc.contributes).toEqual(CONTRIBUTES);

    const declared = new Set<string>();
    const collect = (value: unknown): void => {
      if (Array.isArray(value)) {
        for (const item of value) collect(item);
        return;
      }
      if (typeof value !== "object" || value === null) return;
      for (const [key, child] of Object.entries(value)) {
        declared.add(key);
        collect(child);
      }
    };
    collect(plugin);

    expect(declared.has("agents")).toBe(false);
    expect(declared.has("scopes")).toBe(false);
  });

  test("FR11.1: every contributed face is a directory that exists and holds at least one file", () => {
    for (const [face, relativeDir] of Object.entries(plugin.aidlc.contributes)) {
      const absolute = join(pluginRoot, relativeDir);
      expect({ face, isDirectory: existsSync(absolute) && statSync(absolute).isDirectory() }).toEqual({
        face,
        isDirectory: true,
      });
      expect({ face, holdsFiles: walk(relativeDir).length > 0 }).toEqual({ face, holdsFiles: true });
    }
  });

  test("FR11.2: stage files sit under stages/ with the ddd- prefix", () => {
    const stages = markdownFiles("stages");
    expect(stages.length).toBeGreaterThan(0);
    for (const path of stages) {
      const name = path.slice(path.lastIndexOf("/") + 1);
      expect({ path, prefixed: name.startsWith(LOGICAL_NAME_PREFIX) }).toEqual({ path, prefixed: true });
    }
  });

  test("FR11.3: package.json wires the four scripts and check runs its three stages in order", () => {
    for (const name of REQUIRED_SCRIPTS) {
      expect({ name, present: typeof manifest.scripts[name] === "string" }).toEqual({ name, present: true });
    }

    expect(manifest.scripts.check.split("&&").map((step) => step.trim())).toEqual(CHECK_STEPS);
    expect(manifest.scripts.validate).toContain("aidlc-plugin-validate.ts");
    expect(manifest.scripts["build:claude"].trimEnd().endsWith("claude")).toBe(true);
    expect(manifest.scripts["build:codex"].trimEnd().endsWith("codex")).toBe(true);
  });

  test("FR11.2: logical artifact names produced by stages and contributions are prefixed", () => {
    const fromStages = markdownFiles("stages").flatMap((path) => valuesUnder(frontmatterOf(path), ["produces"]));
    const fromContributions = markdownFiles("contributions").flatMap((path) =>
      valuesUnder(frontmatterOf(path), ["adds", "produces"]),
    );

    expect(fromStages.length).toBeGreaterThan(0);
    expect(fromContributions.length).toBeGreaterThan(0);
    for (const name of [...fromStages, ...fromContributions]) {
      expect({ name, prefixed: name.startsWith(LOGICAL_NAME_PREFIX) }).toEqual({ name, prefixed: true });
    }
  });

  test("FR11.5: the scaffold declares nothing on mechanisms the framework has not implemented", () => {
    const declaring = [...markdownFiles("stages"), ...markdownFiles("contributions")];
    expect(declaring.length).toBeGreaterThan(0);

    for (const path of declaring) {
      const frontmatter = frontmatterOf(path);

      // A stage file may gate on the implemented `requires_stage`; a contribution may not,
      // because `adds.requires_stage` / `adds.required_sections` are deferred or unenforced.
      const unsupported = keysUnder(frontmatter, ["adds"]).filter((key) => UNIMPLEMENTED_ADD_KEYS.includes(key));
      expect({ path, unsupported }).toEqual({ path, unsupported: [] });

      // Conditional execution is declared with `condition:`, never with a `when:` key.
      expect({ path, conditional: keysUnder(frontmatter, []).includes("when") }).toEqual({ path, conditional: false });

      const text = readText(path);
      for (const token of ["after-questions", "required_sections", "memory/"]) {
        expect({ path, token, used: text.includes(token) }).toEqual({ path, token, used: false });
      }
    }

    // `dependencies` names plugins without pinning versions.
    for (const dependency of plugin.dependencies) {
      expect({ dependency, bare: /^[a-z][a-z0-9-]*$/.test(dependency) }).toEqual({ dependency, bare: true });
    }
  });
});
