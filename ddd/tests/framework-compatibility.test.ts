import { expect, test } from "bun:test";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");

for (const harness of ["claude", "codex"]) {
  test(`${harness} composes in a disposable copy without drops or second-compose changes`, () => {
    const result = Bun.spawnSync(
      [process.execPath, ".codex/tools/aidlc-plugin-test.ts", "ddd", "--install", ".", "--harness", harness, "--json"],
      { cwd: root, stdout: "pipe", stderr: "pipe" },
    );
    const output = JSON.parse(result.stdout.toString());
    expect(output.errors).toEqual([]);
    expect(result.exitCode).toBe(0);
    expect(output.graph.compiled).toBe(true);
    expect(output.idempotent).toBe(true);
    expect(output.drops).toEqual([]);
  });
}
