<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-09-10T11:43:46Z — マニフェストの command は参照プラグイン test-pro と同じ bun {{HARNESS_DIR}}/tools/ddd-sensor-<name>.ts の形にした; プラグインは複数ハーネスに投影されるため、ハーネス固有のパスを書けない。
- 2026-09-10T11:43:46Z — 3 つの ddd- 宣言成果物（aggregate-mapping / use-case-declarations / layer-structure）の yaml 形式は U4 が所有し、U7 はそれを fragments で指示する側とした; U7 は U4 に依存する（依存グラフ）ため、解析契約の所有者は読む側の U4 が自然。components.md のエンティティに ADR-009 の必須項目と advisory 用の io_unit / store_semantics を足した。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-09-10T11:50:27Z — レビュー R-01（expected.json に stage / output_path を持たせるか）を受け、起動引数と期待結果を expected.json 1 ファイルにまとめた; GoldenCase の属性として別に持つ形は仕様だけから出所が決まらず、ランナー実装者が迷う。entities.md / rules.md BR8.2 / functional-spec.md WF8 を揃えた。
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-09-10T11:43:46Z — (m) の媒体語は固定リストで判定する; 正規表現や辞書の外部化は決定性と同梱の単純さを損なうため、初版は列挙で始めてゴールデンケースで広げる。
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
