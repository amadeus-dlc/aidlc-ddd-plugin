// Codex's collaboration route can seal message before PreToolUse. Preserve
// that input and transfer the exact rule snapshot through SubagentStart.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadGraph } from "../tools/aidlc-graph.ts";
import {
  agentsDir, getField, readActiveDirectiveMarker, sessionsDir, stateFilePath, validSessionId,
} from "../tools/aidlc-lib.ts";

export interface DispatchInput {
  session_id?: string;
  tool_use_id?: string;
  tool_input?: Record<string, unknown>;
  agent_type?: string;
  agent_id?: string;
  tool_response?: unknown;
}
interface Receipt { call: string; context: string }
const MAX_BYTES = 512 * 1024;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

function receiptDir(project: string, session: string, role: string): string {
  return join(sessionsDir(project), "codex-dispatch", hash(session), hash(role));
}

function locked<T>(dir: string, action: () => T): T {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const lock = join(dir, "lock");
  for (let attempt = 0; ; attempt++) {
    try { mkdirSync(lock); break; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST" || attempt >= 50) {
        throw new Error("AI-DLC dispatch receipt is busy; retry the dispatch after its current hook finishes.");
      }
      Bun.sleepSync(10);
    }
  }
  try { return action(); }
  finally { rmSync(lock, { recursive: true, force: true }); }
}

function readReceipt(path: string): Receipt | null {
  if (!existsSync(path)) return null;
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!parsed || typeof parsed !== "object" || !("call" in parsed) || !("context" in parsed) ||
      typeof parsed.call !== "string" || typeof parsed.context !== "string") {
    throw new Error("Invalid AI-DLC dispatch receipt; inspect the session's codex-dispatch directory.");
  }
  return { call: parsed.call, context: parsed.context };
}

function stageForDispatch(project: string, input: DispatchInput): string {
  const task = input.tool_input?.task_name;
  if (typeof task === "string" && task.startsWith("aidlc_stage_")) {
    const match = /^aidlc_stage_([a-z0-9]+(?:_[a-z0-9]+)*)(?:__[a-z0-9_]+)?$/.exec(task);
    if (!match) throw new Error("Invalid AI-DLC stage hint in task_name.");
    return match[1].replaceAll("_", "-");
  }
  const path = stateFilePath(project);
  if (existsSync(path)) {
    const state = readFileSync(path, "utf8");
    const marker = readActiveDirectiveMarker(project, state);
    if (marker && marker.owner_session === input.session_id &&
        ["run-stage", "dispatch-subagent", "invoke-swarm"].includes(marker.kind ?? "") &&
        marker.delivery !== "consumed" && marker.delivery !== "superseded") return marker.stage;
    const current = getField(state, "Current Stage")?.trim();
    if (current) return current;
  }
  throw new Error(
    "AI-DLC cannot resolve the stage from an opaque Codex dispatch. Select the workflow stage first, " +
    "or use task_name aidlc_stage_<stage_slug_with_underscores>__<task> for an explicit single-stage dispatch.",
  );
}

export async function prepareDispatch(project: string, input: DispatchInput): Promise<void> {
  const { dispatchHookOutput, isAidlcAgent } = await import("./aidlc-deliver-stage-rules.ts");
  const role = input.tool_input?.agent_type;
  if (!isAidlcAgent(role)) return;
  const session = validSessionId(input.session_id);
  const call = input.tool_use_id;
  if (!session || !call) throw new Error("AI-DLC dispatch requires session_id and tool_use_id.");
  const stage = stageForDispatch(project, input);
  const node = loadGraph().find((item) => item.slug === stage);
  if (!node) throw new Error(`Unknown AI-DLC stage: ${stage}`);
  const brief = `Run /stages/${node.phase}/${stage}.md.`;
  const result = dispatchHookOutput({ tool_name: "spawn_agent", tool_input: { agent_type: role, message: brief } }, project);
  if (result.error) throw new Error(result.error);
  const rewritten = result.updatedInput?.message;
  const context = result.changed && typeof rewritten === "string" && rewritten.startsWith(brief)
    ? rewritten.slice(brief.length) : "";
  if (Buffer.byteLength(childOutput(context), "utf8") > MAX_BYTES) {
    throw new Error("AI-DLC stage rules exceed the bounded SubagentStart output limit; reduce the rule bundle.");
  }
  const dir = receiptDir(project, session, role);
  locked(dir, () => {
    const path = join(dir, "pending.json");
    if (existsSync(join(dir, `canceled-${hash(call)}`))) {
      throw new Error("AI-DLC dispatch was rejected by another guard; resolve that rejection before retrying.");
    }
    const pending = readReceipt(path);
    if (pending && (pending.call !== call || pending.context !== context)) {
      throw new Error("An AI-DLC dispatch for this session and agent role is still starting; wait for it, then retry.");
    }
    writeFileSync(path, JSON.stringify({ call, context }), { mode: 0o600 });
  });
}

// Startup and cancellation need no prompt parser. Accept only locally
// installed AI-DLC roles, matching the core dispatch hook's eligibility.
function knownRole(role: unknown): role is string {
  return typeof role === "string" && /^[a-z0-9][a-z0-9-]*-agent$/.test(role) &&
    role !== "aidlc-composer-agent" && existsSync(join(agentsDir(), `${role}.md`));
}

function childOutput(context: string): string {
  return context ? `${JSON.stringify({ hookSpecificOutput: { hookEventName: "SubagentStart", additionalContext: context } })}\n` : "";
}

export function startDispatch(project: string, input: DispatchInput): string {
  const session = validSessionId(input.session_id);
  const role = input.agent_type;
  const child = input.agent_id;
  if (!session || !knownRole(role) || !child) return "";
  const dir = receiptDir(project, session, role);
  if (!existsSync(dir)) return "";
  return locked(dir, () => {
    const delivered = join(dir, `child-${hash(child)}.json`);
    const prior = readReceipt(delivered);
    if (prior) return childOutput(prior.context);
    const path = join(dir, "pending.json");
    const pending = readReceipt(path);
    if (!pending) return "";
    // Freeze by child id before freeing the role slot, so a duplicate startup
    // never consumes the next dispatch's rules.
    writeFileSync(delivered, JSON.stringify(pending), { mode: 0o600 });
    rmSync(path);
    return childOutput(pending.context);
  });
}

export function abortDispatch(project: string, input: DispatchInput): void {
  const session = validSessionId(input.session_id);
  const role = input.tool_input?.agent_type;
  if (!session || !knownRole(role) || !input.tool_use_id) return;
  const call = input.tool_use_id;
  const dir = receiptDir(project, session, role);
  locked(dir, () => {
    // A concurrent rejecting guard may finish before prepareDispatch starts.
    // The tombstone prevents that late preparation from reserving a dead call.
    writeFileSync(join(dir, `canceled-${hash(call)}`), "", { mode: 0o600 });
    const path = join(dir, "pending.json");
    if (readReceipt(path)?.call === call) rmSync(path);
  });
}

export function finishDispatch(project: string, input: DispatchInput): void {
  let response = input.tool_response;
  if (typeof response === "string") {
    try { response = JSON.parse(response); } catch { return; }
  }
  // On Codex 0.153.4 a successful PostToolUse precedes SubagentStart. Keep
  // the reservation until startup consumes it; only a definite failure frees it.
  if (response && typeof response === "object" &&
      (("is_error" in response && response.is_error === true) ||
       ("error" in response && response.error !== null && response.error !== undefined))) {
    abortDispatch(project, input);
  }
}
