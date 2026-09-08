import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");

function withAdapter(
  check: (invoke: (target: string) => ReturnType<typeof Bun.spawnSync>) => void,
  coreOutput = "",
  coreExit = 0,
) {
  const project = mkdtempSync(join(tmpdir(), "ddd-adapter-test-"));
  const hooks = join(project, ".codex/hooks");
  mkdirSync(hooks, { recursive: true });
  copyFileSync(join(root, ".codex/hooks/aidlc-codex-adapter.ts"), join(hooks, "aidlc-codex-adapter.ts"));
  copyFileSync(join(root, ".codex/hooks/aidlc-codex-dispatch.ts"), join(hooks, "aidlc-codex-dispatch.ts"));
  symlinkSync(join(root, ".codex/tools"), join(project, ".codex/tools"), "dir");
  writeFileSync(
    join(hooks, "aidlc-deliver-stage-rules.ts"),
    `process.stdout.write(${JSON.stringify(coreOutput)}); process.stderr.write("core diagnostic"); process.exit(${coreExit});\n`,
  );
  const env = { ...process.env, AIDLC_PROJECT_DIR: project };
  delete env.AIDLC_COMPILED_EXECUTABLE;
  const payload = {
    hook_event_name: "PreToolUse",
    cwd: project,
    session_id: "12345678-1234-1234-1234-123456789abc",
    tool_name: "Bash",
    tool_input: { command: "echo probe", timeout_ms: 1000 },
  };
  try {
    check((target) =>
      Bun.spawnSync([process.execPath, join(hooks, "aidlc-codex-adapter.ts"), target], {
        cwd: project,
        env,
        stdin: Buffer.from(
          JSON.stringify(
            target === "deliver-stage-rules"
              ? { ...payload, tool_name: "spawn_agent", tool_input: { message: "task" } }
              : payload,
          ),
        ),
        stdout: "pipe",
        stderr: "pipe",
      }),
    );
  } finally {
    rmSync(project, { recursive: true, force: true });
    const digest = createHash("sha256").update(project).digest("hex").slice(0, 16);
    rmSync(join(tmpdir(), `aidlc-codex-dedupe-${digest}`), { recursive: true, force: true });
  }
}

describe("Codex adapter compatibility", () => {
  test("session binding returns an allowed rewrite and replays it unchanged", () => {
    withAdapter((invoke) => {
      const first = invoke("bind-bash-session");
      expect(first.exitCode).toBe(0);
      const output = JSON.parse(first.stdout.toString()).hookSpecificOutput;
      expect(output.permissionDecision).toBe("allow");
      expect(output.updatedInput.command).toContain("AIDLC_SESSION_OVERRIDE='12345678-1234-1234-1234-123456789abc'");
      expect(output.updatedInput.timeout_ms).toBe(1000);
      expect(invoke("bind-bash-session").stdout.toString()).toBe(first.stdout.toString());
    });
  });

  test("stage delivery adds allow without losing context or rewritten agent input", () => {
    const core = {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        updatedInput: { message: "stage rules" },
        additionalContext: "context",
      },
    };
    withAdapter((invoke) => {
      const first = invoke("deliver-stage-rules");
      expect(first.exitCode).toBe(0);
      expect(JSON.parse(first.stdout.toString())).toEqual({
        hookSpecificOutput: { ...core.hookSpecificOutput, permissionDecision: "allow" },
      });
      expect(invoke("deliver-stage-rules").stdout.toString()).toBe(first.stdout.toString());
    }, JSON.stringify(core));
  });

  for (const decision of ["deny", "ask"]) {
    test(`stage delivery preserves ${decision}`, () => {
      const core = JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: decision,
          updatedInput: { message: "rules" },
        },
      });
      withAdapter((invoke) => expect(invoke("deliver-stage-rules").stdout.toString()).toBe(core), core);
    });
  }

  test("blocking core responses retain exit code, diagnostics and body", () => {
    const core = JSON.stringify({
      hookSpecificOutput: { hookEventName: "PreToolUse", updatedInput: { message: "rules" } },
    });
    withAdapter(
      (invoke) => {
        const result = invoke("deliver-stage-rules");
        expect(result.exitCode).toBe(2);
        expect(result.stdout.toString()).toBe(core);
        expect(result.stderr.toString()).toContain("core diagnostic");
      },
      core,
      2,
    );
  });

  test("non-JSON diagnostics pass through", () => {
    withAdapter((invoke) => expect(invoke("deliver-stage-rules").stdout.toString()).toBe("diagnostic"), "diagnostic");
  });
});

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

test("Codex generates real plugin runners under .agents/skills", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      ".codex/tools/aidlc-plugin-test.ts",
      "aidlc-workflows/plugins/test-pro",
      "--install",
      ".",
      "--harness",
      "codex",
      "--json",
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  const output = JSON.parse(result.stdout.toString());
  expect(output.errors).toEqual([]);
  expect(result.exitCode).toBe(0);
  expect(output.idempotent).toBe(true);
  expect(output.graph.presentStages).toEqual(["test-pro-full-suite", "test-pro-integration"]);
  for (const name of ["test-pro-full-suite", "test-pro-integration", "test-pro-validation"]) {
    expect(output.composedFiles).toContain(`.agents/skills/${name}/SKILL.md`);
  }
});
