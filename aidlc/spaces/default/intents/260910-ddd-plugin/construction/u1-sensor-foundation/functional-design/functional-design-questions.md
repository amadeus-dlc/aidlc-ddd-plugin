# Functional Design — 確認事項（U1 センサー基盤 / u1-sensor-foundation）

## Sources

- `inception/units-generation/unit-of-work.md`（U1 の責務: SensorRuntime と DomainModelSchema）
- `inception/units-generation/unit-of-work-story-map.md`（U1 に割り当てた要件: FR2、FR2.1〜FR2.7、FR8、FR8.5、NFR8、NFR9）
- `inception/requirements-analysis/requirements.md`（FR2 正規モデルのスキーマ、FR8.5 ディスパッチャ契約、NFR8 可観測性、NFR9 セキュリティ）
- `inception/domain-design/components.md`（SensorRuntime・DomainModelSchema の振る舞いと 11 エンティティ）
- `inception/domain-design/decisions.md`（ADR-001 の4ライブラリ分離、ADR-004 の状態ファイル読み取り、ADR-010 の矛盾一覧）
- `ddd/docs/domain-layer-design.md` §3〜§5（正規モデルの包含構造、参照 ID の例、ID のライフサイクル）と `ddd/docs/use-case-layer-design.md` §5-5（冪等性戦略）
- エンジンのセンサーディスパッチャ `.claude/tools/aidlc-sensor.ts`（スクリプトは終了コード 0 で `pass` を含む JSON を標準出力に書く。終了コード 127 は「ツール未導入」、その他の非 0 は advisory の script-error になる。詳細ファイルはディスパッチャが JSON から生成する）
- 確定済みで再確認しない事項: 4ライブラリは `tools/ddd/lib/` 配下（ADR-001）。YAML を正とし md は整合検査の対象（FR2.7）。冪等性戦略は Command の属性（FR2.5、RA-Q6）。ネットワーク・実行系 API は使わない（NFR2、NFR9）。

設計書とエンジンの契約で決まっていない点だけを聞きます。いずれも U4〜U8 が参照する共通の取り決めになります。

---

## Q1. 安定 ID の接頭辞（要素種別）をどう揃えますか？

文脈: 設計書は `bc.billing`、`aggregate.invoice`、`entity.invoice`、`primitive.invoice-number`、`invariant.invoice.total-positive`、`transition.invoice.issued-to-paid` を例示していますが、Value Object・Command・Domain Event・Domain Error・Factory Rule・Process Manager の接頭辞は決まっていません。この接頭辞はセンサー (e) の解決規則、下流成果物（写像・ユースケース宣言）の記載、ナレッジの説明に共通で使われます。

- A. 種別ごとに短い英単語の接頭辞を固定する: `bc` / `aggregate` / `entity` / `vo` / `primitive` / `invariant` / `command` / `event` / `error` / `transition` / `factory` / `pm`。区切りは `.`、各セグメントは小文字ケバブ（`[a-z][a-z0-9-]*`）。集約配下の要素は `<kind>.<aggregate>.<name>`（例: `command.invoice.issue`、`error.invoice.issue.already-issued`）
- B. A と同じ種別だが、集約名を含めない短い形にする（例: `command.issue-invoice`）。衝突は名前で回避する
- C. 種別接頭辞を使わず、`<bc>/<aggregate>/<name>` のパス形式にし、種別は `kind` 属性だけで持つ
- X. Other (please specify)

[Answer]: A. 種別接頭辞＋集約名を含む (Recommended)

---

## Q2. ID 系譜（rename / split / merge / 廃止の記録）はどこに置きますか？

文脈: 設計書は「split／merge／削除では後継・置換・廃止の関係を記録する」と定めていますが、置き場所は未定です。センサー (e) は廃止 ID の再利用と循環する置換関係を検出するため、系譜を必ず読みます。

- A. `domain-model.yaml` の最上位セクション `lineage:` に置く（1ファイルが正。要素 ID と同じ検査で読める）
- B. 別ファイル `domain-model-lineage.yaml` に置く（本体の差分を小さく保つ。センサーは2ファイルを読む）
- C. 各要素の直下に `lineage` 属性として置く（廃止済み要素も本体に残す）
- X. Other (please specify)

[Answer]: A. domain-model.yaml の lineage: セクション (Recommended)

---

## Q3. 「本質的に非冪等な操作」をスキーマでどう宣言しますか？

文脈: センサー (j) は「非冪等操作なのに冪等性戦略が未宣言」を検出します（FR6.3）。しかし操作が本質的に非冪等（加算・追加系）かどうかを構文だけから判定することはできないため、正規モデル側に宣言が必要です。

- A. Command に `effect: transition | accumulation` を必須属性として持たせ、`accumulation` のときは `idempotency.strategy` が `command-id-memory` でなければ違反にする。`transition` は `none` を許す
- B. `idempotency.strategy` を全 Command で必須にし、`none` を選んだ Command には `absorbed_by: same-value-update` の根拠記述を必須にする（本質の宣言はしない）
- C. 宣言は任意にし、センサー (j) は `idempotency` が無い Command をすべて advisory で報告する
- X. Other (please specify)

[Answer]: A. Command に effect 属性を必須化 (Recommended)

---

## Q4. スキーマの検証器はどう実装しますか？

文脈: `tools/ddd/lib/` は投影される配布物で、bun と同梱物だけで動く必要があります（NFR2）。JSON Schema を機械検証に使うなら検証ライブラリの同梱が要ります。

- A. TypeScript で構造検証器を手書きし、JSON Schema は契約文書（利用者向け・エディタ補完用）として同梱する。実行時の依存を増やさない
- B. `ajv` を `tools/ddd/lib/` に vendoring し、JSON Schema を実行時にも正とする
- C. `zod` などのスキーマライブラリを vendoring し、そこから JSON Schema を生成する
- X. Other (please specify)

[Answer]: A. TypeScript 手書き＋JSON Schema は契約文書 (Recommended)

---

## Consolidated Summary Confirmation

- Q1 ID 接頭辞: 種別ごとに `bc` / `aggregate` / `entity` / `vo` / `primitive` / `invariant` / `command` / `event` / `error` / `transition` / `factory` / `pm` を固定し、区切りは `.`、セグメントは小文字ケバブ。集約配下の要素は `<kind>.<aggregate>.<name>`（A）
- Q2 ID 系譜: `domain-model.yaml` の最上位 `lineage:` セクションに置き、1 ファイルを正とする（A）
- Q3 非冪等の宣言: Command に `effect: transition | accumulation` を必須化し、`accumulation` では `idempotency.strategy` が `command-id-memory` でなければ違反、`transition` は `none` を許す（A）
- Q4 検証器: TypeScript の手書き構造検証器を実装し、JSON Schema は契約文書として同梱する。実行時依存を増やさない（A）

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
