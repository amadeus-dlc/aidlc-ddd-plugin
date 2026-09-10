<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

- 2026-09-10T12:32:35Z — 規則 (b) の Command 照合は名前の正規化（型名 PascalCase→ケバブ、メソッド名 snake→ケバブ）で行う（Q1）; 型推論なしで正規モデルの ID と結び付ける唯一の決定的な手段で、注記方式は注記漏れがそのまま違反になるため採らなかった。

- 2026-09-10T12:32:35Z — 規則 (d)(h)(l)(n) の名前照合に使うドメイン型名・getter 名の一覧は、申告ソースではなくワークスペースのドメイン層クレート全体から作る（Q4）; 以前の Unit で生成した型への呼び出しを見逃さないため。判定対象は申告ソースだけに保つ。

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

- 2026-09-10T12:32:35Z — U2 Q1 の「マクロ不透明箇所は advisory の所見」を、所見ではなく verdict の note への転記に変えた; 3 マニフェストはすべて blocking で advisory を混在できない（ADR-002、U1 BR9.3）。件数と位置は note で読める。

- 2026-09-10T13:11:26Z — レビュー R-02 を受け、依存方向違反（FR9.5）の rule_id を独自の direction から要件の受け入れ基準どおり g に戻した; 安全網としての (g) を要件が名指ししており、別 ID は fixture の期待と一致しない。R-01 のクエリ側ユースケース層の扱いは BR1.2 と RustSensorManifest.includes_query_side に明記した。

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

- 2026-09-10T12:32:35Z — 正規モデルが無いワークフローでは (b) と Command 照合部分だけを note 付きで省略し、他の規則は検査する（Q2）; 全体 pass にすると express / poc で Rust 規約が一切効かず、欠落を違反にすると domain-modeling を実行しないスコープで毎回 override が要る。

- 2026-09-10T12:32:35Z — 完全コンストラクタは名前ではなく戻り型（Self 系）で判定し、replay 経路と後付け初期化は固定の名前リストで見分ける（Q5）; 戻り型判定は命名の自由度を保ち、固定リストは決定性と単純さを優先した。リストはゴールデンケースで見直す。

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->

- 2026-09-10T12:32:35Z — c-model（FactoryRule の前提条件を検査しない復元経路）と &self の内部可変性による setter 偽装は構文だけでは判定できず、初版では所見にしない。ナレッジと設計側の宣言で補う。

- 2026-09-10T12:32:35Z — I/O クレートの固定一覧（Q6）と NFR3 の 10 秒目安は仮置き。性能計測ケース（BR10.4）の結果で見直す。
