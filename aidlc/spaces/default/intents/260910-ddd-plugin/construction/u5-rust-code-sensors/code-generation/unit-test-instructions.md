# Unit Test Instructions — U5 Rust コードセンサー（u5-rust-code-sensors）

## この文書の範囲

本 Unit（`u5-rust-code-sensors`）のテストの実行方法だけを定める。他の Unit のテストは含めない。
Build and Test は全 Unit のコマンドを順に実行するため、ここに書くコマンドは必ず本 Unit に限定する。

## テストフレームワークの設定

- **ランナー**: `bun:test`（bun 組み込み）。追加の devDependency を導入しない。
- **作業ディレクトリ**: `ddd/`
- **設定ファイル**: 専用の設定ファイルは置かない。`ddd/package.json` の `test` が
  `bun test tests/` としてテストディレクトリを走査する。
- **アサーション**: `bun:test` の `describe` / `test` / `expect`。
- **型**: TypeScript。`ddd/tsconfig.json` の設定に従う。
- **構文解析ランタイム**: U2 が同梱する `tools/ddd/lib/rust/vendor/` の `web-tree-sitter` と
  `tree-sitter-rust` WASM を使う。ネットワーク取得は行わない。

事前準備は `ddd/` での依存導入のみで足りる。Rust ツールチェーン（cargo）も
`aidlc-workflows` のビルドも、本 Unit のテストには不要である。

```sh
cd ddd && bun install
```

## 本 Unit のテストの実行方法

本 Unit に限定した実行コマンドは次の 2 つ。最初のテストサイクルより前に、これらが
解決できて走ることを確認する（Testing Contract の `runner_ready_before_first_test`）。

```sh
cd ddd && bun test tests/u5-rust-code-sensors.test.ts
cd ddd && bun test tests/u5-golden.test.ts
```

テスト名で絞る場合：

```sh
cd ddd && bun test tests/u5-golden.test.ts --test-name-pattern "violation-k"
cd ddd && bun test tests/u5-rust-code-sensors.test.ts --test-name-pattern "ddd-rust-domain"
```

本 Unit のテストファイルは `ddd/tests/u5-rust-code-sensors.test.ts`（10 件）と
`ddd/tests/u5-golden.test.ts`（ゴールデンケース **18 件**＋規約テスト 2 件。Step 12 の追加後。
是正前の実測は 15 件で、前周回が書いていた「16 件」は誤りだった）の 2 本である。
`ddd/tests/golden/rust/cases.ts` は本 Unit が所有し、ランナー `ddd/tests/golden/runner.ts` は
U4 が所有するものを共用する。

プロジェクト全体の検証は次の 3 つ。Unit のループでは使わず、記録の最終確認に用いる。

```sh
cd ddd && bun run validate
cd ddd && bun run build:claude
cd ddd && bun run build:codex
```

## 期待するカバレッジ

- **戦略**: Standard — コンポーネントあたり 5〜8 件。本 Unit のコンポーネントは
  RustCodeSensorSuite（3 センサー）と GoldenCaseSuite（Rust センサー分）。
- **スコープ床（plugin-dev）**: 追加の新規テスト床は無い。既存スイートが緑であることのみ。
- **実測の目安**: 3 センサーそれぞれに正常系と違反系が少なくとも 1 件ずつあり、
  ゴールデンケースが各マニフェストの宣言する rule_id を 1 件以上の違反ケースで覆い、
  決定性（3 回実行して一致）と起動契約（1 行 JSON verdict）、正規モデル SKIP 時の note が
  踏まれていること。
- 数値目標を下げて通すことは禁止する。届かない場合は乖離を報告する。

### 既知の前提条件（本 Unit のテストには影響しない）

`tests/codex-dispatch-bridge.test.ts` は `aidlc-workflows/dist/codex/aidlc` の fixture を必要とし、
その dist が未生成の環境では 12 件が落ちる。`ddd/tests/README.md` が既知の前提条件として
記載しているとおりで、`aidlc-workflows/` は読み取り専用のサブモジュールである。
本 Unit のテストはこの fixture を使わないため影響を受けないが、
`bun run check` は `test` 段を含むため終了コード 0 にならない。

## モック・スタブの方針

- **ネットワーク・外部プロセスを呼ばない。** cargo も実行しない（BR1.4）。
  対象は一時ディレクトリに実体化した疑似記録ディレクトリと最小の Cargo workspace で、
  ネットワークにも `aidlc-workflows` にも触れない。
- **センサースクリプトは子プロセスとして起動する。** `import` してはならない。
  スクリプトは最後に `process.exit` を呼ぶため、直接 import するとテストランナーごと
  終了してしまう。`Bun.spawnSync(["bun", <script>, "--stage", <slug>, "--output-path", <path>])`
  で起動する。これは実運用のディスパッチャ契約と同じ経路でもある。
- **正規モデルはモックしない。** U1 の `loadDomainModel` と `ElementIndex` を実物のまま通す。
  (b) の Command 照合と正規モデル SKIP 時の note は、この経路そのものが検証対象だからである。
- **tree-sitter をモックしない。** U2 の `parse` を実物のまま通し、fixture の Rust ソースを
  実際に解析する。
- **ビルド成果物を読まない。** `dist/` は `.gitignore` の管理外であり、内容はビルドに依存する。
  テストは `dist/` を参照しない。
- 時刻・乱数に依存する分岐を持たない。同一の作業ツリーに対して同一の結果が得られる。

## テストデータの管理

- **フィクスチャは `tests/` 配下に置く。** `tools/` には置かない。
  Rust ケースの実体は `ddd/tests/golden/rust/cases.ts` の表にあり、ケースごとに
  Cargo.toml と最小クレート群（`packages/<layer>/<crate>/src/lib.rs`）が一時ディレクトリへ
  実体化される。fixture のソースは書き換えない。
- **record/ と workspace/ は同じ一時ディレクトリ配下に置く。** `source-manifest.json` の
  申告は workspace/ 内の相対パスで、ランナーが `workspace_root` を揃える（BR10.1）。
- **一時ディレクトリは必ず後始末する。** ランナーは `finally` で `rmSync` し、
  テストは `afterEach` で作った分をすべて削除する。
- **所見のパスは workspace 相対で比較する。** ゴールデンケースは `(rule_id, file)` の集合を
  完全一致で比較する。
- **正規モデルが SKIP のケース**（`clean-model-skipped`）は Stage Progress に
  `[S] ddd-domain-modeling — SKIP` を置き、note に `domain-modeling is SKIP` が含まれることを確認する。

## 失敗時の扱い

- テストが落ちた場合、期待値を実装に合わせて緩めることはしない。
  どちらが誤っているかを判断し、`code-summary.md` の逸脱欄に記録する。
- マニフェストの宣言とスクリプトが `evaluateSensor` に渡す rule_id 一覧が食い違う場合、
  どちらが正しいかは `functional-spec.md` §1 と `rules.md` の BR1 に照らして判断する。
  判断がつかない場合はテストを緩めず、乖離として記録して承認ゲートに上げる。
- ゴールデンケースが落ちた場合、**期待所見を消して通すことをしない。**
  どちらの規則が正しいかを `rules.md` に照らして判断し、記録する。
