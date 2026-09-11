<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

- 2026-09-10T13:17:03Z — requires_stage に user-stories を足した（Q1）; requirements-analysis だけだとアルファベット順のタイブレークで user-stories より前に走り、推奨入力のストーリーが存在しない。コアの domain-design が refined-mockups を要求するのと同じ扱い。

- 2026-09-10T13:17:03Z — support_agents に aidlc-product-agent を置いた; ユビキタス言語とストーリーの読み手として妥当で、inline なのでハーネス依存（CON7）は増えない。ADR-007 が禁じるのは独自エージェントだけ。

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

- 2026-09-10T13:17:03Z — 非 ASCII の用語からの ID は英訳案を人間に確認させる（Q2）; ローマ字化は決定的だが下流の Rust 命名（U5 の PascalCase→ケバブ照合）と噛み合わず、確認なしの英訳は永続キーの誤りを残す。

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->

- 2026-09-10T13:17:03Z — (i)〜(v) を承認前に手元で検査する CLI は定義しなかった。U1 の code-generation 計画で ddd-model-check のような入口を検討する。
