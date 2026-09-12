# Code Generation — 確認事項（U9 公開品質 / u9-release-quality）

## Sources

- `inception/units-generation/unit-of-work.md`（U9 = 公開品質、kind: packaging）
- `inception/requirements-analysis/requirements.md`（FR11.3、FR11.4、FR11.6、NFR5、NFR6、NFR10）
- `ddd/README.md`、`ddd/CHANGELOG.md`、`ddd/tests/framework-compatibility.test.ts`、`ddd/docs/framework-compatibility.md`、`ddd/scripts/verify-dist.ts`（既存の実装）、`LICENSE`（ワークスペース根）

## 前提

本 Unit の実装（README / CHANGELOG / 統合テスト）はすでに作業ツリー上に存在する。本計画は**既存の
公開品質成果物を code-generation ステージの成果として記録し、要件に照らして検証する**。
書き起こしは行わない。U3〜U7 と同じ立場である。
**既存ファイルへの改変は Step 8 の 1 パスに限られる**（`ddd/CHANGELOG.md` の 1 文。下記 4 を参照）。

## 承認時に確認されたい点

**1. FR11.3 は未達である（`bun run check` が終了コード 0 にならない）。**
`test` 段の `codex-dispatch-bridge.test.ts` 12 件が読み取り専用サブモジュールの fixture 未生成で落ちる。
U3 が GAP として記録済みで、本 Unit も引き継ぐ。**目標を下げず、`traceability.json` で FR11.3 を Gap とする。**

**2. `ddd/LICENSE` が無い（リポジトリ根の `LICENSE` と README の「ライセンス」節で代替）。**
NFR10 と unit-of-work.md は `plugins/ddd/LICENSE` の同梱を挙げる。プラグイン単体配布で同梱されない点を
**要件の受け入れ基準に関わる乖離として記録し、承認時に確認されたい。**

**3. README・`test:sandbox` が要件の 2 ハーネスを超えて kimi / opencode に触れる可能性がある。**
要件を弱めないが、README と統合テスト（claude / codex）の対象範囲の一致を読み合わせで確認し、差があれば記録する。

**4. 前回レビューの未解決 1 件と、U7 からの申し送り 1 件を Step 7・8 として取り込んだ。**

- **R-01（Minor）— テスト件数の記載が実測と違う（Step 7・記録のみ）。**
  計画 L112・L183 と `unit-test-instructions.md` L41・L56 は「計 8 件」と書くが、
  `tests/framework-compatibility.test.ts` の実測は **9 件**である。

  | 区分 | 位置 | 件数 |
  |---|---|---|
  | Codex アダプタ互換 | `:57` `:69` `:88`（`for (const decision of ["deny", "ask"])` で 2 件）`:100` `:116` | **6** |
  | compose の 3 条件 | `:122`（`for (const harness of ["claude", "codex"])` で 2 件） | 2 |
  | Codex ランナー生成 | `:136` | 1 |
  | | | **計 9** |

  前周回は両ファイルが凍結されていて直せなかった。本改訂で 9 件に直した。
  Standard の床（5〜8 件）に対して上限を 1 件超えるが、**床は下限の要求であり
  超過は不足ではない**。その旨も明記した。

- **U7 からの申し送り（Step 8）— `CHANGELOG.md` の `produces` に関する一般化。**
  U7 のレビュー所見 R-02。`ddd/CHANGELOG.md:43-46` は「The design contributions
  deliberately bind sensors and instructions without adding a `produces` artifact」と
  複数形で一般化するが、実測では `produces` を持つのは **4 本中 1 本**
  （`contributions/inception/domain-design.md:8`）である。同じ文書の 17-18 行は
  `domain-design` について正しく書いており、**同一文書内で読み方が割れる**。

  `ddd/CHANGELOG.md` は**本 Unit 所有**（`source-manifest.json` の 9 パスに含まれる）なので
  本 Unit で直す。43 行の主語を実態に合わせ、どれが `produces` を持ちどれが持たないかを
  名指しする。理由の説明（44-46 行）は正しいので変えない。
  **4 本の contribution（U7 所有）には触れない。**

**この 4 点はいずれも隠さず計画に明記している。** 1〜3 は従来どおり、
4 は Step 7・8 で本パス内に修正する。他に未解決の所見は無い。

---

## Plan Approval

承認対象は次の 3 つである。

1. `construction/u9-release-quality/code-generation/code-generation-plan.md`（埋め込みの Testing Contract を含む）
2. `construction/u9-release-quality/code-generation/unit-test-instructions.md`
3. 上記 2 つに埋め込まれた Testing Contract（`contract_sha256: sha256:8d7f1a7f51e8e641623b1e21dc4fed305238daeae0eb70f0d7e8c9b1a833a386`）

[Approval Fingerprint]: sha256:v3:c49fbdbc6ac0ff595fe5a7b4430a382e1dde96254b83a65411472c1d6ffcc8f9
[Planned Source]: 979589b1cab0ff073210c56dcb0bef7f238570af91608fb4adf5c57f72e5dbbe

- Approve Plan — proceed to code generation
- Request Changes — revise the plan

[Answer]: Approve Plan
