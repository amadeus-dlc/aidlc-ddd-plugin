import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { ProjectSelection } from "../tools/ddd/lib/project-settings/index.ts";
import { bindInspectionInput, readProjectSettings } from "../tools/ddd/lib/project-settings/index.ts";
import { extractRust, RUST_TOOLCHAIN } from "../tools/ddd/lib/rust/state-evidence/index.ts";
import type { InspectionInput, Target } from "../tools/ddd/lib/state-exposure/index.ts";
import { inspectStateExposure, prepareInspectionRequest } from "../tools/ddd/lib/state-exposure/index.ts";
import { freezeInput } from "../tools/ddd/lib/state-exposure-verification/input.ts";
import { extractTypeScriptLocal, TS_TOOLCHAIN } from "../tools/ddd/lib/typescript/state-evidence/index.ts";
import { modernDocument, withWorkspace } from "./fixtures/project-settings/workspace.ts";

type Base = Omit<InspectionInput, "settings">;
type Settings = InspectionInput["settings"];

const COMPANION = readFileSync(new URL("fixtures/state-exposure-languages/companion.ts.txt", import.meta.url), "utf8");
const COMPANION_EXPOSED = COMPANION.replace(
  "increment(): Result",
  "readonly value: number; increment(): Result",
).replace("[brand]: true,", "[brand]: true, value: state.value,");
const CLASS_PRIVATE = "class Model { #value = 1; }";
const CLASS_EXPOSED = "class Model { value = 1; }";
const RUST_PRIVATE = "struct Model { value: u8 }";
const RUST_EXPOSED = "struct Model { pub value: u8 }";

function selectionFrom(document: string): ProjectSelection {
  return withWorkspace({ ".ddd.toml": document }, (root) => {
    const outcome = readProjectSettings(root);
    if (outcome.kind !== "validated") throw new Error(`expected a validated read, received ${JSON.stringify(outcome)}`);
    return outcome.selection;
  });
}

function bound(selection: ProjectSelection, base: Base): InspectionInput {
  const binding = bindInspectionInput(selection, base);
  if (binding.kind !== "bound") throw new Error(`expected a bound input, received ${JSON.stringify(binding)}`);
  return binding.input;
}

function rustBase(content: string): Base {
  return {
    language: "rust",
    target: { file: "model.rs", declarationPath: ["Model"], representation: "rust-struct" },
    sources: [{ path: "model.rs", content }],
    toolchain: RUST_TOOLCHAIN,
  };
}

function typescriptBase(content: string, representation: Target["representation"]): Base {
  return {
    language: "typescript",
    target: { file: "model.ts", declarationPath: ["Model"], representation },
    sources: [{ path: "model.ts", content }],
    toolchain: TS_TOOLCHAIN,
  };
}

async function inspectRust(input: InspectionInput) {
  const frozen = freezeInput(input);
  const observed = await extractRust(frozen);
  const outcome = inspectStateExposure(frozen.request, observed.execution);
  if (outcome.kind !== "evaluated") throw new Error(`expected an evaluation, received ${JSON.stringify(outcome)}`);
  return outcome.result;
}

function inspectTypeScript(input: InspectionInput) {
  const frozen = freezeInput(input);
  const outcome = inspectStateExposure(frozen.request, {
    status: "completed",
    response: extractTypeScriptLocal(frozen),
  });
  if (outcome.kind !== "evaluated") throw new Error(`expected an evaluation, received ${JSON.stringify(outcome)}`);
  return outcome.result;
}

function identityOf(input: unknown): string {
  const prepared = prepareInspectionRequest(input);
  if (prepared.kind !== "prepared")
    throw new Error(`expected a prepared request, received ${JSON.stringify(prepared)}`);
  return prepared.request.requestIdentity;
}

