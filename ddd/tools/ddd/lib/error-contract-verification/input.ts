import type { InspectionInput, InspectionRequest, Location } from "../error-contract/index.ts";
import { prepareErrorContractRequest } from "../error-contract/index.ts";

/** An input and its request always name one language, so a frozen task carries one analysis condition. */
type FrozenTaskOf<Named extends InspectionInput["language"]> = {
  input: Extract<InspectionInput, { language: Named }>;
  request: Extract<InspectionRequest, { language: Named }>;
};
type FrozenTasks = { rust: FrozenTaskOf<"rust">; typescript: FrozenTaskOf<"typescript"> };
export type FrozenTask<Named extends InspectionInput["language"] = InspectionInput["language"]> = FrozenTasks[Named];
export function freezeInput<Input extends InspectionInput>(input: Input): FrozenTask<Input["language"]> {
  const prepared = prepareErrorContractRequest(input);
  if (prepared.kind !== "prepared") throw new Error(JSON.stringify(prepared.issues));
  // Preparation carries the language tag it validated, so the request names this input's own arm.
  return { input: JSON.parse(JSON.stringify(input)), request: prepared.request } as FrozenTask<Input["language"]>;
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
