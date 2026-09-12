/**
 * Language-neutral rule definitions (BR9.1, FR8.6). The Rust evaluators in
 * rust/ implement these; a second language adds evaluators, not definitions.
 */

export type RuleLayer = "domain" | "use-case" | "interface-adapter" | "rmu";

export interface RuleDefinition {
  rule_id: string;
  name: string;
  statement: string;
  target_layers: RuleLayer[];
  requires_model: boolean;
  facts: string[];
  source: string;
  per_file: boolean;
}

export const RULES: readonly RuleDefinition[] = [
  {
    rule_id: "domain-packaging",
    name: "domain-package-vocabulary",
    statement: "affected domain crates use declared business packages rather than technical classifications",
    target_layers: ["domain"],
    requires_model: false,
    facts: ["modules", "domain_packages", "cargo-targets"],
    source: "T-07",
    per_file: false,
  },
  {
    rule_id: "a",
    name: "public-field",
    statement: "domain type exposes a non-private field",
    target_layers: ["domain"],
    requires_model: false,
    facts: ["structs"],
    source: "FR7.1",
    per_file: true,
  },
  {
    rule_id: "b",
    name: "undeclared-mutation",
    statement: "mutating method is not declared as a Command",
    target_layers: ["domain"],
    requires_model: true,
    facts: ["impls", "domain-symbols", "command-index"],
    source: "FR7.2",
    per_file: true,
  },
  {
    rule_id: "c",
    name: "incomplete-construction",
    statement: "domain type is constructed outside the full constructor",
    target_layers: ["domain"],
    requires_model: true,
    facts: ["impls", "constructions", "domain-symbols"],
    source: "FR7.3",
    per_file: true,
  },
  {
    rule_id: "d",
    name: "getter-call",
    statement: "getter called from the domain or use-case layer",
    target_layers: ["domain", "use-case"],
    requires_model: false,
    facts: ["calls", "domain-symbols"],
    source: "FR7.4",
    per_file: true,
  },
  {
    rule_id: "g",
    name: "dip-violation",
    statement: "forbidden dependency direction or external I/O dependency",
    target_layers: ["domain", "use-case", "interface-adapter", "rmu"],
    requires_model: false,
    facts: ["uses", "cargo-dependencies", "layer-assignment"],
    source: "FR9.5",
    per_file: false,
  },
  {
    rule_id: "h",
    name: "execute-aggregate-arg",
    statement: "execute receives an aggregate directly",
    target_layers: ["use-case"],
    requires_model: true,
    facts: ["impls", "fns", "domain-symbols"],
    source: "FR7.6",
    per_file: true,
  },
  {
    rule_id: "i",
    name: "use-case-chaining",
    statement: "use case calls another use case",
    target_layers: ["use-case"],
    requires_model: false,
    facts: ["calls"],
    source: "FR7.7",
    per_file: true,
  },
  {
    rule_id: "k",
    name: "cross-side-reference",
    statement: "command side references query side (or the reverse)",
    target_layers: ["interface-adapter", "rmu", "use-case", "domain"],
    requires_model: false,
    facts: ["uses", "cargo-dependencies", "layer-assignment"],
    source: "FR7.8",
    per_file: false,
  },
  {
    rule_id: "l",
    name: "query-side-domain-reference",
    statement: "query side references a domain type or repository port",
    target_layers: ["interface-adapter", "rmu", "use-case"],
    requires_model: false,
    facts: ["uses", "structs", "impls", "domain-symbols"],
    source: "FR7.9",
    per_file: true,
  },
  {
    rule_id: "m",
    name: "repository-naming",
    statement: "repository port or type is misnamed or names a storage medium",
    target_layers: ["interface-adapter", "rmu"],
    requires_model: false,
    facts: ["structs"],
    source: "FR7.10",
    per_file: true,
  },
  {
    rule_id: "n",
    name: "restoration-bypass",
    statement: "adapter constructs a domain type outside a full constructor",
    target_layers: ["interface-adapter", "rmu"],
    requires_model: false,
    facts: ["constructions", "impls", "domain-symbols"],
    source: "FR7.11",
    per_file: true,
  },
];

const BY_ID = new Map(RULES.map((rule) => [rule.rule_id, rule]));

export function ruleDefinition(ruleId: string): RuleDefinition | undefined {
  return BY_ID.get(ruleId);
}

export function rulesFor(ruleIds: readonly string[]): RuleDefinition[] {
  return ruleIds.map((id) => BY_ID.get(id)).filter((rule): rule is RuleDefinition => rule !== undefined);
}
