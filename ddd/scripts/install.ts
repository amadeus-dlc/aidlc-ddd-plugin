#!/usr/bin/env bun

// install.ts — one-command installer for the ddd plugin.
//
// Builds the harness projection using the destination's standard AI-DLC tools
// and applies it through the compose hook shipped with that projection.
//
// Usage: bun ddd/scripts/install.ts --project <path>
//        [--harness claude] [--dry-run] [--skip-build]

import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const USAGE =
  "Usage: bun ddd/scripts/install.ts --project <path> [--harness <name>] [--from <repo-root> | --ref <branch> | --tag <tag>] [--update] [--dry-run] [--skip-build]";

const REPOSITORY = "amadeus-dlc/aidlc-ddd-plugin";
const PLUGIN_NAME = "ddd";
const PROVENANCE_FILE = "ddd-install.json";

export type SourceKind = "local" | "ref" | "tag" | "latest";

export interface InstallationProvenance {
  readonly version: string;
  readonly ref: string;
  readonly source: SourceKind;
  readonly installed_at: string;
  readonly payload_sha256: string;
  readonly projection_sha256?: string;
  readonly owned_files?: Readonly<Record<string, string>>;
}

interface ResolvedSource {
  readonly pluginRoot: string;
  readonly source: SourceKind;
  readonly ref: string;
  readonly requestedTag: string | null;
  readonly cleanupRoot: string | null;
}

interface Manifest {
  readonly name?: unknown;
  readonly version?: unknown;
}

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export function parseStableSemver(value: string): readonly [number, number, number] | null {
  const match = value.match(/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

export function latestStableTag(tags: readonly string[]): string | null {
  return (
    tags
      .map((tag) => ({ tag, parsed: parseStableSemver(tag) }))
      .filter((entry): entry is { tag: string; parsed: readonly [number, number, number] } => entry.parsed !== null)
      .sort((a, b) => {
        for (let i = 0; i < 3; i++) {
          const difference = b.parsed[i] - a.parsed[i];
          if (difference !== 0) return difference;
        }
        return a.tag.localeCompare(b.tag);
      })[0]?.tag ?? null
  );
}

export function selectSourceSelector(input: { readonly from?: string; readonly ref?: string; readonly tag?: string }): {
  readonly kind: SourceKind;
  readonly value: string;
} {
  if (input.from) return { kind: "local", value: input.from };
  if (input.ref) return { kind: "ref", value: input.ref };
  if (input.tag) return { kind: "tag", value: input.tag };
  return { kind: "latest", value: "" };
}

export function canonicalPayloadSha256(
  entries: readonly { readonly path: string; readonly bytes: Uint8Array }[],
): string {
  const digest = createHash("sha256");
  for (const entry of [...entries].sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)))) {
    digest.update(entry.path);
    digest.update("\0");
    digest.update(entry.bytes);
    digest.update("\0");
  }
  return `sha256:${digest.digest("hex")}`;
}

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

function tarText(bytes: Uint8Array, start: number, length: number): string {
  const end = bytes.subarray(start, start + length).indexOf(0);
  return new TextDecoder().decode(bytes.subarray(start, start + (end < 0 ? length : end))).trim();
}

