import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

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
  const destination = join(root, target, "state-exposure");
  mkdirSync(destination, { recursive: true });
  const built = join(root, target, host, "release/ddd-rust-syn-spike");
  const installed = join(destination, "ddd-rust-syn-spike");
  if (!existsSync(installed) || !readFileSync(built).equals(readFileSync(installed))) copyFileSync(built, installed);
  const began = performance.now();
  const version = JSON.parse(run([installed, "--state-exposure-version"], 180_000));
  if (version.protocol_version !== 2 || version.extractor !== "0.0.0" || version.syn !== "3.0.5")
    throw new Error("prepared native version mismatch");
  process.stderr.write(`Native startup preparation: ${Math.round(performance.now() - began)}ms (limit 180000ms)\n`);
  process.stderr.write(`Prepared state exposure native v2 for ${host}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
