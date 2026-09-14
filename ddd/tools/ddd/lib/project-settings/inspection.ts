/**
 * Projects a validated selection into the one field of the inspection input that participates in
 * request identity. A selection that disagrees with the requested target is refused here, before a
 * request exists, so no extractor ever substitutes a representation the team did not choose.
 */

import type { InspectionInput, Issue } from "../state-exposure/index.ts";
import type { ProjectSelection } from "./contract.ts";
import { projectSettingsPayload, TARGET_REPRESENTATION } from "./payload.ts";

export type InspectionBinding =
  | { readonly kind: "bound"; readonly input: InspectionInput }
  | { readonly kind: "input-rejected"; readonly issues: readonly Issue[] };

function refuse(subject: string, message: string): InspectionBinding {
  return { kind: "input-rejected", issues: [{ code: "invalid-request", message, subject, location: null }] };
}

export function bindInspectionInput(
  selection: ProjectSelection,
  base: Omit<InspectionInput, "settings">,
): InspectionBinding {
  const bound: InspectionBinding = { kind: "bound", input: { ...base, settings: projectSettingsPayload(selection) } };
  if (base.language === "rust") {
    if (selection.rust === null) return refuse("language", "the settings do not put Rust in use");
    return bound;
  }
  if (selection.typescript === null) return refuse("language", "the settings do not put TypeScript in use");
  const expected = TARGET_REPRESENTATION[selection.typescript.codeRepresentation];
  if (base.target.representation !== expected)
    return refuse(
      "target.representation",
      `the settings choose the ${selection.typescript.codeRepresentation} code representation, which inspects ${expected}`,
    );
  return bound;
}
