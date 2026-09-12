# Code Generation — 確認事項（U6 domain-modeling ステージ / u6-domain-modeling-stage）

## Sources

- `inception/units-generation/unit-of-work.md`（U6 = DomainModelingStage、kind: spec）
- `inception/requirements-analysis/requirements.md`（FR1、FR1.1〜FR1.9）
- `construction/u6-domain-modeling-stage/functional-design/functional-spec.md`、`rules.md`、`entities.md`
- `ddd/stages/inception/ddd-domain-modeling.md`（既存の実装）、`ddd/tests/framework-compatibility.test.ts`、`ddd/tests/u3-plugin-scaffold.test.ts`

## 前提

本 Unit の実装（ステージ定義 1 本）はすでに作業ツリー上に存在し、`ddd/CHANGELOG.md` の v0.1.0 に
含まれている。本計画は**既存の定義を code-generation ステージの成果として記録し、仕様に照らして検証する**。
既存ファイルの改変も、本文の書き起こしも行わない。U3〜U5 と同じ立場である。

## 承認時に確認されたい点

**1. slug とファイル名が `ddd-domain-modeling`（仕様本文と FR1.1 の字面は `domain-modeling`）。**
FR11.2 の `ddd-` 接頭辞規約（U3 のテストが強制）と U4・U5 が読むパスに整合しており、実装が正しく
仕様本文が古い。**実装はそのまま、仕様との差として記録する。**

**2. `scopes` に `plugin-dev` が含まれ 7 スコープ（仕様・FR1.4 は 6 スコープ「だけ」）。**
FR1.4 の受け入れ基準「6 スコープのみ EXECUTE」に対する差。**実装を書き換えず、逸脱として記録する。**

**3. standalone モードの語彙トピックと 3 モードの明示的な判定が本文に無い（BR2.1、BR2.2、FR1.5）。**
rerun と brownfield は本文にあるが、入力なしのとき「ドメインの語彙を引き出す」質問トピックと、
Step 1 でのモード判定が書かれていない。FR1.5 の受け入れ基準に関わる。**実装を書き換えず、要件の
検証欄に関わる乖離として記録し、承認時に確認されたい。**

**4. 本 Unit の契約を踏む既存テストは 4 件で Standard の床（5 件）を 1 件下回る。**
専用テストは無く、compose テスト 2 件と U3 の FR11.2 テスト 2 件のみ。**新設せず、床の不足として記録する。**

**5. `bun run check` は終了コード 0 にならない見込みである。**
U3〜U5 と同じ理由（`tests/codex-dispatch-bridge.test.ts` の fixture 未生成）。要件本文に照らして判定し、
実測値を `code-summary.md` に併記する。

**6. 前回レビューの未解決 2 件を、本改訂で Step 11 として取り込んだ。記録のみで、
アプリケーションソースには一切触れない。**

- **R-01（Major）— `matches` パスの正が 2 か所で食い違っている。**
  実測した結果は次のとおりで、3 Unit すべてが「仕様は接頭辞なし・実装は接頭辞あり」という
  同じ形の乖離を持つ。

  | 主体 | 記述 | 値 |
  |---|---|---|
  | U4 の仕様 | `u4-design-sensors/functional-design/functional-spec.md:20` | `**/domain-modeling/domain-model.yaml` |
  | U4 の実装 | `ddd/sensors/aidlc-ddd-model-completeness.md:9` | `**/ddd-domain-modeling/domain-model.yaml` |
  | U5 の仕様 | `u5-rust-code-sensors/functional-design/rules.md:120` | `inception/domain-modeling/domain-model.yaml` |
  | U5 の実装 | `ddd/tools/ddd/lib/rules/context.ts:96,104` | `"ddd-domain-modeling"` |

  FR11.2 の `ddd-` 接頭辞規約に照らして**実装が正しい**。
  **恒久的な解消には functional-design ステージへの変更依頼が要る**（仕様本文は
  他ステージの成果物であり code-generation の範囲外）。本 Unit はこの矛盾を逸脱として
  明示的に記録し、承認ゲートに上げるところまでを担う。

- **R-02（Minor）— 所見自体が不正確である。**
  R-02 は本 Unit の「U4・U5 の同種の乖離と整合する」という主張を疑うが、実測では
  **両方とも真**である。「U4・U5 が**読む**パス」は実装を指し、U4 も U5 も接頭辞付きを読む。
  R-02 は「U4 の仕様 対 実装の矛盾」と「本 Unit の主張が指す U4 の**実装**との整合」を
  混同している。**所見を否定するのではなく、実測の根拠を添えて記録する。**

**この 6 点はいずれも隠さず計画に明記している。** 1〜5 は従来どおり実装を書き換えず記録し、
6 は Step 11 で記録する。他に未解決の所見は無い。

---

## Plan Approval

承認対象は次の 3 つである。

1. `construction/u6-domain-modeling-stage/code-generation/code-generation-plan.md`（埋め込みの Testing Contract を含む）
2. `construction/u6-domain-modeling-stage/code-generation/unit-test-instructions.md`
3. 上記 2 つに埋め込まれた Testing Contract（`contract_sha256: sha256:8d7f1a7f51e8e641623b1e21dc4fed305238daeae0eb70f0d7e8c9b1a833a386`）

[Approval Fingerprint]: sha256:v3:fa1c6e24cfd389a83c49620162a038150f986e9736ca0f5303cc97f0048b3e62
[Planned Source]: 979589b1cab0ff073210c56dcb0bef7f238570af91608fb4adf5c57f72e5dbbe

- Approve Plan — proceed to code generation
- Request Changes — revise the plan

[Answer]: Approve Plan
