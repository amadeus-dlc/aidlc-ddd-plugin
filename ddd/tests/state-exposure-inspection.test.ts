import { describe, expect, test } from "bun:test";
import type {
  Finding,
  InspectionOutcome,
  InspectionResult,
  Issue,
  StateEvidence,
} from "../tools/ddd/lib/state-exposure/contract.ts";
import { inspectStateExposure } from "../tools/ddd/lib/state-exposure/inspection.ts";
import { evidence, input, location, member, reason, request } from "./fixtures/state-exposure-inspection/values.ts";

function inspect(checked: StateEvidence) {
  const req = request();
  return inspectStateExposure(req, {
    status: "completed",
    response: { schemaVersion: "state-exposure/1", requestIdentity: req.requestIdentity, evidence: checked },
  });
}
function expected(
  checkedEvidence: StateEvidence | null,
  ruleResult: InspectionResult["ruleResult"],
  findings: readonly Finding[] = [],
  unresolvedReasons: readonly Issue[] = [],
  executionState: InspectionResult["executionState"] = "completed",
): InspectionOutcome {
  return {
    kind: "evaluated",
    result: {
      schemaVersion: "state-exposure/1",
      requestIdentity: request().requestIdentity,
      target: input().target,
      executionState,
      ruleResult,
      checkedEvidence,
      findings,
      unresolvedReasons,
    },
  };
}
const exposed: Finding = { code: "state-exposed", memberId: "value", evidence: [location(15, 20)] };

describe("state exposure judgment", () => {
  test("complete private state passes and retains the exact evidence", () => {
    const checked = evidence([member("value", false)]);
    expect(inspect(checked)).toEqual(expected(checked, "pass"));
  });
  test("complete public state violates with its confirmed location", () => {
    const checked = evidence();
    expect(inspect(checked)).toEqual(expected(checked, "violation", [exposed]));
  });
  test("partial empty enumeration is unresolved, never an absence proof", () => {
    const checked: StateEvidence = {
      targetStatus: "resolved",
      targetEvidence: [location()],
      members: {
        completeness: "partial",
        items: [],
        reasons: [reason("incomplete-evidence", "Model")],
      },
    };
    expect(inspect(checked)).toEqual(expected(checked, "unresolved", [], [reason("incomplete-evidence", "Model")]));
  });
  test("partial evidence keeps confirmed exposure alongside enumeration failure", () => {
    const checked: StateEvidence = {
      targetStatus: "resolved",
      targetEvidence: [location()],
      members: {
        completeness: "partial",
        items: [member()],
        reasons: [reason("incomplete-evidence", "Model")],
      },
    };
    expect(inspect(checked)).toEqual(
      expected(checked, "unresolved", [exposed], [reason("incomplete-evidence", "Model")]),
    );
  });
  test("complete enumeration with an unresolved fact still remains unresolved", () => {
    const checked = evidence([{ memberId: "unknown", stateExposure: { status: "unresolved", reasons: [reason()] } }]);
    expect(inspect(checked)).toEqual(expected(checked, "unresolved", [], [reason()]));
  });
  test("unknown member semantics do not erase another member's violation", () => {
    const checked = evidence([
      { memberId: "unknown", stateExposure: { status: "unresolved", reasons: [reason()] } },
      member(),
    ]);
    expect(inspect(checked)).toEqual(expected(checked, "unresolved", [exposed], [reason()]));
  });
  test.each(["target-missing", "target-ambiguous", "syntax-error"] as const)("retains unresolved target %s", (code) => {
    const checked: StateEvidence = { targetStatus: "unresolved", reasons: [reason(code, "Model")] };
    expect(inspect(checked)).toEqual(expected(checked, "unresolved", [], [reason(code, "Model")]));
  });
  test("a confirmed non-state member is absent, not exposed", () => {
    const checked = evidence([
      { memberId: "operation", stateExposure: { status: "absent", evidence: [location(15, 20)] } },
    ]);
    expect(inspect(checked)).toEqual(expected(checked, "pass"));
  });
  test("complete empty enumeration passes only with target evidence", () => {
    const checked = evidence([]);
    expect(inspect(checked)).toEqual(expected(checked, "pass"));
  });
  test.each([
    ["unavailable", "tool-unavailable"],
    ["failed", "execution-failed"],
    ["failed", "timeout"],
    ["failed", "output-limit"],
    ["failed", "resource-limit"],
  ] as const)("preserves %s execution and %s cause", (status, code) => {
    expect(inspectStateExposure(request(), { status, reasons: [reason(code, "extractor")] })).toEqual(
      expected(null, "unresolved", [], [reason(code, "extractor")], status),
    );
  });
});

