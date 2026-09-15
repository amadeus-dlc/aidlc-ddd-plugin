import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { RUST_BINARY } from "../tools/ddd/lib/rust/error-contract/index.ts";

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
  const target = "experiments/rust-syn/target";
  run([
    "cargo",
    "build",
    "--locked",
    "--offline",
    "--release",
    "--manifest-path",
    "experiments/rust-syn/Cargo.toml",
    "--target-dir",
    target,
    "--target",
    host,
  ]);
  // The adapter owns the installed path; this script installs to exactly that path.
  mkdirSync(dirname(RUST_BINARY), { recursive: true });
  const built = join(root, target, host, "release/ddd-rust-syn-spike");
  if (!existsSync(RUST_BINARY) || !readFileSync(built).equals(readFileSync(RUST_BINARY)))
    copyFileSync(built, RUST_BINARY);
  const version = JSON.parse(run([RUST_BINARY, "--error-contract-version"], 180_000));
  if (version.protocol_version !== 3 || version.extractor !== "0.0.0" || version.syn !== "3.0.5")
    throw new Error("prepared native version mismatch");
  process.stderr.write(`Prepared error contract native v3 for ${host}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
