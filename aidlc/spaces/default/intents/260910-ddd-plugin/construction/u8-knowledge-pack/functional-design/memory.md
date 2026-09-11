<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-09-10T11:55:38Z — Q1 で本文は英語と決まったため、ADR-010 の矛盾一覧に引用する日本語の設計書の記述は英訳し、原文の出典を併記する扱いにした; 会話言語（日本語）と成果物言語（英語）が分かれる初めてのケース。
- 2026-09-10T11:55:38Z — kind: spec の Unit に対して entities.md / rules.md を「文書集合の構造」と「執筆規則」として書いた; ステージ定義は spec にも entities と rules を要求しており、ナレッジでは規則の Enforcement（強制手段の明示）が FR10.5 / FR10.6 を担保する要になる。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-09-10T11:55:38Z — 例の索引先（clean fixture のパス）は U5 の code-generation まで確定しない。U8 の執筆時は予定パスを書き、U9 で実在を検証する。
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
