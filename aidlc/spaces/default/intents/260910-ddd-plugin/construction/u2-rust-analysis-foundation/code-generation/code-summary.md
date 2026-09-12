# Code Summary — U2 Rust 解析基盤（u2-rust-analysis-foundation）

## この記録の位置づけ

本 Unit の実装は `ddd/` の作業ツリー上にすでに存在し、`ddd/CHANGELOG.md` の v0.1.0 に含まれている。
本ステージは**既存実装を code-generation の成果として記録する**ものである。

ただし本ステージは既存ファイルへの改変を 3 パス含む。

- **Step 6b** — 追加したテストが既存実装の**未達 2 件**を検出したため、`analyzer.ts` を
  最小修正した（逸脱 1・逸脱 2）。テストは 3 件追加し、RustSyntaxAnalyzer を 6 件にした。
- **Step 6c** — `resolver.ts` の `isAllowed` にあった到達不能な比較（TS2367）を除去した。

初版の計画はこの 2 点を承認範囲に含んでおらず、レビューで R-01（完了条件と実態の矛盾）と
R-02（未修正の型エラー）、R-03（`assigns-field` の例示誤り）が上がった。
**2026-09-12 の改訂で計画と指示書を実態に合わせ、Step 6c を計画に取り込んだうえで再承認した。**
現在、未解決のレビュー所見は無い。

## Sources

- `construction/u2-rust-analysis-foundation/functional-design/functional-spec.md`（WF1〜WF5、SM1〜SM2、公開 API）
- `construction/u2-rust-analysis-foundation/functional-design/rules.md`（BR1.1〜BR7.2）
- `construction/u2-rust-analysis-foundation/functional-design/entities.md`（workspace 側と解析器側の型）
- `inception/units-generation/unit-of-work.md`（U2 = RustSyntaxAnalyzer + WorkspaceLayerResolver、kind: library、複雑度 M）
- `inception/requirements-analysis/requirements.md`（FR7.4〜FR7.9、FR7.12、FR8.4、FR8.6、FR9.1〜FR9.6、NFR1〜NFR3）

## 作成物

いずれも `ddd/` リポジトリ相対。全 11 パスを `source-manifest.json` に列挙している。

### 実装（10 ファイル）

| ファイル | 責務 |
|---|---|
| `tools/ddd/lib/workspace/resolver.ts` | `scanWorkspace` / `assignLayers` / `classifyFile` / `isAllowed` / `permissionTable` / `conventions`（BR1〜BR5、FR7.4〜FR7.9、FR9） |
| `tools/ddd/lib/rust/analyzer.ts` | `initAnalyzer` / `parse` と `structs` / `impls` / `fns` / `uses` / `calls` / `constructions` / `opaqueRegions`（BR6、BR7、FR8.4、FR7.12） |
| `tools/ddd/lib/rust/vendor/tree-sitter.js` | 同梱の web-tree-sitter ランタイム本体（BR6.1、NFR2） |
| `tools/ddd/lib/rust/vendor/tree-sitter.wasm` | 同梱の web-tree-sitter コア（BR6.1、NFR2） |
| `tools/ddd/lib/rust/vendor/tree-sitter.d.ts` | vendor したランタイムの型宣言 |
| `tools/ddd/lib/rust/vendor/web-tree-sitter.types.d.ts` | vendor したランタイムの補助型宣言 |
| `tools/ddd/lib/rust/vendor/LICENSE` | 同梱物のライセンス表示 |
| `tools/ddd/lib/rust/vendor/NOTICE.md` | 同梱物の出典と版の表示 |
| `tools/ddd/wasm/tree-sitter-rust.wasm` | 同梱の tree-sitter-rust 文法（BR6.1、NFR2） |
| `tools/ddd/wasm/LICENSE` | 文法 WASM のライセンス表示 |

### テスト（1 ファイル）

