import { describe, expect, test } from "bun:test";
import type { InspectionRequest } from "../tools/ddd/lib/error-contract/contract.ts";
import { REASON_CODES, RESOLUTION_STEP_KINDS, SCHEMA_VERSION } from "../tools/ddd/lib/error-contract/contract.ts";
import { validateExecution, validateResponse } from "../tools/ddd/lib/error-contract/evidence.ts";
import { resolveErrorContract } from "../tools/ddd/lib/error-contract/inspection.ts";
import { prepareErrorContractRequest, validateRequest } from "../tools/ddd/lib/error-contract/request.ts";
import { canonicalJson, digest, jsonCopy } from "../tools/ddd/lib/state-exposure/canonical.ts";
import { REASON_CODES as STATE_EXPOSURE_REASON_CODES } from "../tools/ddd/lib/state-exposure/contract.ts";
import {
  cargoPackage,
  caseSet,
  condition,
  DOMAIN_ID,
  errorCase,
  errorCases,
  errorTypeLocation,
  evidence,
  input,
  lineStarts,
  operation,
  operationLocation,
  reason,
  request,
  response,
  resultContract,
  SOURCE,
  SOURCE_PATH,
  settings,
  step,
  USE_CASE_ID,
} from "./fixtures/error-contract/values.ts";

function prepared(value: unknown): InspectionRequest {
  const result = prepareErrorContractRequest(value);
  if (result.kind !== "prepared") throw new Error(JSON.stringify(result));
  return result.request;
}
function rejected(value: unknown) {
  const result = prepareErrorContractRequest(value);
  expect(result.kind).toBe("input-rejected");
  if (result.kind === "input-rejected") {
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ code: "invalid-request" });
  }
}
function invalidResponse(value: unknown, requestValue = request()) {
  expect(validateResponse(value, requestValue)).toMatchObject({
    valid: false,
    issue: { code: "invalid-response", subject: "response", location: null },
  });
}

const BOUNDED_RESOLUTION_CODES = [
  "shadowed-result-identity",
  "alias-cycle",
  "ambiguous-candidate",
  "missing-referent",
  "incomplete-case-set",
  "unsupported-type-argument",
  "multiple-package-versions",
  "trait-selection-required",
  "associated-type-required",
  "expression-inference-required",
  "unknown-cfg",
  "macro-generated",
];

describe("bounded-resolution vocabulary", () => {
  test("extends the state exposure reason codes instead of redefining them", () => {
    for (const code of STATE_EXPOSURE_REASON_CODES) expect(REASON_CODES).toContain(code);
    expect(new Set(REASON_CODES).size).toBe(REASON_CODES.length);
  });
  test("gives every bounded-resolution category its own code", () => {
    expect(new Set(BOUNDED_RESOLUTION_CODES).size).toBe(BOUNDED_RESOLUTION_CODES.length);
    for (const code of BOUNDED_RESOLUTION_CODES) {
      expect(REASON_CODES as readonly string[]).toContain(code);
      expect(STATE_EXPOSURE_REASON_CODES as readonly string[]).not.toContain(code);
    }
  });
  test("names every supported reference form as its own resolution step", () => {
    expect([...RESOLUTION_STEP_KINDS].sort()).toEqual([
      "dependency-rename",
      "direct",
      "qualified",
      "re-export",
      "self-type",
      "type-alias",
      "use-rename",
    ]);
  });
});

