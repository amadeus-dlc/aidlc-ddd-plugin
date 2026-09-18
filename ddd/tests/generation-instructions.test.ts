/**
 * The runtime instructions shipped to the agents — knowledge, sensor manifests, stages and
 * contributions — show the DDD artifacts in the format the gates read.
 *
 * Every example block that declares one of those artifacts is read with the reader the gate uses, so
 * an instruction that still teaches a replaced shape — a crate list, a crate beside the business ids,
 * a settings file of the older version — is caught by what that reader refuses, not by searching the
 * prose for spellings. Placeholder values are left to the reader of the instruction; the keys, the
 * containers and the versions are what is checked here.
 */

import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { readMappingDraft } from "../tools/ddd/lib/aggregate-mapping/reader.ts";
import { readLayerDraft } from "../tools/ddd/lib/layer-declaration/reader.ts";
import { validateProjectSettings } from "../tools/ddd/lib/project-settings/settings.ts";
import { MODEL_DATA_FILE } from "../tools/ddd/lib/schema/artifacts.ts";
import { OPERATION_OWNED_SCHEMA_VERSION } from "../tools/ddd/lib/schema/loader.ts";
import { isRecord } from "../tools/ddd/lib/shared/yaml-read.ts";

const PLUGIN_ROOT = join(import.meta.dir, "..");
const RUNTIME_DIRECTORIES = ["knowledge", "sensors", "stages", "contributions"] as const;

type Node = Readonly<Record<string, unknown>>;

interface Example {
  readonly file: string;
  readonly language: "yaml" | "toml";
  readonly root: Node;
}

function markdownFiles(directory: string): string[] {
  const found: string[] = [];
  const visit = (absolute: string): void => {
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      const path = join(absolute, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name.endsWith(".md")) found.push(path);
    }
  };
  visit(join(PLUGIN_ROOT, directory));
  return found.sort();
}

const RUNTIME_FILES = RUNTIME_DIRECTORIES.flatMap(markdownFiles);

interface Partitioned {
  /** Fenced blocks with their info string; a closing fence repeats the opening character at least as often. */
  readonly blocks: { info: string; body: string }[];
  /** Everything outside those blocks: what an instruction states in its own words. */
  readonly prose: string;
}