| ファイル | 内容 |
|---|---|
| `tests/u2-rust-analysis-foundation.test.ts` | 本 Unit の唯一のテストファイル。12 テスト |

フィクスチャはファイルとして持たない。各テストが一時ディレクトリに Cargo workspace と
Rust ソースを組み立て、`afterEach` で必ず消す。

## 主要な実装判断

- **層判定の根拠を `layer_source` に残す。** `assignLayers` は層・CQRS 側・`layer_source`
  （`marker` / `placement` / `both`）・`cqrs_side`・`is_composition_root` を返し、
  判断に使った根拠そのものを呼び出し側に渡す。U5 はここから所見を作る。
- **配置と接尾辞を独立に評価し、食い違いを診断にする。** ディレクトリ配置とクレート名の
  接尾辞が一致すれば `both`、片方だけなら `layer_source` をその側にし、食い違えば
  `layer.conflict` を付けて `unknown` にする（BR2、BR3）。
- **構文的事実は字面と位置だけ（BR6.4、FR7.12）。** 型推論も名前解決もマクロ展開もしない。
  `Self` と impl 対象型の一致だけを字面比較で補助情報（`is_by_value_self_type`）として付ける。
- **同一内容は content hash で 1 回だけ解析する（BR6.3、NFR3）。** キャッシュの鍵は
  ファイルパスではなくバイト列のハッシュで、`SyntaxTree.file` だけがファイルごとに変わる。
- **解析エラーと不透明領域を例外にしない（BR6.5、BR6.6）。** `has_parse_error` と
  `OpaqueRegion` で返し、エラー範囲の外の事実は通常どおり返す。
- **同梱資産だけで動く（BR6.1、NFR2）。** 読み込み元は `tools/ddd/wasm/` と
  `tools/ddd/lib/rust/vendor/` に限り、`node_modules` を参照しない。資産欠落は
  `state = unavailable` として返し、終了コード 127 への写像は呼び出し元（U5）が行う。

## テストカバレッジ

- **実行コマンド**: `cd ddd && bun test tests/u2-rust-analysis-foundation.test.ts`
- **実測**: **12 pass / 0 fail / 83 expect() 呼び出し**（2026-09-11 実測）
- **内訳**: `scanWorkspace` 2 件、`assignLayers` 2 件、`classifyFile` 1 件、`permissions` 1 件、
  `RustSyntaxAnalyzer` 6 件
- **戦略**: Standard（コンポーネントあたり 5〜8 件）。WorkspaceLayerResolver 6 件 /
  RustSyntaxAnalyzer 6 件で、**両コンポーネントが床を満たす**。
- **スコープ床（plugin-dev）**: 追加の新規テスト床は無い。既存スイートが緑であることのみ。
- **テストランナー**: `bun:test`（bun 組み込み）。追加の devDependency は導入していない（NFR1）。

### Step 6b で追加した 3 件と、その結果

| 追加したテスト | 対応する BR | 結果 |
|---|---|---|
| `uses` の字面・先頭セグメント・別名 | BR6.4 | 実装は規則どおり。修正不要 |
| 組み込み属性の透過と macro-item / macro-expression の区別 | BR6.6 | **未達を検出 → 修正**（逸脱 2） |
| `body_shape` 4 値と `constructions` 4 種 | BR6.7、BR6.8 | **未達を検出 → 修正**（逸脱 1） |

BR6.7 の 4 値はすべて到達可能であることを確認した（`self.id.clone()` → `returns-field-only`、
`self.total` → `returns-field-only`、`self.id = …` → `assigns-field`、
`self.id.push_str(…)` → `assigns-field`、`format!` を含む本体 → `opaque`、
`self.id.len()` → `other`）。

## 型検査（`type-check` センサー相当）

レビュー（iteration 1）の指摘を受けて、`ddd/` で `bunx tsc --noEmit -p .` を実測した（2026-09-11）。

