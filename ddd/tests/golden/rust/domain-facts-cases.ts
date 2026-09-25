/**
 * Cases for the two rules that decide on native extractor facts (T-10-02): public tuple members for
 * rule (a) and explicit-`return` getters for rule (d).
 *
 * Each rule gets the input the tree-sitter decision base these replaced used to drop, the
 * neighbouring input whose verdict must not move, and both module layouts, so the switch of decision
 * base is observed at the sensor boundary rather than inside the extractor.
 */

import type { GoldenCase } from "../runner.ts";

const DOMAIN = "packages/domain/billing-domain/src/lib.rs";
const USE_CASE = "packages/use-case/billing-use-case/src/lib.rs";
const MODULE_FILE = "packages/domain/billing-domain/src/invoice.rs";
const MOD_RS = "packages/domain/billing-domain/src/invoice/mod.rs";
const MANIFEST = "construction/u1/code-generation/source-manifest.json";

/** A crate whose one public member is the unnamed member of a tuple declaration. */
const TUPLE_PUBLIC = "pub struct Invoice(pub i64);\n";
/** The same declaration with its member private: the tuple form itself is not the violation. */
const TUPLE_PRIVATE = "pub struct Invoice(i64);\n";
/** One restricted member and one private member, each on its own line. */
export const TUPLE_RESTRICTED = "pub struct Invoice(\n    pub(crate) i64,\n    i64,\n);\n";
/** Enum variant members carry the visibility of the enum; they are not public fields. */
const ENUM_VARIANTS = `${TUPLE_PRIVATE}pub enum Kind {
    Draft,
    Paid(i64),
    Issued { amount: i64 },
}
`;
/** The field text appears in a macro body, a string and a comment; none of them declares a field. */
const MACRO_BODY = `${TUPLE_PRIVATE}macro_rules! declare {
    () => {
        pub struct Generated { pub amount: i64 }
    };
}
const DOC: &str = "pub amount: i64";
// pub amount: i64
`;
/** A getter whose body is an explicit \`return\`, beside a same-named method of another type. */
export const EXPLICIT_RETURN = `pub struct Invoice { amount: i64 }
impl Invoice { pub fn total(&self) -> i64 { return self.amount; } }
pub struct Ledger { entries: i64 }
impl Ledger { pub fn total(&self) -> i64 { self.entries + 1 } }
pub fn peek(inv: &Invoice) -> i64 { inv.total() }
pub fn count(ledger: &Ledger) -> i64 { ledger.total() }
`;
/** A trait implementation returns a field: a trait method is not an inherent getter. */
const TRAIT_IMPL_GETTER = `pub struct Invoice { amount: i64 }
pub trait Shown { fn shown(&self) -> i64; }
impl Shown for Invoice { fn shown(&self) -> i64 { self.amount } }
pub fn peek(inv: &Invoice) -> i64 { inv.shown() }
`;
/** Both missed forms in one module file, so either module layout reports the same two rules. */
const MODULE_SOURCE = `pub struct Invoice(pub i64);
pub struct Ledger { amount: i64 }
impl Ledger { pub fn total(&self) -> i64 { return self.amount; } }
pub fn peek(ledger: &Ledger) -> i64 { ledger.total() }
`;

function claim(path: string): string {
  return JSON.stringify({ stage: "code-generation", unit: "u1", version: 1, writes: [{ path }] });
}

export function domainFactsCases(base: readonly GoldenCase[]): GoldenCase[] {
  const clone = (name: string, nextName: string): GoldenCase & { workspace: Record<string, string> } => {
    const source = base.find((entry) => entry.name === name);
    if (!source?.workspace) throw new Error(`missing Rust fixture ${name}`);
    return { ...structuredClone(source), workspace: structuredClone(source.workspace), name: nextName };
  };
  const domain = (name: string, lib: string, rules: string[]): GoldenCase => {
    const entry = clone("clean-domain", name);
    entry.workspace[DOMAIN] = lib;
    entry.expect = {
      pass: rules.length === 0,
      rules,
      files: Object.fromEntries(rules.map((rule) => [rule, DOMAIN])),
    };
    return entry;
  };

  const cases: GoldenCase[] = [
    domain("violation-a-tuple", TUPLE_PUBLIC, ["a"]),
    domain("clean-a-tuple-private", TUPLE_PRIVATE, []),
    domain("violation-a-tuple-restricted", TUPLE_RESTRICTED, ["a"]),
    domain("clean-a-enum-variant", ENUM_VARIANTS, []),
    domain("clean-a-macro-body", MACRO_BODY, []),
    domain("violation-d-explicit-return", EXPLICIT_RETURN, ["d"]),
    domain("clean-d-trait-impl-getter", TRAIT_IMPL_GETTER, []),
  ];

  // The same rule is declared by the use-case gate, where the getter is declared in another crate
  // than the call: the facts the decision reads cover every source of the program, not the claimed
  // files alone.
  const useCase = clone("violation-h", "violation-d-use-case-explicit-return");
  useCase.workspace[DOMAIN] =
    "pub struct Invoice { amount: i64 }\nimpl Invoice { pub fn total(&self) -> i64 { return self.amount; } }\n";
  useCase.workspace[USE_CASE] = "use billing_domain::Invoice;\npub fn render(inv: &Invoice) -> i64 { inv.total() }\n";
  useCase.expect = { pass: false, rules: ["d"], files: { d: USE_CASE } };
  cases.push(useCase);

  const moduleFile = clone("clean-domain", "violation-a-d-module-file");
  moduleFile.workspace[DOMAIN] = "pub mod invoice;\n";
  moduleFile.workspace[MODULE_FILE] = MODULE_SOURCE;
  moduleFile.files[MANIFEST] = claim(MODULE_FILE);
  moduleFile.expect = { pass: false, rules: ["a", "d"], files: { a: MODULE_FILE, d: MODULE_FILE } };
  cases.push(moduleFile);

  const modRs = structuredClone(moduleFile);
  modRs.name = "violation-a-d-mod-rs";
  delete modRs.workspace?.[MODULE_FILE];
  modRs.workspace = { ...modRs.workspace, [MOD_RS]: MODULE_SOURCE };
  modRs.files[MANIFEST] = claim(MOD_RS);
  modRs.expect = { pass: false, rules: ["a", "d"], files: { a: MOD_RS, d: MOD_RS } };
  cases.push(modRs);

  return cases;
}
