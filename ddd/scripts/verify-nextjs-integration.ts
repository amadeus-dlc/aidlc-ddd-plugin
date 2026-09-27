// Verify the TypeScript generation samples inside an ESM Next.js application on the server-side
// Node.js runtime (T-11-06), rather than by inspecting their sources on their own.
//
// For every sample (both code representations under both module layouts) a fresh project joins the
// sample's packages and the host of tests/fixtures/nextjs-integration, and this script
//   1. installs it with `npm ci` from the committed lockfile, fetching Next.js from the npm registry,
//   2. builds the host with `next build`,
//   3. runs the four TypeScript gates of the source tools, each of which has to inspect the project
//      and pass, and the module layout CI entry, which has to exit 0,
//   4. starts the host with `next start` on Node.js and sends the issue requests of the host fixture,
//      whose answers have to be the ones it states,
// and removes the server and the project on every path. The result is printed as JSON; its versions
// are read from what npm installed and from the tools that ran.
//
// Needs Node.js and npm on PATH and access to the npm registry. Not part of `bun run check`.
//
// Usage: bun scripts/verify-nextjs-integration.ts
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Subprocess } from "bun";
import { HOST_DIR, ISSUE_REQUESTS, integratedWorkspace, issuePath } from "../tests/fixtures/nextjs-integration/host.ts";
import {
  inspectedPassProblemsAt,
  runLayoutCiEntryAt,
  sampleGateCases,
} from "../tests/fixtures/typescript-generation/gate-runs.ts";
import { type GenerationSample, generationSamples } from "../tests/fixtures/typescript-generation/samples.ts";
import { writeCase } from "../tests/golden/runner.ts";

const dddRoot = resolve(import.meta.dir, "..");
const toolsDir = join(dddRoot, "tools");
const lockfile = join(dddRoot, "tests/fixtures/nextjs-integration/package-lock.json");
const SERVER_READY_MS = 60_000;
/** How long one command (`npm ci`, `next build`, a gate) may run before it is killed and failed. */
const COMMAND_TIMEOUT_MS = 15 * 60_000;
const SERVER_STOP_MS = 10_000;

interface StepResult {
  readonly step: string;
  readonly ok: boolean;
  readonly seconds: number;
  readonly detail?: unknown;
}
interface SampleResult {
  readonly representation: string;
  readonly layout: string;
  readonly ok: boolean;
  /** The versions npm installed; absent when `npm ci` failed. */
  readonly installed?: Readonly<Record<string, string>>;
  readonly steps: readonly StepResult[];
}

const running = new Set<Subprocess>();
const projects = new Set<string>();

// An interrupted run still stops the server it started and removes its project; the handler, not a
// `finally`, ends the process, since the pending steps would otherwise go on after it.
for (const [signal, code] of [
  ["SIGINT", 130],
  ["SIGTERM", 143],
] as const) {
  process.on(signal, () => {
    for (const child of running) child.kill("SIGTERM");
    for (const project of projects) rmSync(project, { recursive: true, force: true });
    process.exit(code);
  });
}

function seconds(since: number): number {
  return Math.round((performance.now() - since) / 10) / 100;
}

/**
 * Runs `command` to its end. Bun kills a command that outlives `COMMAND_TIMEOUT_MS`, and the run still
 * waits for its output streams and its exit, so no process or stream outlives the step that started
 * it and the project is removed only once nothing is writing into it.
 */
async function run(
  command: readonly string[],
  cwd: string,
): Promise<{ exitCode: number; output: string; timedOut: boolean }> {
  const child = Bun.spawn([...command], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    timeout: COMMAND_TIMEOUT_MS,
    killSignal: "SIGKILL",
  });
  running.add(child);
  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    return { exitCode, output: `${stdout}${stderr}`, timedOut: child.signalCode === "SIGKILL" };
  } finally {
    running.delete(child);
  }
}

async function commandStep(step: string, command: readonly string[], cwd: string): Promise<StepResult> {
  const started = performance.now();
  const { exitCode, output, timedOut } = await run(command, cwd);
  if (timedOut)
    return {
      step,
      ok: false,
      seconds: seconds(started),
      detail: `killed after ${COMMAND_TIMEOUT_MS} ms: ${output.slice(-4000)}`,
    };
  return exitCode === 0
    ? { step, ok: true, seconds: seconds(started) }
    : { step, ok: false, seconds: seconds(started), detail: `exit ${exitCode}: ${output.slice(-4000)}` };
}

function version(root: string, name: string): string {
  return (JSON.parse(readFileSync(join(root, "node_modules", name, "package.json"), "utf8")) as { version: string })
    .version;
}

function freePort(): number {
  const listener = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
  const { port } = listener;
  listener.stop(true);
  return port;
}

async function stopServer(server: Subprocess): Promise<void> {
  if (server.exitCode !== null || server.signalCode !== null) return;
  server.kill("SIGTERM");
  const stopped = await Promise.race([server.exited.then(() => true), Bun.sleep(SERVER_STOP_MS).then(() => false)]);
  if (!stopped) {
    server.kill("SIGKILL");
    await server.exited;
  }
}

