// Opt-in live check: invokes the installed Codex CLI with the user's existing
// authentication. All configuration and evidence stay in an ignored sandbox.
import { createHash, randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { copyReferenceFixture } from "./copy-reference-fixture.ts";

const root = resolve(import.meta.dir, "../..");
const mode = process.argv[2] ?? "state";
if (!["state", "task-name"].includes(mode))
  throw new Error("Usage: bun scripts/verify-codex-host.ts [state|task-name]");
const probe = join(root, "ddd-sandbox", `codex-host-${mode}-${randomUUID()}`);
const evidence = join(probe, "evidence");
const probeHome = join(probe, "codex-home");
mkdirSync(evidence, { recursive: true });
mkdirSync(probeHome);
cpSync(join(root, ".codex"), join(probe, ".codex"), { recursive: true });
copyReferenceFixture(join(root, "aidlc-workflows/dist/codex/aidlc"), join(probe, "aidlc"));
for (const file of readdirSync(join(probe, ".codex/agents"))) {
  if (file.endsWith(".toml")) rmSync(join(probe, ".codex/agents", file));
}
const selectedTargets = new Set([
  "bind-bash-session",
  "deliver-stage-rules",
  "start-stage-rules",
  "finish-stage-rules",
]);
const installed = JSON.parse(readFileSync(join(root, ".codex/hooks.json"), "utf8"));
const hooks: Record<string, unknown[]> = {};
for (const [event, groups] of Object.entries(installed.hooks) as [string, { hooks: { command: string }[] }[]][]) {
  for (const group of groups) {
    const selected = group.hooks.filter((hook) => selectedTargets.has(hook.command.split(" ").at(-1) ?? ""));
    if (selected.length) {
      hooks[event] ??= [];
      hooks[event].push({
        ...group,
        hooks: selected.map((hook) => ({ ...hook, command: `bun probe-hook.ts ${hook.command.split(" ").at(-1)}` })),
      });
    }
  }
}
writeFileSync(join(probe, ".codex/hooks.json"), JSON.stringify({ hooks }, null, 2));
writeFileSync(
  join(probe, "probe-hook.ts"),
  `import { appendFileSync } from "node:fs";
const input = await Bun.stdin.text();
const target = process.argv[2];
const result = Bun.spawnSync([process.execPath, ".codex/hooks/aidlc-codex-adapter.ts", target], { stdin: Buffer.from(input), stdout: "pipe", stderr: "pipe" });
appendFileSync("evidence/hooks.jsonl", JSON.stringify({target, input: JSON.parse(input), stdout: result.stdout.toString(), stderr: result.stderr.toString(), code: result.exitCode}) + "\\n");
process.stdout.write(result.stdout); process.stderr.write(result.stderr); process.exit(result.exitCode);
`,
);
writeFileSync(
  join(probe, ".codex/probe-agent.toml"),
  `developer_instructions = """
This is a hook transport test. Do not run tools or execute a lifecycle. Inspect only your delivered context. Return the exact value of HOST_PROBE_TOKEN, or TOKEN_MISSING when it is absent. Never infer a value.
"""
`,
);
writeFileSync(
  join(probe, ".codex/config.toml"),
  `[features]
hooks = true
multi_agent = true
[agents.aidlc-product-agent]
description = "Reports a token from delivered context in a bounded transport test."
config_file = "probe-agent.toml"
`,
);
const token = `host-probe-${randomUUID()}`;
const memory = join(probe, "aidlc/spaces/default/memory/phases/inception.md");
writeFileSync(memory, `${readFileSync(memory, "utf8")}\nHOST_PROBE_TOKEN: ${token}\n`);
if (mode === "state") {
  const intents = join(probe, "aidlc/spaces/default/intents");
  mkdirSync(intents, { recursive: true });
  writeFileSync(join(intents, "aidlc-state.md"), "# Probe workflow\n\n- **Current Stage**: user-stories\n");
}
const auth = join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "auth.json");
if (!existsSync(auth)) throw new Error("Log in to the local Codex CLI before running this live check.");
const authLink = join(probeHome, "auth.json");
writeFileSync(
  join(probeHome, "config.toml"),
  `model = "gpt-6-astra"\n[projects.${JSON.stringify(probe)}]\ntrust_level = "trusted"\n`,
);
const taskName = mode === "state" ? "transport_test" : "aidlc_stage_user_stories__transport";
const prompt = `This is an authorized, bounded Codex hook transport test. Do not read files or execute the AI-DLC workflow.
1. Run exactly one shell command: python3 -c 'import os,json; print(json.dumps({"session":os.getenv("AIDLC_SESSION_OVERRIDE"),"source":os.getenv("AIDLC_SESSION_OVERRIDE_SOURCE")}))'
2. Spawn exactly one agent with agent_type aidlc-product-agent, task_name ${taskName}, and message: "Transport test for .codex/aidlc-common/stages/inception/user-stories.md. Do not run that stage or tools. Return the exact HOST_PROBE_TOKEN from your delivered context, or TOKEN_MISSING if absent."
3. Wait for the child, then return only a JSON object with session, source, child_token, using the actual shell output and child answer. Do not guess values or make other tool calls.`;
writeFileSync(join(evidence, "prompt.txt"), prompt);
const env = { ...process.env, CODEX_HOME: probeHome };
for (const key of Object.keys(env)) {
  if (
    key.startsWith("ORCA_") ||
    [
      "CODEX_THREAD_ID",
      "CODEX_SESSION_ID",
      "CODEX_CI",
      "AIDLC_PROJECT_DIR",
      "CLAUDE_PROJECT_DIR",
      "AIDLC_SESSION_OVERRIDE",
      "AIDLC_SESSION_OVERRIDE_SOURCE",
      "AIDLC_COMPILED_EXECUTABLE",
      "AIDLC_RULES_DIR",
    ].includes(key)
  )
    delete env[key];
}
const git = Bun.spawnSync(["git", "init", "-q", probe]);
if (git.exitCode !== 0) throw new Error("Could not initialize the disposable probe repository.");
const version = Bun.spawnSync(["codex", "--version"]).stdout.toString().trim();
symlinkSync(auth, authLink);
const proc = (() => {
  try {
    return Bun.spawn(
      [
        "codex",
        "-a",
        "never",
        "exec",
        "--ignore-rules",
        "--dangerously-bypass-hook-trust",
        "--enable",
        "hooks",
        "--enable",
        "multi_agent",
        "-m",
        "gpt-6-astra",
        "-s",
        "workspace-write",
        "-C",
        probe,
        "--json",
        "-o",
        join(evidence, "final.txt"),
        "-",
      ],
      {
        cwd: probe,
        env,
        stdin: "pipe",
        stdout: Bun.file(join(evidence, "events.jsonl")),
        stderr: Bun.file(join(evidence, "stderr.log")),
      },
    );
  } catch (error) {
    rmSync(authLink, { force: true });
    throw error;
  }
})();
proc.stdin.write(prompt);
proc.stdin.end();
const timer = setTimeout(() => proc.kill(), 180_000);
let exit: number;
try {
  exit = await proc.exited;
} finally {
  clearTimeout(timer);
  rmSync(authLink, { force: true });
}
const events = readFileSync(join(evidence, "events.jsonl"), "utf8")
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const finalPath = join(evidence, "final.txt");
const final = existsSync(finalPath) ? JSON.parse(readFileSync(finalPath, "utf8")) : {};
const thread = events.find((event) => event.type === "thread.started")?.thread_id;
const hookPath = join(evidence, "hooks.jsonl");
const runs = existsSync(hookPath)
  ? readFileSync(hookPath, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  : [];
const child = runs.find((run) => run.target === "start-stage-rules");
const childContext = child?.stdout ? JSON.parse(child.stdout).hookSpecificOutput?.additionalContext : "";
const shell = events.filter((event) => event.type === "item.completed" && event.item?.type === "command_execution");
const shellResult = shell.length === 1 ? JSON.parse(shell[0].item.aggregated_output) : {};
const passed =
  exit === 0 &&
  runs.every((run) => run.code === 0) &&
  !!thread &&
  final.session === thread &&
  final.source === "payload" &&
  shellResult.session === thread &&
  shellResult.source === "payload" &&
  final.child_token === token &&
  childContext.includes(token);
const summary = {
  version,
  model: "gpt-6-astra",
  mode,
  verdict: passed ? "VERIFIED" : "NOT VERIFIED",
  shell_session_matches: shellResult.session === thread,
  child_token_matches: final.child_token === token,
  hook_context_has_token: childContext.includes(token),
  hook_events: runs.map((run) => ({
    target: run.target,
    event: run.input.hook_event_name,
    tool: run.input.tool_name,
    exit: run.code,
  })),
  artifact_sha256: Object.fromEntries(
    ["events.jsonl", "hooks.jsonl", "final.txt"]
      .filter((file) => existsSync(join(evidence, file)))
      .map((file) => [
        file,
        createHash("sha256")
          .update(readFileSync(join(evidence, file)))
          .digest("hex"),
      ]),
  ),
};
writeFileSync(join(evidence, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ ...summary, evidence }, null, 2));
process.exitCode = passed ? 0 : 1;
