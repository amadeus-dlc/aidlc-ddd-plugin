# Code Generation — 確認事項（U2 Rust 解析基盤 / u2-rust-analysis-foundation）

## Sources

- `construction/u2-rust-analysis-foundation/functional-design/functional-spec.md`（WF1〜WF5、SM1〜SM2、公開 API 面）
- `construction/u2-rust-analysis-foundation/functional-design/rules.md`（BR1.1〜BR7.2）
- `construction/u2-rust-analysis-foundation/functional-design/entities.md`（workspace 側と解析器側の型）
- `construction/u2-rust-analysis-foundation/functional-design/functional-design-questions.md`（Q1〜Q4 — 回答済み）
- `inception/units-generation/unit-of-work.md`（U2 = RustSyntaxAnalyzer + WorkspaceLayerResolver、kind: library、複雑度 M）
- `inception/requirements-analysis/requirements.md`（FR7.4〜FR7.9、FR7.12、FR8.4、FR8.6、FR9.1〜FR9.6、NFR1、NFR2、NFR3）

## 前提

本 Unit の実装はすでに作業ツリー上に存在し、`ddd/CHANGELOG.md` の v0.1.0 に含まれている。
したがって本ステージは**既存実装を code-generation の成果として記録する**ものである。
Step 1〜6 は既存実装の検証であり、新規のコード生成は行わない。
既存ファイルへの改変は Step 6b（実施済み）と Step 6c（未実施）の 2 件に限られる。

## レビュー所見への対応

### 1. テスト量の不足（初版の所見・解消済み）

初版の計画は Standard 戦略の「コンポーネントあたり 5〜8 件」に対し、
WorkspaceLayerResolver 6 件 / RustSyntaxAnalyzer 3 件の計 9 件を記録していた。
**RustSyntaxAnalyzer が床を下回っていた**という所見を受け、Step 6b を追加した。

- RustSyntaxAnalyzer に 3 件を追加し、**6 件 / 6 件の計 12 件**とする。
- 追加する 3 件は BR6.4（`uses` の字面・先頭セグメント・別名）、
  BR6.6（組み込み属性を不透明にしない、macro-item と macro-expression の区別）、
  BR6.7・BR6.8（`body_shape` と `constructions` の種別）の経路で、
  いずれも現行のテストが踏んでいない。
- **Step 6b は作業ツリー上ですでに実施済みである**。テストは 12 件（6 件 / 6 件）存在する。

### 2. R-01 — 完了条件と実態の食い違い（本改訂で解消）

Step 6b の 3 件を通すために `lib/rust/analyzer.ts` を 2 か所修正していた（+15/−3）。
`struct_expression` の `..base` を `body` フィールド経由で見る点と、
item 位置のマクロ呼び出しが `expression_statement` に包まれる場合を拾う点である。
一方、計画の完了条件は「改変は Step 6b のテスト追加のみ」と書かれたままだった。
**本改訂で、計画の位置づけ・Step 6b・完了条件をこの実態に合わせた。**

### 3. R-02 — `isAllowed` の型エラー（本改訂で Step 6c として計画に取り込み）

`lib/workspace/resolver.ts` の `isAllowed` にある `if (opposite && fromSide !== "rmu")` は、
`opposite` が真の時点で `fromSide` が `"command" | "query"` に絞られるため到達不能で、
`tsc --noEmit` が TS2367 を出す。従来は accepted risk として build-and-test に送る想定だった。
**本改訂では Step 6c として本 Unit 内で直す**。`rmu` は `opposite` を成立させないため
振る舞いは変わらない。

### 4. R-03 — `assigns-field` の例示誤り（本改訂で解消）

`unit-test-instructions.md` の表が `assigns-field` の例に `self.set_id(…)` を挙げていたが、
実際の分類は `other` である。実テストに合わせて `self.id.push_str(…)` に直し、
併せて `opaque`（`format!(…)`）と `associated-call` を表に補った。

**未解決の所見は無い。**

---

## Plan Approval

承認対象は次の 3 つである。

1. `construction/u2-rust-analysis-foundation/code-generation/code-generation-plan.md`（埋め込みの Testing Contract を含む）
2. `construction/u2-rust-analysis-foundation/code-generation/unit-test-instructions.md`
3. 上記 2 つに埋め込まれた Testing Contract（`contract_sha256: sha256:8d7f1a7f51e8e641623b1e21dc4fed305238daeae0eb70f0d7e8c9b1a833a386`）

[Approval Fingerprint]: sha256:v3:0d1bd7eea87401afade49b1fae0ed5fa522c54d59c4dacaad9275a378da844a3
[Planned Source]: bff016081a0ba48392385bd0bbed3ef56714f801fc19ab11422eea0f42163840

- Approve Plan — proceed to code generation
- Request Changes — revise the plan

[Answer]: Approve Plan
