# Units Generation — 確認事項

## Sources

- `inception/domain-design/components.md`（14コンポーネント、19エンティティ、依存グラフ）
- `inception/domain-design/decisions.md`（ADR-001〜ADR-010。ADR-001 の4ライブラリ分離、ADR-002 の9マニフェスト、ADR-009 の設計側／コード側検査の分離が Unit の境界を制約する）
- `inception/requirements-analysis/requirements.md`（FR1〜FR11、NFR1〜NFR10、制約 CON1〜CON12）
- 確定済みで再確認しない事項: 投影先はプラグイン1つ（`plugins/ddd/`）で、Unit ごとに別々に配布・デプロイすることはない。対象言語は Rust のみ（CON11）。テスト戦略は Standard。

以下は、14コンポーネントを実装単位（Unit）にまとめるための判断だけを聞くものです。どの Unit から作るかの順序（価値優先・リスク優先など）はここでは決めません。

---

## Q1. Unit の境界をどの軸で切りますか？

文脈: コンポーネントは「compose の合成面」（ステージ／contribution／センサー／ナレッジ／ツール／パッケージング）と「対象層」（ドメイン層／ユースケース層／IA 層）の2軸で眺められます。Construction では Unit ごとに機能設計・コード生成・レビューが回るので、境界は「1つの Unit を作り終えたら単独で検証できる」ことを優先します。

- A. 合成面と依存の向きで切る: 共有ライブラリ → センサー群 → ステージ／contribution → ナレッジ → パッケージング。各 Unit はゴールデンケースで単独検証できる
- B. 対象層で縦に切る: ドメイン層一式（ステージ＋モデルスキーマ＋domain 系センサー＋ナレッジ）、ユースケース層一式、IA 層一式、共通基盤。層ごとに end-to-end で動く
- C. コンポーネント1つ＝Unit 1つ（14 Unit）
- D. 全体を1 Unit にする
- X. Other (please specify)

[Answer]: A. 合成面と依存の向き (Recommended)

---

## Q2. 共有ライブラリ4つ（SensorRuntime / DomainModelSchema / RustSyntaxAnalyzer / WorkspaceLayerResolver）をどう Unit にまとめますか？

文脈: 4つとも葉（他に依存しない）で、センサー群の土台です。DomainModelSchema はステージと contribution の出典でもあり、RustSyntaxAnalyzer は唯一の外部ランタイム（WASM）を抱えます。まとめるほど早く土台が揃い、分けるほど並列に作れて WASM の検証を切り離せます。

- A. 2 Unit に分ける: 「センサー基盤」（SensorRuntime + DomainModelSchema。設計センサーの土台）と「Rust 解析基盤」（RustSyntaxAnalyzer + WorkspaceLayerResolver。コードセンサーの土台）
- B. 1 Unit にまとめる（`tools/ddd/lib/` 全体）
- C. 4 Unit に分ける（ライブラリごと）
- D. 各ライブラリを最初に使うセンサー群の Unit に同梱する
- X. Other (please specify)

[Answer]: A. 2 Unit に分ける (Recommended)

---

## Q3. センサー群（DesignSensorSuite: 6マニフェスト、RustCodeSensorSuite: 3マニフェスト）をどう Unit にしますか？

文脈: 設計センサーは YAML/Markdown を読み、Rust センサーは構文木と層判定を読みます。依存する土台が違い、ゴールデンケースも別です（FR8.7）。Rust センサーの規則 (a)〜(n) は14種あり、1 Unit だと大きくなります。

- A. 2 Unit: 「設計センサー」と「Rust コードセンサー」。それぞれ自分のゴールデンケースを同梱する
- B. 3 Unit: 「設計センサー」「Rust センサー（domain / use-case 層: (a)(b)(c)(d)(g)(h)(i)）」「Rust センサー（IA 層: (k)(l)(m)(n)）」
- C. 1 Unit: 全センサーを1つに
- D. マニフェストごとに9 Unit
- X. Other (please specify)

[Answer]: A. 2 Unit (Recommended)

---

## Q4. ゴールデンケース（GoldenCaseSuite）は独立した Unit にしますか、各センサー Unit に同梱しますか？

文脈: fixture は `tests/golden/` に置き `tools/` には置けません。センサーの受け入れ基準そのものなので、センサーと同じ Unit で作ると「Unit を作り終えたら検証できる」状態になります。独立 Unit にすると fixture 規約を先に決められますが、センサー Unit が単独で完結しなくなります。

