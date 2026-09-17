# 集約の実装写像（Rust）

業務IDは TypeScript の写像と共通で、エラーケースの綴りだけが言語ごとに異なる。

```yaml
schema_version: 2
model_ref: ../../ddd-domain-model-yaml.md
aggregate_mappings:
  - aggregate_ref: aggregate.invoice
    programming_model: class
    persistence_method: state-sourcing
    reference_ids: [entity.invoice]
    code:
      language: rust
      package: billing-domain
      module: [invoice]
      type: Invoice
    operations:
      - operation_ref: command.invoice.issue
        code: { method: issue, error_type: IssueInvoiceError }
        errors:
          - { error_ref: error.invoice.issue.already-issued, code: { case: AlreadyIssued } }
          - { error_ref: error.invoice.issue.empty-lines, code: { case: EmptyLines } }
      - operation_ref: factory.invoice.open
        code: { method: open, error_type: OpenInvoiceError }
        errors:
          - { error_ref: error.invoice.open.negative-amount, code: { case: NegativeAmount } }
          - { error_ref: error.invoice.open.missing-customer, code: { case: MissingCustomer } }
domain_packages:
  - term: 請求
    model_refs: [bc.billing]
    rationale: 請求の業務全体を所有する
    code: { language: rust, package: billing-domain, module: [] }
  - term: 請求書
    model_refs: [aggregate.invoice]
    rationale: 請求書の発行と開始をまとめる
    code: { language: rust, package: billing-domain, module: [invoice] }
```