test("a Rust selection from the new API reaches the real native extractor and passes", async () => {
  const input = bound(selectionFrom(modernDocument({ rust: { moduleLayout: "file" } })), rustBase(RUST_PRIVATE));
  expect(input.settings).toEqual({
    projectSettings: { version: 2, languages: ["rust"], rust: { moduleLayout: "file" } },
  });
  const result = await inspectRust(input);
  expect(result.ruleResult).toBe("pass");
  expect(result.checkedEvidence?.targetStatus).toBe("resolved");
});

test("a Rust selection from the new API reaches the real native extractor and reports a violation", async () => {
  const input = bound(selectionFrom(modernDocument({ rust: { moduleLayout: "mod-rs" } })), rustBase(RUST_EXPOSED));
  const result = await inspectRust(input);
  expect(result.ruleResult).toBe("violation");
  expect(result.findings.map((finding) => finding.memberId)).toEqual(["Model::field:value"]);
});

for (const [codeRepresentation, representation, passing, exposing] of [
  ["class", "ts-class", CLASS_PRIVATE, CLASS_EXPOSED],
  ["companion", "ts-companion", COMPANION, COMPANION_EXPOSED],
] as const)
  test(`the TypeScript ${codeRepresentation} selection reaches the extractor that matches it`, () => {
    const selection = selectionFrom(modernDocument({ typescript: { moduleLayout: "named-file", codeRepresentation } }));
    const passingInput = bound(selection, typescriptBase(passing, representation));
    expect(passingInput.settings).toEqual({
      projectSettings: {
        version: 2,
        languages: ["typescript"],
        typescript: { moduleLayout: "named-file", codeRepresentation },
      },
    });
    expect(inspectTypeScript(passingInput).ruleResult).toBe("pass");
    const exposed = inspectTypeScript(bound(selection, typescriptBase(exposing, representation)));
    expect(exposed.ruleResult).toBe("violation");
    expect(exposed.findings.map((finding) => finding.memberId)).toEqual(["Model::value"]);
  });

const BOTH_LANGUAGES = modernDocument({
  rust: { moduleLayout: "file" },
  typescript: { moduleLayout: "named-file", codeRepresentation: "class" },
});
const BOTH_LANGUAGES_PAYLOAD = {
  projectSettings: {
    version: 2,
    languages: ["rust", "typescript"],
    rust: { moduleLayout: "file" },
    typescript: { moduleLayout: "named-file", codeRepresentation: "class" },
  },
};

test("a selection that puts both languages in use reaches the real native extractor", async () => {
  const input = bound(selectionFrom(BOTH_LANGUAGES), rustBase(RUST_EXPOSED));
  expect(input.settings).toEqual(BOTH_LANGUAGES_PAYLOAD);
  const result = await inspectRust(input);
  expect(result.ruleResult).toBe("violation");
  expect(result.findings.map((finding) => finding.memberId)).toEqual(["Model::field:value"]);
});

test("a selection that puts both languages in use reaches the TypeScript extractor", () => {
  const input = bound(selectionFrom(BOTH_LANGUAGES), typescriptBase(CLASS_EXPOSED, "ts-class"));
  expect(input.settings).toEqual(BOTH_LANGUAGES_PAYLOAD);
  const result = inspectTypeScript(input);
  expect(result.ruleResult).toBe("violation");
  expect(result.findings.map((finding) => finding.memberId)).toEqual(["Model::value"]);
});

test("a both-language selection is still refused when the requested representation disagrees", () => {
  const companion = selectionFrom(
    modernDocument({
      rust: { moduleLayout: "file" },
      typescript: { moduleLayout: "named-file", codeRepresentation: "companion" },
    }),
  );
  const binding = bindInspectionInput(companion, typescriptBase(CLASS_EXPOSED, "ts-class"));
  expect(binding.kind).toBe("input-rejected");
  if (binding.kind !== "input-rejected") return;
  expect(binding.issues[0].subject).toBe("target.representation");
});

