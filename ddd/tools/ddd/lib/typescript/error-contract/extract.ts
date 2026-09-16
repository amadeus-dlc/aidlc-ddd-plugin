/**
 * One TypeScript inspection: the frozen snapshot and the recorded condition in,
 * one contract response out. Everything the response carries is stated in the
 * shared contract's own vocabulary, so no Compiler API value leaves this module.
 */

import type ts from "typescript";
import type { ContractEvidence, ContractResponse } from "../../error-contract/index.ts";
import { SCHEMA_VERSION } from "../../error-contract/index.ts";
import { type FrozenTask, verifyTask } from "../../error-contract-verification/input.ts";
import { typeScriptSelection } from "../../project-settings/payload.ts";
import { type Context, compilerPath, location, problem, subjectOf } from "./context.ts";
import { locateOperation } from "./operation.ts";
import { createInspectionProgram, TS_ERROR_CONTRACT_TOOLCHAIN } from "./program.ts";
import { resolveResultContract } from "./result.ts";

function evidenceOf(context: Context, file: ts.SourceFile): ContractEvidence {
  if (context.program.getSyntacticDiagnostics(file).length)
    return {
      operationStatus: "unresolved",
      reasons: [problem(context, "syntax-error", "The compiler cannot scan this source.")],
    };
  const operation = locateOperation(context, file);
  if (operation.kind !== "found") return { operationStatus: "unresolved", reasons: [operation.issue] };
  const facts = resolveResultContract(context, operation.declaration);
  return {
    operationStatus: "resolved",
    operation: operation.identity,
    operationEvidence: [location(context, operation.declaration)],
    resultContract: facts.resultContract,
    errorCases: facts.errorCases,
    resolutionPath: operation.step ? [operation.step, ...facts.steps] : [...facts.steps],
  };
}

export function extractTypeScriptErrorContract(task: FrozenTask): ContractResponse {
  verifyTask(task);
  if (task.request.language !== "typescript") throw new Error("expected TypeScript input");
  if (
    TS_ERROR_CONTRACT_TOOLCHAIN.some(
      (tool) =>
        !task.request.toolchain.some((claimed) => claimed.name === tool.name && claimed.version === tool.version),
    )
  )
    throw new Error("TypeScript toolchain identity mismatch");
  const request = task.request;
  const condition = request.typeScriptCondition;
  const program = createInspectionProgram(task.input.sources, condition);
  const file = program.getSourceFile(compilerPath(request.target.file));
  if (!file) throw new Error("frozen target source unavailable");

  const selection = typeScriptSelection(task.input.settings);
  const evidence: ContractEvidence = selection
    ? evidenceOf(
        {
          request,
          condition,
          representation: selection.codeRepresentation,
          program,
          checker: program.getTypeChecker(),
        },
        file,
      )
    : {
        operationStatus: "unresolved",
        reasons: [
          {
            code: "unsupported-syntax",
            message: "The settings name no code representation to inspect.",
            subject: subjectOf(request),
            location: null,
          },
        ],
      };
  return { schemaVersion: SCHEMA_VERSION, requestIdentity: request.requestIdentity, evidence };
}
