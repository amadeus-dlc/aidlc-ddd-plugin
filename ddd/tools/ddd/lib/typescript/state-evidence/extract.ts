import ts from "typescript";
import { acceptsTypeScriptSettings } from "../../project-settings/payload.ts";
import type { EvidenceResponse, StateEvidence } from "../../state-exposure/index.ts";
import { type FrozenTask, verifyTask } from "../../state-exposure-verification/input.ts";
import { extractClass } from "./class.ts";
import { extractCompanion } from "./companion.ts";
import { type Context, unresolved } from "./context.ts";
import { createFrozenProgram, TS_TOOLCHAIN } from "./program.ts";

function extract(context: Context, program: ts.Program): StateEvidence {
  const { file, task } = context;
  if (program.getSyntacticDiagnostics(file).length) return unresolved(context, "syntax-error");
  if (
    task.request.target.declarationPath.length !== 1 ||
    !acceptsTypeScriptSettings(task.input.settings, task.request.target.representation)
  )
    return unresolved(context, "unsupported-syntax");
  if (
    file.statements.some(
      (s) =>
        ts.isImportDeclaration(s) ||
        ts.isImportEqualsDeclaration(s) ||
        (ts.isExportDeclaration(s) && !!s.moduleSpecifier),
    )
  )
    return unresolved(context, "unsupported-syntax");
  const name = task.request.target.declarationPath[0];
  const classes = file.statements.filter(
    (s): s is ts.ClassDeclaration => ts.isClassDeclaration(s) && s.name?.text === name,
  );
  if (task.request.target.representation === "ts-class") {
    if (classes.length !== 1) return unresolved(context, classes.length ? "target-ambiguous" : "target-missing");
    return extractClass(context, classes[0]);
  }
  const types = file.statements.filter(
    (s): s is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(s) && s.name.text === name,
  );
  const values = file.statements
    .flatMap((s) => (ts.isVariableStatement(s) ? [...s.declarationList.declarations] : []))
    .filter((s) => ts.isIdentifier(s.name) && s.name.text === name);
  if (types.length !== 1 || values.length !== 1)
    return unresolved(context, types.length > 1 || values.length > 1 ? "target-ambiguous" : "target-missing");
  return extractCompanion(context, types[0], values[0]);
}
export function extractTypeScriptLocal(task: FrozenTask): EvidenceResponse {
  verifyTask(task);
  if (
    TS_TOOLCHAIN.some(
      (tool) =>
        !task.request.toolchain.some((claimed) => claimed.name === tool.name && claimed.version === tool.version),
    )
  )
    throw new Error("TypeScript toolchain identity mismatch");
  if (task.request.language !== "typescript") throw new Error("expected TypeScript input");
  const program = createFrozenProgram(task);
  const file = program.getSourceFile(`/input/${task.request.target.file}`);
  if (!file) throw new Error("frozen target source unavailable");
  const context: Context = { task, file, checker: program.getTypeChecker() };
  return {
    schemaVersion: "state-exposure/1",
    requestIdentity: task.request.requestIdentity,
    evidence: extract(context, program),
  };
}
