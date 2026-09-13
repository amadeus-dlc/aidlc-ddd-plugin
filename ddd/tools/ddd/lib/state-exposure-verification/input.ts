import { createHash } from "node:crypto";
import type { InspectionInput, InspectionRequest, Location } from "../state-exposure/index.ts";
import { prepareInspectionRequest } from "../state-exposure/index.ts";

export interface FrozenTask {
  input: InspectionInput;
  request: InspectionRequest;
}
export function freezeInput(input: InspectionInput): FrozenTask {
  const prepared = prepareInspectionRequest(input);
  if (prepared.kind !== "prepared") throw new Error(JSON.stringify(prepared.issues));
  return { input: JSON.parse(JSON.stringify(input)), request: prepared.request };
}
export function verifyTask(task: FrozenTask): void {
  const prepared = prepareInspectionRequest(task.input);
  if (prepared.kind !== "prepared" || prepared.request.requestIdentity !== task.request.requestIdentity)
    throw new Error("frozen input identity mismatch");
}
export function digest(content: string): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}
export function byteLocation(request: InspectionRequest, start: number, end: number): Location {
  const snapshot = request.sources.find((source) => source.path === request.target.file);
  if (
    !snapshot ||
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= end ||
    end > snapshot.byteLength
  )
    throw new Error("invalid source location");
  let line = 0;
  for (const offset of snapshot.lineStarts) {
    if (offset > start) break;
    line++;
  }
  return { file: request.target.file, line, byteStart: start, byteEnd: end };
}
