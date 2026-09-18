/**
 * Preconditions for pre-packaging fixtures, in the language-neutral mapping format the gates read.
 * Dedicated packaging cases author their own declarations.
 */

/** Module paths below each fixture package root, one segment per entry; the root itself is `[]`. */
const FIXTURE_MODULES: readonly (readonly string[])[] = [
  [],
  ["billing"],
  ["billing", "invoice"],
  ["invoice"],
  ["operations"],
  ["left"],
  ["right"],
  ["other"],
];

export const FIXTURE_PACKAGES = ["billing-domain", "billing-core-domain", "other-domain"].flatMap((name) =>
  FIXTURE_MODULES.map((module) => ({
    term: "請求",
    model_refs: ["bc.billing"],
    rationale: "既存の解析ケースで扱う請求の構成要素",
    code: { language: "rust", package: name, module: [...module] },
  })),
);

export function withFixturePackages(markdown: string): string {
  if (/\bdomain_packages\s*:/.test(markdown)) return markdown;
  return markdown.replace(
    /^aggregate_mappings:/m,
    `domain_packages: ${JSON.stringify(FIXTURE_PACKAGES)}\naggregate_mappings:`,
  );
}

/**
 * The mapping of the Rust fixture model: its one aggregate at the root of `billing-domain`, with the
 * one command and the one business error that model declares. A mapping has to cover every
 * aggregate, operation and error of its model before a gate reads it at all.
 */
export function fixtureMapping(): string {
  return withFixturePackages(
    [
      "# 集約写像",
      "",
      "```yaml",
      "schema_version: 2",
      "model_ref: inception/ddd-domain-modeling/ddd-domain-model-yaml.md",
      "aggregate_mappings:",
      "  - aggregate_ref: aggregate.invoice",
      "    programming_model: class",
      "    persistence_method: state-sourcing",
      "    reference_ids: [entity.invoice]",
      "    code: { language: rust, package: billing-domain, module: [], type: Invoice, ports: [], repository: InvoiceRepository }",
      "    operations:",
      "      - operation_ref: command.invoice.issue",
      "        code: { method: issue, error_type: IssueInvoiceError }",
      "        errors:",
      "          - { error_ref: error.invoice.issue.already-issued, code: { case: AlreadyIssued } }",
      "```",
      "",
    ].join("\n"),
  );
}