function partition(text: string): Partitioned {
  const blocks: { info: string; body: string }[] = [];
  const prose: string[] = [];
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index++) {
    const opening = /^(`{3,}|~{3,})(.*)$/.exec(lines[index]);
    if (opening === null) {
      prose.push(lines[index]);
      continue;
    }
    const [marker, info] = [opening[1], opening[2]];
    const closing = new RegExp(`^\\${marker[0]}{${marker.length},}\\s*$`);
    const body: string[] = [];
    let end = index + 1;
    while (end < lines.length && !closing.test(lines[end])) body.push(lines[end++]);
    blocks.push({ info: info.trim(), body: body.join("\n") });
    index = end;
  }
  return { blocks, prose: prose.join("\n") };
}

/** Every YAML and TOML example in the runtime instructions, parsed; one that does not parse fails here. */
function examples(): Example[] {
  const found: Example[] = [];
  for (const path of RUNTIME_FILES) {
    const file = relative(PLUGIN_ROOT, path);
    for (const block of partition(readFileSync(path, "utf8")).blocks) {
      const language = block.info === "toml" ? "toml" : block.info === "yaml" || block.info === "yml" ? "yaml" : null;
      if (language === null) continue;
      let root: unknown;
      try {
        root = language === "toml" ? Bun.TOML.parse(block.body) : Bun.YAML.parse(block.body);
      } catch (error) {
        throw new Error(`${file}: a ${language} example does not parse: ${String(error)}`);
      }
      if (isRecord(root)) found.push({ file, language, root });
    }
  }
  return found;
}

const EXAMPLES = examples();

function examplesDeclaring(key: string): Example[] {
  return EXAMPLES.filter((example) => example.language === "yaml" && Object.hasOwn(example.root, key));
}

function records(value: unknown): Node[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function hasKeys(value: unknown, keys: readonly string[]): boolean {
  return isRecord(value) && keys.every((key) => Object.hasOwn(value, key));
}

function field(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

/** The messages of what a draft reader refused as keys the format does not have. */
function unknownKeyFindings(read: { kind: string; findings?: readonly { rule_id: string; message: string }[] }) {
  return (read.findings ?? []).filter((entry) => entry.rule_id.endsWith(".unknown-key")).map((entry) => entry.message);
}

// ---------------------------------------------------------------------------
// Implementation mapping
// ---------------------------------------------------------------------------

test("the instructions show an implementation mapping example", () => {
  expect(examplesDeclaring("aggregate_mappings").length).toBeGreaterThan(0);
});

for (const example of examplesDeclaring("aggregate_mappings")) {
  test(`${example.file}: the mapping example has the language-neutral version and no key outside that format`, () => {
    expect(example.root.schema_version).toBe(2);
    expect(unknownKeyFindings(readMappingDraft(example.root, example.file))).toEqual([]);
  });

  test(`${example.file}: the mapping example places code, operations, error cases and replay methods under their own entries`, () => {
    const aggregates = records(example.root.aggregate_mappings);
    expect(aggregates.length).toBeGreaterThan(0);
    for (const aggregate of aggregates) {
      expect(hasKeys(aggregate.code, ["language", "package", "module", "type"])).toBe(true);
      expect(Array.isArray(field(aggregate.code, "module"))).toBe(true);
      expect(Array.isArray(aggregate.operations)).toBe(true);
    }
    const operations = aggregates.flatMap((aggregate) => records(aggregate.operations));
    expect(operations.length).toBeGreaterThan(0);
    for (const operation of operations) {
      expect(hasKeys(operation, ["operation_ref", "code", "errors"])).toBe(true);
      expect(hasKeys(operation.code, ["method", "error_type"])).toBe(true);
    }
    const errors = operations.flatMap((operation) => records(operation.errors));
    expect(errors.length).toBeGreaterThan(0);
    for (const error of errors) expect(hasKeys(error.code, ["case"]) && hasKeys(error, ["error_ref"])).toBe(true);
    const replays = aggregates.flatMap((aggregate) => records(aggregate.replay_methods));
    expect(replays.length).toBeGreaterThan(0);
    for (const replay of replays) expect(hasKeys(replay, ["event_ref"]) && hasKeys(replay.code, ["method"])).toBe(true);
  });

  test(`${example.file}: the mapping example declares its root package with an empty module path`, () => {
    const packages = records(example.root.domain_packages);
    for (const entry of packages) {
      expect(hasKeys(entry, ["term", "model_refs", "rationale", "code"])).toBe(true);
      expect(hasKeys(entry.code, ["language", "package", "module"])).toBe(true);
    }
    const modules = packages.map((entry) => field(entry.code, "module"));
    expect(modules.some((module) => Array.isArray(module) && module.length === 0)).toBe(true);
  });

  test(`${example.file}: the mapping example places code in Rust, the only language generated and inspected today`, () => {
    const locations = [
      ...records(example.root.aggregate_mappings).map((aggregate) => aggregate.code),
      ...records(example.root.domain_packages).map((entry) => entry.code),
    ];
    expect(locations.length).toBeGreaterThan(0);
    for (const location of locations) expect(field(location, "language")).toBe("rust");
  });
}

// ---------------------------------------------------------------------------
// Layer declaration
// ---------------------------------------------------------------------------

test("the instructions show a layer declaration example", () => {
  expect(examplesDeclaring("layer_structures").length).toBeGreaterThan(0);
});

for (const example of examplesDeclaring("layer_structures")) {
  test(`${example.file}: the layer example has the language-neutral version and no key outside that format`, () => {
    expect(example.root.schema_version).toBe(2);
    expect(unknownKeyFindings(readLayerDraft(example.root, example.file))).toEqual([]);
  });

  test(`${example.file}: the layer example names packages and dependency rows by language and package`, () => {
    const structures = records(example.root.layer_structures);
    expect(structures.length).toBeGreaterThan(0);
    const packages = structures.flatMap((structure) => records(structure.packages));
    const rows = structures.flatMap((structure) => records(structure.dependencies));
    expect(packages.length).toBeGreaterThan(0);
    expect(rows.length).toBeGreaterThan(0);
    for (const entry of packages) {
      expect(hasKeys(entry, ["role", "code"])).toBe(true);
      expect(hasKeys(entry.code, ["language", "package"])).toBe(true);
    }
    for (const row of rows) {
      expect(hasKeys(row.code, ["language", "package"]) && Array.isArray(row.depends_on)).toBe(true);
      for (const target of records(row.depends_on)) expect(hasKeys(target, ["language", "package"])).toBe(true);
    }
    for (const identity of [...packages.map((entry) => entry.code), ...rows.map((row) => row.code)])
      expect(field(identity, "language")).toBe("rust");
  });
}

// ---------------------------------------------------------------------------
// Canonical model and project settings
// ---------------------------------------------------------------------------

/**
 * The canonical model is described in prose rather than shown as an example block, so the version
 * the instruction names is checked directly: an agent told to write a version the model reader
 * refuses writes a model its own gate then blocks.
 *
 * Only prose is read. A version inside a fenced block belongs to the artifact that block declares —
 * the use-case declarations keep their own, which no language spells and which never changed — and
 * those blocks are already read above with the reader that owns each of them.
 */
test("every version the instructions state for the canonical model is the one its reader requires", () => {
  const stated = RUNTIME_FILES.flatMap((path) => {
    const text = readFileSync(path, "utf8");
    if (!text.includes(MODEL_DATA_FILE)) return [];
    return [...partition(text).prose.matchAll(/schema_version\s*[:=]\s*(\d+)/g)].map(
      (match) => [relative(PLUGIN_ROOT, path), Number(match[1])] as const,
    );
  });
  expect(stated.length).toBeGreaterThan(0);
  for (const [file, version] of stated)
    expect({ file, version }).toEqual({ file, version: OPERATION_OWNED_SCHEMA_VERSION });
});

test("every project settings example is a valid language-neutral settings file", () => {
  const settings = EXAMPLES.filter(
    (example) => example.language === "toml" && Object.hasOwn(example.root, "schema_version"),
  );
  expect(settings.length).toBeGreaterThan(0);
  for (const example of settings) {
    const validated = validateProjectSettings({ ...example.root }, example.file);
    expect({ file: example.file, kind: validated.kind }).toEqual({ file: example.file, kind: "validated" });
    if (validated.kind === "validated") expect(validated.selection.languages).toContain("rust");
  }
});

// ---------------------------------------------------------------------------
// Language of the runtime instructions
// ---------------------------------------------------------------------------

test("the runtime instructions are written in English", () => {
  const japanese = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;
  const lines = RUNTIME_FILES.flatMap((path) =>
    readFileSync(path, "utf8")
      .split("\n")
      .flatMap((line, index) => (japanese.test(line) ? [`${relative(PLUGIN_ROOT, path)}:${index + 1}`] : [])),
  );
  expect(lines).toEqual([]);
});
