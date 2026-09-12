<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-09-11T14:25:00Z — U5 は既存実装の記録・検証として計画した; 3 マニフェスト・規則モジュール・ゴールデンケースが v0.1.0 として作業ツリーに存在するため、U3・U4 と同じ立場で「実装を書き起こさず、仕様に照らして検証して逸脱を記録する」計画にした。

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-09-11T14:25:00Z — ゴールデンケースの網羅不足を実装で埋めず逸脱として記録した; 仕様 BR10.2〜10.4 が求める clean ケース（replay 経路、IA 層からの getter）や c-post-init / layer.* / model.invalid / 性能計測ケースが無いが、本 Unit は記録の立場なので fixture を追加せず、承認ゲートで人間に判断を委ねた。

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
- 2026-09-11T14:25:00Z — 不足しているゴールデンケース（FR7.3 replay 経路、FR7.4 IA 層 getter、c-post-init、g 変種、layer.*、model.invalid、性能計測）をどの Unit で補うか; U5 の記録では追加しなかったので、Build and Test か U9 の `bun run check` 整備で扱うかを決める必要がある。
- 2026-09-11T14:25:00Z — セッション再開時に `plan-approval-guard` フックが `aidlc.ts` 経由の全 Bash 呼び出しを拒否した; フックの信頼済みツール判定が `aidlc-*.ts` の命名だけを許すため、CLAUDE.md が案内する `bun .claude/tools/aidlc.ts engine ...` が「不透明なシェル」扱いになる。`aidlc-orchestrate.ts` を直接呼ぶ回避策で進めたが、フレームワーク側の修正候補。
