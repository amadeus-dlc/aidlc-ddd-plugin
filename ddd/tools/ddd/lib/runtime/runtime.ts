/**
 * runSensor — the sensor execution contract (BR7).
 *
 * A sensor script builds its definition (sensor_id, severity, evaluate) and
 * hands runSensor its argv. The runtime resolves the context, runs the
 * callback, assembles the verdict, and writes exactly one JSON line to stdout
 * (logs go to stderr). It fails closed: an evaluation error is reported as
 * pass:false, never swallowed. Exit code 127 is reserved for a missing bundled
 * asset (ToolUnavailableError); everything else exits 0.
 */

import { assembleFindings, type FindingInput, type SensorFinding, type Severity } from "../shared/findings.ts";
import { resolveContext, type SensorRunContext } from "./context.ts";

export class ToolUnavailableError extends Error {}
export class BudgetExceededError extends Error {}

export interface SensorApi {
  readonly context: SensorRunContext;
  elapsedMs(): number;
  budgetExceeded(): boolean;
  /** Throws BudgetExceededError when the soft budget has elapsed (BR7.8). */
  checkBudget(): void;
}

export interface SensorEvaluation {
  findings: FindingInput[];
  note?: string;
}

export interface SensorDefinition {
  sensor_id: string;
  severity: Severity;
  budget_ms?: number;
  evaluate(context: SensorRunContext, api: SensorApi): FindingInput[] | SensorEvaluation;
}

export interface SensorVerdict {
  pass: boolean;
  sensor_id: string;
  stage: string;
  output_path: string;
  findings_count: number;
  findings: SensorFinding[];
  reason?: string;
  note?: string;
}

export interface SensorIO {
  stdout(text: string): void;
  stderr(text: string): void;
}

const defaultIO: SensorIO = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

function emit(io: SensorIO, verdict: SensorVerdict): void {
  io.stdout(`${JSON.stringify(verdict)}\n`);
}

function summarize(findings: readonly FindingInput[]): string {
  if (findings.length === 1) return `${findings[0].rule_id}: ${findings[0].message}`;
  return `${findings.length} findings`;
}

export function runSensor(
  definition: SensorDefinition,
  argv: readonly string[] = process.argv.slice(2),
  io: SensorIO = defaultIO,
): number {
  const resolved = resolveContext(argv, { budgetMs: definition.budget_ms });
  if (!resolved.ok) {
    emit(io, {
      pass: false,
      sensor_id: definition.sensor_id,
      stage: "",
      output_path: "",
      findings_count: 0,
      findings: [],
      reason: resolved.reason,
    });
    return 0;
  }
  const context = resolved.context;
  const startedAt = Date.now();
  const api: SensorApi = {
    context,
    elapsedMs: () => Date.now() - startedAt,
    budgetExceeded: () => context.budget_ms !== undefined && Date.now() - startedAt > context.budget_ms,
    checkBudget: () => {
      if (context.budget_ms !== undefined && Date.now() - startedAt > context.budget_ms) {
        throw new BudgetExceededError();
      }
    },
  };

  let findings: FindingInput[];
  let note: string | undefined;
  try {
    const evaluated = definition.evaluate(context, api);
    if (Array.isArray(evaluated)) {
      findings = evaluated;
    } else {
      findings = evaluated.findings;
      note = evaluated.note;
    }
  } catch (error) {
    if (error instanceof ToolUnavailableError) {
      io.stderr(`${definition.sensor_id}: tool unavailable: ${error.message}\n`);
      return 127;
    }
    const reason =
      error instanceof BudgetExceededError
        ? "budget-exceeded"
        : `runtime-error: ${error instanceof Error ? error.message : String(error)}`;
    emit(io, {
      pass: false,
      sensor_id: definition.sensor_id,
      stage: context.stage,
      output_path: context.output_path,
      findings_count: 0,
      findings: [],
      reason,
    });
    return 0;
  }

  if (api.budgetExceeded()) {
    emit(io, {
      pass: false,
      sensor_id: definition.sensor_id,
      stage: context.stage,
      output_path: context.output_path,
      findings_count: 0,
      findings: [],
      reason: "budget-exceeded",
    });
    return 0;
  }

  const assembled = assembleFindings(definition.sensor_id, definition.severity, findings);
  emit(io, {
    pass: assembled.length === 0,
    sensor_id: definition.sensor_id,
    stage: context.stage,
    output_path: context.output_path,
    findings_count: assembled.length,
    findings: assembled,
    ...(assembled.length === 0 ? {} : { reason: summarize(findings) }),
    ...(note === undefined ? {} : { note }),
  });
  return 0;
}