- **終了コード 1、エラー 29 件**。うち本 Unit の申告ファイルに関するものは **1 件**:

  ```
  tools/ddd/lib/workspace/resolver.ts(559,19): error TS2367: This comparison appears to be unintentional because the types '"command" | "query"' and '"rmu"' have no overlap.
  ```

  `isAllowed` の rmu 交差側判定が、型の絞り込みにより到達不能な分岐（dead code）になっている。
  振る舞い上は BR5.2（rmu 発の辺は cross-side にしない）をテストが緑で通しているが、
  型検査としては失敗であり、**本 Unit の欠陥として記録する**。
- 残り 28 件は本 Unit 所有外のファイル（他 Unit・ハーネス投影物）に属する。

### Step 6c による修正（2026-09-12、改訂版の計画で承認）

初版の計画は上記 1 件を accepted risk として Build and Test に送る想定だったが、
**改訂版の計画で Step 6c として本 Unit 内で修正することを承認した**。

- 修正内容: `isAllowed` の `if (opposite && fromSide !== "rmu")` から
  `&& fromSide !== "rmu"` を落とした。`opposite` が真の時点で `fromSide` は
  `"command" | "query"` に絞られており、`rmu` は `opposite` を成立させない。
  したがって振る舞いは変わらない。意図が読めるようコメントを 1 行添えた。
  `permissionTable` の `cross_side_allowed: from === "rmu"` は現状のまま。
- 再実測（2026-09-12）: `bunx tsc --noEmit -p .` の**エラーは 29 件 → 28 件**。
  `lib/workspace/` および `lib/rust/` に属するエラーは **0 件**。
  残る 28 件はすべて本 Unit 所有外のファイルに属する。
- 回帰: `bun test tests/u2-rust-analysis-foundation.test.ts` は修正の前後いずれも
  **12 pass / 0 fail**（83 expect）。`isAllowed` の `cross-side` 経路を踏む
  `permissions` の 1 件も緑のまま。
- `bun run check:biome`: 51 ファイル、エラー・警告なし。
- `bun run validate`: VALID（errors 0 / warnings 1 = 既存の `compose-hook-absent`）。

## 計画からの逸脱

### 逸脱 0: 計画の完了条件「既存実装を改変しない」と、実際に行った `analyzer.ts` の改変が矛盾していた — **解消済み（2026-09-12）**

初版の計画 `code-generation-plan.md` の完了条件は「Step 1〜6 は既存実装に対する改変を行っていない」と
書いていたが、実際には Step 6b で追加したテストが未達を検出したため `tools/ddd/lib/rust/analyzer.ts` を
改変していた（`git diff --stat`: `analyzer.ts` 18 行 = +15 / -3、`tests/u2-rust-analysis-foundation.test.ts`
+113 行）。改変の内容は逸脱 1（`update-syntax` の判定を `field_initializer_list` 直下に変更）と
逸脱 2（`isItemPosition` の追加）の 2 箇所で、いずれも承認ゲートで選択された最小修正である。

**2026-09-12 の改訂で計画本文を実態に合わせた。** 前試行の受領書がセッション跨ぎで無効化され、
計画を再提示する必要が生じたため、フィンガープリントによる凍結が解け、次を書き直せた。

- 「この計画の位置づけ」に、Step 6b（実施済み）と Step 6c（未実施）の 2 件が既存ファイルへの
  改変であることを明記した。
- Step 6b に「上記 3 件が踏んだ実装不具合の修正」を項目として追加し、`analyzer.ts` の 2 か所を記述した。
- 完了条件から「Step 6b のテスト追加のみ」という文言を削除し、改変 3 パスを列挙する形に改めた。

**計画と実態の矛盾は残っていない。**

### 逸脱 1: `constructions` の `update-syntax` に到達できなかった（BR6.8 未達）