export function extractTarGz(archive: Uint8Array, destination: string): void {
  const bytes = Bun.gunzipSync(archive.slice().buffer as ArrayBuffer);
  mkdirSync(destination, { recursive: true });
  for (let offset = 0; offset + 512 <= bytes.length; ) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = tarText(header, 0, 100);
    const prefix = tarText(header, 345, 155);
    const entryName = prefix ? `${prefix}/${name}` : name;
    const sizeText = tarText(header, 124, 12);
    const size = Number.parseInt(sizeText || "0", 8);
    if (!Number.isSafeInteger(size) || size < 0) throw new Error(`invalid tar size for ${entryName}`);
    if (!entryName || entryName.startsWith("/") || entryName.split("/").includes("..")) {
      throw new Error(`unsafe archive path: ${entryName || "<empty>"}`);
    }
    const target = resolve(destination, entryName);
    if (!isInside(destination, target)) throw new Error(`archive entry escapes extraction root: ${entryName}`);
    const type = String.fromCharCode(header[156] ?? 0);
    const bodyStart = offset + 512;
    const bodyEnd = bodyStart + size;
    if (bodyEnd > bytes.length) throw new Error(`truncated tar entry: ${entryName}`);
    if (type === "2" || type === "1") {
      throw new Error(`archive links are not allowed: ${entryName}`);
    }
    if (type === "5") {
      mkdirSync(target, { recursive: true });
    } else if (type === "0" || type === "\0" || type === "") {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes.subarray(bodyStart, bodyEnd));
    } else if (type !== "x" && type !== "g" && type !== "L") {
      throw new Error(`unsupported tar entry type ${JSON.stringify(type)}: ${entryName}`);
    }
    offset = bodyStart + Math.ceil(size / 512) * 512;
  }
}

function findPluginRoot(root: string): string | null {
  const visit = (directory: string): string | null => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const child = join(directory, entry.name);
      if (entry.name === PLUGIN_NAME && existsSync(join(child, ".aidlc-plugin", "plugin.json"))) return child;
      const nested = visit(child);
      if (nested) return nested;
    }
    return null;
  };
  return visit(root);
}

async function fetchBytes(url: string, fetcher: Fetcher): Promise<Uint8Array> {
  const response = await fetcher(url, { headers: { "User-Agent": "ddd-installer" } });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

export async function resolveLatestTag(fetcher: Fetcher = fetch): Promise<string> {
  const response = await fetcher(`https://api.github.com/repos/${REPOSITORY}/tags?per_page=100`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "ddd-installer" },
  });
  if (!response.ok) throw new Error(`GitHub tags API returned HTTP ${response.status}`);
  const body = (await response.json()) as unknown;
  if (!Array.isArray(body)) throw new Error("GitHub tags API returned an invalid document");
  const names = body.flatMap((entry) =>
    entry && typeof entry === "object" && typeof (entry as { name?: unknown }).name === "string"
      ? [(entry as { name: string }).name]
      : [],
  );
  if (names.length === 0) throw new Error("GitHub tags API returned no tags");
  const tag = latestStableTag(names);
  if (!tag) throw new Error("GitHub repository has no stable Semantic Versioning tag");
  return tag;
}

export async function acquireRemote(
  kind: "ref" | "tag" | "latest",
  requested: string,
  fetcher: Fetcher = fetch,
): Promise<ResolvedSource> {
  const resolvedRef = kind === "latest" ? await resolveLatestTag(fetcher) : requested;
  const namespace = kind === "ref" ? "heads" : "tags";
  const url = `https://codeload.github.com/${REPOSITORY}/tar.gz/refs/${namespace}/${encodeURIComponent(resolvedRef)}`;
  const cleanupRoot = mkdtempSync(join(tmpdir(), "ddd-source-"));
  try {
    extractTarGz(await fetchBytes(url, fetcher), cleanupRoot);
    const pluginRoot = findPluginRoot(cleanupRoot);
    if (!pluginRoot) throw new Error(`archive does not contain ${PLUGIN_NAME}/.aidlc-plugin/plugin.json`);
    return {
      pluginRoot,
      source: kind,
      ref: resolvedRef,
      requestedTag: kind === "ref" ? null : resolvedRef,
      cleanupRoot,
    };
  } catch (error) {
    rmSync(cleanupRoot, { recursive: true, force: true });
    throw error;
  }
}

export function acquireLocal(repoRoot: string): ResolvedSource {
  const root = resolve(repoRoot);
  if (existsSync(join(root, ".aidlc-plugin", "plugin.json"))) {
    throw new Error(
      `--from expects a repository root containing ${PLUGIN_NAME}/; the plugin root itself was provided: ${root}`,
    );
  }
  const pluginRoot = join(root, PLUGIN_NAME);
  if (!existsSync(join(pluginRoot, ".aidlc-plugin", "plugin.json"))) {
    throw new Error(`--from expects a repository root with ${PLUGIN_NAME}/.aidlc-plugin/plugin.json: ${root}`);
  }
  return { pluginRoot, source: "local", ref: root, requestedTag: null, cleanupRoot: null };
}

