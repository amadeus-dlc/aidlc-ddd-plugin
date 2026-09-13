import type { InspectionInput, InspectionRequest, Issue, Location, MemberEvidence, StateEvidence } from "../../../tools/ddd/lib/state-exposure/contract.ts";
import { prepareInspectionRequest } from "../../../tools/ddd/lib/state-exposure/request.ts";

export function input(): InspectionInput {
  return { language: "rust", target: { file: "src/model.rs", declarationPath: ["Model"], representation: "rust-struct" },
    sources: [{ path: "src/model.rs", content: "struct Model { value: i32 }\n" }], settings: {}, toolchain: [{ name: "fixture", version: "1" }] };
}
export function request(): InspectionRequest {
  const prepared = prepareInspectionRequest(input());
  if (prepared.kind !== "prepared") throw new Error("Fixture preparation failed.");
  return prepared.request;
}
export function location(byteStart = 0, byteEnd = 6): Location {
  return { file: "src/model.rs", line: 1, byteStart, byteEnd };
}
export function reason(code: Issue["code"] = "unsupported-syntax", subject = "Model.unknown"): Issue {
  return { code, subject, message: "Cannot establish this fact.", location: null };
}
export function member(memberId = "value", value = true): MemberEvidence {
  return { memberId, stateExposure: { status: "resolved", value, evidence: [location(15, 20)] } };
}
export function evidence(items: readonly MemberEvidence[] = [member()]): StateEvidence {
  return { targetStatus: "resolved", targetEvidence: [location()], members: { completeness: "complete", items, reasons: [] } };
}