test("repeating the identity generation from one validated selection gives the same identity", () => {
  const selection = selectionFrom(
    modernDocument({
      rust: { moduleLayout: "file" },
      typescript: { moduleLayout: "index-file", codeRepresentation: "class" },
    }),
  );
  const identities = [0, 1, 2].map(() => identityOf(bound(selection, rustBase(RUST_PRIVATE))));
  expect(new Set(identities).size).toBe(1);
});

test("every distinct valid selection produces a distinct identity for one fixed source, target and toolchain", () => {
  const documents: string[] = [];
  for (const rust of ["file", "mod-rs"] as const) {
    documents.push(modernDocument({ rust: { moduleLayout: rust } }));
    for (const moduleLayout of ["named-file", "index-file"] as const)
      for (const codeRepresentation of ["class", "companion"] as const)
        documents.push(
          modernDocument({ rust: { moduleLayout: rust }, typescript: { moduleLayout, codeRepresentation } }),
        );
  }
  expect(documents).toHaveLength(10);
  const identities = documents.map((document) => identityOf(bound(selectionFrom(document), rustBase(RUST_PRIVATE))));
  expect(new Set(identities).size).toBe(10);
});

test("a selection carried outside settings never reaches the identity", () => {
  const selection = selectionFrom(modernDocument({ rust: { moduleLayout: "mod-rs" } }));
  const base = rustBase(RUST_PRIVATE);
  const carried = bound(selection, base);
  const plain = { ...base, settings: {} };
  const smuggled = { ...plain, projectSettings: carried.settings.projectSettings };
  expect(identityOf(smuggled)).toBe(identityOf(plain));
  expect(identityOf(carried)).not.toBe(identityOf(plain));
});

test("a selection that disagrees with the requested representation is refused, not substituted", () => {
  const selection = selectionFrom(
    modernDocument({ typescript: { moduleLayout: "named-file", codeRepresentation: "companion" } }),
  );
  const binding = bindInspectionInput(selection, typescriptBase(CLASS_PRIVATE, "ts-class"));
  expect(binding.kind).toBe("input-rejected");
  if (binding.kind !== "input-rejected") return;
  expect(binding.issues).toHaveLength(1);
  expect(binding.issues[0].code).toBe("invalid-request");
  expect(binding.issues[0].subject).toBe("target.representation");
});

test("a selection that does not enable the requested language is refused", () => {
  const typescriptOnly = selectionFrom(
    modernDocument({ typescript: { moduleLayout: "named-file", codeRepresentation: "class" } }),
  );
  const rustOnly = selectionFrom(modernDocument({ rust: { moduleLayout: "file" } }));
  for (const [selection, base] of [
    [typescriptOnly, rustBase(RUST_PRIVATE)],
    [rustOnly, typescriptBase(CLASS_PRIVATE, "ts-class")],
  ] as const) {
    const binding = bindInspectionInput(selection, base);
    expect(binding.kind).toBe("input-rejected");
    if (binding.kind === "input-rejected") expect(binding.issues[0].subject).toBe("language");
  }
});

test("changing only the Rust layout changes the identity and leaves the evidence alone", async () => {
  const inputs = (["file", "mod-rs"] as const).map((moduleLayout) =>
    bound(selectionFrom(modernDocument({ rust: { moduleLayout } })), rustBase(RUST_EXPOSED)),
  );
  expect(identityOf(inputs[0])).not.toBe(identityOf(inputs[1]));
  const [first, second] = [await inspectRust(inputs[0]), await inspectRust(inputs[1])];
  expect(first.ruleResult).toBe("violation");
  expect(first.checkedEvidence).toEqual(second.checkedEvidence);
});

test("changing only the TypeScript layout changes the identity and leaves the evidence alone", () => {
  const inputs = (["named-file", "index-file"] as const).map((moduleLayout) =>
    bound(
      selectionFrom(modernDocument({ typescript: { moduleLayout, codeRepresentation: "class" } })),
      typescriptBase(CLASS_EXPOSED, "ts-class"),
    ),
  );
  expect(identityOf(inputs[0])).not.toBe(identityOf(inputs[1]));
  const [first, second] = [inspectTypeScript(inputs[0]), inspectTypeScript(inputs[1])];
  expect(first.ruleResult).toBe("violation");
  expect(first.checkedEvidence).toEqual(second.checkedEvidence);
});

