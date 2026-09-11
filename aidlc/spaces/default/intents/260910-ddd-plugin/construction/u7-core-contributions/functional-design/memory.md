<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

- 2026-09-10T13:46:26Z — FR4.3 の「(g)(h)(i)(d)(j) を functional-design にバインド」は、(j) と 6 項目を設計側（mapping-declarations）で、(g)(h)(i)(d) を code-generation の Rust マニフェストで満たすと解釈した; functional-design のゲートには Rust コードが無く、ADR-009 の設計側／コード側の分離をそのまま当てはめた。

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

- 2026-09-10T13:46:26Z — adds.required_sections は使わない; 機械強制されない（CON3）ため、章構造の保証は U4 の gate センサーに寄せた。

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

- 2026-09-10T13:46:26Z — fragments は質問生成の直後と成果物生成の直後の対で挿入する（Q1）; end-of-steps は保守が楽だが質問に宣言事項が含まれず、宣言が後追いになる。コアのステップ番号の変更には U9 の drops ログ検出で追随する。

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->

- 2026-09-10T13:46:26Z — adds.produces で追加した per-unit 成果物が対象外の Unit でも完了条件として要求されるかはエンジン実装に依存する。Q2 の空の宣言で安全側に倒し、U9 の統合テストで確認する。
