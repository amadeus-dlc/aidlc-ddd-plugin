# Unit Test Instructions — U1 センサー基盤（u1-sensor-foundation）

## この文書の範囲

本 Unit（`u1-sensor-foundation`）のテストの実行方法だけを定める。他の Unit のテストは含めない。
Build and Test は全 Unit のコマンドを順に実行するため、ここに書くコマンドは必ず本 Unit に限定する。

## テストフレームワークの設定

- **ランナー**: `bun:test`（bun 組み込み）。追加の devDependency を導入しない（NFR2）。
- **作業ディレクトリ**: `ddd/`
- **設定ファイル**: 専用の設定ファイルは置かない。`ddd/package.json` の `test` が
  `bun test tests/` としてテストディレクトリを走査する。
- **アサーション**: `bun:test` の `describe` / `test` / `expect` / `afterEach`。
- **型**: TypeScript。`ddd/tsconfig.json` の設定に従う。

事前準備は `ddd/` での依存導入のみで足りる。

```sh
cd ddd && bun install
```

## 本 Unit のテストの実行方法

本 Unit に限定した実行コマンドは次のとおり。最初のテストサイクルより前に、このコマンドが
解決できて走ることを確認する（Testing Contract の `runner_ready_before_first_test`）。

```sh
cd ddd && bun test tests/u1-sensor-foundation.test.ts
```

テスト名で絞る場合：

```sh
cd ddd && bun test tests/u1-sensor-foundation.test.ts --test-name-pattern "loadDomainModel"
```

本 Unit のテストファイルは `ddd/tests/u1-sensor-foundation.test.ts` の 1 本のみである。
フィクスチャは `ddd/tests/fixtures/u1/` に置く。

プロジェクト全体の検証（Biome + プラグイン検証 + 全テスト）は次のとおり。Unit のループでは
使わず、記録の最終確認にのみ用いる。

```sh
cd ddd && bun run check
```

## 期待するカバレッジ

- **戦略**: Standard — コンポーネントあたり 5〜8 件。本 Unit は 2 コンポーネントで 15 件。
- **スコープ床（plugin-dev）**: 追加の新規テスト床は無い。既存スイートが緑であることのみ。
- **実測の目安**: `ddd/tools/ddd/lib/{runtime,schema,shared}/` の分岐のうち、
  引数不足・record_dir 未解決・不正スキーマ・未解決参照・例外・欠落申告の各経路が
  少なくとも 1 件のテストで踏まれていること。
- 数値目標を下げて通すことは禁止する。届かない場合は乖離を報告する。

## モック・スタブの方針

- **ネットワーク・外部プロセスを呼ばない。** 本 Unit はネットワークにも cargo にも依存しない（NFR2）。
  したがってモックの対象はファイルシステムと標準出力だけである。
- **標準出力**は `SensorIO`（`{ stdout, stderr }` の関数 2 つ）を差し替えて捕まえる。
  `runSensor` はこのインターフェース越しにしか出力しないので、`process.stdout` を触る必要はない。
- **ファイルシステム**は実物を使う。一時ディレクトリ（`mkdtempSync`）に本物の
  `domain-model.yaml` と `aidlc-state.md` を書く。fs のモックは行わない —
  パス解決の正しさそのものが検証対象だからである。
- 時刻・乱数に依存する分岐を持たない。`finding_id` は入力から決定的に導出される（NFR9）。

## テストデータの管理

- **適合サンプル**: `ddd/tests/fixtures/u1/valid.yaml`。正規モデルの最小の正例で、
  読み込み成功・索引解決・完全性検査の 0 件を同時に確認する基準になる。
- **不適合サンプル**: テスト本体の中で文字列として組み立て、一時ディレクトリに書き出す
  （`writeModel(yaml)` ヘルパー）。ファイルを増やさず、各テストが自分の違反だけを持つ。
- **一時ディレクトリ**: 各テストが `makeTemp()` で作り、`afterEach` が
  `rmSync(..., { recursive: true, force: true })` で必ず消す。テスト間で状態を持ち越さない。
- **状態ファイル**: `aidlc-state.md` は `## Stage Progress` 以降に
  `- [<checkbox>] <slug> — <EXECUTE|SKIP>` の行を持つ最小の内容を一時ディレクトリに書く。
  形式の出典は state-template であり、ADR-004 の前提を崩さない。

## 失敗時の扱い

- テストが落ちた場合、期待値を実装に合わせて緩めることはしない。
  どちらが誤っているかを判断し、`code-summary.md` の逸脱欄に記録する。
- 予算超過（BR7.8）のように時間に依存する経路は、閾値を下げるのではなく
  決定性のある入力で再現させる。
