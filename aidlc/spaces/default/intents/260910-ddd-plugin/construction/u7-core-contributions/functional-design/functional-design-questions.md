# Functional Design — 確認事項（U7 コアステージ contribution / u7-core-contributions）

## Sources

- `inception/units-generation/unit-of-work.md`（U7 の責務: 4 つの contribution の frontmatter（`adds.consumes` / `adds.produces` / `adds.sensors`）と fragments。`ddd-aggregate-mapping`、`ddd-use-case-declarations`、`ddd-layer-structure` の記載形式は U4 が所有し U7 が fragments で指示する。anchor は実装済みの 4 種のみ、追加のみで上書きしない）
- `inception/units-generation/unit-of-work-story-map.md`（U7 の要件: FR3、FR3.1〜FR3.5、FR4、FR4.1〜FR4.3、FR5、FR5.1〜FR5.3、FR8.3。先に固める要件は FR3.1 と FR3.5）
- `inception/requirements-analysis/requirements.md`（FR3〜FR5、FR8.3、CON1〜CON3、CON8、CON12）
- `inception/domain-design/components.md`（4 つの contribution の振る舞い、AggregateMapping / UseCaseDeclaration / LayerStructureDeclaration）
- `inception/domain-design/decisions.md`（ADR-003 発火経路、ADR-005 命名規約の出典、ADR-007 順序強制、ADR-008 `ddd-` 成果物、ADR-009 設計側検査）
- U4 の設計 `construction/u4-design-sensors/functional-design/`（宣言成果物の fenced yaml の形、マニフェスト ID、契機の成果物パス）
- U5 の設計 `construction/u5-rust-code-sensors/functional-design/functional-spec.md` §7（code-generation の fragments に載せる実装規約）
- 参照プラグイン `aidlc-workflows/plugins/test-pro/contributions/`（frontmatter の形: `target` / `plugin` / `adds` / `fragments[].anchor` / `order`、本文の `## fragment: <anchor>` 見出し）
- コアのステージ定義（`domain-design` 8 ステップ、`functional-design` 6 ステップ、`infrastructure-design` 7 ステップ、`code-generation` 7 ステップ）
- 確定済みで再確認しない事項: 成果物は `ddd-aggregate-mapping`（domain-design）、`ddd-use-case-declarations`（functional-design）、`ddd-layer-structure`（infrastructure-design）の 3 つで、形式は U4 が定めた fenced yaml（ADR-008、U4 §2）。`adds.sensors` の ID は U4 の 6 本と U5 の 3 本（FR3.5、FR4.3、FR5.4、FR8.3）。`adds.consumes` で `ddd-domain-model-yaml` を domain-design に要求する（FR3.1）。anchor は `after-step:<n>` / `before-step:<n>` / `end-of-steps` / `in:<Compartment>` のみ（FR3.4、CON8）。contribution の本文は英語（U6 Q4、U8 Q1 と同じ理由）。

設計書と上流の設計で決まっていない、contribution の挿入位置と例外的な Unit の扱いだけを聞きます。

---

## Q1. 4 つの contribution の fragments をコアの手順のどこに挿入しますか？

文脈: コアのステージは質問 → 回答 → 成果物生成 → 完了 の順で、挿入位置によって「宣言を書け」という指示が質問の前に来るか成果物生成の中に来るかが変わります。案 A はコアの各ステージの手順番号に合わせた具体案です。

- A. 成果物生成のステップの直後に「宣言成果物を書け」を挿入し、質問生成のステップの直後に「宣言に必要な事項を質問に含めよ」を挿入する: domain-design は `after-step:2`（質問に 2 軸を含める）と `after-step:4`（写像成果物を書く）、functional-design は `after-step:2` と `after-step:4`、infrastructure-design は `after-step:2` と `after-step:5`、code-generation は `after-step:1`（計画前に命名・配置規約と実装規約を読む）と `in:Sensors`（Rust センサーの案内）
- B. すべて `end-of-steps` にまとめて挿入する（挿入位置の保守は楽だが、質問に宣言事項が含まれず、成果物の後追いになる）
- C. 成果物生成ステップの `before-step:<n>` に挿入し、コアの成果物より先に宣言を書かせる
- X. Other (please specify)

[Answer]: A. 質問の後＋成果物生成の後 (Recommended)

---

## Q2. 集約もユースケースも持たない Unit（packaging / spec / ui など）では、per-unit の宣言成果物（`ddd-use-case-declarations`、`ddd-layer-structure`）をどう扱いますか？

文脈: `functional-design` と `infrastructure-design` は Unit ごとに実行され、contribution の `adds.produces` は Unit の種別に関わらず要求されます（contribution は `produces_kinds` を変えられません）。ドキュメントだけの Unit にユースケース宣言を書かせるのは無意味ですが、成果物が無いと完了条件に引っかかる可能性があります。U4 のセンサーは成果物が存在するときだけ発火します。

- A. 空の宣言を書く: `use_cases: []` / `layer_structures: []` と `model_ref` を持つ fenced yaml に「この Unit は対象外」の一文を添える。センサーは空の一覧を pass にする（U4 の検査は要素ごとなので所見が出ない）
- B. 成果物を省略し、fragments で「対象外の Unit では書かなくてよい」と指示する（`adds.produces` の必須性がエンジンで強制される場合に完了できないリスクを負う）
- C. `adds.produces` を使わず、宣言成果物をコアの成果物の節として書かせる（ADR-008 を覆す）
- X. Other (please specify)

[Answer]: A. 空の宣言を書く (Recommended)

---

## Consolidated Summary Confirmation

- Q1 挿入位置: 質問生成ステップの直後に「宣言に必要な事項を質問に含めよ」、成果物生成ステップの直後に「宣言成果物を書け」を挿入する（domain-design: after-step:2 / after-step:4、functional-design: after-step:2 / after-step:4、infrastructure-design: after-step:2 / after-step:5、code-generation: after-step:1 と in:Sensors）（A）
- Q2 対象外の Unit: `use_cases: []` / `layer_structures: []` と `model_ref` を持つ空の宣言を書き、「この Unit は対象外」の一文を添える（A）

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