/** Waits until the server answers any request, and reports why it did not when it exits or times out. */
async function waitForServer(server: Subprocess, origin: string): Promise<string | undefined> {
  const deadline = performance.now() + SERVER_READY_MS;
  while (performance.now() < deadline) {
    if (server.exitCode !== null || server.signalCode !== null) return `next start exited ${server.exitCode}`;
    const answered = await fetch(origin).then(
      () => true,
      () => false,
    );
    if (answered) return undefined;
    await Bun.sleep(250);
  }
  return `next start did not answer within ${SERVER_READY_MS} ms`;
}

async function serveAndRequest(root: string): Promise<StepResult[]> {
  const port = freePort();
  const origin = `http://127.0.0.1:${port}`;
  const started = performance.now();
  const server = Bun.spawn(
    ["node", join(root, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)],
    { cwd: join(root, HOST_DIR), stdout: "ignore", stderr: "pipe" },
  );
  running.add(server);
  const serverErrors = new Response(server.stderr).text();
  try {
    const notReady = await waitForServer(server, origin);
    if (notReady !== undefined) {
      await stopServer(server);
      return [
        { step: "next start", ok: false, seconds: seconds(started), detail: `${notReady}: ${await serverErrors}` },
      ];
    }
    const steps: StepResult[] = [{ step: "next start", ok: true, seconds: seconds(started) }];
    for (const request of ISSUE_REQUESTS) {
      const path = issuePath(request.invoice);
      const step = `POST ${path}`;
      const expected = { status: request.status, body: request.body };
      const sent = performance.now();
      let status: number | undefined;
      let text: string | undefined;
      try {
        const response = await fetch(`${origin}${path}`, { method: "POST" });
        status = response.status;
        text = await response.text();
        const body: unknown = JSON.parse(text);
        const ok = status === request.status && JSON.stringify(body) === JSON.stringify(request.body);
        steps.push({ step, ok, seconds: seconds(sent), detail: { status, body, expected } });
      } catch (error) {
        // A request that fails or an answer that is not JSON (an HTML error page, a dropped
        // connection) is this step's failure, and the requests after it are not sent.
        const message = error instanceof Error ? error.message : String(error);
        steps.push({ step, ok: false, seconds: seconds(sent), detail: { error: message, status, text, expected } });
        break;
      }
    }
    return steps;
  } finally {
    await stopServer(server);
    running.delete(server);
  }
}

/** The gates and the CI entry over the project `writeCase` wrote at `root`, after it was installed and built. */
function gateSteps(sample: GenerationSample, root: string, outputPath: string): StepResult[] {
  const steps: StepResult[] = sampleGateCases(sample).map((gateCase) => {
    const started = performance.now();
    const problems = inspectedPassProblemsAt(toolsDir, gateCase, outputPath);
    return { step: `gate ${gateCase.sensor}`, ok: problems.length === 0, seconds: seconds(started), detail: problems };
  });
  const started = performance.now();
  const ci = runLayoutCiEntryAt(toolsDir, root);
  steps.push({ step: "layout CI entry", ok: ci.exitCode === 0, seconds: seconds(started), detail: ci.output.trim() });
  return steps;
}

async function verifySample(sample: GenerationSample): Promise<SampleResult> {
  const root = mkdtempSync(join(tmpdir(), "ddd-nextjs-integration-"));
  projects.add(root);
  const steps: StepResult[] = [];
  let installed: Record<string, string> | undefined;
  try {
    const outputPath = writeCase(root, { ...sample.domainCase, workspace: integratedWorkspace(sample) });
    copyFileSync(lockfile, join(root, "package-lock.json"));

    steps.push(await commandStep("npm ci", ["npm", "ci", "--no-audit", "--no-fund"], root));
    if (steps.every((step) => step.ok)) {
      installed = Object.fromEntries(
        ["next", "react", "react-dom", "typescript"].map((name) => [name, version(root, name)]),
      );
      steps.push(
        await commandStep(
          "next build",
          ["node", join(root, "node_modules/next/dist/bin/next"), "build"],
          join(root, HOST_DIR),
        ),
      );
    }
    if (steps.every((step) => step.ok)) steps.push(...gateSteps(sample, root, outputPath));
    if (steps.every((step) => step.ok)) steps.push(...(await serveAndRequest(root)));
  } catch (error) {
    // An exception in a stage is recorded as that sample's failure, so the other samples still run
    // and the result is still printed.
    steps.push({
      step: "unexpected error",
      ok: false,
      seconds: 0,
      detail: error instanceof Error ? (error.stack ?? error.message) : String(error),
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
    projects.delete(root);
  }
  return {
    representation: sample.representation,
    layout: sample.layout,
    ok: steps.every((step) => step.ok),
    installed,
    steps,
  };
}

const startedAt = new Date().toISOString();
const samples: SampleResult[] = [];
for (const sample of generationSamples()) samples.push(await verifySample(sample));
const tool = async (command: string[]) => (await run(command, dddRoot)).output.trim();
const ok = samples.every((sample) => sample.ok);
console.log(
  JSON.stringify(
    {
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      platform: `${process.platform}-${process.arch}`,
      toolchain: { node: await tool(["node", "--version"]), npm: await tool(["npm", "--version"]), bun: Bun.version },
      ok,
      samples,
    },
    null,
    2,
  ),
);
process.exitCode = ok ? 0 : 1;
