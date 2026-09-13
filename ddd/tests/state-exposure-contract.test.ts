import { describe, expect, test } from "bun:test";
import { canonicalJson, digest, jsonCopy, scalarCompare } from "../tools/ddd/lib/state-exposure/canonical.ts";
import type {
  InspectionInput,
  InspectionRequest,
  JsonValue,
  StateEvidence,
} from "../tools/ddd/lib/state-exposure/contract.ts";
import { prepareInspectionRequest, validateRequest } from "../tools/ddd/lib/state-exposure/request.ts";
import { input, request } from "./fixtures/state-exposure-inspection/values.ts";

function prepared(value: unknown) {
  const result = prepareInspectionRequest(value);
  if (result.kind !== "prepared") throw new Error(JSON.stringify(result));
  return result.request;
}
function rejected(value: unknown, subject?: string) {
  const result = prepareInspectionRequest(value);
  expect(result.kind).toBe("input-rejected");
  if (result.kind === "input-rejected") {
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      code: "invalid-request",
      location: null,
      ...(subject ? { subject } : {}),
    });
  }
}

describe("JSON and canonical values", () => {
  test("uses scalar ordering including numeric keys and astral characters", () => {
    expect(scalarCompare("\ue000", "𐀀")).toBeLessThan(0);
    expect(canonicalJson({ "2": 2, "10": 10, 𐀀: 1, "\ue000": 0 })).toBe('{"10":10,"2":2,"":0,"𐀀":1}');
  });
  test("preserves arrays and uses exact JSON escaping and decimal integers", () => {
    expect(canonicalJson({ s: '\b\t\n\f\r\u0000\u001f/"\\é', a: [-0, 9007199254740991] })).toBe(
      '{"a":[0,9007199254740991],"s":"\\b\\t\\n\\f\\r\\u0000\\u001f/\\"\\\\é"}',
    );
  });
  test("copies shared values and preserves __proto__ as data", () => {
    const shared = { ok: true };
    const original = { a: shared, b: shared, ...JSON.parse('{"__proto__":{"safe":true}}') };
    const copy = jsonCopy(original, "input");
    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
    expect((copy as { a: unknown }).a).not.toBe(shared);
    expect(canonicalJson(copy)).toBe('{"__proto__":{"safe":true},"a":{"ok":true},"b":{"ok":true}}');
  });
  test.each([
    undefined,
    () => 1,
    1n,
    NaN,
    Infinity,
    -Infinity,
    1.5,
    9007199254740992,
    "\ud800",
    "\udfff",
    new Date(0),
    new Map(),
    new Set(),
    Symbol("x"),
  ])("rejects non-JSON settings %p", (bad) => rejected({ ...input(), settings: { bad } }));
  test("rejects cycles while accepting duplicated shared settings", () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    rejected({ ...input(), settings: cycle });
    const shared = { flag: true };
    expect(prepared({ ...input(), settings: { a: shared, b: shared } }).requestIdentity).toBe(
      prepared({ ...input(), settings: { a: { flag: true }, b: { flag: true } } }).requestIdentity,
    );
  });
  test("rejects sparse arrays, symbols, accessors and custom instances without invoking getters", () => {
    let invoked = false;
    const getter = Object.defineProperty({}, "x", {
      enumerable: true,
      get() {
        invoked = true;
        return 1;
      },
    });
    class Custom {
      value = 1;
    }
    for (const bad of [
      new Array(1),
      Object.assign([], { x: 1 }),
      { [Symbol("x")]: 1 },
      getter,
      new Custom(),
      { "\ud800": 1 },
    ]) {
      rejected({ ...input(), settings: { bad } });
    }
    expect(invoked).toBe(false);
  });
  test("handles deep settings without recursive traversal or serialization", () => {
    let deep: JsonValue = null;
    for (let i = 0; i < 12000; i++) deep = { child: deep };
    const value = prepared({ ...input(), settings: { deep } });
    expect(validateRequest(value).requestIdentity).toBe(value.requestIdentity);
  });
});

