# Unit Test Instructions — U8 ナレッジ（u8-knowledge-pack）

## この文書の範囲

本 Unit（`u8-knowledge-pack`）の検証方法だけを定める。他の Unit のテストは含めない。
Build and Test は全 Unit のコマンドを順に実行するため、ここに書くコマンドは必ず本 Unit に限定する。

ただし本 Unit は **kind `spec`** であり、**自前のテストファイルを持たない**。成果物は
8 本の Markdown 文書で、実行時の型もテストランナーも持たない。したがって本 Unit の「テスト」は
**既存の検証経路を本 Unit の成果物に対して走らせること**を指す。新規テストは作成しない
（作成主体は U9。`functional-spec.md` §4 WF4、`rules.md` BR8.1／BR8.2、
`entities.md` の `PlacementCheck` が「U9 の統合テストが実行する」と明記している）。

## テストフレームワークの設定

- **ランナー**: `bun:test`（bun 組み込み）。追加の devDependency を導入しない。
- **作業ディレクトリ**: `ddd/`
- **設定ファイル**: 専用の設定ファイルは置かない。`ddd/package.json` の `test` が
  `bun test tests/` としてテストディレクトリを走査する。
- **アサーション**: `bun:test` の `describe` / `test` / `expect`。
- **型**: TypeScript。`ddd/tsconfig.json` の設定に従う。
- **対象言語**: 本 Unit の成果物は Markdown（本文は英語）である。コンパイルも型検査も受けない。

事前準備は `ddd/` での依存導入のみで足りる。Rust ツールチェーン（cargo）も
`aidlc-workflows` のビルドも、本 Unit の検証には不要である。

```sh
cd ddd && bun install
```

## 本 Unit のテストの実行方法

本 Unit に限定した実行コマンドは次の 3 つ。最初のテストサイクルより前に、これらが
解決できて走ることを確認する（Testing Contract の `runner_ready_before_first_test`）。

```sh
cd ddd && bun test tests/u3-plugin-scaffold.test.ts
cd ddd && bun run validate
cd ddd && bun run check:biome
```

`tests/u3-plugin-scaffold.test.ts` は、本 Unit の成果物であるナレッジ面を検査する
**唯一の既存テスト**である。検査するのは面の存在と粒度に限られる
（`knowledge/` が `contributes` に宣言され、ファイルを 1 件以上含み、各ファイル名が
`ddd-` 接頭辞を持つこと）。BR8.1／BR8.2 が求める 8 本の個別の検証は行わない。

投影の確認は次の 2 つ。Unit のループでは使わず、記録の最終確認に用いる。

```sh
cd ddd && bun run build:claude
cd ddd && bun run build:codex
```

本 Unit に固有のテストファイルは存在しない。`ddd/tests/` にあるのは u1・u2・u3・u4（2 本）・
u5（2 本）・framework-compatibility・install・codex-dispatch-bridge の各テストであり、
u8 は無い。**この不在は意図どおりである**（U8 はテストの所有者ではない）。

## 期待するカバレッジ

- **戦略**: Standard — コンポーネントあたり 5〜8 件。本 Unit のコンポーネントは
  **KnowledgePack（8 本）** の 1 つである。
- **スコープ床（plugin-dev）**: 追加の新規テスト床は無し。既存スイートが緑であることのみ。
- **本 Unit でテストを新設しない理由**: BR8.1／BR8.2 は検証の実行主体を U9 の統合テストと
  定め、`entities.md` の `PlacementCheck` も「U9 の統合テストが実行する」と明記する。
  U8 が自前のテストを書くと、検証の所有者が二重になる。
- **本 Unit が代わりに提供するもの**: 8 本の実在・命名・衝突なし・節構成・行数・トピック網羅・
  Enforcement 参照の実在を、**読み取りによる照合**で確認し `code-summary.md` に表として記録する。
- 数値目標を下げて通すことは禁止する。届かない場合は乖離を報告する。

## モック・スタブの方針

- **ネットワーク・外部プロセスを呼ばない。** 本 Unit の検証はファイルを読み、
  既存コマンドを起動するだけである。
- **Markdown を解析するモックを書かない。** 本 Unit の検証は目視の照合と
  既存コマンドの実行であり、一時的なパーサを書き起こすと検証の再現性が
  その場限りのスクリプトに依存してしまう。