const RUST_PAYLOAD: Settings = {
  projectSettings: { version: 2, languages: ["rust"], rust: { moduleLayout: "file" } },
};
const TYPESCRIPT_PAYLOAD: Settings = {
  projectSettings: {
    version: 2,
    languages: ["typescript"],
    typescript: { moduleLayout: "named-file", codeRepresentation: "class" },
  },
};

const UNRECOGNIZED_RUST: readonly (readonly [string, Settings])[] = [
  ["an unknown key beside the payload", { ...RUST_PAYLOAD, trace: true }],
  ["a payload whose language choice is absent", { projectSettings: { version: 2, languages: ["rust"] } }],
  [
    "a payload naming a version the contract does not define",
    { projectSettings: { version: 1, languages: ["rust"], rust: { moduleLayout: "file" } } },
  ],
  [
    "a payload naming a value the contract does not define",
    { projectSettings: { version: 2, languages: ["rust"], rust: { moduleLayout: "auto" } } },
  ],
  ["a settings object that is not the payload", { moduleLayout: "file" }],
  ["a payload that does not enable the requested language", TYPESCRIPT_PAYLOAD],
  [
    "a payload carrying a language key that is not in use and names a value the contract does not define",
    {
      projectSettings: {
        version: 2,
        languages: ["rust"],
        rust: { moduleLayout: "file" },
        typescript: { moduleLayout: "named-file", codeRepresentation: "record" },
      },
    },
  ],
  [
    "a payload carrying a null language key that is not in use",
    {
      projectSettings: {
        version: 2,
        languages: ["rust"],
        rust: { moduleLayout: "file" },
        typescript: null,
      },
    },
  ],
];

const UNRECOGNIZED_TYPESCRIPT: readonly (readonly [string, Settings])[] = [
  ["an unknown key beside the payload", { ...TYPESCRIPT_PAYLOAD, trace: true }],
  ["a payload whose language choice is absent", { projectSettings: { version: 2, languages: ["typescript"] } }],
  [
    "a payload naming a version the contract does not define",
    {
      projectSettings: {
        version: 1,
        languages: ["typescript"],
        typescript: { moduleLayout: "named-file", codeRepresentation: "class" },
      },
    },
  ],
  [
    "a payload naming a value the contract does not define",
    {
      projectSettings: {
        version: 2,
        languages: ["typescript"],
        typescript: { moduleLayout: "named-file", codeRepresentation: "record" },
      },
    },
  ],
  ["a settings object that is not the payload", { codeRepresentation: "class" }],
  ["a payload that does not enable the requested language", RUST_PAYLOAD],
  [
    "a payload naming a representation other than the one being inspected",
    {
      projectSettings: {
        version: 2,
        languages: ["typescript"],
        typescript: { moduleLayout: "named-file", codeRepresentation: "companion" },
      },
    },
  ],
];

for (const [label, settings] of UNRECOGNIZED_RUST)
  test(`the native extractor refuses ${label} rather than ignoring it`, async () => {
    const result = await inspectRust({ ...rustBase(RUST_PRIVATE), settings });
    expect(result.ruleResult).toBe("unresolved");
    expect(result.unresolvedReasons[0].code).toBe("unsupported-syntax");
    expect(result.findings).toEqual([]);
  });

for (const [label, settings] of UNRECOGNIZED_TYPESCRIPT)
  test(`the TypeScript extractor refuses ${label} rather than ignoring it`, () => {
    const result = inspectTypeScript({ ...typescriptBase(CLASS_PRIVATE, "ts-class"), settings });
    expect(result.ruleResult).toBe("unresolved");
    expect(result.unresolvedReasons[0].code).toBe("unsupported-syntax");
    expect(result.findings).toEqual([]);
  });