describe("request preparation and identity", () => {
  test("prepares the exact snapshot and a recomputable identity", () => {
    const actual = prepared(input());
    const fields: Omit<InspectionRequest, "requestIdentity"> = {
      schemaVersion: SCHEMA_VERSION,
      language: "rust",
      cargoCondition: condition(),
      target: input().target,
      sources: [
        {
          path: SOURCE_PATH,
          sha256: digest(SOURCE),
          byteLength: new TextEncoder().encode(SOURCE).length,
          lineStarts: lineStarts(),
        },
      ],
      settings: settings(),
      toolchain: [{ name: "fixture", version: "1" }],
    };
    expect(actual).toEqual({ ...fields, requestIdentity: digest(canonicalJson(jsonCopy(fields, "expected"))) });
    expect(validateRequest(actual)).toEqual(actual);
  });
  test("rejects a request whose identity does not match its own contents", () => {
    const tampered = { ...prepared(input()), requestIdentity: `sha256:${"0".repeat(64)}` };
    expect(() => validateRequest(tampered)).toThrow();
  });

  const conditionChanges: [string, unknown][] = [
    ["target triple", { ...condition(), targetTriple: "x86_64-unknown-linux-gnu" }],
    ["package identity", { ...condition(), packages: [cargoPackage({ packageId: USE_CASE_ID })] }],
    ["package name", { ...condition(), packages: [cargoPackage({ name: "billing-domain-fork" })] }],
    ["package edition", { ...condition(), packages: [cargoPackage({ edition: "2024" })] }],
    [
      "Cargo target kind",
      {
        ...condition(),
        packages: [cargoPackage({ targets: [{ kind: "bin", name: "billing_domain", srcPath: SOURCE_PATH }] })],
      },
    ],
    [
      "Cargo target name",
      {
        ...condition(),
        packages: [cargoPackage({ targets: [{ kind: "lib", name: "renamed", srcPath: SOURCE_PATH }] })],
      },
    ],
    ["selected features", { ...condition(), packages: [cargoPackage({ features: ["extra-case"] })] }],
    [
      "dependency rename",
      {
        ...condition(),
        packages: [cargoPackage({ dependencyRenames: [{ alias: "billing", packageId: DOMAIN_ID }] })],
      },
    ],
    [
      "package set",
      {
        ...condition(),
        packages: [cargoPackage(), cargoPackage({ packageId: USE_CASE_ID, name: "billing-use-case" })],
      },
    ],
  ];
  test.each(conditionChanges)("a changed Cargo condition changes the request identity: %s", (_label, changed) => {
    expect(prepared({ ...input(), cargoCondition: changed }).requestIdentity).not.toBe(
      prepared(input()).requestIdentity,
    );
  });

  const snapshotChanges: [string, unknown][] = [
    ["operation name", { ...input(), target: { ...input().target, operation: "cancel" } }],
    ["declaration path", { ...input(), target: { ...input().target, declarationPath: ["Other"] } }],
    ["source content", { ...input(), sources: [{ path: SOURCE_PATH, content: `${SOURCE}// changed\n` }] }],
    ["toolchain version", { ...input(), toolchain: [{ name: "fixture", version: "2" }] }],
    [
      "module layout setting",
      {
        ...input(),
        settings: { projectSettings: { version: 2, languages: ["rust"], rust: { moduleLayout: "mod-rs" } } },
      },
    ],
  ];
  test.each(snapshotChanges)("a changed snapshot changes the request identity: %s", (_label, changed) => {
    expect(prepared(changed).requestIdentity).not.toBe(prepared(input()).requestIdentity);
  });

  test("keeps same-name packages apart instead of merging them by name", () => {
    const duplicated = {
      ...condition(),
      packages: [cargoPackage(), cargoPackage({ packageId: `${DOMAIN_ID}-other` })],
    };
    const actual = prepared({ ...input(), cargoCondition: duplicated });
    expect(actual.cargoCondition.packages.map((entry) => entry.packageId)).toEqual([DOMAIN_ID, `${DOMAIN_ID}-other`]);
    expect(actual.cargoCondition.packages.map((entry) => entry.name)).toEqual(["billing-domain", "billing-domain"]);
  });

  const malformed: [string, unknown][] = [
    ["missing condition", { ...input(), cargoCondition: undefined }],
    ["empty package set", { ...input(), cargoCondition: { ...condition(), packages: [] } }],
    ["blank target triple", { ...input(), cargoCondition: { ...condition(), targetTriple: "" } }],
    [
      "duplicate package identity",
      { ...input(), cargoCondition: { ...condition(), packages: [cargoPackage(), cargoPackage()] } },
    ],
    ["blank edition", { ...input(), cargoCondition: { ...condition(), packages: [cargoPackage({ edition: "" })] } }],
    ["no Cargo target", { ...input(), cargoCondition: { ...condition(), packages: [cargoPackage({ targets: [] })] } }],
    [
      "rename pointing outside the condition",
      {
        ...input(),
        cargoCondition: {
          ...condition(),
          packages: [
            cargoPackage({ dependencyRenames: [{ alias: "billing", packageId: "path+file:///absent#0.1.0" }] }),
          ],
        },
      },
    ],
    [
      "blank rename alias",
      {
        ...input(),
        cargoCondition: {
          ...condition(),
          packages: [cargoPackage({ dependencyRenames: [{ alias: "", packageId: DOMAIN_ID }] })],
        },
      },
    ],
    ["target file is not a source", { ...input(), target: { ...input().target, file: "billing-domain/src/gone.rs" } }],
    ["empty declaration path", { ...input(), target: { ...input().target, declarationPath: [] } }],
    ["blank operation", { ...input(), target: { ...input().target, operation: "" } }],
    ["unknown language", { ...input(), language: "typescript" }],
    ["no sources", { ...input(), sources: [] }],
    ["duplicate sources", { ...input(), sources: [...input().sources, ...input().sources] }],
    ["absolute source path", { ...input(), sources: [{ path: `/${SOURCE_PATH}`, content: SOURCE }] }],
    ["non-JSON settings", { ...input(), settings: { bad: undefined } }],
    ["empty toolchain", { ...input(), toolchain: [] }],
  ];
  test.each(malformed)("rejects malformed input: %s", (_label, bad) => rejected(bad));
});

