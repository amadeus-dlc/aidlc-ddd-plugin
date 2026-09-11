/**
 * Sensor runtime context — resolveContext / readStageStatus / readSourceClaims
 * (BR7.1, BR8.1–BR8.5).
 *
 * The runtime only reads files and resolves paths. It never spawns a process,
 * touches the network, or reads credentials (BR7.6).
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { FindingInput, Severity } from "../shared/findings.ts";

export interface SensorRunContext {
  stage: string;
  output_path: string;
  record_dir: string;
  workspace_root: string;
  unit?: string;
  budget_ms?: number;
  started_at: string;
}

export type ContextResult = { ok: true; context: SensorRunContext } | { ok: false; reason: string };

export interface StageStatus {
  stage: string;
  execution: "EXECUTE" | "SKIP" | "absent";
  checkbox?: string;
}

export interface SourceClaim {
  path: string;
  repo?: string;
  is_directory: boolean;
  resolved_path?: string;
}

export interface SourceClaimOptions {
  /** Extension filter (with dot), applied when expanding directory claims. */
  extensions?: readonly string[];
  /** repo name -> absolute repo root, supplied by the caller. */
  repoRoots?: Readonly<Record<string, string>>;
}

export type SourceClaimsResult =
  | { ok: true; claims: SourceClaim[]; findings: FindingInput[] }
  | { ok: false; reason: string };

const UNIT_SEGMENT = /^[a-z][a-z0-9-]*$/;

function parseArgs(argv: readonly string[]): { stage?: string; path?: string } {
  const out: { stage?: string; path?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--stage") out.stage = argv[++i];
    else if (argv[i] === "--output-path" || argv[i] === "--file-path") out.path = argv[++i];
  }
  return out;
}

function ancestors(from: string): string[] {
  const chain: string[] = [];
  let current = resolve(from);
  for (;;) {
    chain.push(current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return chain;
}

/** BR8.1 — nearest ancestor of output_path containing aidlc-state.md. */
function findRecordDir(outputPath: string): string | undefined {
  for (const candidate of ancestors(dirname(outputPath))) {
    if (existsSync(join(candidate, "aidlc-state.md"))) return candidate;
  }
  return undefined;
}

/** BR8.1 — nearest ancestor of record_dir that contains an `aidlc/` directory. */
function findWorkspaceRoot(recordDir: string): string | undefined {
  for (const candidate of ancestors(recordDir)) {
    if (existsSync(join(candidate, "aidlc"))) return candidate;
  }
  return undefined;
}

/** BR8.2 — unit when output_path lives under record_dir/construction/<unit>/. */
function findUnit(recordDir: string, outputPath: string): string | undefined {
  const rel = relative(recordDir, outputPath);
  if (rel.startsWith("..") || isAbsolute(rel)) return undefined;
  const segments = rel.split(sep);
  if (segments.length >= 2 && segments[0] === "construction" && UNIT_SEGMENT.test(segments[1])) {
    return segments[1];
  }
  return undefined;
}

export function resolveContext(
  argv: readonly string[],
  options: { budgetMs?: number; now?: () => Date } = {},
): ContextResult {
  const args = parseArgs(argv);
  if (!args.stage || !args.path) {
    return { ok: false, reason: "args-missing" };
  }
  const outputPath = isAbsolute(args.path) ? resolve(args.path) : resolve(process.cwd(), args.path);
  const recordDir = findRecordDir(outputPath);
  if (!recordDir) return { ok: false, reason: "record-dir-unresolved" };
  const workspaceRoot = findWorkspaceRoot(recordDir);
  if (!workspaceRoot) return { ok: false, reason: "record-dir-unresolved" };

  const unit = findUnit(recordDir, outputPath);
  const context: SensorRunContext = {
    stage: args.stage,
    output_path: outputPath,
    record_dir: recordDir,
    workspace_root: workspaceRoot,
    started_at: (options.now?.() ?? new Date()).toISOString(),
  };
  if (unit) context.unit = unit;
  if (options.budgetMs !== undefined) context.budget_ms = options.budgetMs;
  return { ok: true, context };
}

const STAGE_LINE = /^- \[(.)\] ([a-z0-9-]+) — (EXECUTE|SKIP)/;

export function readStageStatus(context: SensorRunContext, stage: string): StageStatus {
  const statePath = join(context.record_dir, "aidlc-state.md");
  if (!existsSync(statePath)) return { stage, execution: "absent" };
  let text: string;
  try {
    text = readFileSync(statePath, "utf-8");
  } catch {
    return { stage, execution: "absent" };
  }
  for (const line of text.split("\n")) {
    const match = STAGE_LINE.exec(line.trim());
    if (match && match[2] === stage) {
      return { stage, execution: match[3] as "EXECUTE" | "SKIP", checkbox: match[1] };
    }
  }
  return { stage, execution: "absent" };
}

interface SourceManifestWrite {
  path: string;
  repo?: string;
}

const MANIFEST_KEYS = new Set(["stage", "unit", "version", "writes"]);
const WRITE_KEYS = new Set(["path", "repo"]);

function parseSourceManifest(text: string): { writes: SourceManifestWrite[] } | { reason: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { reason: "source-manifest-invalid" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { reason: "source-manifest-invalid" };
  }
  const record = parsed as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!MANIFEST_KEYS.has(key)) return { reason: "source-manifest-invalid" };
  }
  if (record.version !== 1 || record.stage !== "code-generation") {
    return { reason: "source-manifest-invalid" };
  }
  if (typeof record.unit !== "string" || !Array.isArray(record.writes)) {
    return { reason: "source-manifest-invalid" };
  }
  const writes: SourceManifestWrite[] = [];
  for (const entry of record.writes) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      return { reason: "source-manifest-invalid" };
    }
    const write = entry as Record<string, unknown>;
    for (const key of Object.keys(write)) {
      if (!WRITE_KEYS.has(key)) return { reason: "source-manifest-invalid" };
    }
    if (typeof write.path !== "string" || write.path.length === 0) {
      return { reason: "source-manifest-invalid" };
    }
    if (write.repo !== undefined && typeof write.repo !== "string") {
      return { reason: "source-manifest-invalid" };
    }
    writes.push({ path: write.path, ...(write.repo ? { repo: write.repo } : {}) });
  }
  return { writes };
}

