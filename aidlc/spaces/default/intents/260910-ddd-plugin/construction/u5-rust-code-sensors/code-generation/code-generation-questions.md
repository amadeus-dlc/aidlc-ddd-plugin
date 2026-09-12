# Code Generation — 確認事項（U5 Rust コードセンサー / u5-rust-code-sensors）

## Sources

- `inception/units-generation/unit-of-work.md`（U5 = RustCodeSensorSuite + GoldenCaseSuite（Rust センサー分）、kind: library、複雑度 XL）
- `inception/requirements-analysis/requirements.md`（FR7、FR7.1〜FR7.13、FR9.5、NFR1、NFR3）
- `construction/u5-rust-code-sensors/functional-design/functional-spec.md`、`rules.md`、`entities.md`
- `ddd/sensors/aidlc-ddd-rust-*.md`（3 本）、`ddd/tools/ddd-sensor-rust-*.ts`（3 本）、`ddd/tools/ddd/lib/rules/`、`ddd/tests/golden/rust/cases.ts`、`ddd/tests/u5-*.test.ts`（既存の実装）

## 前提

本 Unit の実装はすでに作業ツリー上に存在し、`ddd/CHANGELOG.md` の v0.1.0 に含まれている。
本計画は**既存の実装を code-generation ステージの成果として記録し、仕様に照らして検証する**。
実装の書き起こしは行わない。U3・U4 と同じ立場である。
**既存ファイルへの改変は Step 12・12b の 2 パスに限られる**
（`ddd/tests/golden/rust/cases.ts` と `ddd/tools/ddd/lib/rules/evaluate.ts`）。

## 承認時に確認されたい点

**1. Rust 判定器の配置が仕様の「1 規則 1 ファイル」と異なる。**
仕様 §2 は `lib/rules/rust/a-public-field.ts … n-restoration-bypass.ts` の形を書くが、実装は
`lib/rules/rust/evaluators.ts` の 1 ファイルに 11 個の判定器関数を置き、表で rule_id に対応づける。
定義と判定器の分離（BR9.1）、U2 の事実だけを入力にすること（BR7.2）は満たしている。
**実装を書き換えず、逸脱として記録する。**

**2. ゴールデンケースの構成規約が仕様と異なる（U4 と同じ乖離）。**
仕様 BR10.1 は `tests/golden/rust/<sensor-id>/<case-name>/` に `record/`・`workspace/`・`expected.json`
を置く形を要求するが、実装は `tests/golden/rust/cases.ts` の TypeScript の表でケースを持ち、
一時ディレクトリに実体化してから起動する。実引数起動・完全一致比較・決定性は満たしている。
**実装を書き換えず、逸脱として記録する。**

**3. ゴールデンケースの網羅が仕様 BR10.2〜BR10.4 の列挙に届いていない。**
実装は 16 ケース（clean 3、violation 12、model-skipped 1）で、**宣言された rule_id ごとに 1 件以上の
violation ケース**は満たす。しかし仕様が求める clean ケース（(c) の replay 経路、(d) の IA 層からの
getter、(k) の rmu からの両側依存、(h) の Id 型引数）、violation ケース（c-post-init、d（use-case）、
g の use-case → IA と external-io、layer.* 診断）、model.invalid ケース、性能計測ケースは無い。
特に **FR7.3 と FR7.4 の受け入れ基準が挙げる「replay 経路 / IA 層からの呼び出しを含む fixture が
pass する」に対応する clean ケースが無い**。判定器側には c-post-init・model.invalid の実装がある。
**実装を書き換えず、要件の検証欄に関わる乖離として記録し、承認時に確認されたい。**

**4. 正規モデルのパスが仕様本文の記載と異なる（U4 と同じ乖離）。**
仕様 BR3.4 は `inception/domain-modeling/domain-model.yaml` と書くが、実装は
`inception/ddd-domain-modeling/domain-model.yaml` を読む。ステージ slug と FR11.2 の接頭辞規約から
**実装が正しく仕様本文が不正確**である。**実装はそのまま、仕様本文との差として記録する。**

**5. `bun run check` は終了コード 0 にならない見込みである。**
U3・U4 と同じ理由（`tests/codex-dispatch-bridge.test.ts` の 12 件が要求する fixture が未生成）である。
計画は要件本文に照らして判定し、実測値と生の証拠を `code-summary.md` に併記する。

**6. 前回レビューの未解決 2 件を、本改訂で Step 12・Step 13 として取り込んだ。**

