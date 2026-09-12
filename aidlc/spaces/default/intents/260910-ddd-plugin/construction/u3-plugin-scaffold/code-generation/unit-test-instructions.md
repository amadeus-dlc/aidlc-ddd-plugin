# Unit Test Instructions — U3 プラグイン足場（u3-plugin-scaffold）

## この文書の範囲

本 Unit（`u3-plugin-scaffold`）のテストの実行方法だけを定める。他の Unit のテストは含めない。
Build and Test は全 Unit のコマンドを順に実行するため、ここに書くコマンドは必ず本 Unit に限定する。

## テストフレームワークの設定

- **ランナー**: `bun:test`（bun 組み込み）。追加の devDependency を導入しない。
- **作業ディレクトリ**: `ddd/`
- **設定ファイル**: 専用の設定ファイルは置かない。`ddd/package.json` の `test` が
  `bun test tests/` としてテストディレクトリを走査する。
- **アサーション**: `bun:test` の `describe` / `test` / `expect`。
- **型**: TypeScript。`ddd/tsconfig.json` の設定に従う。

事前準備は `ddd/` での依存導入のみで足りる。Rust ツールチェーン（cargo）も
`aidlc-workflows` のビルドも、本 Unit のテストには不要である。

```sh
cd ddd && bun install
```

## 本 Unit のテストの実行方法

本 Unit に限定した実行コマンドは次のとおり。最初のテストサイクルより前に、このコマンドが
解決できて走ることを確認する（Testing Contract の `runner_ready_before_first_test`）。

```sh
cd ddd && bun test tests/u3-plugin-scaffold.test.ts
```

テスト名で絞る場合：

```sh
cd ddd && bun test tests/u3-plugin-scaffold.test.ts --test-name-pattern "contributes"
```

本 Unit のテストファイルは `ddd/tests/u3-plugin-scaffold.test.ts` の 1 本のみである。
フィクスチャは持たない。テストは `ddd/.aidlc-plugin/plugin.json`、`ddd/package.json`、
`ddd/biome.json` と、`contributes` が指す 5 つの面のディレクトリを**実物のまま読む**。

プロジェクト全体の検証は次の 4 つ。Unit のループでは使わず、記録の最終確認に用いる。

```sh
cd ddd && bun run validate
cd ddd && bun run build:claude
cd ddd && bun run build:codex
cd ddd && bun run check
```

## 期待するカバレッジ

- **戦略**: Standard — コンポーネントあたり 5〜8 件。
  本 Unit のコンポーネントは PluginPackaging の 1 つで、本 Unit は **6 件**を置く。
- **スコープ床（plugin-dev）**: 追加の新規テスト床は無い。既存スイートが緑であることのみ。
- **実測の目安**: `ddd/.aidlc-plugin/plugin.json` の `contributes` が宣言する 5 面、
  `contributes` が指すディレクトリの実在、`package.json` の 4 スクリプトと `check` の段構成、
  `biome.json` の対象と除外、`stages/` と `contributions/` の論理名の接頭辞、
  未実装機構への非依存の各経路が、少なくとも 1 件のテストで踏まれていること。
- 数値目標を下げて通すことは禁止する。届かない場合は乖離を報告する。

### 既知の前提条件（本 Unit のテストには影響しない）

`tests/codex-dispatch-bridge.test.ts` は `aidlc-workflows/dist/codex/aidlc` の fixture を必要とし、
その dist が未生成の環境では 12 件が落ちる。`ddd/tests/README.md` が既知の前提条件として
記載しているとおりで、`aidlc-workflows/` は読み取り専用のサブモジュールである。
本 Unit のテストはこの fixture を使わないため影響を受けないが、
`bun run check` は `test` 段を含むため終了コード 0 にならない。

## モック・スタブの方針

- **ネットワーク・外部プロセスを呼ばない。** 本 Unit のテストはファイルを読むだけである。
  `bun run validate` / `build:*` はテストからは起動しない（記録の最終確認で別途実行する）。
- **ファイルシステムは実物を使う。** `plugin.json` と `package.json` をモックしない。
  宣言そのものが検証対象だからである。一時ディレクトリも作らない。
- **ビルド成果物を読まない。** `dist/` は `.gitignore` の管理外であり、内容はビルドに依存する。
  テストは `dist/` を参照しない。
- 時刻・乱数に依存する分岐を持たない。同一の作業ツリーに対して同一の結果が得られる。

## テストデータの管理

- **フィクスチャを持たない。** 対象はすべて `ddd/` 配下の実ファイルである。
- **パスは `ddd/` からの相対で組み立てる。** テストファイルの位置
  （`tests/u3-plugin-scaffold.test.ts`）から `../.aidlc-plugin/plugin.json` のように解決し、
  実行時の作業ディレクトリに依存しない。
- **書き込みをしない。** 本 Unit のテストは読み取り専用で、後始末を要する状態を作らない。

## 失敗時の扱い

- テストが落ちた場合、期待値を実装に合わせて緩めることはしない。
  どちらが誤っているかを判断し、`code-summary.md` の逸脱欄に記録する。
- 足場の宣言（5 面）と実ディレクトリが食い違う場合、どちらが正しいかは
  `unit-of-work.md` の U3 の記述と FR11.1 に照らして判断する。判断がつかない場合は
  テストを緩めず、乖離として記録して承認ゲートに上げる。
