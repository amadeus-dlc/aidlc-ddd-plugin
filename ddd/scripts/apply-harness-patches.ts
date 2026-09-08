import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const patch = resolve(import.meta.dir, "../patches/installed-harnesses.patch");
const check = (reverse: boolean) =>
  Bun.spawnSync(["git", "apply", "--check", ...(reverse ? ["--reverse"] : []), patch], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  }).exitCode === 0;

if (check(true)) {
  console.log("Installed harness patches are already applied.");
} else if (check(false)) {
  const result = Bun.spawnSync(["git", "apply", patch], { cwd: root, stdout: "inherit", stderr: "inherit" });
  if (result.exitCode !== 0) throw new Error("Could not apply installed harness patches.");
} else {
  throw new Error(
    "Installed .claude/.codex files differ from the patch baseline. Review local changes before retrying.",
  );
}