describe("execution envelope", () => {
  test("a completed execution without a response key rejects the invocation", () => {
    expect(resolveErrorContract(request(), { status: "completed" })).toMatchObject({
      kind: "input-rejected",
      issues: [{ code: "invalid-request", subject: "execution.response" }],
    });
  });
  test.each(["unavailable", "failed"] as const)("keeps %s execution apart from a resolution outcome", (status) => {
    expect(
      resolveErrorContract(request(), { status, reasons: [reason("tool-unavailable", "extractor")] }),
    ).toMatchObject({
      kind: "evaluated",
      result: {
        executionState: status,
        evidence: null,
        unresolvedReasons: [{ code: "tool-unavailable", subject: "extractor" }],
      },
    });
  });
  test("valid execution reasons are copied and stripped of supplementary fields", () => {
    expect(
      validateExecution({ status: "failed", reasons: [{ ...reason("timeout", "extractor"), extra: 1 }] }, request()),
    ).toEqual({ status: "failed", reasons: [reason("timeout", "extractor")] });
  });
});

describe("resolution records", () => {
  test("returns every required record and drops supplementary native fields", () => {
    expect(validateResponse({ ...response({ ...evidence(), extra: true }), native: 1 }, request()) as unknown).toEqual({
      valid: true,
      evidence: evidence(),
    });
  });
  test.each(["operation", "operationEvidence", "resultContract", "errorCases", "resolutionPath"])(
    "rejects a resolved response that omits the %s record",
    (field) => {
      const incomplete = evidence();
      delete incomplete[field];
      invalidResponse(response(incomplete));
    },
  );
  test("keeps an incomplete case set apart from a closed empty set", () => {
    expect(
      validateResponse(
        response(
          evidence({
            errorCases: errorCases({
              value: caseSet({ completeness: "partial", items: [], reasons: [reason("incomplete-case-set")] }),
            }),
          }),
        ),
        request(),
      ),
    ).toMatchObject({ valid: true, evidence: { errorCases: { value: { completeness: "partial", items: [] } } } });
    expect(
      validateResponse(response(evidence({ errorCases: errorCases({ value: caseSet({ items: [] }) }) })), request()),
    ).toMatchObject({ valid: true, evidence: { errorCases: { value: { completeness: "complete", items: [] } } } });
  });
  test("an operation with no declared result contract has no case set either", () => {
    const outcome = validateResponse(
      response(
        evidence({
          resultContract: { status: "absent", evidence: [operationLocation()] },
          errorCases: { status: "absent", evidence: [operationLocation()] },
          resolutionPath: [],
        }),
      ),
      request(),
    );
    expect(outcome).toMatchObject({
      valid: true,
      evidence: { resultContract: { status: "absent" }, errorCases: { status: "absent" } },
    });
  });

  const inconsistentCaseSets: [string, unknown][] = [
    ["complete with enumeration reasons", errorCases({ value: caseSet({ reasons: [reason("incomplete-case-set")] }) })],
    ["partial without a reason", errorCases({ value: caseSet({ completeness: "partial" }) })],
    ["unknown completeness", errorCases({ value: caseSet({ completeness: "unknown" }) })],
    ["duplicate case names", errorCases({ value: caseSet({ items: [errorCase(), errorCase()] }) })],
    ["blank case name", errorCases({ value: caseSet({ items: [{ ...errorCase(), name: "" }] }) })],
    ["unresolved without a reason", { status: "unresolved", reasons: [] }],
    ["unknown case set status", { status: "maybe" }],
    ["absent with a value", { status: "absent", evidence: [operationLocation()], value: caseSet() }],
  ];
  test.each(inconsistentCaseSets)("rejects an inconsistent case set: %s", (_label, cases) => {
    invalidResponse(response(evidence({ errorCases: cases })));
  });

  const inconsistentRecords: [string, unknown][] = [
    ["unknown reason code", { operationStatus: "unresolved", reasons: [{ ...reason(), code: "invented" }] }],
    ["unresolved without a reason", { operationStatus: "unresolved", reasons: [] }],
    [
      "unresolved carrying resolved records",
      { operationStatus: "unresolved", reasons: [reason()], operation: operation() },
    ],
    ["unknown operation status", evidence({ operationStatus: "maybe" })],
    ["unknown resolution step kind", evidence({ resolutionPath: [{ ...step(), kind: "guessed" }] })],
    ["resolution step without a target symbol", evidence({ resolutionPath: [{ ...step(), resolved: "" }] })],
    ["empty resolution path beneath a resolved result contract", evidence({ resolutionPath: [] })],
    ["resolved result contract without evidence", evidence({ resultContract: resultContract({ evidence: [] }) })],
    [
      "result contract fact that is both resolved and unresolved",
      evidence({ resultContract: resultContract({ reasons: [reason()] }) }),
    ],
    ["unknown result contract fact status", evidence({ resultContract: { status: "maybe" } })],
    [
      "unresolved result contract without a reason",
      evidence({ resultContract: { status: "unresolved", reasons: [] } }),
    ],
    [
      "unknown success type kind",
      evidence({
        resultContract: resultContract({
          value: { standardResult: true, successType: { kind: "guessed" }, errorType: { kind: "unit" } },
        }),
      }),
    ],
    [
      "nominal type without a symbol",
      evidence({
        resultContract: resultContract({
          value: { standardResult: true, successType: { kind: "unit" }, errorType: { kind: "nominal" } },
        }),
      }),
    ],
    [
      "a standard result without a success and error type",
      evidence({
        resultContract: resultContract({
          value: { standardResult: true, resultType: { kind: "nominal", symbolId: "billing-domain::Result" } },
        }),
      }),
    ],
    [
      "a non standard result carrying success and error types",
      evidence({
        resultContract: resultContract({
          value: {
            standardResult: false,
            resultType: { kind: "nominal", symbolId: "billing-domain::Result" },
            successType: { kind: "unit" },
          },
        }),
      }),
    ],
    ["blank operation symbol", evidence({ operation: { ...operation(), symbolId: "" } })],
    ["operation outside the requested package", evidence({ operation: { ...operation(), packageId: USE_CASE_ID } })],
    ["operation that is not the requested one", evidence({ operation: { ...operation(), operation: "cancel" } })],
    [
      "absent result contract beside a case set that resolved",
      evidence({
        resultContract: { status: "absent", evidence: [operationLocation()] },
        errorCases: errorCases({ value: caseSet() }),
        resolutionPath: [],
      }),
    ],
  ];
  test.each(inconsistentRecords)("rejects an inconsistent resolution record: %s", (_label, bad) => {
    invalidResponse(response(bad));
  });

  test.each([
    { ...errorTypeLocation(), file: "billing-domain/src/absent.rs" },
    { ...errorTypeLocation(), line: 1 },
    { ...errorTypeLocation(), byteStart: -1 },
    { ...errorTypeLocation(), byteEnd: 100_000 },
    { ...errorTypeLocation(), byteEnd: errorTypeLocation().byteStart },
  ])("rejects an invalid location %p", (bad) => {
    invalidResponse(response(evidence({ resolutionPath: [{ ...step(), location: bad }] })));
  });

  test("an unresolved operation carries its reasons and no resolution records", () => {
    expect(
      resolveErrorContract(request(), {
        status: "completed",
        response: response({ operationStatus: "unresolved", reasons: [reason("target-missing")] }),
      }),
    ).toMatchObject({
      kind: "evaluated",
      result: {
        executionState: "completed",
        evidence: { operationStatus: "unresolved" },
        unresolvedReasons: [{ code: "target-missing" }],
      },
    });
  });
  test("carries the case-set reasons of a partial contract into the unresolved reasons", () => {
    const outcome = resolveErrorContract(request(), {
      status: "completed",
      response: response(
        evidence({
          errorCases: errorCases({
            value: caseSet({ completeness: "partial", reasons: [reason("incomplete-case-set")] }),
          }),
        }),
      ),
    });
    expect(outcome).toMatchObject({
      kind: "evaluated",
      result: { executionState: "completed", unresolvedReasons: [{ code: "incomplete-case-set" }] },
    });
  });
  test("accepts a result type that is not the standard result and reports why the contract is blocked", () => {
    const outcome = resolveErrorContract(request(), {
      status: "completed",
      response: response(
        evidence({
          resultContract: resultContract({
            value: { standardResult: false, resultType: { kind: "nominal", symbolId: "billing-domain::Result" } },
          }),
          errorCases: { status: "unresolved", reasons: [reason("shadowed-result-identity")] },
          resolutionPath: [step("direct")],
        }),
      ),
    });
    expect(outcome).toMatchObject({
      kind: "evaluated",
      result: {
        evidence: { resultContract: { status: "resolved", value: { standardResult: false } } },
        unresolvedReasons: [{ code: "shadowed-result-identity" }],
      },
    });
  });
  test("allows an empty resolution path when no result contract was resolved", () => {
    expect(
      validateResponse(
        response(
          evidence({
            resultContract: { status: "unresolved", reasons: [reason("expression-inference-required")] },
            errorCases: { status: "unresolved", reasons: [reason("expression-inference-required")] },
            resolutionPath: [],
          }),
        ),
        request(),
      ),
    ).toMatchObject({ valid: true });
  });
  test("discards the whole response when one record is invalid", () => {
    expect(
      resolveErrorContract(request(), {
        status: "completed",
        response: response(evidence({ resolutionPath: [{ ...step(), kind: "guessed" }] })),
      }),
    ).toMatchObject({
      kind: "evaluated",
      result: { evidence: null, unresolvedReasons: [{ code: "invalid-response" }] },
    });
  });
  test("rejects an unknown response version before reading its body", () => {
    expect(validateResponse({ ...response(42), schemaVersion: "error-contract/2" }, request())).toMatchObject({
      valid: false,
      issue: { code: "unknown-version", subject: "response.schemaVersion" },
    });
    // `evidence` belongs to this version, so a later one that carries no such field is still a version report.
    expect(
      validateResponse({ schemaVersion: "error-contract/2", requestIdentity: request().requestIdentity }, request()),
    ).toMatchObject({ valid: false, issue: { code: "unknown-version", subject: "response.schemaVersion" } });
  });
});

