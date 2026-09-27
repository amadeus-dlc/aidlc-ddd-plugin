/**
 * Copies the pinned TypeScript Compiler API into the one product path the TypeScript extractor
 * launches from, together with its license texts, and records the digest of the copied compiler.
 *
 * The distribution carries the compiler because an installed project may have no `typescript`
 * package, or another version of it; the extractor must start from the distributed tree alone.
 */

import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { COMPILER_NAME, MANIFEST_NAME, TYPESCRIPT_VENDOR_DIR } from "../tools/ddd/lib/typescript/compiler/launch.ts";
import { SUPPORTED_COMPILER_API_VERSION } from "../tools/ddd/lib/typescript/compiler/settings.ts";

const PACKAGE_DIR = resolve(import.meta.dir, "../node_modules/typescript");
const LICENSE_TEXTS = ["LICENSE.txt", "ThirdPartyNoticeText.txt"];

try {
  const { version } = JSON.parse(readFileSync(join(PACKAGE_DIR, "package.json"), "utf8"));
  if (version !== SUPPORTED_COMPILER_API_VERSION)
    throw new Error(
      `node_modules/typescript is ${version}; the extractor supports ${SUPPORTED_COMPILER_API_VERSION}. Run bun install --frozen-lockfile.`,
    );

  mkdirSync(TYPESCRIPT_VENDOR_DIR, { recursive: true });
  const compiler = readFileSync(join(PACKAGE_DIR, "lib", COMPILER_NAME));
  writeFileSync(join(TYPESCRIPT_VENDOR_DIR, COMPILER_NAME), compiler);
  for (const name of LICENSE_TEXTS) copyFileSync(join(PACKAGE_DIR, name), join(TYPESCRIPT_VENDOR_DIR, name));
  writeFileSync(
    join(TYPESCRIPT_VENDOR_DIR, MANIFEST_NAME),
    `${JSON.stringify({ [COMPILER_NAME]: { sha256: createHash("sha256").update(compiler).digest("hex") } }, null, 2)}\n`,
  );
  process.stderr.write(`Prepared the TypeScript Compiler API ${version} at ${TYPESCRIPT_VENDOR_DIR}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