`struct_expression` の `..base` は `field_initializer_list` の下に入るため、
`analyzer.ts` が `struct_expression` の直下の子として `base_field_initializer` を探していた
判定は常に偽になり、`Order { total: 1, ..base }` は `struct-literal` として返っていた。

- 修正: `childForFieldName("body")`（`field_initializer_list`）の直下を見るように変えた。
  入れ子の構造体式（`Outer { inner: Inner { ..base } }`）を外側の `update-syntax` と
  誤判定しないよう、子の直接の並びだけを見る形にしている。
- BR6.8 は `Type { field, ..expr } → update-syntax` を要求しており、U5 の所見 (c)・(n) が
  この事実を材料にする。未修正のままでは当該所見が成立しない。

### 逸脱 2: トップレベルでは `macro-item` に到達できなかった（BR6.6 未達）

tree-sitter はトップレベルの `mac!();` を `expression_statement` で包むため、
`macro_invocation` の親が `source_file` にならず、`macro-item` ではなく
`macro-expression` として報告されていた。実際に `macro-item` になっていたのは
`mod m { mac!(); }`（親が `declaration_list`）と、セミコロンなしの `mac! { … }` / `mac!(…)` だけで、
**`file!();` や `include!();` のような最も典型的な item 位置のマクロが漏れていた**。

- 修正: 親が `source_file` / `declaration_list` / `mod_item` のいずれかである場合に加え、
  親が `expression_statement` で**その親**が同じ 3 種である場合も item 位置とみなす
  `isItemPosition` を追加した。関数本体内の `println!` は親が `block` の
  `expression_statement` なので、従来どおり `macro-expression` のままである。
- 誤検出の危険は無い。トップレベルに現れる式文は item 位置のマクロ呼び出しだけである。

### 逸脱 3: 計画 Step 6b の記載と実装の細部が一致しない（`self.set_id(…)`）

計画 Step 6b は「`self.set_id(…)` で `assigns-field`」と記載したが、BR6.7 の文言は
`self.<field> = <expr>` または `self.<field>.<mutating call>` であり、
`self.<mutating call>` は含まない。実装も文言どおりで、`self.set_id(…)` は `other` になる。

- テストは規則の文言どおり `self.id.push_str(…)`（フィールドの mutating call）で
  `assigns-field` を確認する形にした。`self.set_id(…)` は検証対象にしていない。
- 計画の当該括弧書きは、実装を読む前の記述による不正確な要約だった。
- `self.set_id(…)` を `assigns-field` に含めるべきかは規則の解釈の問題であり、
  本 Unit では判断しない（U5 の所見 (a) の材料として挙がった時点で扱う）。

**2026-09-12 の改訂で解消した。** 計画 Step 6b と `unit-test-instructions.md` の表の両方で、
`assigns-field` の例を `self.set_id(…)` から実テストどおりの `self.id.push_str(…)` に直した。
併せて `self.id.len()` → `other`、`format!(…)` → `opaque`、`constructions` の
`associated-call` を表に補い、4 種の `body_shape` と 4 種の構築箇所が揃った。

### 逸脱 4: `bun run check` は緑ではない（既存スイートの失敗）

実測は **142 pass / 12 fail**（記録時 136 pass、その後 U3 の並行進行で件数が増えた。
2026-09-12 の Step 6c 後の再実測も同じ 142 pass / 12 fail）。
落ちている 12 件はすべて既存の
`tests/codex-dispatch-bridge.test.ts` にあり、原因は同一で
`ENOENT: no such file or directory, scandir '<workspace>/aidlc-workflows/dist/codex/aidlc'`。
`scripts/copy-reference-fixture.ts` が参照する dist フィクスチャが存在しないために落ちている。

- `aidlc-workflows/` は本家参照用の読み取り専用サブモジュールであり、
  `ddd/docs/framework-compatibility.md` と `ddd/docs/reference-read-only.md` が
  再生成・保護解除を禁じている。`ddd/tests/README.md` も「the two pre-existing
  harness-adapter suites need the `aidlc-workflows` dist fixture」「skip-fail when that
  dist is not built」として、この落ち方を既知の前提条件として記載している。
