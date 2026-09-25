/**
 * Builds the native extractor for the host and installs it at the one product path both entries
 * launch, then records the host platform in the distribution manifest.
 *
 * The manifest names the platforms this distribution actually ships a build for. Only the platform
 * built here is recorded, so an environment that was never built for is never presented as covered.
 */

import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { EXTRACTOR_NAME, MANIFEST_NAME, NATIVE_BIN_DIR, PLATFORM_KEY } from "../tools/ddd/lib/rust/native/manifest.ts";

const PROTOCOLS = [
  { flag: "--error-contract-version", version: 3 },
  { flag: "--state-exposure-version", version: 2 },
  { flag: "--domain-facts-version", version: 6 },
];

const root = resolve(import.meta.dir, "..");
function run(command: string[], timeoutMs = 120_000) {
  const result = Bun.spawnSync(command, { cwd: root, stdout: "pipe", stderr: "pipe", timeout: timeoutMs });
  if (result.exitCode !== 0) throw new Error(`${command[0]}: ${result.stderr.toString()}`);
  process.stderr.write(result.stderr);
  return result.stdout.toString();
}

try {
  const host = /^host: (.+)$/m.exec(run(["rustc", "-vV"]))?.[1];
  if (!host) throw new Error("rustc host target unavailable");
  const buildDir = "experiments/rust-syn/target";
  run([
    "cargo",
    "build",
    "--locked",
    "--offline",
    "--release",
    "--manifest-path",
    "experiments/rust-syn/Cargo.toml",
    "--target-dir",
    buildDir,
    "--target",
    host,
  ]);

  // The shared resolution layer owns the installed path; this script installs to exactly that path.
  const installed = join(NATIVE_BIN_DIR, PLATFORM_KEY, EXTRACTOR_NAME);
  mkdirSync(dirname(installed), { recursive: true });
  const built = readFileSync(join(root, buildDir, host, "release", EXTRACTOR_NAME));
  if (!existsSync(installed) || !built.equals(readFileSync(installed))) {
    copyFileSync(join(root, buildDir, host, "release", EXTRACTOR_NAME), installed);
  }
  // Distribution copies payload bytes without a mode; the execute bit is granted here and restored
  // by the installer, so the launch path can treat its absence as a reportable condition.
  chmodSync(installed, 0o755);

  const began = performance.now();
  for (const protocol of PROTOCOLS) {
    const reported = JSON.parse(run([installed, protocol.flag], 180_000));
    if (reported.protocol_version !== protocol.version || reported.extractor !== "0.0.0" || reported.syn !== "3.0.5")
      throw new Error(`prepared native version mismatch for ${protocol.flag}`);
  }
  process.stderr.write(`Native startup preparation: ${Math.round(performance.now() - began)}ms (limit 180000ms)\n`);

  const manifestPath = join(NATIVE_BIN_DIR, MANIFEST_NAME);
  const rows = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
  rows[PLATFORM_KEY] = { target: host, sha256: createHash("sha256").update(built).digest("hex") };
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      Object.fromEntries(
        Object.keys(rows)
          .sort()
          .map((key) => [key, rows[key]]),
      ),
      null,
      2,
    )}\n`,
  );
  process.stderr.write(`Prepared the native extractor for ${PLATFORM_KEY} (${host})\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
