/**
 * Sensor findings — the shared report vocabulary for every ddd sensor.
 *
 * U1 owns these types: the sensor runtime assembles them into a SensorVerdict
 * (see runtime/runtime.ts) and the schema layer returns them as load-time
 * violations. A finding is deterministic: same input, same (finding_id, order).
 */

export type Severity = "blocking" | "advisory";

/** A finding before the runtime assigns `finding_id` and sorts it. */
export interface FindingInput {
  rule_id: string;
  file: string;
  line?: number;
  message: string;
}

/** A fully assembled finding as it appears in the SensorVerdict. */
export interface SensorFinding {
  finding_id: string;
  sensor_id: string;
  rule_id: string;
  file: string;
  line?: number;
  message: string;
  severity: Severity;
}

/** BR9.1 — rule_id, file and message are mandatory. */
export function assertFindingInput(input: FindingInput): void {
  if (!input.rule_id || !input.file || !input.message) {
    throw new Error(`sensor finding is missing a required field: ${JSON.stringify(input)}`);
  }
  if (input.line !== undefined && (!Number.isInteger(input.line) || input.line < 1)) {
    throw new Error(`sensor finding line must be a positive integer: ${input.line}`);
  }
}

/** BR7.7 — findings are ordered by (file, line, rule_id, message). */
export function compareFindings(a: FindingInput, b: FindingInput): number {
  const byFile = a.file.localeCompare(b.file, "en");
  if (byFile !== 0) return byFile;
  const aLine = a.line ?? 0;
  const bLine = b.line ?? 0;
  if (aLine !== bLine) return aLine - bLine;
  const byRule = a.rule_id.localeCompare(b.rule_id, "en");
  if (byRule !== 0) return byRule;
  return a.message.localeCompare(b.message, "en");
}

/**
 * BR9.2 — sort, then assign `<sensor_id>:<rule_id>:<ordinal>` with a 1-based
 * ordinal and the manifest severity transcribed onto every finding.
 */
export function assembleFindings(
  sensorId: string,
  severity: Severity,
  inputs: readonly FindingInput[],
): SensorFinding[] {
  const sorted = [...inputs].sort(compareFindings);
  return sorted.map((input, index) => ({
    finding_id: `${sensorId}:${input.rule_id}:${index + 1}`,
    sensor_id: sensorId,
    rule_id: input.rule_id,
    file: input.file,
    ...(input.line === undefined ? {} : { line: input.line }),
    message: input.message,
    severity,
  }));
}
