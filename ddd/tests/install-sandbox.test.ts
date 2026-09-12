import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { DESIGN_CASES } from "./golden/design/cases.ts";
import { runGoldenCase } from "./golden/runner.ts";

const repository = resolve(import.meta.dir, "../..");
const temporary: string[] = [];
afterEach(() => {
  for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true });
});
function fixture(harness: "claude" | "codex") {
  const root = mkdtempSync(join(tmpdir(), "ddd-install-sandbox-"));
  temporary.push(root);
  const project = join(root, "project");
  const source = join(root, "source");
  const leaf = `.${harness}`;
  mkdirSync(project, { recursive: true });
  cpSync(join(repository, leaf), join(project, leaf), { recursive: true, dereference: true });
  if (harness === "codex")
    cpSync(join(repository, ".agents"), join(project, ".agents"), { recursive: true, dereference: true });
  cpSync(join(repository, "ddd"), join(source, "ddd"), {
    recursive: true,
    dereference: true,
    filter: (path) => !path.split(sep).some((part) => part === "node_modules" || part === "dist"),
  });
  const userFile = join(project, "application.txt");
  writeFileSync(userFile, "User-owned application data\n");
  const env = { ...process.env, AIDLC_PROJECT_DIR: project, CLAUDE_PROJECT_DIR: project };
  delete env.AIDLC_COMPILED_EXECUTABLE;
  const invoke = (args: string[] = ["--from", source]) => {
    const result = Bun.spawnSync(
      [
        process.execPath,
        join(repository, "ddd/scripts/install.ts"),
        "--project",
        project,
        "--harness",
        harness,
        ...args,
      ],
      { cwd: project, env, stdout: "pipe", stderr: "pipe" },
    );
    return { code: result.exitCode, output: result.stdout.toString() + result.stderr.toString() };
  };
  return { root, project, source, leaf, userFile, invoke };
}

for (const harness of ["claude", "codex"] as const)
  test(`${harness}: fresh installation registers runnable plugin artifacts`, () => {
    const f = fixture(harness);
    const result = f.invoke();
    expect(result.code, result.output).toBe(0);
    const data = join(f.project, f.leaf, "tools/data");
    expect(
      JSON.parse(readFileSync(join(data, "stage-graph.json"), "utf8")).some(
        (stage: { slug: string }) => stage.slug === "ddd-domain-modeling",
      ),
    ).toBe(true);
    expect(existsSync(join(data, "ddd-install.json"))).toBe(true);
    const entry = DESIGN_CASES.find(
      (candidate) => candidate.sensor === "ddd-model-completeness" && candidate.name === "clean-complete",
    );
    if (!entry) throw new Error("Model fixture missing");
    expect(runGoldenCase(join(f.project, f.leaf, "tools"), entry).problems).toEqual([]);
    expect(readFileSync(f.userFile, "utf8")).toBe("User-owned application data\n");
  }, 30_000);

function snapshot(root: string): Record<string, string> {
  const files: Record<string, string> = {};
  function visit(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else files[path.slice(root.length + 1)] = createHash("sha256").update(readFileSync(path)).digest("hex");
    }
  }
  visit(root);
  return files;
}

test("claude: reinstalling the same source leaves the destination unchanged", () => {
  const f = fixture("claude");
  const first = f.invoke();
  expect(first.code, first.output).toBe(0);
  const before = snapshot(f.project);
  const second = f.invoke();
  expect(second.code, second.output).toBe(0);
  expect(second.output).toContain("Changed 0");
  expect(snapshot(f.project)).toEqual(before);
}, 30_000);
