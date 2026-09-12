# Code Generation — 確認事項（U4 設計センサー / u4-design-sensors）

## Sources

- `inception/units-generation/unit-of-work.md`（U4 = DesignSensorSuite + GoldenCaseSuite、kind: library、複雑度 L）
- `inception/requirements-analysis/requirements.md`（FR4.4、FR5.4、FR5.5、FR6、FR6.1〜FR6.6、FR8.1、FR8.2、FR8.7、NFR4）
- `construction/u4-design-sensors/functional-design/functional-spec.md`、`rules.md`、`entities.md`
- `ddd/sensors/aidlc-ddd-*.md`（6 本）、`ddd/tools/ddd-sensor-*.ts`（6 本）、`ddd/tests/golden/`、`ddd/tests/u4-*.test.ts`（既存の実装）

## 前提

本 Unit の実装はすでに作業ツリー上に存在し、`ddd/CHANGELOG.md` の v0.1.0 に含まれている。
本計画は**既存の実装を code-generation ステージの成果として記録し、仕様に照らして検証する**。
Step 1〜11 は既存実装の検証であり、実装の書き起こしは行わない。
既存ファイルへの改変は**本改訂で追加した Step 12 のみ**である（下記 2 を参照）。

## 承認時に確認されたい点

**1. ゴールデンケースの構成規約が仕様と異なる。**
仕様 BR8.1 / WF8.1〜8.2 は `tests/golden/<suite>/<sensor-id>/<case-name>/` に
`record/` と `expected.json` を置き、ランナーがディレクトリを列挙して `expected.json` を読む形を
要求している。実装は `tests/golden/design/cases.ts` の **TypeScript の表**でケースを持ち、
`files` / `state` を一時ディレクトリに実体化してからスクリプトを起動する。`expected.json` は無く、
`record/` の列挙も無い。一方で BR8.2（`pass` と `(rule_id, file)` 集合の完全一致）、
BR8.3（網羅性）、BR8.4（実引数での起動）、BR8.5（決定性）、BR8.6（fixture を `tests/` に置く）は
満たしている。**実装を書き換えず、逸脱として記録する。**

**2. 3 本のマニフェストが、スクリプトの発行する rule_id を 4 つ宣言していない。**
`mapping-declarations.document` / `mapping-declarations.model` / `layer-structure.model` /
`design-advisories.document` はスクリプトが発行するが、各マニフェストの `checks:` に無い。
BR1.1 / BR1.2 はマニフェストが自分の検査を宣言することを求めており、宣言の無い所見は
`requirement` / `inputs` / `outcome` を持たない。ゴールデンケースの網羅性テストも
「宣言された rule_id」を起点にするため、この 4 つは網羅性の検査対象から外れる。
`reference-ids` は同種の `.document` / `.model` を宣言しており、他 3 本だけが揃っていない。

**本改訂で Step 12 として解消する。** 前回周回は「実装を書き換えず記録にとどめる」方針だったが、
4 本とも「宣言ブロックが壊れている／正規モデルが読めない」という不正入力のハンドリング経路で、
うち 3 つはセンサーの `default_severity: blocking` を受ける。すなわち
**不正入力のときに `requirement` も `inputs` も持たない blocking 所見でゲートが閉じうる**。
Step 12 で 3 本のマニフェストに 4 件を宣言し、`reference-ids` の同種の宣言に
`requirement` / `inputs` を揃える。

| rule_id | `requirement` | センサーの `default_severity` |
|---|---|---|
| `mapping-declarations.document` | ADR-008 | blocking |
| `mapping-declarations.model` | FR6.1 | blocking |
| `layer-structure.model` | FR6.1 | blocking |
| `design-advisories.document` | ADR-008 | advisory |

`tests/u4-golden.test.ts` の「every declared rule has a violation case」が宣言ごとに
違反ケースを要求するため、`tests/golden/design/cases.ts` にゴールデンケースを 4 件追加する。
**スクリプトの振る舞いは変えない。** 宣言を実装の実態に合わせるだけである。

ただし **`rules.md` への仕様化は本 Unit では行わない**。この 4 経路は BR5・BR6・BR7 の
いずれにも現れず（grep で 0 件）、仕様本文への追記は functional-design の成果物への変更で
code-generation の範囲外である。仕様と宣言の乖離は逸脱として残し、恒久的な解消には
functional-design への変更依頼が要る旨を `code-summary.md` に記録する。

**3. model-presence が読む正規モデルのパスが、仕様本文の記載と異なる。**
仕様 WF3.3 は `inception/domain-modeling/domain-model.yaml` と書くが、実装は
`inception/ddd-domain-modeling/domain-model.yaml` を読む。ステージ slug は `ddd-domain-modeling`
（`ddd/stages/inception/ddd-domain-modeling.md` の frontmatter）であり、FR11.2 の `ddd-` 接頭辞規約
からも**実装が正しく仕様本文が不正確**である。マニフェストの `matches` も一貫している。
**実装はそのまま、仕様本文との差として記録する。**

**この 3 点はいずれも隠さず計画に明記している。** 1 と 3 は実装を変えず逸脱として記録、
2 は本改訂で Step 12 として解消する。他に未解決の所見は無い。

**4. `bun run check` は終了コード 0 にならない見込みである。**
U3 と同じ理由（`tests/codex-dispatch-bridge.test.ts` の 12 件が要求する
`aidlc-workflows/dist/codex/aidlc` の fixture が未生成。読み取り専用サブモジュール）である。
FR8.7 と NFR4 の**検証欄**は `bun run check` の緑を挙げているが、**要件本文**が求めているのは
「各センサーにゴールデンケースが同梱され、テストで通過すること」（FR8.7）と
「既存テスト 2 本は緑のまま」（NFR4）である。計画は要件本文に照らして判定し、
実測値と生の証拠を `code-summary.md` に併記する。目標を下げて通すことはしない。

---

## Plan Approval

承認対象は次の 3 つである。

1. `construction/u4-design-sensors/code-generation/code-generation-plan.md`（埋め込みの Testing Contract を含む）
2. `construction/u4-design-sensors/code-generation/unit-test-instructions.md`
3. 上記 2 つに埋め込まれた Testing Contract（`contract_sha256: sha256:8d7f1a7f51e8e641623b1e21dc4fed305238daeae0eb70f0d7e8c9b1a833a386`）

[Approval Fingerprint]: sha256:v3:f87b316fb28801d2e15cc1fa998e72235a0dc726caa6c7047ae1f9e56332b6ae
[Planned Source]: 149116c303229bbead56ee31f33c8444c8bffbe290c6504cdad9e7cbf4ceb706

- Approve Plan — proceed to code generation
- Request Changes — revise the plan

[Answer]: Approve Plan
