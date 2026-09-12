/** Preconditions for pre-packaging fixtures. Dedicated packaging cases author their own declarations. */
export const FIXTURE_PACKAGES = ["billing-domain", "billing-core-domain", "other-domain"].flatMap((crate) =>
  ["crate", "billing", "billing::invoice", "invoice", "operations", "left", "right", "other"].map((module) => ({
    crate,
    module,
    term: "請求",
    model_refs: ["bc.billing"],
    rationale: "既存の解析ケースで扱う請求の構成要素",
  })),
);

export function withFixturePackages(markdown: string): string {
  if (/\bdomain_packages\s*:/.test(markdown)) return markdown;
  return markdown.replace(
    /^aggregate_mappings:/m,
    `domain_packages: ${JSON.stringify(FIXTURE_PACKAGES)}\naggregate_mappings:`,
  );
}

export function fixtureMapping(): string {
  return withFixturePackages(
    "# 集約写像\n\n```yaml\nschema_version: 1\nmodel_ref: inception/ddd-domain-modeling/ddd-domain-model-yaml.md\naggregate_mappings: []\n```\n",
  );
}