describe("request preparation and validation", () => {
  test("prepares the exact snapshot and recomputable request identity", () => {
    const actual = prepared(input());
    const fields: Omit<InspectionRequest, "requestIdentity"> = {
      schemaVersion: "state-exposure/1",
      ruleId: "state-exposure",
      language: "rust",
      target: input().target,
      sources: [
        { path: "src/model.rs", sha256: digest("struct Model { value: i32 }\n"), byteLength: 28, lineStarts: [0, 28] },
      ],
      settings: {},
      toolchain: [{ name: "fixture", version: "1" }],
    };
    expect(actual).toEqual({ ...fields, requestIdentity: digest(canonicalJson(jsonCopy(fields, "expected"))) });
    expect(validateRequest(actual)).toEqual(actual);
  });
  test("sorts source/tool names and identifies settings independent of key order", () => {
    const a = {
      ...input(),
      sources: [...input().sources, { path: "A.rs", content: "" }],
      toolchain: [
        { name: "z", version: "2" },
        { name: "a", version: "1" },
      ],
      settings: { z: { b: 2, a: 1 }, a: true },
    };
    const b = {
      ...a,
      sources: [...a.sources].reverse(),
      toolchain: [...a.toolchain].reverse(),
      settings: { a: true, z: { a: 1, b: 2 } },
    };
    expect(prepared(a)).toEqual(prepared(b));
    expect(prepared(a).sources.map((s) => s.path)).toEqual(["A.rs", "src/model.rs"]);
    expect(prepared(a).toolchain.map((t) => t.name)).toEqual(["a", "z"]);
  });
  test.each([
    { ...input(), sources: [{ path: "src/model.rs", content: "changed" }] },
    { ...input(), settings: { unknownSetting: true } },
    { ...input(), target: { ...input().target, declarationPath: ["Other"] } },
    { ...input(), toolchain: [{ name: "fixture", version: "2" }] },
    { ...input(), language: "typescript", target: { ...input().target, representation: "ts-class" } },
  ])("changes identity when semantic input changes: %p", (changed) => {
    expect(prepared(changed).requestIdentity).not.toBe(prepared(input()).requestIdentity);
  });
  test.each(["", "/a", "a/", "a//b", "./a", "a/../b", "a\\b", "a\0b"])("rejects invalid paths %p", (path) => {
    rejected({ ...input(), sources: [{ path, content: "" }], target: { ...input().target, file: path } });
  });
  test.each([
    { ...input(), sources: [] },
    { ...input(), sources: [...input().sources, ...input().sources] },
    { ...input(), toolchain: [] },
    { ...input(), toolchain: [...input().toolchain, ...input().toolchain] },
    { ...input(), target: { ...input().target, file: "missing.rs" } },
    { ...input(), target: { ...input().target, declarationPath: [] } },
    { ...input(), target: { ...input().target, declarationPath: [""] } },
    { ...input(), target: { ...input().target, representation: "ts-class" } },
    { ...input(), toolchain: [{ name: "fixture", version: "" }] },
    { ...input(), settings: null },
    { ...input(), language: "unknown" },
  ])("rejects malformed required input %p", (bad) => rejected(bad));
  test.each([
    ["", 0, [0]],
    ["a\n", 2, [0, 2]],
    ["a\r\nb\rc\nd\u2028e\u2029", 15, [0, 3, 5, 7, 11, 15]],
    ["\ufeffé😀\r\n", 11, [0, 11]],
  ])("retains UTF-8 bytes and line terminators %p", (content, byteLength, lineStarts) => {
    const actual = prepared({ ...input(), sources: [{ path: "src/model.rs", content }] });
    expect(actual.sources).toEqual([
      { path: "src/model.rs", sha256: digest(content as string), byteLength, lineStarts },
    ]);
  });
  test("preserves case and Unicode spelling and ignores supplementary fields outside settings", () => {
    const a = prepared({ ...input(), extra: "ignored", target: { ...input().target, extra: true } });
    expect(a).toEqual(prepared(input()));
    expect(
      prepared({
        ...input(),
        sources: [
          ...input().sources,
          { path: "é", content: "" },
          { path: "é", content: "" },
          { path: "SRC/model.rs", content: "" },
        ],
      }).sources,
    ).toHaveLength(4);
  });
  test("detaches prepared values from mutable inputs", () => {
    const original = {
      ...input(),
      settings: { nested: [1] },
      target: { ...input().target, declarationPath: ["Model"] },
    };
    const actual = prepared(original);
    original.settings.nested.push(2);
    original.target.declarationPath[0] = "Changed";
    expect(actual.settings).toEqual({ nested: [1] });
    expect(actual.target.declarationPath).toEqual(["Model"]);
  });
  test("revalidates required fields, version, identity, sortedness and snapshot ranges", () => {
    const good = request();
    const invalid = [
      { ...good, schemaVersion: "state-exposure/2" },
      { ...good, ruleId: "other" },
      { ...good, requestIdentity: `sha256:${"A".repeat(64)}` },
      { ...good, settings: { changed: true } },
      ...[-1, 0.5, 9007199254740992].map((byteLength) => ({ ...good, sources: [{ ...good.sources[0], byteLength }] })),
      ...[[], [1], [0, 0], [0, 30], [0, 3, 2]].map((lineStarts) => ({
        ...good,
        sources: [{ ...good.sources[0], lineStarts }],
      })),
      { ...good, sources: [{ ...good.sources[0], sha256: "bad" }] },
      { ...good, sources: [...good.sources, ...good.sources] },
      {
        ...good,
        toolchain: [
          { name: "z", version: "1" },
          { name: "a", version: "1" },
        ],
      },
      { ...good, sources: [...good.sources, { ...good.sources[0], path: "A.rs" }] },
    ];
    for (const bad of invalid) expect(() => validateRequest(bad)).toThrow();
  });
  test("accepts every valid language representation", () => {
    for (const representation of ["ts-class", "ts-companion"] as const) {
      const source: InspectionInput = {
        ...input(),
        language: "typescript",
        target: { ...input().target, representation },
      };
      expect(prepared(source).target.representation).toBe(representation);
    }
  });
});

