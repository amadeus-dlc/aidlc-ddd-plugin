<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-09-10T07:53:35Z — traceability.json は FR グループ（FR1〜FR11）とサブ要件（FR1.1 等）の両方、さらに NFR1〜NFR10 を列挙した; 検査ツールはグループ ID を必須とし、サブ要件と NFR は余剰扱いにならなかった。グループ行の写像先は主担当コンポーネント1つに絞った。
- 2026-09-10T07:23:31Z — 「コンポーネント＝書くコード」の定義を、プラグインが投影する宣言ファイル（ステージ、contribution、ナレッジ）にも広げて解釈した; このプラグインではそれらが主要な成果物であり、コードだけをコンポーネントにすると contribution の境界が Units に現れなくなる。
- 2026-09-10T06:22:37Z — 質問を組む前にエンジン実装を2点確認した（tools/ の再帰コピーと、gate 発火センサーが受け取るのは成果物パスであること）; 前者は共有ライブラリと WASM の置き場、後者は Rust コードセンサーの契機とソース解決の設計に直結し、確認なしでは境界を誤る。確認元は compose.ts の walk/copyTreeNoClobber と docs/reference/07-sensor-system.md。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-09-10T09:14:11Z — OQ6（コア ddd-patterns.md との矛盾洗い出し）は質問ファイルに追加せず、アーキテクトの判断として ADR-010 に記録した; 追加質問にすると要約確認をやり直す必要があり、矛盾の内容は設計書と要件で既に決まっているため、承認ゲートで人間が判断できれば足りると解釈した。
- 2026-09-10T09:14:11Z — Q1 の「約8本」から設計センサーを1本増やして9本にした; FR5.4 の設計側検査（(k)(l)(m)(n) を宣言に対して行う）を担うマニフェストが欠けていた（レビュー R-01）。
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-09-10T07:23:31Z — 14コンポーネントに分解した（ステージ1、contribution 4、センサー群2、解析器・ランタイム4、ナレッジ1、テスト1、パッケージング1）; Markdown だけの contribution やナレッジもコンポーネントとして数えた。compose の合成単位と変更理由が別なので境界として扱う方が Units 分解で自然になる。細かすぎる懸念はあるが、葉の4ライブラリを統合すると第2言語追加とディスパッチャ契約変更の影響範囲が広がる。
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
