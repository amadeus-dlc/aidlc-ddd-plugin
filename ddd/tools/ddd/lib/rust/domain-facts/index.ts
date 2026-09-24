/**
 * Protocol version 4 of the native extractor: the facts rules (a) and (d) decide on.
 *
 * The launch classification is the shared one in `native/launch.ts`; this module owns the protocol
 * identity, the one batch this inspection sends, and the strict conversion of native spellings into
 * the records the rule layer reads. Native spellings never leave it.
 *
 * Every condition that would leave a requested file without facts — a batch too large to send, a
 * run that did not finish, an answer that is not this protocol — is reported as one unavailable
 * result. An empty fact set is never produced as a stand-in, because "nothing public is declared"
 * is exactly the answer an uninspected file must not give.
 */

import { classifyNativeExtractor, type NativeOutcome } from "../native/launch.ts";
import { NATIVE_BIN_DIR, PLATFORM_KEY } from "../native/manifest.ts";

const PROTOCOL = { flag: "--domain-facts-version", version: 4 };
/** The extractor refuses a larger request, so an oversized batch is refused before it is sent. */
const MAX_REQUEST_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 30_000;

/** A non-private member of a struct declaration, spelled as the source spells it. */
export interface PublicMember {
  readonly typeName: string;
  /** A field identifier, raw prefix included, or the ordinal of a tuple member. */
  readonly name: string;
  readonly line: number;
}

export interface DomainFactSet {
  /**
   * Workspace-relative file -> its non-private struct members in declaration order. A file the
   * extractor could not parse has no entry at all.
   */
  readonly publicMembers: ReadonlyMap<string, readonly PublicMember[]>;
  /** `methodKey(...)` -> whether that impl method's body only hands back a member of `self`. */
  readonly fieldReturns: ReadonlyMap<string, boolean>;
  /** One line per construct that could hide a declaration from this answer. */
  readonly notes: readonly string[];
}

/** One source of the inspected program, as the extractor is asked about it. */
export interface RustSourceFile {
  /** Workspace-relative path; the answer is keyed by it. */
  readonly file: string;
  readonly source: string;
}

export type DomainFactResult =
  | { readonly kind: "facts"; readonly facts: DomainFactSet }
  | { readonly kind: "unavailable"; readonly detail: string };

/**
 * The identity an impl method is joined on. The two extractors spell the same type and trait
 * differently around whitespace, so both sides are compared with it removed; everything else is
 * compared as written, which is what keeps `r#total` apart from `total`.
 *
 * The name's own line makes the identity one declaration rather than one name: a function body may
 * declare its own type, and the module path names no function, so two local declarations of one
 * name would otherwise share it. Both extractors read that line from the same source text.
 */
export function methodKey(
  file: string,
  modulePath: readonly string[],
  ownerTypeText: string,
  traitText: string | null,
  name: string,
  nameLine: number,
): string {
  const compact = (text: string) => text.replace(/\s+/g, "");
  return [
    file,
    modulePath.join("::"),
    compact(ownerTypeText),
    traitText === null ? "" : compact(traitText),
    name,
    String(nameLine),
  ].join("\u0000");
}

export function classifyDomainFactExtractor(): Promise<NativeOutcome> {
  return classifyNativeExtractor(NATIVE_BIN_DIR, PLATFORM_KEY, PROTOCOL);
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("expected native object");
  return value as Record<string, unknown>;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("expected native array");
  return value;
}

function nonempty(value: unknown): string {
  if (typeof value !== "string" || !value.length) throw new Error("expected native text");
  return value;
}

function line(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) throw new Error("invalid native line");
  return value;
}

function member(value: unknown): PublicMember {
  const raw = object(value);
  return { typeName: nonempty(raw.type), name: nonempty(raw.member), line: line(raw.line) };
}