describe("a build condition change inside one inspection process", () => {
  test("re-derives the result and refuses the previous condition's response", () => {
    const withoutFeature = request();
    const withFeature = request({
      cargoCondition: { ...condition(), packages: [cargoPackage({ features: ["extra-case"] })] },
    });

    expect(withFeature.requestIdentity).not.toBe(withoutFeature.requestIdentity);
    expect(withFeature.cargoCondition.packages[0].features).toEqual(["extra-case"]);
    expect(withoutFeature.cargoCondition.packages[0].features).toEqual([]);

    const previous = response(evidence(), withoutFeature.requestIdentity);
    expect(validateResponse(previous, withFeature)).toMatchObject({
      valid: false,
      issue: { code: "identity-mismatch", subject: "response.requestIdentity" },
    });
    expect(resolveErrorContract(withFeature, { status: "completed", response: previous })).toMatchObject({
      kind: "evaluated",
      result: {
        requestIdentity: withFeature.requestIdentity,
        evidence: null,
        unresolvedReasons: [{ code: "identity-mismatch" }],
      },
    });

    const current = response(
      evidence({
        errorCases: errorCases({
          value: caseSet({ items: [errorCase("AlreadyIssued"), errorCase("Empty"), errorCase("Rejected")] }),
        }),
      }),
      withFeature.requestIdentity,
    );
    const accepted = validateResponse(current, withFeature);
    expect(accepted).toMatchObject({ valid: true });
    if (accepted.valid && accepted.evidence.operationStatus === "resolved") {
      const cases = accepted.evidence.errorCases;
      if (cases.status !== "resolved") throw new Error("expected a resolved case set");
      expect(cases.value.items.map((item) => item.name)).toEqual(["AlreadyIssued", "Empty", "Rejected"]);
    }
  });
});
