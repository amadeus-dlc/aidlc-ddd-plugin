/**
 * Whether the canonical model the code gates decide against is available for one record (BR3.4).
 * Shared by every language's code gate, so a skipped, absent or unreadable model means the same to
 * all of them.
 */

import { join } from "node:path";
import { readStageStatus, type SensorRunContext } from "../runtime/context.ts";
import { MODEL_DATA_PATH } from "../schema/artifacts.ts";
import { loadDomainModel, OPERATION_OWNED_SCHEMA_VERSION } from "../schema/loader.ts";
import { finding, relPath } from "../sensors/common.ts";
import type { FindingInput } from "../shared/findings.ts";
import type { ModelAvailability } from "./types.ts";

/**
 * The model of `run`'s record, and the finding an executed stage whose model does not load raises.
 * `dependentChecks` names the checks of the calling gate that read the model, which a skipped or
 * absent model leaves unchecked; each language's gate decides a different set of them.
 */
export function readModelAvailability(
  run: SensorRunContext,
  dependentChecks: readonly string[],
): { model: ModelAvailability; findings: FindingInput[] } {
  const status = readStageStatus(run, "ddd-domain-modeling");
  if (status.execution === "SKIP" || status.execution === "absent") {
    return {
      model: {
        status: status.execution === "SKIP" ? "skipped" : "absent",
        note: `domain-modeling is ${status.execution}; model-dependent checks (${dependentChecks.join(", ")}) skipped`,
      },
      findings: [],
    };
  }
  const modelPath = join(run.record_dir, MODEL_DATA_PATH);
  const loaded = loadDomainModel(modelPath, OPERATION_OWNED_SCHEMA_VERSION);
  if (!loaded.ok)
    return {
      model: { status: "invalid" },
      findings: [
        finding(
          "model.invalid",
          relPath(run, modelPath),
          "domain-modeling ran but ddd-domain-model-yaml.md did not load",
        ),
      ],
    };
  return { model: { status: "available", index: loaded.index }, findings: [] };
}
