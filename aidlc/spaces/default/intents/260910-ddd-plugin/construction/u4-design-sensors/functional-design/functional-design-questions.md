# Functional Design — 確認事項（U4 設計センサー / u4-design-sensors）

## Sources

- `inception/units-generation/unit-of-work.md`（U4 の責務: DesignSensorSuite の 6 マニフェストと実行スクリプト、GoldenCaseSuite の fixture 規約と設計センサー分の fixture）
- `inception/units-generation/unit-of-work-story-map.md`（U4 に割り当てた要件: FR4.4、FR5.4、FR5.5、FR6、FR6.1〜FR6.6、FR8.1、FR8.2、FR8.7、NFR4。先に固める要件は FR8.7 と FR8.2）
- `inception/requirements-analysis/requirements.md`（FR6 設計成果物のセンサー、FR8.1〜FR8.2 マニフェストの形、FR8.7 ゴールデンケース、NFR4 テスト）
- `inception/domain-design/components.md`（DesignSensorSuite / GoldenCaseSuite の振る舞い、GoldenCase エンティティ）
- `inception/domain-design/decisions.md`（ADR-002 9 マニフェスト、ADR-004 状態ファイルの読み取り、ADR-008 `ddd-` 成果物、ADR-009 設計側の (k)(l)(m)(n)）
- エンジンのゲート発火の実装（`.claude/tools/aidlc-state.ts`）: ゲートでは「存在する宣言済み成果物」ごとに、`matches` に一致するマニフェストを blocking / advisory の区別なく起動する。存在しない成果物には発火しない
- 確定済みで再確認しない事項: マニフェストは 6 本（model-completeness、model-presence、reference-ids、mapping-declarations、layer-structure、design-advisories。ADR-002、ADR-009）。blocking は `fire_on: gate`（FR8.2）。正規モデルの読み込みと参照解決は U1 の API を使う。fixture は `tests/golden/` に置き `tools/` には置かない（GoldenCaseSuite）。

設計書・ADR・U1 の設計で決まっていない点だけを聞きます。Q1 の fixture 規約は U5（Rust コードセンサー）も同じ規約に従います。

---

## Q1. ゴールデンケース fixture の構成規約をどうしますか？

文脈: 各センサーに「違反あり／違反なし」の fixture を同梱し、`bun test` で実行して verdict と所見（規則 ID・ファイル・行）を検証します（FR8.7）。U1 のランタイムは `--output-path` から記録ディレクトリ（`aidlc-state.md` を含む）を辿るため、fixture は記録ディレクトリの形を再現する必要があります。

- A. `tests/golden/<suite>/<sensor-id>/<case-name>/` に 1 ケース 1 ディレクトリ。中に `record/`（`aidlc-state.md` と成果物を含む記録ディレクトリの最小コピー。Rust センサーでは `workspace/` も並置）と `expected.json`（`pass`、所見の `rule_id` / `file` / `line` の一覧）を置く。ケース名は `violation-<規則>` / `clean-<説明>` で始める
- B. センサーごとに 1 ファイル `tests/golden/<sensor-id>.test.ts` にケースを列挙し、入力はテストコード内の文字列テンプレートで作る（ディレクトリを持たない）
- C. A の構成だが、`expected.json` の代わりに `expected.md`（人間が読む所見一覧）を置き、テストはそれを解析する
- X. Other (please specify)

[Answer]: A. 1 ケース 1 ディレクトリ＋expected.json (Recommended)

---

## Q2. `domain-model.md` と `domain-model.yaml` の整合検査（規則 (f)）で、md 側に何を要求しますか？

文脈: yaml を正とし、md の「要素の欠落・不変条件の食い違い」を検出します（FR6.2）。md は人間向けの説明文書なので、機械が突き合わせるための最低限の約束が要ります。この約束は U6（domain-modeling ステージの手順）が md の書き方として指示します。

- A. md の各要素の見出しまたは表に `element_id` をそのまま書くことを要求する。検査は「yaml の全 element_id が md に現れる」「md に現れる `<kind>.` 形式の ID が yaml に存在する」「不変条件は md にも `statement` の全文が現れる」の 3 点
- B. md の末尾に `## Element Index` の表（element_id、name、kind）を要求し、検査はその表と yaml の突き合わせだけにする（本文は自由）
- C. yaml の全 element_id が md の本文のどこかに現れることだけを検査する（不変条件の文面は検査しない）
- X. Other (please specify)

[Answer]: A. 見出し・表に element_id＋不変条件の全文 (Recommended)

---

## Q3. 正規モデル存在検査（model-presence、FR6.4）は `domain-design` のどの成果物を契機に発火させますか？

文脈: ゲート発火は「存在する宣言済み成果物」ごとに起きます。プラグインが追加する `ddd-aggregate-mapping` を契機にすると、その成果物が書かれなかったときに検査自体が発火せず、正規モデルの欠落を見逃します。コアの `components.md` はコアの `domain-design` が必ず書きます。

- A. `**/domain-design/components.md` を契機にする（コアの成果物なので必ず発火する。検査内容は `domain-model.yaml` の存在と参照解決で、`components.md` の中身は読まない）
- B. `**/domain-design/ddd-aggregate-mapping.md` を契機にする（プラグインの成果物に閉じる。欠落時の見逃しは受け入れる）
- C. 両方に一致させ、同じ検査を成果物ごとに実行する（発火は最大 2 回）
- X. Other (please specify)

[Answer]: A. コアの components.md を契機 (Recommended)

---

## Consolidated Summary Confirmation

- Q1 fixture 規約: `tests/golden/<suite>/<sensor-id>/<case-name>/` に 1 ケース 1 ディレクトリ。`record/`（記録ディレクトリの最小コピー。Rust センサーは `workspace/` も並置）と `expected.json`（`pass` と所見の `rule_id` / `file` / `line`）。ケース名は `violation-<規則>` / `clean-<説明>`（A）
- Q2 md/yaml 整合: md の見出しまたは表に `element_id` を書くことを要求し、「yaml の全 ID が md に現れる」「md の `<kind>.` 形式の ID が yaml に存在する」「不変条件の statement 全文が md に現れる」の 3 点を検査する（A）
- Q3 存在検査の契機: `**/domain-design/components.md` を契機にし、`domain-model.yaml` の存在と参照解決を検査する。`components.md` の中身は読まない（A）

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