- **R-03（Major）— ゴールデンケースが BR10.2 の列挙に届いていない。**
  実測は **15 件**（violation 12・clean 3）で、BR10.2 が求める violation 19 種・clean 7 種に対し
  **12 種が不足**している。`tests/u5-golden.test.ts` の網羅性テストは**規則 ID 単位**
  （裸の `a`〜`n`）で見るため、各文字に 1 件ずつあれば緑になり、この不足を検出できない。

  不足 12 種のうち、**`layer.unknown` / `layer.conflict` / `layer.mixed-targets` の 3 種を
  Step 12 で追加する**（追加後 18 件）。この 3 つは網羅性テストの `NOT_IN_RUST_SUITE` で
  除外されており、**どのテストでも一度も踏まれていない**。不足の中で最もリスクが高い。

  発火条件は `lib/workspace/resolver.ts` の実測による — `:405` bin と lib の両ターゲット、
  `:456` 名前の接尾辞と配置ディレクトリの食い違い、`:476` 接尾辞も層ディレクトリも無い。
  診断はクレートの `Cargo.toml` に付くため `expect.files` はそこを指す。
  **3 センサーのスクリプトと判定器は変更しない**（下記 7 の Step 12b が
  `evaluate.ts` の診断転送 1 行だけを直す）。

  **残る 9 種は `Deferred` として `code-summary.md` に一覧で明示する**
  — violation の `c-post-init` / `d（use-case）`/ `g（use-case → IA）`/
  `g（domain → use-case）`/ `g（external-io）`、clean の `(c)` ES replay /
  `(d)` IA 層からの getter / `(k)` rmu からの両側依存 / `(h)` Id 型引数。
  「網羅している」とは書かない。

- **R-01（Minor）— ケース数の記載が実測と違う。** 計画 L117・L296 と
  `unit-test-instructions.md` L44 は「16 件」と書いていたが実測は 15 件だった。
  前周回は両ファイルが承認フィンガープリントで凍結されていて直せなかった。
  本改訂で Step 13 として、Step 12 の追加後の値である **18 件**に直した。

**7. Step 12 の実装中に、層診断の rule_id が二重接頭辞になる欠陥を見つけた（Step 12b）。**

`lib/rules/evaluate.ts:38` は `rule_id: \`layer.${diagnostic.code}\`` と組み立てるが、
`DiagnosticCode`（`lib/workspace/resolver.ts:27-35`）は **8 種すべてが既に名前空間接頭辞を
持つ**。したがって発行される ID は必ず `layer.layer.unknown` /
`layer.cqrs.conflict` のように二重になる。**接頭辞が正しくなるコードは 1 つも無い。**

追加したゴールデンケースを実行して実測で確認した。

```
unexpected finding layer.layer.unknown       @ packages/misc/billing-thing/Cargo.toml
unexpected finding layer.layer.conflict      @ packages/use-case/billing-domain/Cargo.toml
unexpected finding layer.layer.mixed-targets @ packages/domain/billing-domain/Cargo.toml
```

マニフェストの宣言は `layer.*` なので、二重接頭辞の ID とは永久に一致しない。
`NOT_IN_RUST_SUITE` がこの 3 つを除外している本当の理由はこれだと考えられる。

**修正は 1 行**（`rule_id: diagnostic.code`）で、`layer.layer.*` /
`layer.cqrs.*` / `layer.workspace.*` に依存するコード・文書・fixture は
`ddd/` 全体に **1 件も無い**ことを grep で確認済みである。

**判定器と 3 センサーのスクリプトは変更しない。** 変更は `evaluate.ts` の診断転送 1 行のみ。

なお `cqrs.conflict` / `cqrs.query-domain` / `workspace.unreadable` /
`workspace.no-members` は修正後も**どのマニフェストにも宣言されていない**。
これは U4 の未宣言 rule_id と同種のギャップで、**本 Unit では直さず記録する**。

**この 7 点はいずれも隠さず計画に明記している。** 1〜5 は従来どおり、
6 は Step 12・13、7 は Step 12b で本パス内に修正する。他に未解決の所見は無い。

---

## Plan Approval

承認対象は次の 3 つである。

1. `construction/u5-rust-code-sensors/code-generation/code-generation-plan.md`（埋め込みの Testing Contract を含む）
2. `construction/u5-rust-code-sensors/code-generation/unit-test-instructions.md`
3. 上記 2 つに埋め込まれた Testing Contract（`contract_sha256: sha256:8d7f1a7f51e8e641623b1e21dc4fed305238daeae0eb70f0d7e8c9b1a833a386`）

[Approval Fingerprint]: sha256:v3:fa07658e7287c270bdceeef0231db396eef68d5289adf533df4623e511490a57
[Planned Source]: 979589b1cab0ff073210c56dcb0bef7f238570af91608fb4adf5c57f72e5dbbe

- Approve Plan — proceed to code generation
- Request Changes — revise the plan

[Answer]: Approve Plan