import { validateExecution, validateResponse } from "../tools/ddd/lib/state-exposure/evidence.ts";
import { inspectStateExposure } from "../tools/ddd/lib/state-exposure/inspection.ts";
import { evidence, location, member, reason } from "./fixtures/state-exposure-inspection/values.ts";

function response(evidenceValue: unknown = evidence()) {
  return { schemaVersion: "state-exposure/1", requestIdentity: request().requestIdentity, evidence: evidenceValue };
}
function invalidResponse(value: unknown) {
  expect(validateResponse(value, request())).toMatchObject({
    valid: false,
    issue: { code: "invalid-response", subject: "response", location: null },
  });
}

describe("execution envelope", () => {
  test("missing response rejects the invocation with its exact field", () => {
    expect(inspectStateExposure(request(), { status: "completed" })).toEqual({
      kind: "input-rejected",
      issues: [
        {
          code: "invalid-request",
          subject: "execution.response",
          message: "Completed execution requires a response key.",
          location: null,
        },
      ],
    });
  });
  test.each([undefined, () => 1, 1n, NaN, "\ud800"])("non-JSON response rejects the invocation %p", (value) => {
    expect(inspectStateExposure(request(), { status: "completed", response: value })).toMatchObject({
      kind: "input-rejected",
      issues: [{ code: "invalid-request" }],
    });
  });
  test("a circular response rejects the invocation", () => {
    const value: Record<string, unknown> = {};
    value.loop = value;
    expect(inspectStateExposure(request(), { status: "completed", response: value })).toMatchObject({
      kind: "input-rejected",
      issues: [{ code: "invalid-request" }],
    });
  });
  test.each([null, 42, {}, { schemaVersion: "state-exposure/1" }])(
    "JSON response failure preserves completed and target: %p",
    (value) => {
      const actual = inspectStateExposure(request(), { status: "completed", response: value });
      expect(actual).toMatchObject({
        kind: "evaluated",
        result: {
          target: input().target,
          executionState: "completed",
          ruleResult: "unresolved",
          checkedEvidence: null,
          findings: [],
          unresolvedReasons: [{ code: "invalid-response", subject: "response", location: null }],
        },
      });
    },
  );
  test.each([
    { status: "unknown", response: null },
    { status: "completed", response: null, reasons: [] },
    { status: "failed", reasons: [] },
    { status: "unavailable", reasons: [reason()], response: null },
    { status: "unavailable" },
    { status: "failed", reasons: [{ ...reason(), code: "unknown" }] },
    { status: "failed", reasons: [{ ...reason(), message: "" }] },
    { status: "failed", reasons: [{ ...reason(), subject: "" }] },
    { status: "failed", reasons: [{ code: "timeout", subject: "tool", message: "expired" }] },
    { status: "failed", reasons: [{ ...reason(), location: { ...location(), file: "unknown" } }] },
  ])("rejects invalid execution tags, reasons and contradictory fields %p", (bad) => {
    expect(inspectStateExposure(request(), bad)).toMatchObject({
      kind: "input-rejected",
      issues: [{ code: "invalid-request" }],
    });
  });
  test("validates the request before looking at execution", () => {
    expect(
      inspectStateExposure({ ...request(), settings: { different: true } }, { status: "completed" }),
    ).toMatchObject({ kind: "input-rejected", issues: [{ subject: "request.requestIdentity" }] });
  });
  test("valid execution reasons are copied, ordered and stripped of supplementary fields", () => {
    const reasons = [{ ...reason("timeout", "z"), extra: "ignored" }, reason("execution-failed", "a")];
    expect(validateExecution({ status: "failed", reasons, extra: true }, request())).toEqual({
      status: "failed",
      reasons: [reason("execution-failed", "a"), reason("timeout", "z")],
    });
  });
});