function isInside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function collectFiles(dir: string, extensions: readonly string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectFiles(full, extensions));
    } else if (entry.isFile()) {
      if (extensions.length === 0 || extensions.includes(extname(entry.name))) out.push(full);
    }
  }
  return out.sort((a, b) => a.localeCompare(b, "en"));
}

export function readSourceClaims(context: SensorRunContext, options: SourceClaimOptions = {}): SourceClaimsResult {
  if (!context.unit) return { ok: false, reason: "unit-unresolved" };
  const manifestPath = join(
    context.record_dir,
    "construction",
    context.unit,
    "code-generation",
    "source-manifest.json",
  );
  if (!existsSync(manifestPath)) {
    return { ok: false, reason: "source-manifest-invalid" };
  }
  let text: string;
  try {
    text = readFileSync(manifestPath, "utf-8");
  } catch {
    return { ok: false, reason: "source-manifest-invalid" };
  }
  const parsed = parseSourceManifest(text);
  if ("reason" in parsed) return { ok: false, reason: parsed.reason };

  const findings: FindingInput[] = [];
  const manifestFile = relative(context.workspace_root, manifestPath).split(sep).join("/");
  const claims: SourceClaim[] = [];

  for (const write of parsed.writes) {
    const isDirectory = write.path.endsWith("/");
    let base = context.workspace_root;
    if (write.repo !== undefined) {
      const repoRoot = options.repoRoots?.[write.repo];
      if (!repoRoot) {
        findings.push({
          rule_id: "runtime.claim-out-of-scope",
          file: manifestFile,
          message: `write "${write.path}" names unknown repo "${write.repo}"`,
        });
        continue;
      }
      base = repoRoot;
    }
    const resolved = resolve(base, write.path);
    if (!isInside(base, resolved)) {
      findings.push({
        rule_id: "runtime.claim-out-of-scope",
        file: manifestFile,
        message: `write "${write.path}" resolves outside ${base}`,
      });
      continue;
    }
    if (isDirectory) {
      if (!existsSync(resolved)) {
        findings.push({
          rule_id: "runtime.claim-missing",
          file: manifestFile,
          message: `declared directory "${write.path}" does not exist`,
        });
        continue;
      }
      for (const full of collectFiles(resolved, options.extensions ?? [])) {
        claims.push({
          path: relative(base, full).split(sep).join("/"),
          ...(write.repo ? { repo: write.repo } : {}),
          is_directory: false,
          resolved_path: full,
        });
      }
      continue;
    }
    if (!existsSync(resolved)) {
      findings.push({
        rule_id: "runtime.claim-missing",
        file: manifestFile,
        message: `declared file "${write.path}" does not exist`,
      });
      continue;
    }
    if (statSync(resolved).isDirectory()) {
      findings.push({
        rule_id: "runtime.claim-out-of-scope",
        file: manifestFile,
        message: `write "${write.path}" is a directory without a trailing slash`,
      });
      continue;
    }
    claims.push({
      path: relative(base, resolved).split(sep).join("/"),
      ...(write.repo ? { repo: write.repo } : {}),
      is_directory: false,
      resolved_path: resolved,
    });
  }

  return { ok: true, claims, findings };
}

export type { FindingInput, Severity };