import type {
  EvidenceResponse,
  InspectionInput,
  InspectionRequest,
  MemberEvidence,
} from "../tools/ddd/lib/state-exposure/index.ts";
import {
  inspectStateExposure as inspectPublic,
  prepareInspectionRequest,
} from "../tools/ddd/lib/state-exposure/index.ts";

function preparePublic(source: unknown): InspectionRequest {
  const prepared = prepareInspectionRequest(source);
  if (prepared.kind !== "prepared") throw new Error("Invalid integration fixture.");
  return prepared.request;
}
function executePublic(req: InspectionRequest, checked: StateEvidence) {
  const response: EvidenceResponse = {
    schemaVersion: "state-exposure/1",
    requestIdentity: req.requestIdentity,
    evidence: checked,
  };
  return inspectPublic(req, { status: "completed", response });
}

describe("public boundary integration", () => {
  test("request preparation, JSON round trips and inspection preserve all evidence", () => {
    const req = preparePublic(JSON.parse(JSON.stringify(input())));
    const checked = evidence([member("value", false)]);
    const actual = executePublic(JSON.parse(JSON.stringify(req)), JSON.parse(JSON.stringify(checked)));
    expect(actual).toEqual(expected(checked, "pass"));
    expect(JSON.parse(JSON.stringify(actual))).toEqual(expected(checked, "pass"));
  });
  test("a pass with only a different evidence position remains observably different", () => {
    const req = preparePublic(input());
    const original = evidence([member("value", false)]);
    const changed = evidence([
      { memberId: "value", stateExposure: { status: "resolved", value: false, evidence: [location(14, 20)] } },
    ]);
    const first = executePublic(req, original);
    const second = executePublic(req, changed);
    expect(first).toEqual(expected(original, "pass"));
    expect(second).toEqual(expected(changed, "pass"));
    expect(second).not.toEqual(first);
  });
  test("input mutations cannot alter an already returned request or result", () => {
    const mutable = { ...input(), settings: { flags: [1] }, target: { ...input().target, declarationPath: ["Model"] } };
    const req = preparePublic(mutable);
    const positions = [location(15, 20)];
    const items: MemberEvidence[] = [
      { memberId: "value", stateExposure: { status: "resolved", value: true, evidence: positions } },
    ];
    const targetPositions = [location()];
    const checked: StateEvidence = {
      targetStatus: "resolved",
      targetEvidence: targetPositions,
      members: { completeness: "complete", items, reasons: [] },
    };
    const actual = executePublic(req, checked);
    const expectedResult: InspectionOutcome = {
      kind: "evaluated",
      result: {
        schemaVersion: "state-exposure/1",
        requestIdentity: req.requestIdentity,
        target: input().target,
        executionState: "completed",
        ruleResult: "violation",
        checkedEvidence: evidence(),
        findings: [exposed],
        unresolvedReasons: [],
      },
    };
    positions.push(location());
    items.length = 0;
    targetPositions.length = 0;
    mutable.settings.flags.push(2);
    mutable.target.declarationPath[0] = "Other";
    (req.target.declarationPath as string[])[0] = "Changed request";
    expect(actual).toEqual(expectedResult);
  });
  test("scalar member ordering and numeric evidence ordering retain duplicate evidence", () => {
    const req = preparePublic(input());
    const positions = [location(15, 20), location(2, 10), location(2, 6), location(2, 6)];
    const items = ["𐀀", "\ue000", "a"].map((memberId) => ({
      memberId,
      stateExposure: { status: "resolved" as const, value: true, evidence: positions },
    }));
    const checked: StateEvidence = {
      targetStatus: "resolved",
      targetEvidence: [...positions],
      members: { completeness: "complete", items, reasons: [] },
    };
    const sortedPositions = [location(2, 6), location(2, 6), location(2, 10), location(15, 20)];
    const sorted: StateEvidence = {
      targetStatus: "resolved",
      targetEvidence: sortedPositions,
      members: {
        completeness: "complete",
        reasons: [],
        items: ["a", "\ue000", "𐀀"].map((memberId) => ({
          memberId,
          stateExposure: { status: "resolved", value: true, evidence: sortedPositions },
        })),
      },
    };
    const findings = ["a", "\ue000", "𐀀"].map((memberId) => ({
      code: "state-exposed" as const,
      memberId,
      evidence: sortedPositions,
    }));
    expect(executePublic(req, checked)).toEqual(expected(sorted, "violation", findings));
    expect(items.map((item) => item.memberId)).toEqual(["𐀀", "\ue000", "a"]);
    expect(positions).toEqual([location(15, 20), location(2, 10), location(2, 6), location(2, 6)]);
  });
  test("reasons sort by code, subject, null/location and message without deduplication", () => {
    const a = { ...reason(), message: "a" };
    const b = { ...reason(), message: "b" };
    const located = { ...reason(), location: location() };
    const anotherSubject = reason("unsupported-syntax", "z");
    const anotherCode = reason("syntax-error", "z");
    const order = [anotherCode, a, a, b, located, anotherSubject];
    const checked: StateEvidence = {
      targetStatus: "unresolved",
      reasons: [anotherSubject, located, b, a, anotherCode, a],
    };
    const normalized: StateEvidence = { targetStatus: "unresolved", reasons: order };
    expect(executePublic(preparePublic(input()), checked)).toEqual(expected(normalized, "unresolved", [], order));
    const reversed: StateEvidence = { targetStatus: "unresolved", reasons: [...checked.reasons].reverse() };
    expect(executePublic(preparePublic(input()), reversed)).toEqual(expected(normalized, "unresolved", [], order));
  });
  test.each([
    [false, false, "pass"],
    [true, false, "violation"],
    [false, true, "unresolved"],
    [true, true, "unresolved"],
  ] as const)(
    "same shared semantics in both languages: exposure=%p incomplete=%p",
    (publicState, incomplete, ruleResult) => {
      const representations: readonly [InspectionInput["language"], InspectionInput["target"]["representation"]][] = [
        ["rust", "rust-struct"],
        ["typescript", "ts-class"],
        ["typescript", "ts-companion"],
      ];
      for (const [language, representation] of representations) {
        const file = language === "rust" ? "model.rs" : "model.ts";
        const source: InspectionInput = {
          language,
          target: { file, declarationPath: ["Model"], representation },
          sources: [
            { path: file, content: language === "rust" ? "struct Model { x: i32 }" : "class Model { x = 1; }" },
          ],
          settings: {},
          toolchain: [{ name: `${language}-fixture`, version: "1" }],
        };
        const req = preparePublic(source);
        const targetLocation = { file, line: 1, byteStart: 0, byteEnd: language === "rust" ? 6 : 5 };
        const memberLocation = {
          file,
          line: 1,
          byteStart: language === "rust" ? 15 : 14,
          byteEnd: language === "rust" ? 16 : 15,
        };
        const missing: Issue[] = incomplete
          ? [{ code: "incomplete-evidence", subject: "Model", message: "Unenumerated members.", location: null }]
          : [];
        const checked: StateEvidence = {
          targetStatus: "resolved",
          targetEvidence: [targetLocation],
          members: {
            completeness: incomplete ? "partial" : "complete",
            reasons: missing,
            items: [
              { memberId: "x", stateExposure: { status: "resolved", value: publicState, evidence: [memberLocation] } },
            ],
          },
        };
        const findings: Finding[] = publicState
          ? [{ code: "state-exposed", memberId: "x", evidence: [memberLocation] }]
          : [];
        expect(executePublic(req, checked)).toEqual({
          kind: "evaluated",
          result: {
            schemaVersion: "state-exposure/1",
            requestIdentity: req.requestIdentity,
            target: source.target,
            executionState: "completed",
            ruleResult,
            checkedEvidence: checked,
            findings,
            unresolvedReasons: missing,
          },
        });
      }
    },
  );
  test("multiple independent invocations and frozen evidence remain deterministic", () => {
    const req = preparePublic(input());
    const checked = evidence([member("value", false)]);
    function freeze(value: unknown): void {
      if (value && typeof value === "object") {
        Object.freeze(value);
        for (const item of Object.values(value)) freeze(item);
      }
    }
    freeze(req);
    freeze(checked);
    for (let i = 0; i < 3; i++) expect(executePublic(req, checked)).toEqual(expected(checked, "pass"));
  });
});
