# 正規モデル（エラー集合の照合シナリオ）

請求書集約は、コマンドを1種類、生成操作を1種類持つ。どちらの操作も自身の業務エラーを2件ずつ宣言する。

```yaml
schema_version: 2
bounded_contexts:
  - element_id: bc.billing
    name: Billing
    aggregates:
      - element_id: aggregate.invoice
        name: Invoice
        bounded_context: bc.billing
        root_element: entity.invoice
        elements:
          - { element_id: entity.invoice, kind: entity, name: Invoice, aggregate: aggregate.invoice }
        invariants:
          - element_id: invariant.invoice.total-positive
            name: TotalPositive
            aggregate: aggregate.invoice
            statement: "請求金額は負であってはならない。"
        commands:
          - element_id: command.invoice.issue
            name: Issue
            aggregate: aggregate.invoice
            effect: transition
            state_effect: none
            domain_errors:
              - element_id: error.invoice.issue.already-issued
                name: AlreadyIssued
                operation: command.invoice.issue
                condition: "請求書は発行済みである。"
              - element_id: error.invoice.issue.empty-lines
                name: EmptyLines
                operation: command.invoice.issue
                condition: "請求明細が一件もない。"
            idempotency: { strategy: none }
        factory_rules:
          - element_id: factory.invoice.open
            name: Open
            target_element: entity.invoice
            preconditions: [invariant.invoice.total-positive]
            domain_errors:
              - element_id: error.invoice.open.negative-amount
                name: NegativeAmount
                operation: factory.invoice.open
                condition: "開始金額が負である。"
              - element_id: error.invoice.open.missing-customer
                name: MissingCustomer
                operation: factory.invoice.open
                condition: "請求先の顧客が指定されていない。"
lineage: []
```
