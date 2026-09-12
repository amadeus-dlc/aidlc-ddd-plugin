# Code Generation — 確認事項（U7 コアステージ contribution / u7-core-contributions）

## Sources

- `inception/units-generation/unit-of-work.md`（U7 = 4 つの contribution、kind: spec）
- `inception/requirements-analysis/requirements.md`（FR3〜FR5、FR8.3）
- `construction/u7-core-contributions/functional-design/functional-spec.md`、`rules.md`、`entities.md`
- `ddd/contributions/inception/domain-design.md`、`ddd/contributions/construction/{functional-design,infrastructure-design,code-generation}.md`（既存の実装）、`ddd/CHANGELOG.md`

## 前提

本 Unit の実装（contribution 4 本）はすでに作業ツリー上に存在し、`ddd/CHANGELOG.md` の v0.1.0 に
含まれている。本計画は**既存の contribution を code-generation ステージの成果として記録し、仕様に照らして
検証する**。既存ファイルの改変も、本文の書き起こしも行わない。U3〜U6 と同じ立場である。

## 承認時に確認されたい点

**1. functional-design と infrastructure-design の contribution が `adds.produces` を持たない（仕様 BR3.1 / BR4.1 は持つ）。**
CHANGELOG が記す意図的な判断（contributed artifact が kind で刈り込まれたコアの `review_artifact` の
スキーマ検査を壊す）に基づく。宣言成果物は fragment の指示だけで書かれ、コアの `produces` 契約の外にある。
**実装を書き換えず、意図的な乖離として記録する。承認時に確認されたい。**

**2. FR8.3 の `matches: **/*.rs` は満たしていない（ADR-003 の意図的な選択、値は U5 所有）。**
本 Unit の責務（3 本のバインド）は満たしている。**要件の字面との差として記録する。**

**3. FR4.3 の (g)(h)(i)(d) は functional-design ではなく code-generation に束ねている（仕様 §8、BR3.3）。**
コード規則を設計ゲートで検査できないための分離。**要件の字面との差はゲートで人間の判断に委ねる。**

**4. 本 Unit の契約を踏む既存テストは 4 件で、コンポーネントあたりの Standard 床を満たさない。**
fragment 本文の合成を固定するテストは無く、compose 出力の目視で代替する。**新設せず、床の不足として記録する。**

**5. `bun run check` は終了コード 0 にならない見込みである。**
U3〜U6 と同じ理由。要件本文に照らして判定し、実測値を `code-summary.md` に併記する。

**6. 前回レビューの未解決 2 件を Step 11 として記録に取り込んだ。いずれも本 Unit の所有外にあり、
記録のみで、アプリケーションソースには一切触れない。**

- **R-01（Minor）— `reviewer-scope` フックの字面判定がアンカーされていない。**
  レビュアーが `ddd/contributions/construction/functional-design.md` などを読めなかった件の
  原因を特定した。`.claude/hooks/aidlc-reviewer-scope.ts` の `judgeLexicalPath`（313-322 行）が
  `construction` というパス要素を**位置に関係なく**探し、次の要素が担当 Unit でなければ拒否する。
  そのため記録の `<record>/construction/<unit>/` とは無関係な
  `ddd/contributions/construction/<file>` まで巻き込まれる。
  同ファイルの `judgeResolvedPath` は記録配下の construction に正しくアンカーされており、
  **字面判定だけがアンカーを欠いている**。

  `.claude/hooks/` はフレームワークのファイルで、DDD プラグインにも本 Unit の
  `source-manifest.json`（4 パス）にも含まれない。回避手段も無い
  （`dist/` への投影パスも同じ要素を含む）。**引き取り先はフレームワーク側**である。

- **R-02（Minor）— `CHANGELOG.md` の文言が実装の非対称性と食い違う。**
  `ddd/CHANGELOG.md:43-46` は「The design contributions deliberately bind sensors and
  instructions without adding a `produces` artifact」と複数形で一般化するが、実測では
  `produces` を持つのは **4 本中 1 本**（`contributions/inception/domain-design.md:8`）である。
  同じ文書の 17-18 行は `domain-design` について「produces the aggregate mapping」と
  正しく書いており、同一文書内で読み方が割れる。

  **`ddd/CHANGELOG.md` は U9 所有**（`u9-release-quality` の `source-manifest.json` に含まれ、
  本 Unit の 4 パスには含まれない）。**引き取り先は U9** とし、本 Unit は contribution 側の
  実態が正しいことを実測で確認して申し送る。4 本の contribution 自体に欠陥は無い。

**この 6 点はいずれも隠さず計画に明記している。** 1〜5 は従来どおり実装を書き換えず記録し、
6 は Step 11 で記録して引き取り先を明示する。他に未解決の所見は無い。

---

## Plan Approval

承認対象は次の 3 つである。

1. `construction/u7-core-contributions/code-generation/code-generation-plan.md`（埋め込みの Testing Contract を含む）
2. `construction/u7-core-contributions/code-generation/unit-test-instructions.md`
3. 上記 2 つに埋め込まれた Testing Contract（`contract_sha256: sha256:8d7f1a7f51e8e641623b1e21dc4fed305238daeae0eb70f0d7e8c9b1a833a386`）

[Approval Fingerprint]: sha256:v3:4386f294f79663896aa233546fc8e51f21ee92c7484cc051797f8665de2b82c3
[Planned Source]: 979589b1cab0ff073210c56dcb0bef7f238570af91608fb4adf5c57f72e5dbbe

- Approve Plan — proceed to code generation
- Request Changes — revise the plan

[Answer]: Approve Plan
