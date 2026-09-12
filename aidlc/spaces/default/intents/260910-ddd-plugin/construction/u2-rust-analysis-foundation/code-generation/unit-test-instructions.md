# Unit Test Instructions — U2 Rust 解析基盤（u2-rust-analysis-foundation）

## この文書の範囲

本 Unit（`u2-rust-analysis-foundation`）のテストの実行方法だけを定める。他の Unit のテストは含めない。
Build and Test は全 Unit のコマンドを順に実行するため、ここに書くコマンドは必ず本 Unit に限定する。

## テストフレームワークの設定

- **ランナー**: `bun:test`（bun 組み込み）。追加の devDependency を導入しない（NFR1）。
- **作業ディレクトリ**: `ddd/`
- **設定ファイル**: 専用の設定ファイルは置かない。`ddd/package.json` の `test` が
  `bun test tests/` としてテストディレクトリを走査する。
- **アサーション**: `bun:test` の `describe` / `test` / `expect` / `afterEach`。
- **型**: TypeScript。`ddd/tsconfig.json` の設定に従う。

事前準備は `ddd/` での依存導入のみで足りる。Rust ツールチェーン（cargo）は不要である。

```sh
cd ddd && bun install
```

## 本 Unit のテストの実行方法

本 Unit に限定した実行コマンドは次のとおり。最初のテストサイクルより前に、このコマンドが
解決できて走ることを確認する（Testing Contract の `runner_ready_before_first_test`）。

```sh
cd ddd && bun test tests/u2-rust-analysis-foundation.test.ts
```

テスト名で絞る場合：

```sh
cd ddd && bun test tests/u2-rust-analysis-foundation.test.ts --test-name-pattern "assignLayers"
```

本 Unit のテストファイルは `ddd/tests/u2-rust-analysis-foundation.test.ts` の 1 本のみである。
フィクスチャはファイルとして持たず、各テストが一時ディレクトリに Cargo workspace を組み立てる。

プロジェクト全体の検証（Biome + プラグイン検証 + 全テスト）は次のとおり。Unit のループでは
使わず、記録の最終確認にのみ用いる。

```sh
cd ddd && bun run check
```

## 期待するカバレッジ

- **戦略**: Standard — コンポーネントあたり 5〜8 件。
  本 Unit は WorkspaceLayerResolver 6 件 / RustSyntaxAnalyzer 6 件の計 12 件。
  6 件 / 6 件とし、両コンポーネントが床を満たす（下記「レビュー所見への対応」を参照）。
- **スコープ床（plugin-dev）**: 追加の新規テスト床は無い。既存スイートが緑であることのみ。
- **実測の目安**: `ddd/tools/ddd/lib/{workspace,rust}/` の分岐のうち、
  読めない Cargo.toml・メンバー 0 件・同居ターゲット・層の食い違い・クエリ側のドメイン層・
  所属クレートなし・資産欠落（`unavailable`）・解析エラーと不透明領域の各経路が
  少なくとも 1 件のテストで踏まれていること。
- 数値目標を下げて通すことは禁止する。届かない場合は乖離を報告する。

### レビュー所見への対応（テスト量の不足）

初版の記録では `RustSyntaxAnalyzer` が 3 件で、Standard 戦略の床（5〜8 件）に届いていなかった。
レビューでこの所見が上がったため、計画に Step 6b を追加し、次の 3 件を
`tests/u2-rust-analysis-foundation.test.ts` に加えて **6 件**とする。いずれも現行のテストが
踏んでいない経路である。

| 追加するテスト | 対応する BR | 確認する内容 |
|---|---|---|
| `uses` の字面と先頭セグメント | BR6.4 | 別名付き `use … as …` で `path_text` が字面のまま、`first_segment` が先頭セグメント、`alias` が別名。波括弧付き `use x::{A, B};` でも先頭セグメントが取れる |
| 組み込み属性とマクロの位置 | BR6.6 | `#[derive(…)]` を不透明領域にせず、非組み込み属性だけを `attribute-macro` にする。item 位置のマクロを `macro-item`、式位置を `macro-expression` に分ける |
| `body_shape` と構築箇所 | BR6.7、BR6.8 | 本体が `&self.total` / `self.id.clone()` で `returns-field-only`、`self.id = …` / `self.id.push_str(…)` で `assigns-field`、`self.id.len()` で `other`、`format!(…)` で `opaque`。`constructions` が `struct-literal` / `update-syntax` / `default-call` / `associated-call` を区別する |