- **`dist/` を根拠にしない。** 投影の確認は行うが、判定の根拠は常に `ddd/knowledge/` の
  実ファイルに置く。`dist/` は `.gitignore` の管理外で、内容はビルドに依存する。
- 時刻・乱数に依存する分岐を持たない。同一の作業ツリーに対して同一の結果が得られる。

## テストデータの管理

- **本 Unit はテストデータを作らない。** fixture の所有者は U4（設計）と U5（Rust）である。
- **本 Unit が参照する fixture 名は U4・U5 の表にある。** ナレッジの `Examples (index)` 節が
  指す `clean-complete` / `clean-execute` / `clean-skip` / `clean-mapping` / `clean` /
  `clean-domain` / `clean-model-skipped` / `clean-repository` は
  `ddd/tests/golden/design/cases.ts` と `ddd/tests/golden/rust/cases.ts` に実在することを
  確認済みである（`code-summary.md` に記録）。ロケータは
  **`tests/golden/<suite>/cases.ts#<case-name>`** の形で書く（ケースはディレクトリではなく
  TypeScript の表にあるため。U4 の逸脱 1 と同じ構造）。
- **fixture のソースは書き換えない。** `ddd/tests/golden/` は U4・U5 が所有する。
  規則が対象とする構文を含む clean ケースが無い場合も、**ケースを新設せず**残差を記録する。

## 失敗時の扱い

- 検証で仕様との乖離が見つかった場合、**期待値を実装に合わせて緩めることはしない。**
  どちらが誤っているかを `functional-spec.md` / `rules.md` / `entities.md` に照らして判断し、
  `code-summary.md` の逸脱欄に記録する。
- 乖離が**要件の未達**にあたる場合（FR10 群の本文を満たさない場合）は、
  逸脱欄への記録で終わらせず、**本パスの中で対象ファイルを修正して要件を満たす**
  （計画の Step 10・11）。`traceability.json` は是正後に `OK` とする。
- **要件の未達を後続 Unit に引き継がない。** 引き継ぎ先が動く保証のないまま `GAP` を残すのは、
  要件を満たさないまま完了させることに等しい。ナレッジ文書の中身は U8 の責務であり
  （`unit-of-work.md` U8 の節）、U9 の境界は「各コンポーネントの実体は U1〜U8」である。
- **BR レベルの逸脱も本パスの中で修正する。** 規則 ID の文法と文型（BR4.1）、Principles 節の
  型（entities.md）、Enforcement の深刻度と anchor（BR4.2）、example-index の実在パス
  （BR6.1・BR6.2・BR4.5）、出典の向き先（BR7.1・BR5.2）は、いずれも**本 Unit 自身の責務**で
  あり（`unit-of-work.md` U8 の節）、記録に留めず Step 12〜15 で 8 本を書き換える。
- **BR4.3 により規則を弱めた場合は隠さない。** ALWAYS / NEVER を冠する規則に実在する強制手段が
  無い場合、その規則を **PREFER + `guidance-only` に言い換える**。弱めた規則は
  **すべて `code-summary.md` の逸脱欄に列挙する**（弱めた事実を記録せずに通さない）。
- **example-index の残差も記録する。** センサーの clean ケースに規則が対象とする構文が
  含まれていない場合（(k)・(l) のコマンド／クエリのクレート対、`RPC-2`・`RPC-3` の
  Event Sourcing 固有部分）、索引は「違反を報告しなかったケース」を指すにとどまる。
  `tests/golden/` の所有者は U4・U5 であるため**ケースを新設せず**、残差を
  `code-summary.md` に記録して U9 に申し送る。
- **修正後は Step 9 の 4 コマンドを再実行する。** 是正の前後で結果の差を記録し、
  差が無い（他の 6 本と既存テストに影響しない）ことを確認する。

### 既知の前提条件（本 Unit の検証には影響しない）

`tests/codex-dispatch-bridge.test.ts` は `aidlc-workflows/dist/codex/aidlc` の fixture を必要とし、
その dist が未生成の環境では 12 件が落ちる。`ddd/tests/README.md` が既知の前提条件として
記載しているとおりで、`aidlc-workflows/` は読み取り専用のサブモジュールである。
本 Unit の検証はこの fixture を使わないため影響を受けないが、
`bun run check` は `test` 段を含むため終了コード 0 にならない。
