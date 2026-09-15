import type { InspectionInput, InspectionRequest, Location } from "../error-contract/index.ts";
import { prepareErrorContractRequest } from "../error-contract/index.ts";

export interface FrozenTask {
  input: InspectionInput;
  request: InspectionRequest;
}
export function freezeInput(input: InspectionInput): FrozenTask {
  const prepared = prepareErrorContractRequest(input);
  if (prepared.kind !== "prepared") throw new Error(JSON.stringify(prepared.issues));
  return { input: JSON.parse(JSON.stringify(input)), request: prepared.request };
}
export function verifyTask(task: FrozenTask): void {
  const prepared = prepareErrorContractRequest(task.input);
  if (prepared.kind !== "prepared" || prepared.request.requestIdentity !== task.request.requestIdentity)
    throw new Error("frozen input identity mismatch");
}
/** Resolution crosses files, so a native range names the source it was measured in. */
export function byteLocation(request: InspectionRequest, file: string, start: number, end: number): Location {
  const snapshot = request.sources.find((source) => source.path === file);
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
  return { file, line, byteStart: start, byteEnd: end };
}
