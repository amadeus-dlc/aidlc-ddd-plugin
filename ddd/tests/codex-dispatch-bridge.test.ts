import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { copyReferenceFixture } from "../scripts/copy-reference-fixture.ts";

const root = resolve(import.meta.dir, "../..");
const role = "aidlc-product-agent";
const task = { agent_type: role, task_name: "aidlc_stage_user_stories__probe", message: "gAAAAAopaque-ciphertext" };
const developer = { tool_input: { ...task, agent_type: "aidlc-developer-agent" } };
const start = { hook_event_name: "SubagentStart", agent_id: "child-1", agent_type: role };

function fixture(
  check: (
    invoke: (target: string, fields?: Record<string, unknown>) => ReturnType<typeof Bun.spawnSync>,
    dir: string,
  ) => void,
) {
  const dir = mkdtempSync(join(tmpdir(), "ddd-bridge-test-"));
  cpSync(join(root, ".codex"), join(dir, ".codex"), { recursive: true });
  copyReferenceFixture(join(root, "aidlc-workflows/dist/codex/aidlc"), join(dir, "aidlc"));
  appendFileSync(
    join(dir, "aidlc/spaces/default/memory/phases/inception.md"),
    "\nBRIDGE_RULE_TOKEN: inception-proof\n",
  );
  const env: Record<string, string | undefined> = { ...process.env, AIDLC_PROJECT_DIR: dir };
  for (const key of [
    "AIDLC_COMPILED_EXECUTABLE",
    "AIDLC_RULES_DIR",
    "AIDLC_SESSION_OVERRIDE",
    "AIDLC_SESSION_OVERRIDE_SOURCE",
  ])
    delete env[key];
  const payload = {
    cwd: dir,
    session_id: "bridge-parent-session",
    tool_use_id: "dispatch-1",
    hook_event_name: "PreToolUse",
    tool_name: "collaborationspawn_agent",
    tool_input: task,
  };
  try {
    check(
      (target, fields = {}) =>
        Bun.spawnSync([process.execPath, ".codex/hooks/aidlc-codex-adapter.ts", target], {
          cwd: dir,
          env,
          stdin: Buffer.from(JSON.stringify({ ...payload, ...fields })),
          stdout: "pipe",
          stderr: "pipe",
        }),
      dir,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
    const digest = createHash("sha256").update(dir).digest("hex").slice(0, 16);
    rmSync(join(tmpdir(), `aidlc-codex-dedupe-${digest}`), { recursive: true, force: true });
  }
}

function stateFile(dir: string, stage: string): string {
  const intents = join(dir, "aidlc/spaces/default/intents");
  mkdirSync(intents, { recursive: true });
  const path = join(intents, "aidlc-state.md");
  writeFileSync(path, `# Workflow\n\n- **Current Stage**: ${stage}\n`);
  return path;
}

test("opaque dispatch reaches the child without rewriting ciphertext; duplicate delivery is stable", () =>
  fixture((invoke) => {
    const pre = invoke("deliver-stage-rules");
    expect(pre.exitCode).toBe(0);
    expect(pre.stdout.toString()).toBe("");
    const child = invoke("start-stage-rules", start);
    expect(child.exitCode).toBe(0);
    const out = JSON.parse(child.stdout.toString());
    expect(out.hookSpecificOutput.hookEventName).toBe("SubagentStart");
    expect(out.hookSpecificOutput.additionalContext).toContain("BRIDGE_RULE_TOKEN: inception-proof");
    expect(out.hookSpecificOutput.additionalContext).toContain("stage:user-stories");
    expect(out.hookSpecificOutput.additionalContext).not.toContain("gAAAAA");
    expect(invoke("start-stage-rules", start).stdout.toString()).toBe(child.stdout.toString());
  }));

test("missing or invalid stage hints block opaque dispatch", () =>
  fixture((invoke) => {
    for (const name of ["ordinary_task", "aidlc_stage_not_a_stage__probe"]) {
      const result = invoke("deliver-stage-rules", { tool_use_id: name, tool_input: { ...task, task_name: name } });
      expect(result.exitCode).toBe(2);
      expect(result.stderr.toString()).toContain("stage");
    }
  }));

test("current workflow stage selects the bundle without a task-name hint", () =>
  fixture((invoke, dir) => {
    stateFile(dir, "user-stories");
    expect(invoke("deliver-stage-rules", { tool_input: { ...task, task_name: "ordinary_task" } }).exitCode).toBe(0);
    expect(invoke("start-stage-rules", start).stdout.toString()).toContain("inception-proof");
  }));

test("the snapshot cannot leak to another session or role, or pick up later rule edits", () =>
  fixture((invoke, dir) => {
    expect(invoke("deliver-stage-rules").exitCode).toBe(0);
    appendFileSync(join(dir, "aidlc/spaces/default/memory/phases/inception.md"), "\nLATER_RULE_TOKEN\n");
    expect(invoke("start-stage-rules", { ...start, session_id: "other-session" }).stdout.toString()).toBe("");
    expect(invoke("start-stage-rules", { ...start, agent_type: "aidlc-quality-agent" }).stdout.toString()).toBe("");
    const child = invoke("start-stage-rules", start);
    expect(child.stdout.toString()).toContain("inception-proof");
    expect(child.stdout.toString()).not.toContain("LATER_RULE_TOKEN");
  }));

test("overlapping same-role dispatch waits until the first child receives its bundle", () =>
  fixture((invoke) => {
    expect(invoke("deliver-stage-rules").exitCode).toBe(0);
    expect(invoke("deliver-stage-rules", { tool_use_id: "dispatch-2" }).exitCode).toBe(2);
    expect(invoke("start-stage-rules", start).stdout.toString()).toContain("inception-proof");
    expect(invoke("deliver-stage-rules", { tool_use_id: "dispatch-3" }).exitCode).toBe(0);
    expect(invoke("start-stage-rules", { ...start, agent_id: "child-2" }).stdout.toString()).toContain(
      "inception-proof",
    );
  }));

test("post-tool cleanup releases a definite spawn failure", () =>
  fixture((invoke) => {
    expect(invoke("deliver-stage-rules").exitCode).toBe(0);
    expect(invoke("deliver-stage-rules", { tool_use_id: "blocked" }).exitCode).toBe(2);
    expect(
      invoke("finish-stage-rules", {
        hook_event_name: "PostToolUse",
        tool_response: JSON.stringify({ error: "spawn failed" }),
      }).exitCode,
    ).toBe(0);
    expect(invoke("deliver-stage-rules", { tool_use_id: "dispatch-2" }).exitCode).toBe(0);
  }));

test("non-AI-DLC and composer agents keep their existing behavior", () =>
  fixture((invoke) => {
    for (const agent_type of ["default", "aidlc-composer-agent"]) {
      const pre = invoke("deliver-stage-rules", {
        tool_use_id: agent_type,
        tool_input: { ...task, agent_type, task_name: "plain" },
      });
      expect(pre.exitCode).toBe(0);
      expect(pre.stdout.toString()).toBe("");
    }
  }));

test("installed hooks wire both dispatch names, child startup, and cleanup", () => {
  const hooks = JSON.parse(readFileSync(join(root, ".codex/hooks.json"), "utf8")).hooks;
  const dispatch = hooks.PreToolUse.find((entry: { hooks: { command: string }[] }) =>
    entry.hooks.some((hook) => hook.command.endsWith(" deliver-stage-rules")),
  );
  expect(dispatch.matcher).toContain("collaborationspawn_agent");
  for (const [event, target] of [
    ["SubagentStart", "start-stage-rules"],
    ["PostToolUse", "finish-stage-rules"],
  ]) {
    expect(
      hooks[event]?.some((entry: { hooks: { command: string }[] }) =>
        entry.hooks.some((hook) => hook.command.endsWith(` ${target}`)),
      ),
    ).toBe(true);
  }
});

test("a single-stage hint overrides the main pointer without changing it", () =>
  fixture((invoke, dir) => {
    const path = stateFile(dir, "code-generation");
    const state = readFileSync(path, "utf8");
    expect(invoke("deliver-stage-rules").exitCode).toBe(0);
    expect(invoke("start-stage-rules", start).stdout.toString()).toContain("stage:user-stories");
    expect(readFileSync(path, "utf8")).toBe(state);
  }));

test("core guards receive the canonical Task shape and unchanged opaque prompt", () =>
  fixture((invoke, dir) => {
    writeFileSync(
      join(dir, ".codex/hooks/aidlc-plan-approval-guard.ts"),
      'const input = JSON.parse(await Bun.stdin.text()); if (input.tool_name === "Task" && input.tool_input.prompt === "gAAAAAopaque-ciphertext") { process.stderr.write("canonical dispatch blocked"); process.exit(2); }',
    );
    const result = invoke("plan-approval-guard", developer);
    expect(result.exitCode).toBe(2);
    expect(result.stderr.toString()).toContain("canonical dispatch blocked");
  }));

test("successful PostToolUse before startup retains the prepared rules", () =>
  fixture((invoke) => {
    expect(invoke("deliver-stage-rules").exitCode).toBe(0);
    expect(
      invoke("finish-stage-rules", {
        hook_event_name: "PostToolUse",
        tool_response: JSON.stringify({ task_name: "/root/aidlc_stage_user_stories__probe" }),
      }).exitCode,
    ).toBe(0);
    expect(invoke("start-stage-rules", start).stdout.toString()).toContain("inception-proof");
  }));

for (const guardFirst of [false, true]) {
  test(`guard rejection ${guardFirst ? "before" : "after"} preparation cannot strand a reservation`, () =>
    fixture((invoke, dir) => {
      writeFileSync(
        join(dir, ".codex/hooks/aidlc-plan-approval-guard.ts"),
        'process.stderr.write("guard rejection"); process.exit(2);',
      );
      if (!guardFirst) expect(invoke("deliver-stage-rules", developer).exitCode).toBe(0);
      expect(invoke("plan-approval-guard", developer).exitCode).toBe(2);
      if (guardFirst) expect(invoke("deliver-stage-rules", developer).exitCode).toBe(2);
      expect(invoke("deliver-stage-rules", { ...developer, tool_use_id: "after-guard" }).exitCode).toBe(0);
    }));
}
