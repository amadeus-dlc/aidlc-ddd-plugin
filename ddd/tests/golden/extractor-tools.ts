/**
 * Private copies of the distributed tools tree whose installed extractor meets one condition.
 *
 * Every entry resolves the extractor relative to its own `tools/ddd/` tree, so an entry run out of a
 * copy whose `ddd/bin` was rebuilt here is what puts its launch into one classification. Shared by
 * the entries that decide on the extractor, so a launch condition is described in one place rather
 * than restated per entry.
 */

import { createHash } from "node:crypto";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";

const PRODUCT_TOOLS_DIR = join(import.meta.dir, "..", "..", "tools");
const PRODUCT_BIN_DIR = join(PRODUCT_TOOLS_DIR, "ddd", "bin");
const HOST_KEY = `${process.platform}-${process.arch}`;
const EXTRACTOR_NAME = "ddd-rust-syn-spike";
/** The protocol the Rust decision base is read over, fixed by the inspection contract. */
const DOMAIN_FACTS_VERSION = 7;
/** The unresolved reason the extractor records for an attribute that may replace what it annotates. */
const ATTRIBUTE_MACRO_REASON = "attribute-macro";

export interface InstallationOptions {
  /** Omit the host row from the manifest, leaving this platform unrecorded. */
  readonly recorded?: false;
  /** Leave the installation directory without the extractor file. */
  readonly present?: false;
  /** Install the file without any execute bit. */
  readonly executable?: false;
  /** Record a digest the installed bytes do not produce. */
  readonly digest?: "stale";
  /** Leave the protocol probe without an answer by exiting non-zero. */
  readonly probe?: "fails";
  /** Answer the probe with a protocol the adapter does not accept. */
  readonly protocol?: number;
  /**
   * Answer the batch as the product extractor does, less every attribute-macro record. The input
   * and every other fact stay the product's, so a run through this copy and one through the product
   * differ in that record alone — which is the answer the rule layer received before the extractor
   * recorded attribute macros at all.
   */
  readonly batch?: "without-attribute-macros";
}

const temporary: string[] = [];

/** Removes every copy handed out since the last call; callers register this in `afterEach`. */
export function removeExtractorTools(): void {
  for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true });
}

/**
 * Runs the extractor named by its first argument over the request on stdin and prints the answer
 * without the unresolved records carrying the reason named by its second. A run that fails is passed
 * on as the same failure, so the filter never turns a missing answer into an empty one.
 */
const RECORD_FILTER = `const [extractor, reason] = process.argv.slice(2);
const run = Bun.spawnSync([extractor], {
  stdin: Buffer.from(await Bun.stdin.arrayBuffer()),
  stdout: "pipe",
  stderr: "inherit",
});
if (run.exitCode !== 0) process.exit(run.exitCode ?? 1);
const answer = JSON.parse(run.stdout.toString());
for (const file of answer.files) file.unresolved = file.unresolved.filter((entry) => entry.reason !== reason);
process.stdout.write(JSON.stringify(answer));
`;

function extractorStub(options: InstallationOptions, root: string): string {
  const answer = `echo '{"protocol_version":${options.protocol ?? DOMAIN_FACTS_VERSION},"extractor":"0.0.0","syn":"3.0.5"}'`;
  let batch = "exit 1";
  if (options.batch === "without-attribute-macros") {
    const filter = join(root, "record-filter.ts");
    writeFileSync(filter, RECORD_FILTER);
    const product = join(PRODUCT_BIN_DIR, HOST_KEY, EXTRACTOR_NAME);
    batch = `exec '${process.execPath}' '${filter}' '${product}' '${ATTRIBUTE_MACRO_REASON}'`;
  }
  return [
    "#!/bin/sh",
    'case "$1" in',
    `  --*-version) ${options.probe === "fails" ? "exit 1" : answer} ;;`,
    `  *) ${batch} ;;`,
    "esac",
    "",
  ].join("\n");
}

/** A private copy of the distributed tools tree whose installed extractor meets one condition. */
export function toolsWithExtractor(options: InstallationOptions): string {
  const root = mkdtempSync(join(tmpdir(), "ddd-extractor-tools-"));
  temporary.push(root);
  const tools = join(root, "tools");
  cpSync(PRODUCT_TOOLS_DIR, tools, {
    recursive: true,
    filter: (source) => source !== PRODUCT_BIN_DIR && !source.startsWith(`${PRODUCT_BIN_DIR}${sep}`),
  });
  const bin = join(tools, "ddd", "bin");
  mkdirSync(bin, { recursive: true });
  const body = extractorStub(options, root);
  const recorded = createHash("sha256")
    .update(options.digest === "stale" ? `${body}# recorded from other bytes\n` : body)
    .digest("hex");
  const rows = options.recorded === false ? {} : { [HOST_KEY]: { target: "unit-test-triple", sha256: recorded } };
  writeFileSync(join(bin, "manifest.json"), `${JSON.stringify(rows, null, 2)}\n`);
  if (options.present !== false) {
    mkdirSync(join(bin, HOST_KEY), { recursive: true });
    const binary = join(bin, HOST_KEY, EXTRACTOR_NAME);
    writeFileSync(binary, body);
    chmodSync(binary, options.executable === false ? 0o644 : 0o755);
  }
  return tools;
}

/** The same private copy, carrying the product installation unchanged. */
export function toolsWithProductExtractor(): string {
  const root = mkdtempSync(join(tmpdir(), "ddd-extractor-tools-product-"));
  temporary.push(root);
  const tools = join(root, "tools");
  cpSync(PRODUCT_TOOLS_DIR, tools, { recursive: true });
  return tools;
}