- したがってこれは **U2 の欠陥ではなく、環境の前提条件が満たされていないことによる既存スイートの失敗**
  である。本 Unit のテスト（12 件、うち追加 3 件を含む）と Biome（記録時 50 ファイル、
  レビュー後の再実測 2026-09-11 では 51 ファイル。差の 1 件は他 Unit の並行進行で追加された
  `tests/u3-plugin-scaffold.test.ts` であり、いずれも `--error-on-warnings` でエラーなし）と
  プラグイン検証（VALID、既存の警告 1 件 `hooks/compose.ts [compose-hook-absent]`）はいずれも通っている。
  全体スイートの件数も同じ理由で記録時 136 → 再実測 142 pass に増えており、fail は同じ 12 件である。
- U1 の記録（133 pass / 12 fail）と同じ 12 件であり、件数が 133 → 136 に増えているのは
  Step 6b で追加した 3 件の分である。

### 逸脱 5: traceability センサーは割り当て外 ID を advisory 所見として報告する

`traceability.json` は本 Unit に割り当てられた ID（FR7.4〜FR7.9、FR7.12、FR8.4、FR8.6、
FR9.1〜FR9.6、NFR1〜NFR3 と BR1.1〜BR7.2 の計 50 件）を列挙している。sensor の判定は次のとおり。

- `gaps` / `orphans` / `missing_from_table` / `invalid_entries` / `invalid_targets` はいずれも **0 件**。
  `OK` 目標はすべて実在するワークスペース相対パスである。
- `missing_from_upstream_ids` は 78 件出る。内容は requirements.md の製品全体の FR／NFR と、
  rules.md の本文中に**出典として引用されている他 Unit の BR** である。後者の実例が `BR7.4` で、
  U2 の rules.md には 221 行目の `source: FR8.5、U1 BR7.4` という散文としてのみ現れる
  （U1 の規則であり、U2 に割り当てられた規則ではない）。U1 の記録でも同じ挙動を確認しており
  （81 件）、既存の `functional-design/traceability.json` でも起きている（75 件）。
  当該 sensor は `default_severity: advisory` であり、ステージ進行を止めない。
- ステージ定義は「**割り当てられた** AC / NFRx.y / BRx.y を列挙する」と指示しており、
  本記録はそれに従った。他 Unit への割り当てを U2 の記録に書き写すことはしていない。

## 完了条件の確認

- 本 Unit が作成・変更した全アプリケーションソース 11 パスを `source-manifest.json` に列挙した。
  うち本ステージで変更したのは 3 パスである — Step 6b の
  `tools/ddd/lib/rust/analyzer.ts` と `tests/u2-rust-analysis-foundation.test.ts`、
  Step 6c の `tools/ddd/lib/workspace/resolver.ts`。いずれも既に列挙済みで、追加は不要だった。
- `traceability.json` のすべての `OK` 目標が実在するワークスペース相対パスである
  （`invalid_targets` 0 件）。
- 計画の完了条件「Step 1〜6 は既存実装に対する改変を行っていない」を**満たしている**。
  既存実装への改変は Step 6b（`analyzer.ts` の 2 箇所 = 逸脱 1・逸脱 2）と
  Step 6c（`resolver.ts` の 1 箇所）に限られ、いずれも改訂版の計画が明示的に承認した範囲である。
- 計画の完了条件「本 Unit の改変は Step 6b と Step 6c に限られる」を**満たしている**。
- 計画の完了条件「`bunx tsc --noEmit -p .` に本 Unit 由来の型エラーが残っていない」を
  **満たしている**。Step 6c の後、`lib/workspace/` と `lib/rust/` に属するエラーは 0 件
  （全体は 29 件 → 28 件。残りは本 Unit 所有外）。