function collectMethod(raw: Record<string, unknown>, file: string, into: Map<string, boolean>): void {
  const trait = raw.trait_text;
  if (trait !== null && typeof trait !== "string") throw new Error("invalid native trait");
  if (typeof raw.returns_field_only !== "boolean") throw new Error("invalid native method fact");
  const key = methodKey(
    file,
    array(raw.module).map(nonempty),
    nonempty(raw.owner_type_text),
    trait === null ? null : nonempty(trait),
    nonempty(raw.name),
    line(raw.line),
  );
  const seen = into.get(key);
  // One declaration has one body. Two answers for one declaration that disagree are the extractor
  // contradicting itself about the same lines, not a source this rule cannot read.
  if (seen !== undefined && seen !== raw.returns_field_only)
    throw new Error(
      `the answer states two bodies for ${nonempty(raw.owner_type_text)}::${nonempty(raw.name)} at ${file}:${line(raw.line)}`,
    );
  into.set(key, raw.returns_field_only);
}

function convert(response: unknown, requested: readonly RustSourceFile[]): DomainFactSet {
  const raw = object(response);
  if (raw.protocol_version !== PROTOCOL.version) throw new Error("native protocol mismatch");
  const files = array(raw.files);
  if (files.length !== requested.length) throw new Error("native answer does not cover the request");
  const publicMembers = new Map<string, readonly PublicMember[]>();
  const fieldReturns = new Map<string, boolean>();
  const notes = new Set<string>();
  for (const [index, entry] of files.entries()) {
    const record = object(entry);
    const file = requested[index].file;
    if (record.path !== file) throw new Error("native answer is not in the order it was requested");
    for (const item of array(record.unresolved)) {
      const reason = object(item);
      notes.add(`domain-facts.unresolved: ${file}:${line(reason.line)} ${nonempty(reason.reason)}`);
    }
    if (record.parsed !== true) {
      if (record.parsed !== false) throw new Error("invalid native parse state");
      continue;
    }
    publicMembers.set(file, array(record.members).map(member));
    for (const item of array(record.methods)) collectMethod(object(item), file, fieldReturns);
  }
  return { publicMembers, fieldReturns, notes: [...notes].sort() };
}

/**
 * Runs the classified extractor once over every source of the inspected program. `binaryPath` is
 * the one the launch classification resolved and verified, so this call is the run alone.
 */
export function readDomainFacts(binaryPath: string, sources: readonly RustSourceFile[]): DomainFactResult {
  // The request contract needs at least one file, and a batch with none has nothing to answer for.
  if (sources.length === 0)
    return { kind: "facts", facts: { publicMembers: new Map(), fieldReturns: new Map(), notes: [] } };
  const request = JSON.stringify({
    protocol_version: PROTOCOL.version,
    files: sources.map((entry) => ({ path: entry.file, source: entry.source })),
  });
  if (Buffer.byteLength(request) > MAX_REQUEST_BYTES)
    return {
      kind: "unavailable",
      detail: `the inspected sources exceed the native extractor's ${MAX_REQUEST_BYTES}-byte request limit`,
    };
  const run = Bun.spawnSync([binaryPath], {
    stdin: Buffer.from(request),
    stdout: "pipe",
    stderr: "pipe",
    timeout: TIMEOUT_MS,
  });
  // A run stopped by the timeout reports a signal rather than a status, so both are named: an
  // unfinished run is reported as itself, not as an answer that happened to be empty.
  if (run.exitCode !== 0)
    return {
      kind: "unavailable",
      detail: `the native extractor did not complete its ${PROTOCOL.flag} batch (exit ${run.exitCode}, signal ${run.signalCode}): ${run.stderr.toString().trim()}`,
    };
  let response: unknown;
  try {
    response = JSON.parse(run.stdout.toString());
  } catch {
    return { kind: "unavailable", detail: "the native extractor answered with text that is not JSON" };
  }
  try {
    return { kind: "facts", facts: convert(response, sources) };
  } catch (error) {
    return {
      kind: "unavailable",
      detail: `the ${PROTOCOL.flag} answer cannot be read: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