本 Unit のテストファイルは 1 本のままである。追加後は 12 件（WorkspaceLayerResolver 6 件、
RustSyntaxAnalyzer 6 件）となり、両コンポーネントが床を満たす。

### レビュー所見への対応（型エラー R-02）

計画の Step 6c は `isAllowed` から到達不能な比較（`&& fromSide !== "rmu"`）を除去する。
これは型検査のみの修正で、`rmu` は `opposite` を成立させないため振る舞いは変わらない。
したがって**新しいテストは追加しない**。既存の `permissions` の 1 件が、まさに Step 6c が
触れる分岐である `isAllowed(command, query).reason === "cross-side"` を踏んでおり、
併せて `permissionTable()` の許可／不許可と `rmu` の `cross_side_allowed` を確認している。
これが緑のままであることを回帰の確認とする。
なお `isAllowed` の `ok` と `layer-forbidden` の戻り値は、この 1 件では直接踏んでいない
（同じ判定表を `permissionTable()` 経由で確認している）。Step 6c は `cross-side` の
条件式のみを触るため、本 Unit ではここを追加のテスト対象としない。
型検査は `bunx tsc --noEmit -p .` の実測で確認する。

## モック・スタブの方針

- **ネットワーク・外部プロセスを呼ばない。** 本 Unit はネットワークにも cargo にも依存しない（NFR2）。
  構文解析は同梱の WASM を bun 上で動かす（`tools/ddd/lib/rust/vendor/tree-sitter.wasm` と
  `tools/ddd/wasm/tree-sitter-rust.wasm`）。
- **ファイルシステムは実物を使う。** 一時ディレクトリ（`mkdtempSync`）に本物の
  `Cargo.toml` と `src/lib.rs` / `src/main.rs` を書く。fs のモックは行わない —
  メンバー解決とパス依存の解決そのものが検証対象だからである。
- **構文解析器はモックしない。** `parse` は実際に Rust のソースを解析する。
  事実の抽出（`structs` / `impls` / `fns` / `uses` / `calls` / `constructions`）が
  字面と位置を返すことを、実物の解析結果で確認する。
- 時刻・乱数に依存する分岐を持たない。診断は `code → crate_name`、事実は Span 順に整列され、
  同一入力に対して同一の結果が得られる（BR6.3）。

## テストデータの管理

- **Cargo workspace**: `buildWorkspace(specs)` ヘルパーが一時ディレクトリに組み立てる。
  `CrateSpec`（path / name / lib / bin / deps）の配列でメンバーを宣言し、
  workspace ルートの `Cargo.toml` と各メンバーの `Cargo.toml` を生成する。ファイルは増やさない。
- **Rust ソース**: 解析対象のソースはテスト本体の中で文字列として組み立て、
  一時ディレクトリに書き出す。
- **一時ディレクトリ**: `makeTemp()` が作ったものをモジュール先頭の配列に積み、
  `afterEach` が `rmSync(..., { recursive: true, force: true })` で必ず消す。
  テスト間で状態を持ち越さない。

## 失敗時の扱い

- テストが落ちた場合、期待値を実装に合わせて緩めることはしない。
  どちらが誤っているかを判断し、`code-summary.md` の逸脱欄に記録する。
- 同梱資産（wasm）が見つからない場合、`initAnalyzer` は `state = unavailable` を返し、
  例外を投げない（BR6.2）。この経路は呼び出し元（U5）が終了コード 127 に写像する。
  テストが「動かない」と落ちたときは、まず資産の同梱漏れを疑う。
