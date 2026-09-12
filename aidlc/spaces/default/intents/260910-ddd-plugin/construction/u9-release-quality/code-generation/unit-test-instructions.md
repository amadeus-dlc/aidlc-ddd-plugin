# Unit Test Instructions — U9 公開品質（u9-release-quality）

## この文書の範囲

本 Unit（`u9-release-quality`）のテストの実行方法だけを定める。他の Unit のテストは含めない。
Build and Test は全 Unit のコマンドを順に実行するため、ここに書くコマンドは必ず本 Unit に限定する。

## テストフレームワークの設定

- **ランナー**: `bun:test`（bun 組み込み）。追加の devDependency を導入しない。
- **作業ディレクトリ**: `ddd/`
- **設定ファイル**: 専用の設定ファイルは置かない。`ddd/package.json` の `test` が
  `bun test tests/` としてテストディレクトリを走査する。
- **アサーション**: `bun:test` の `describe` / `test` / `expect`。
- **compose ツール**: `../.codex/tools/aidlc-plugin-test.ts`（ワークスペース根の `.codex/tools/`）を
  子プロセスで起動し、使い捨てのコピーに対して compose する。Codex アダプタ互換テストは `.codex/` の
  投影済みアダプタを使う。ネットワークは使わない。

事前準備は `ddd/` での依存導入のみで足りる。

```sh
cd ddd && bun install
```

## 本 Unit のテストの実行方法

本 Unit の統合テストは `ddd/tests/framework-compatibility.test.ts` の 1 本である。最初のテストサイクルより
前に、これが解決できて走ることを確認する（Testing Contract の `runner_ready_before_first_test`）。

```sh
cd ddd && bun test tests/framework-compatibility.test.ts
```

テスト名で絞る場合：

```sh
cd ddd && bun test tests/framework-compatibility.test.ts --test-name-pattern "composes"
cd ddd && bun test tests/framework-compatibility.test.ts --test-name-pattern "Codex adapter"
```

内訳は Codex アダプタ互換 **6 件**（`:88` の `for (const decision of ["deny", "ask"])` が 2 件を生む）、
compose の 3 条件（claude / codex）2 件、Codex ランナー生成 1 件の**計 9 件**。
前周回の本文は「5 件・計 8 件」と書いていたが誤りだった。

プロジェクト全体の検証は次の 4 つ（FR11.3 の 4 コマンド）。Unit のループでは使わず、記録の最終確認に用いる。
`check` は既知の前提条件（下記）で終了コード 0 にならない見込みであり、その事実を記録する。

```sh
cd ddd && bun run validate
cd ddd && bun run build:claude
cd ddd && bun run build:codex
cd ddd && bun run check
```

## 期待するカバレッジ

- **戦略**: Standard — コンポーネントあたり 5〜8 件。本 Unit のコンポーネントは IntegrationTest の 1 つで、
  **9 件**が床（下限 5 件）を満たす。上限 8 件を 1 件超えるが、床は下限の要求であり
  超過は不足ではない。
- **スコープ床（plugin-dev）**: 追加の新規テスト床は無い。既存スイートが緑であることのみ。
- **実測の目安**: compose の 3 条件（`errors: []`、`graph.compiled: true`、`idempotent: true`）が
  claude / codex の両方で踏まれ、Codex アダプタの 5 経路が踏まれていること。
- 数値目標を下げて通すことは禁止する。届かない場合は乖離を報告する。

### 既知の前提条件（本 Unit のテストには影響しない）

`tests/codex-dispatch-bridge.test.ts` は `aidlc-workflows/dist/codex/aidlc` の fixture を必要とし、
その dist が未生成の環境では 12 件が落ちる。`ddd/tests/README.md` が既知の前提条件として
記載しているとおりで、`aidlc-workflows/` は読み取り専用のサブモジュールである。
本 Unit の統合テストはこの fixture を使わないため影響を受けないが、`bun run check` は `test` 段を
含むため終了コード 0 にならず、FR11.3 は本 Unit で Gap として記録する。

## モック・スタブの方針

- **ネットワークを呼ばない。** compose は使い捨てのローカルコピーに対して行う。
- **compose ツール・アダプタをモックしない。** フレームワーク実物を子プロセスとして起動する。
  プラグインが実際のグラフコンパイラと Codex アダプタに受理されることが検証対象だからである。
- **文書を書き換えて通さない。** README / CHANGELOG / LICENSE と要件の差は逸脱として記録する。
- 時刻・乱数に依存する分岐を持たない。同一の作業ツリーに対して同一の結果が得られる。

## テストデータの管理

- compose テストは使い捨てのコピーを作り、テスト側が後始末する。`ddd/` 配下に生成物を残さない。
- `dist/` は `.gitignore` の管理外であり、テストは `dist/` を参照しない（`bun run test:dist` は
  `build:all` 後の別の関心事で、本 Unit のループでは実行しない）。
- 本 Unit に fixture は無い。

## 失敗時の扱い

- compose テストが落ちた場合（drops がある、グラフに載らない、2 回目が不安定）、原因が本 Unit 所有外の
  ステージ・contribution・センサー（U1〜U8）にあるかを判定し、`code-summary.md` の逸脱欄に記録する。
  期待値を緩めない。
- `bun run check` が非 0 の場合、原因を段ごとに切り分けて記録し、FR11.3 を Gap として残す。