export function validateManifest(source: ResolvedSource): { manifest: Manifest; version: string } {
  const path = join(source.pluginRoot, ".aidlc-plugin", "plugin.json");
  let manifest: Manifest;
  try {
    manifest = JSON.parse(readFileSync(path, "utf-8")) as Manifest;
  } catch (error) {
    throw new Error(`cannot read plugin manifest ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (manifest.name !== PLUGIN_NAME) throw new Error(`plugin manifest name must be ${PLUGIN_NAME}`);
  if (typeof manifest.version !== "string" || !parseStableSemver(manifest.version)) {
    throw new Error("plugin manifest version must be a stable Semantic Version");
  }
  if (source.requestedTag && source.requestedTag.replace(/^v/, "") !== manifest.version) {
    throw new Error(`tag ${source.requestedTag} does not match manifest version ${manifest.version}`);
  }
  return { manifest, version: manifest.version };
}

interface PluginTarget {
  harnessName: string;
  harnessLeaf: string;
  kind: "store";
}

function fail(message: string): never {
  console.error(`install: ${message}`);
  process.exit(1);
}

function run(label: string, command: string[], options: { cwd?: string; env?: Record<string, string> } = {}): void {
  console.log(`\n▸ ${label}`);
  const result = spawnSync(command[0], command.slice(1), {
    stdio: "inherit",
    cwd: options.cwd,
    env: options.env ? { ...process.env, ...options.env } : process.env,
  });
  if (result.error) fail(`${label} failed: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} exited with status ${result.status}`);
}

function fileHash(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}
function ownedPayloadPath(path: string): boolean {
  if (
    !path ||
    isAbsolute(path) ||
    path.includes("\\") ||
    path.split("/").some((part) => part === ".." || part === "." || part === "")
  )
    return false;
  if (path.startsWith("tools/ddd/")) return true;
  const parts = path.split("/");
  const name = parts[parts.length - 1];
  return (
    ["tools", "sensors", "knowledge", "agents", "scopes", "aidlc-common"].includes(parts[0]) &&
    (name.startsWith("ddd-") || name.startsWith("aidlc-ddd-"))
  );
}

class CommitFailure extends Error {
  constructor(
    message: string,
    readonly recoveryRequired: boolean,
  ) {
    super(message);
  }
}
interface FileImage {
  bytes: Buffer;
  mode: number;
}
function treeFiles(root: string): Map<string, FileImage> {
  const files = new Map<string, FileImage>();
  function visit(directory: string): void {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, item.name);
      if (item.isSymbolicLink()) throw new Error(`linked candidate path is not supported: ${path}`);
      if (item.isDirectory()) visit(path);
      else if (item.isFile())
        files.set(relative(root, path), { bytes: readFileSync(path), mode: lstatSync(path).mode & 0o777 });
      else throw new Error(`unsupported candidate file: ${path}`);
    }
  }
  visit(root);
  return files;
}
function sameFile(a: FileImage | undefined, b: FileImage | undefined): boolean {
  return a === undefined ? b === undefined : b !== undefined && a.mode === b.mode && a.bytes.equals(b.bytes);
}
function unlinkedPath(root: string, path: string): void {
  if (!isInside(root, path)) throw new Error(`path escapes destination: ${path}`);
  let current = root;
  for (const part of ["", ...relative(root, path).split(sep)]) {
    current = join(current, part);
    const info = lstatSync(current, { throwIfNoEntry: false });
    if (info?.isSymbolicLink()) throw new Error(`refusing to modify a linked path: ${current}`);
  }
}
function atomicFile(path: string, value: FileImage): void {
  const temporary = `${path}.ddd-${randomUUID()}`;
  try {
    writeFileSync(temporary, value.bytes, { flag: "wx", mode: value.mode });
    chmodSync(temporary, value.mode);
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}
function applyCandidate(
  destination: string,
  before: Map<string, FileImage>,
  after: Map<string, FileImage>,
  roots: string[],
  transactionRoot: string,
): void {
  const changes = [...new Set([...before.keys(), ...after.keys()])]
    .filter((path) => !sameFile(before.get(path), after.get(path)))
    .sort();
  const backups = join(transactionRoot, "rollback");
  for (const path of changes) {
    if (!roots.some((root) => path === root || path.startsWith(`${root}${sep}`)))
      throw new Error(`compose wrote outside managed roots: ${path}`);
    const target = join(destination, path);
    unlinkedPath(destination, target);
    const info = lstatSync(target, { throwIfNoEntry: false });
    if (info && !info.isFile()) throw new Error(`destination is not a regular file: ${path}`);
    const current = info ? { bytes: readFileSync(target), mode: info.mode & 0o777 } : undefined;
    if (!sameFile(current, before.get(path))) throw new Error(`destination changed during installation: ${path}`);
    const previous = before.get(path);
    if (previous) {
      const backup = join(backups, path);
      mkdirSync(dirname(backup), { recursive: true });
      writeFileSync(backup, previous.bytes, { mode: previous.mode });
    }
  }
  const applied: string[] = [];
  const createdDirectories: string[] = [];
  try {
    for (const path of changes) {
      const target = join(destination, path);
      unlinkedPath(destination, target);
      const parents: string[] = [];
      for (let dir = dirname(target); !existsSync(dir); dir = dirname(dir)) parents.push(dir);
      for (const dir of parents.reverse()) {
        mkdirSync(dir);
        createdDirectories.push(dir);
      }
      applied.push(path);
      const value = after.get(path);
      if (value) atomicFile(target, value);
      else rmSync(target);
    }
  } catch (error) {
    const failures: string[] = [];
    for (const path of applied.reverse()) {
      try {
        const target = join(destination, path);
        unlinkedPath(destination, target);
        const previous = before.get(path);
        if (previous) atomicFile(target, previous);
        else rmSync(target, { force: true });
      } catch {
        failures.push(path);
      }
    }
    for (const dir of createdDirectories.reverse()) {
      try {
        rmdirSync(dir);
      } catch {
        /* retain nonempty directories */
      }
    }
    throw new CommitFailure(
      `${error instanceof Error ? error.message : String(error)}${failures.length ? `; rollback failed for ${failures.join(", ")}` : "; destination files restored"}`,
      failures.length > 0,
    );
  }
}

// ---- arguments --------------------------------------------------------------

if (import.meta.main) {
  let projectArg = "";
  let harness = "claude";
  let dryRun = false;
  let skipBuild = false;
  let fromArg = "";
  let refArg = "";
  let tagArg = "";
  let update = false;

  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--project") projectArg = args[++i] ?? "";
    else if (arg === "--harness") harness = args[++i] ?? "";
    else if (arg === "--from") fromArg = args[++i] ?? "";
    else if (arg === "--ref") refArg = args[++i] ?? "";
    else if (arg === "--tag") tagArg = args[++i] ?? "";
    else if (arg === "--update") update = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--skip-build") skipBuild = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(USAGE);
      process.exit(0);
    } else fail(`unknown argument "${arg}"\n${USAGE}`);
  }
  if (!projectArg) fail(`--project is required\n${USAGE}`);
  if ([fromArg, refArg, tagArg].filter(Boolean).length > 1)
    fail("choose only one source selector: --from, --ref, or --tag");

  // ---- workspace layout -------------------------------------------------------

  let projectDir = resolve(projectArg);
  if (!existsSync(projectDir)) fail(`project not found: ${projectDir}`);
  const harnessLeaves: Readonly<Record<string, string>> = { claude: ".claude", codex: ".codex" };
  const expectedLeaf = harnessLeaves[harness];
  if (!expectedLeaf) fail(`unsupported harness "${harness}" — supported: claude, codex`);
  const toolsDir = join(projectDir, expectedLeaf, "tools");
  const builderPath = join(toolsDir, "aidlc-plugin-build.ts");
  const pluginTestPath = join(toolsDir, "aidlc-plugin-test.ts");
  const targetsPath = join(toolsDir, "data", "plugin-targets.json");
  if (!existsSync(builderPath) || !existsSync(pluginTestPath) || !existsSync(targetsPath)) {
    fail(
      `AI-DLC plugin toolchain is missing under ${toolsDir} — install AI-DLC for the ` +
        `"${harness}" harness first, then re-run this installer`,
    );
  }
  const targets = JSON.parse(readFileSync(targetsPath, "utf-8")) as Record<string, PluginTarget>;
  const target = targets[harness];
  if (!target || target.harnessLeaf !== expectedLeaf || target.kind !== "store" || target.harnessName !== harness) {
    fail(`installed AI-DLC target metadata is incompatible with ${harness}`);
  }

  if (!existsSync(join(projectDir, target.harnessLeaf))) {
    fail(
      `${projectDir} has no ${target.harnessLeaf}/ — install AI-DLC v2 for the ` +
        `"${harness}" harness there first (see aidlc-workflows dist/${harness}/)`,
    );
  }

  let provenancePath = join(projectDir, target.harnessLeaf, "tools", "data", PROVENANCE_FILE);

  function readProvenance(): InstallationProvenance | null {
    if (!existsSync(provenancePath)) return null;
    try {
      const value = JSON.parse(readFileSync(provenancePath, "utf-8")) as InstallationProvenance;
      if (
        typeof value.version !== "string" ||
        typeof value.ref !== "string" ||
        !["local", "ref", "tag", "latest"].includes(value.source) ||
        typeof value.installed_at !== "string" ||
        !/^sha256:[0-9a-f]{64}$/.test(value.payload_sha256) ||
        (value.owned_files !== undefined &&
          (typeof value.owned_files !== "object" ||
            value.owned_files === null ||
            Array.isArray(value.owned_files) ||
            Object.entries(value.owned_files).some(
              ([path, hash]) =>
                !ownedPayloadPath(path) || typeof hash !== "string" || !/^sha256:[0-9a-f]{64}$/.test(hash),
            )))
      )
        return null;
      return value;
    } catch {
      return null;
    }
  }

  const existingProvenance = readProvenance();
  if (update && (fromArg || refArg || tagArg)) fail("--update cannot be combined with --from, --ref, or --tag");
  if (update && !existingProvenance) {
    fail("--update requires installation provenance; run a normal install with --from, --ref, --tag, or latest first");
  }
  if (update && existingProvenance?.source === "tag") {
    const owned = existingProvenance.owned_files;
    if (!owned || Object.keys(owned).length === 0)
      fail("fixed-tag installation has no file ownership receipt; reinstall that tag to verify it");
    for (const [path, expectedHash] of Object.entries(owned)) {
      const file = join(projectDir, target.harnessLeaf, ...path.split("/"));
      if (!existsSync(file) || !lstatSync(file).isFile() || fileHash(readFileSync(file)) !== expectedHash)
        fail(`fixed-tag payload is missing or modified: ${path}`);
    }
    console.log(`Changed 0 — fixed tag ${existingProvenance.ref} is already installed`);
    process.exit(0);
  }

  let resolvedSource: ResolvedSource;
  try {
    if (update && existingProvenance) {
      resolvedSource =
        existingProvenance.source === "local"
          ? acquireLocal(existingProvenance.ref)
          : await acquireRemote(
              existingProvenance.source === "ref" ? "ref" : "latest",
              existingProvenance.source === "ref" ? existingProvenance.ref : "",
            );
    } else if (fromArg) {
      resolvedSource = acquireLocal(fromArg);
    } else if (refArg) {
      resolvedSource = await acquireRemote("ref", refArg);
    } else if (tagArg) {
      resolvedSource = await acquireRemote("tag", tagArg);
    } else if (skipBuild) {
      // Development-only compatibility: --skip-build intentionally consumes the
      // already-built projection beside this script and never performs network I/O.
      const localPluginRoot = dirname(import.meta.dir);
      resolvedSource = {
        pluginRoot: localPluginRoot,
        source: "local",
        ref: dirname(localPluginRoot),
        requestedTag: null,
        cleanupRoot: null,
      };
    } else {
      resolvedSource = await acquireRemote("latest", "");
    }
  } catch (error) {
    fail(`source acquisition failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  const pluginRoot = resolvedSource.pluginRoot;
  const cleanupRoot = resolvedSource.cleanupRoot;
  if (cleanupRoot !== null) {
    process.on("exit", () => rmSync(cleanupRoot, { recursive: true, force: true }));
  }
  let pluginVersion = "";
  try {
    pluginVersion = validateManifest(resolvedSource).version;
  } catch (error) {
    fail(`source validation failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // ---- build ------------------------------------------------------------------

  const distDir = join(pluginRoot, "dist", harness);
  if (skipBuild) {
    if (!existsSync(distDir)) fail(`--skip-build but ${distDir} does not exist`);
  } else {
    run(`build dist/${harness}/`, ["bun", builderPath, pluginRoot, harness]);
  }

  // Refresh only recorded, unmodified plugin files inside the candidate tree.

  const PAYLOAD_MAP: [string, string[]][] = [
    ["sensors", ["sensors"]],
    ["tools", ["tools"]],
    ["knowledge", ["knowledge"]],
    ["agents", ["agents"]],
    ["scopes", ["scopes"]],
    ["stages", ["aidlc-common", "stages"]],
  ];

  function walkFiles(root: string): string[] {
    const out: string[] = [];
    const visit = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) visit(p);
        else out.push(relative(root, p));
      }
    };
    visit(root);
    return out.sort();
  }

  function payloadDigest(entries: readonly { path: string; bytes: Uint8Array }[]): string {
    return canonicalPayloadSha256(entries);
  }

  function candidatePayloadEntries(): { path: string; bytes: Uint8Array }[] {
    const entries: { path: string; bytes: Uint8Array }[] = [];
    for (const [srcDir, dstParts] of PAYLOAD_MAP) {
      const srcRoot = join(distDir, srcDir);
      if (!existsSync(srcRoot)) continue;
      for (const rel of walkFiles(srcRoot)) {
        const source = join(srcRoot, rel);
        if (lstatSync(source).isSymbolicLink()) continue;
        entries.push({
          path: [...dstParts, ...rel.split(sep)].join("/"),
          // Compose materializes harness placeholders in Markdown payloads. Hash
          // the bytes that will exist in the destination, not the projection
          // template bytes, so an unchanged source can be recognized pre-write.
          bytes: source.endsWith(".md")
            ? Buffer.from(readFileSync(source, "utf-8").replaceAll("{{HARNESS_DIR}}", target.harnessLeaf), "utf-8")
            : readFileSync(source),
        });
      }
    }
    return entries;
  }

  function installedPayloadEntries(): { path: string; bytes: Uint8Array }[] | null {
    const entries: { path: string; bytes: Uint8Array }[] = [];
    for (const candidate of candidatePayloadEntries()) {
      if (candidate.path === `tools/data/${PROVENANCE_FILE}`) continue;
      const installed = join(projectDir, target.harnessLeaf, ...candidate.path.split("/"));
      if (!existsSync(installed) || !lstatSync(installed).isFile() || lstatSync(installed).isSymbolicLink())
        return null;
      entries.push({ path: candidate.path, bytes: readFileSync(installed) });
    }
    return entries;
  }

  function sameResolvedSource(provenance: InstallationProvenance): boolean {
    return provenance.source === resolvedSource.source && provenance.ref === resolvedSource.ref;
  }

  function writeProvenance(payloadSha256: string): void {
    const provenance: InstallationProvenance = {
      version: pluginVersion,
      ref: resolvedSource.ref,
      source: resolvedSource.source,
      installed_at: new Date().toISOString(),
      payload_sha256: payloadSha256,
      projection_sha256: projectionDigest,
      owned_files: Object.fromEntries(
        candidatePayloadEntries()
          .filter((entry) => ownedPayloadPath(entry.path))
          .map((entry) => [
            entry.path,
            fileHash(readFileSync(join(projectDir, target.harnessLeaf, ...entry.path.split("/")))),
          ]),
      ),
    };
    mkdirSync(dirname(provenancePath), { recursive: true });
    const temporary = `${provenancePath}.tmp-${process.pid}-${randomUUID()}`;
    try {
      writeFileSync(temporary, `${JSON.stringify(provenance, null, 2)}\n`, { flag: "wx" });
      renameSync(temporary, provenancePath);
    } finally {
      rmSync(temporary, { force: true });
    }
  }

  function refreshPluginPayloads(): number {
    for (const candidate of candidatePayloadEntries()) {
      const dst = join(projectDir, target.harnessLeaf, ...candidate.path.split("/"));
      if (existsSync(dst) && !(candidate.path in priorOwnership)) {
        if (!lstatSync(dst).isFile() || !readFileSync(dst).equals(candidate.bytes))
          fail(`payload collision with an unowned file: ${candidate.path}`);
      }
    }
    for (const [path, expectedHash] of Object.entries(priorOwnership)) {
      const dst = join(projectDir, target.harnessLeaf, ...path.split("/"));
      if (existsSync(dst) && (!lstatSync(dst).isFile() || fileHash(readFileSync(dst)) !== expectedHash))
        fail(`installed plugin file was modified: ${path}`);
    }
    let refreshed = 0;
    for (const path of Object.keys(priorOwnership)) {
      const dst = join(projectDir, target.harnessLeaf, ...path.split("/"));
      if (existsSync(dst)) {
        rmSync(dst);
        refreshed++;
      }
    }
    return refreshed;
  }

  const projectionDigest = canonicalPayloadSha256(
    walkFiles(distDir).map((path) => ({ path: path.split(sep).join("/"), bytes: readFileSync(join(distDir, path)) })),
  );
  const beforePayload = installedPayloadEntries();
  if (
    existingProvenance &&
    existingProvenance.owned_files === undefined &&
    (!beforePayload || payloadDigest(beforePayload) !== existingProvenance.payload_sha256)
  ) {
    fail("cannot verify ownership of the previous installation; reinstall its recorded source version before updating");
  }
  const priorOwnership =
    existingProvenance?.owned_files ??
    (existingProvenance && beforePayload && payloadDigest(beforePayload) === existingProvenance.payload_sha256
      ? Object.fromEntries(
          beforePayload
            .filter((entry) => ownedPayloadPath(entry.path))
            .map((entry) => [entry.path, fileHash(entry.bytes)]),
        )
      : {});
  const candidateDigest = payloadDigest(candidatePayloadEntries());
  if (
    existingProvenance &&
    sameResolvedSource(existingProvenance) &&
    existingProvenance.version === pluginVersion &&
    existingProvenance.owned_files !== undefined &&
    existingProvenance.projection_sha256 === projectionDigest &&
    beforePayload &&
    payloadDigest(beforePayload) === candidateDigest &&
    existingProvenance.payload_sha256 === candidateDigest
  ) {
    console.log(`Changed 0 — ${resolvedSource.source} ${resolvedSource.ref} is already installed`);
    process.exit(0);
  }

  const destinationDir = projectDir;
  const transactionRoot = mkdtempSync(join(tmpdir(), "ddd-transaction-"));
  const candidateDir = join(transactionRoot, "candidate");
  const managedRoots = [target.harnessLeaf, ".agents", "aidlc", ".gitignore", ".mcp.json"];
  let retainRecovery = false;
  const lockPath = join(destinationDir, ".ddd-install-lock");
  let locked = false;
  process.on("exit", () => {
    if (!retainRecovery) rmSync(transactionRoot, { recursive: true, force: true });
    if (locked) rmSync(lockPath, { recursive: true, force: true });
  });
  try {
    if (!dryRun) {
      mkdirSync(lockPath);
      locked = true;
    }
    mkdirSync(candidateDir);
    for (const name of managedRoots) {
      const original = join(destinationDir, name);
      if (existsSync(original))
        cpSync(original, join(candidateDir, name), { recursive: true, dereference: true, preserveTimestamps: true });
    }
  } catch (error) {
    fail(`cannot prepare installation candidate: ${error instanceof Error ? error.message : String(error)}`);
  }
  const beforeCandidate = treeFiles(candidateDir);
  projectDir = candidateDir;
  provenancePath = join(candidateDir, target.harnessLeaf, "tools", "data", PROVENANCE_FILE);

  const refreshed = refreshPluginPayloads();
  if (refreshed > 0) {
    console.log(`\n▸ candidate preparation: refreshing ${refreshed} owned plugin file(s)`);
  }
  // ---- compose candidate ----------------------------------------------------

  const composeEnv = {
    AIDLC_PLUGIN_ROOT: distDir,
    AIDLC_PROJECT_DIR: projectDir,
    CLAUDE_PROJECT_DIR: projectDir,
    AIDLC_HARNESS_DIR: target.harnessLeaf,
    AIDLC_HARNESS_NAME: target.harnessName,
  };
  run("compose (hooks/compose.ts)", ["bun", join(distDir, "hooks", "compose.ts")], {
    cwd: projectDir,
    env: composeEnv,
  });

  // ---- verify -----------------------------------------------------------------

  const sentinel = join(projectDir, target.harnessLeaf, "sensors", "aidlc-ddd-model-completeness.md");
  if (!existsSync(sentinel)) {
    fail(`compose finished but ${sentinel} is missing — check the compose output above`);
  }
  const installedPayload = installedPayloadEntries();
  if (!installedPayload) fail("compose completed but one or more plugin-owned payload files are missing");
  const installedDigest = payloadDigest(installedPayload);
  const pluginChecks = await import(pluginTestPath);
  if (typeof pluginChecks.readPluginDropEntries !== "function")
    fail("installed AI-DLC tools do not expose plugin drop verification");
  const drops = pluginChecks.readPluginDropEntries(candidateDir, PLUGIN_NAME) as { message: string }[];
  if (drops.length > 0) fail(`candidate composition has drops: ${drops.map((drop) => drop.message).join("; ")}`);
  run("verify candidate graph", ["bun", join(candidateDir, target.harnessLeaf, "tools", "aidlc-graph.ts"), "compile"], {
    cwd: candidateDir,
    env: composeEnv,
  });
  const graph = JSON.parse(
    readFileSync(join(candidateDir, target.harnessLeaf, "tools/data/stage-graph.json"), "utf8"),
  ) as { slug: string }[];
  if (!graph.some((stage) => stage.slug === "ddd-domain-modeling"))
    fail("candidate graph is missing ddd-domain-modeling");
  if (installedDigest !== candidateDigest) fail("candidate payload differs from the selected projection");
  writeProvenance(installedDigest);
  if (dryRun) {
    console.log("\n✓ dry run passed — destination unchanged");
    process.exit(0);
  }
  try {
    applyCandidate(destinationDir, beforeCandidate, treeFiles(candidateDir), managedRoots, transactionRoot);
  } catch (error) {
    retainRecovery = error instanceof CommitFailure && error.recoveryRequired;
    fail(
      `installation could not be committed: ${error instanceof Error ? error.message : String(error)}${retainRecovery ? `; recovery files: ${join(transactionRoot, "rollback")}` : ""}`,
    );
  }
  console.log(`\n✓ installed into ${destinationDir} (${target.harnessLeaf}/)`);
  console.log(`Changed 1 — recorded ${pluginVersion} from ${resolvedSource.source} ${resolvedSource.ref}`);
}
