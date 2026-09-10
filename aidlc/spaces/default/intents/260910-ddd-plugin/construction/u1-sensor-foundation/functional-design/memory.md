<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-09-10T11:05:04Z — ProcessManager は Aggregate ではなく BoundedContext が所有し、Aggregate.process_managers は読み込み器が補完する導出値にした; components.md は Aggregate の属性に process_managers を挙げるが、複数集約に跨がる要素を 1 集約の入れ子にはできない。
- 2026-09-10T11:05:04Z — Q1 の「集約配下の要素は <kind>.<aggregate>.<name>」を、Invariant / Command / Event / Error / Transition / Factory に適用し、Entity / VO / Primitive は設計書の例（entity.invoice、primitive.invoice-number）どおり <kind>.<name> とした; Domain Primitive は複数の集約から共有され得るため集約名を含めない方が自然で、設計書の例とも一致する。
- 2026-09-10T10:51:43Z — components.md は SensorRuntime が「詳細ファイルを書く」と記すが、エンジンのディスパッチャ（aidlc-sensor.ts）はスクリプトの標準出力 JSON（pass / findings_count ほか）から詳細ファイルを自分で生成する; スクリプト側は終了コード 0 で JSON を出すだけにし、SensorVerdict は「ディスパッチャに渡す報告」として定義する。終了コード非 0 は advisory の script-error になるため、blocking 違反は必ず終了コード 0 + pass:false で返す。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-09-10T11:05:04Z — ランタイムの予期しない例外はフェイルクローズ（pass:false、reason runtime-error）にした; ディスパッチャは非 0 終了コードを advisory の script-error として pass 扱いにするため、例外を伝播させるとセンサーの欠陥が違反の見逃しになる。センサー自体のバグでゲートが閉じる副作用は、監査付き override（CON9）で回避できると判断した。
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-09-10T11:05:04Z — YAML 解析器を bun 組み込みにするか最小実装を同梱するかは code-generation の計画で確定する（NFR2 の実行時依存に関わる）。
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