- A. 各センサー Unit に同梱する（fixture の構成規約は最初のセンサー Unit で決め、後続が従う）
- B. 独立した Unit にし、全センサーの後に作る
- C. fixture 規約とテストランナーだけを先に独立 Unit で作り、fixture 本体は各センサー Unit に同梱する
- X. Other (please specify)

[Answer]: A. 各センサー Unit に同梱 (Recommended)

---

## Q5. ステージ（DomainModelingStage）と4つの contribution をどう Unit にしますか？

文脈: いずれも Markdown の宣言ファイルで、DomainModelSchema の ID 文法と、束ねるセンサー ID に依存します。contribution はコアステージ1つにつき1ファイルです。compose が拒否しないことは `aidlc-plugin-test --install`（FR11.4）で確認します。

- A. 2 Unit: 「domain-modeling ステージ」と「4 contribution」（domain-design / functional-design / infrastructure-design / code-generation）
- B. 1 Unit: ステージと contribution をまとめて「ワークフロー統合」
- C. 5 Unit: ステージ1 + contribution 4
- D. 層ごとに3 Unit: ドメイン層（ステージ + domain-design contribution）、ユースケース層（functional-design）、IA 層（infrastructure-design + code-generation）
- X. Other (please specify)

[Answer]: A. 2 Unit (Recommended)

---

## Q6. ナレッジ（DddKnowledgePack）はどの Unit に入れますか？

文脈: Markdown のみで、役割別ディレクトリに約20ファイル。DomainModelSchema と WorkspaceLayerResolver を出典として参照し、ADR-010 の矛盾一覧を転記します。コードとは変更理由が違います。

- A. 独立した Unit（kind: spec）にする
- B. ステージ Unit に同梱する（domain-modeling のリードが読むナレッジと一緒に作る）
- C. 役割ごとに分けて、architect 分はステージ Unit、developer 分は Rust センサー Unit、aws-platform 分は contribution Unit に同梱する
- X. Other (please specify)

[Answer]: A. 独立した Unit (Recommended)

---

## Q7. パッケージング（PluginPackaging: plugin.json、ビルド配線、README、compose 統合テスト）はどう扱いますか？

文脈: 既存の `plugins/ddd/` には plugin.json と空の足場、`bun run validate / build / check` の配線が既にあります（コード知識ベース `ddd/component-inventory.md`）。README・CHANGELOG・LICENSE と統合テストの拡充が残っています。

- A. 独立した Unit（kind: packaging）にし、他の全 Unit に依存させる（最後に README と統合テストを仕上げる）
- B. 2つに分ける: 「足場の更新」（plugin.json の contributes 宣言、ビルド配線。他の Unit より先）と「公開品質」（README / CHANGELOG / LICENSE / 統合テスト。最後）
- C. 独立 Unit にせず、各 Unit が自分の分の plugin.json 宣言と README 節を書く
- X. Other (please specify)

[Answer]: B. 2つに分ける (Recommended)

---

## Q8. 依存のない Unit 同士は並列に作ってよいですか？

文脈: 共有ライブラリ2 Unit は互いに独立で、設計センサーと Rust センサーもそれぞれの土台が揃えば独立です。並列を許すと Construction で同時に進められますが、fixture 規約や `tools/ddd/lib/` の共通コードで衝突する可能性があります。

- A. 並列を許す（依存グラフだけを制約にする）
- B. 直列のみ（トポロジカル順で1つずつ）
- C. 共有ライブラリと fixture 規約が揃うまでは直列、その後は並列を許す
- X. Other (please specify)

[Answer]: C. 基盤が揃うまで直列、その後並列 (Recommended)

---

## Consolidated Summary Confirmation

- Q1 境界軸: 合成面と依存の向きで切る（共有ライブラリ → センサー群 → ステージ／contribution → ナレッジ → パッケージング）（A）
- Q2 共有ライブラリ: 2 Unit。「センサー基盤」（SensorRuntime + DomainModelSchema）と「Rust 解析基盤」（RustSyntaxAnalyzer + WorkspaceLayerResolver）（A）
- Q3 センサー群: 2 Unit。「設計センサー」（6マニフェスト）と「Rust コードセンサー」（3マニフェスト）（A）
- Q4 ゴールデンケース: 各センサー Unit に同梱。fixture 規約は最初のセンサー Unit で決める（A）
- Q5 宣言系: 2 Unit。「domain-modeling ステージ」と「4 contribution」（A）
- Q6 ナレッジ: 独立した Unit（kind: spec）（A）
- Q7 パッケージング: 2 Unit。「足場の更新」（先）と「公開品質」（最後）（B）
- Q8 並列: 共有ライブラリと fixture 規約が揃うまで直列、その後は依存グラフだけを制約に並列を許す（C）

合計 9 Unit。

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