describe("response schema and invariant validation", () => {
  test("returns complete validated known evidence, not native supplementary fields", () => {
    const good = { ...evidence(), extra: { native: true } };
    expect(validateResponse({ ...response(good), native: true }, request())).toEqual({
      valid: true,
      evidence: evidence(),
    });
  });
  test("rejects an unknown version before interpreting a future evidence body", () => {
    expect(validateResponse({ ...response(42), schemaVersion: "state-exposure/2" }, request())).toEqual({
      valid: false,
      issue: {
        code: "unknown-version",
        subject: "response.schemaVersion",
        message: "Unsupported response schema version.",
        location: null,
      },
    });
    invalidResponse({ ...response(), schemaVersion: 1 });
    invalidResponse({ schemaVersion: "state-exposure/2", requestIdentity: request().requestIdentity });
  });
  test("rejects another valid digest before checking evidence, without salvaging findings", () => {
    const foreign = { ...response(), requestIdentity: `sha256:${"0".repeat(64)}` };
    expect(validateResponse(foreign, request())).toEqual({
      valid: false,
      issue: {
        code: "identity-mismatch",
        subject: "response.requestIdentity",
        message: "Response identity does not match the request.",
        location: null,
      },
    });
    expect(inspectStateExposure(request(), { status: "completed", response: foreign })).toMatchObject({
      kind: "evaluated",
      result: { checkedEvidence: null, findings: [], ruleResult: "unresolved" },
    });
  });
  test.each([
    { status: "absent", evidence: [location()], value: false },
    { status: "absent", evidence: [location()], reasons: [] },
    { status: "unresolved", reasons: [reason()], value: true },
    { status: "unresolved", reasons: [reason()], evidence: [location()] },
    { status: "resolved", value: true, evidence: [location()], reasons: [] },
    { status: "resolved", value: "true", evidence: [location()] },
    { status: "resolved", value: false, evidence: [] },
    { status: "absent", evidence: [] },
    { status: "unresolved", reasons: [] },
    { status: "unknown" },
  ])("rejects inconsistent or unsupported facts %p", (stateExposure) => {
    invalidResponse(
      response({
        targetStatus: "resolved",
        targetEvidence: [location()],
        members: {
          completeness: "complete",
          reasons: [],
          items: [{ memberId: "x", stateExposure }],
        },
      }),
    );
  });
  test.each([
    { targetStatus: "resolved", targetEvidence: [], members: { completeness: "complete", reasons: [], items: [] } },
    { targetStatus: "unresolved", reasons: [] },
    { targetStatus: "unresolved", reasons: [reason()], members: {} },
    { targetStatus: "unresolved", reasons: [reason()], targetEvidence: [] },
    { ...evidence(), reasons: [] },
    { targetStatus: "unknown" },
    {
      targetStatus: "resolved",
      targetEvidence: [location()],
      members: { completeness: "partial", reasons: [], items: [] },
    },
    {
      targetStatus: "resolved",
      targetEvidence: [location()],
      members: { completeness: "complete", reasons: [reason()], items: [] },
    },
    {
      targetStatus: "resolved",
      targetEvidence: [location()],
      members: { completeness: "unknown", reasons: [], items: [] },
    },
    evidence([member(), member()]),
    evidence([{ ...member(), memberId: "" }]),
  ])("rejects invalid target, completeness and duplicate member IDs %p", (bad) => invalidResponse(response(bad)));
  test.each([
    { ...location(), file: "missing.rs" },
    { ...location(), line: 0 },
    { ...location(), line: 2 },
    { ...location(), byteStart: -1 },
    { ...location(), byteStart: 6 },
    { ...location(), byteEnd: 29 },
    { ...location(), byteEnd: 0.5 },
    { ...location(), byteEnd: 9007199254740992 },
  ])("rejects invalid location range or line %p", (bad) => {
    invalidResponse(
      response(evidence([{ memberId: "x", stateExposure: { status: "resolved", value: true, evidence: [bad] } }])),
    );
  });
  test("rejects evidence in another source while allowing issue locations there", () => {
    const multi = prepared({ ...input(), sources: [...input().sources, { path: "other.rs", content: "abc" }] });
    const other = { file: "other.rs", line: 1, byteStart: 0, byteEnd: 3 };
    const foreign = {
      targetStatus: "resolved",
      targetEvidence: [other],
      members: { completeness: "complete", reasons: [], items: [] },
    };
    expect(validateResponse({ ...response(foreign), requestIdentity: multi.requestIdentity }, multi)).toMatchObject({
      valid: false,
    });
    const unresolved: StateEvidence = { targetStatus: "unresolved", reasons: [{ ...reason(), location: other }] };
    expect(validateResponse({ ...response(unresolved), requestIdentity: multi.requestIdentity }, multi)).toEqual({
      valid: true,
      evidence: unresolved,
    });
  });
  test("validates Unicode and line boundaries without claiming to prove character boundaries", () => {
    const req = prepared({ ...input(), sources: [{ path: "src/model.rs", content: "é\r\n😀\u2028x" }] });
    for (const [byteStart, byteEnd, line] of [
      [0, 2, 1],
      [4, 8, 2],
      [11, 12, 3],
      [1, 2, 1],
    ]) {
      const checked: StateEvidence = {
        targetStatus: "resolved",
        targetEvidence: [{ file: "src/model.rs", byteStart, byteEnd, line }],
        members: { completeness: "complete", reasons: [], items: [] },
      };
      expect(validateResponse({ ...response(checked), requestIdentity: req.requestIdentity }, req)).toEqual({
        valid: true,
        evidence: checked,
      });
    }
  });
  test("discards the entire invalid response even with one valid exposed member", () => {
    const bad = response(
      evidence([member(), { memberId: "bad", stateExposure: { status: "resolved", value: true, evidence: [] } }]),
    );
    expect(inspectStateExposure(request(), { status: "completed", response: bad })).toMatchObject({
      kind: "evaluated",
      result: {
        ruleResult: "unresolved",
        checkedEvidence: null,
        findings: [],
        unresolvedReasons: [{ code: "invalid-response" }],
      },
    });
  });
});
