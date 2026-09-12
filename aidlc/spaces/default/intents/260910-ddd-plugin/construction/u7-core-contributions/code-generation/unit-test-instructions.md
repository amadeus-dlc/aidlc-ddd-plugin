# Unit Test Instructions — U7 コアステージ contribution（u7-core-contributions）

## この文書の範囲

本 Unit（`u7-core-contributions`）のテストの実行方法だけを定める。他の Unit のテストは含めない。
Build and Test は全 Unit のコマンドを順に実行するため、ここに書くコマンドは必ず本 Unit に限定する。

## テストフレームワークの設定

- **ランナー**: `bun:test`（bun 組み込み）。追加の devDependency を導入しない。
- **作業ディレクトリ**: `ddd/`
- **設定ファイル**: 専用の設定ファイルは置かない。`ddd/package.json` の `test` が
  `bun test tests/` としてテストディレクトリを走査する。
- **アサーション**: `bun:test` の `describe` / `test` / `expect`。
- **compose ツール**: `../.codex/tools/aidlc-plugin-test.ts`（ワークスペース根の `.codex/tools/`）を
  子プロセスで起動し、使い捨てのコピーに対して compose する。ネットワークは使わない。

事前準備は `ddd/` での依存導入のみで足りる。

```sh
cd ddd && bun install
```

## 本 Unit のテストの実行方法

本 Unit は Markdown の contribution 4 本であり、専用のテストファイルを持たない。本 Unit の契約
（compose に載ること、drops が無いこと、`adds` の論理名の接頭辞、未実装の面に依存しないこと）を踏む
既存テストを、テスト名で絞って Unit 限定で実行する。最初のテストサイクルより前に、これらが
解決できて走ることを確認する（Testing Contract の `runner_ready_before_first_test`）。

```sh
cd ddd && bun test tests/framework-compatibility.test.ts --test-name-pattern "composes"
cd ddd && bun test tests/u3-plugin-scaffold.test.ts --test-name-pattern "FR11.2|FR11.5"
```

- 1 つ目は claude / codex の 2 ハーネスで compose し、`errors: []`、`graph.compiled: true`、
  `idempotent: true`、`drops: []` を確認する（2 件。FR3.4、FR3.1 / FR3.5 / FR8.3 のノード反映の前提）。
- 2 つ目は `adds.produces` の論理名が `ddd-` 接頭辞であること（FR11.2。ステージの `produces` も同時に検査する）と、
  `adds.requires_stage` / `when:` / `after-questions` に依存しないこと（FR11.5、BR1.2）を確認する
  （`--test-name-pattern "FR11.2|FR11.5"` は FR11.2 の 2 件と FR11.5 の 1 件に一致する。うち本 Unit の
  契約に関わるのは `logical artifact names ... are prefixed` と FR11.5 の 2 件）。

プロジェクト全体の検証は次の 3 つ。Unit のループでは使わず、記録の最終確認に用いる。

```sh
cd ddd && bun run validate
cd ddd && bun run build:claude
cd ddd && bun run build:codex
```

compose 後の 4 ノードの consumes / produces / sensors と fragment 本文の出現（FR3.1、FR3.5、FR4.2、FR5.2、
FR5.3、FR8.3）は、`bun ../.codex/tools/aidlc-plugin-test.ts . --install .. --harness claude --json` の出力を
読んで確認する。

## 期待するカバレッジ

- **戦略**: Standard — コンポーネントあたり 5〜8 件。本 Unit のコンポーネントは 4 つの contribution。
- **実測の目安**: 上記のテストが緑であること。**床を満たさない**ことは計画で申告済みの逸脱であり、
  数値目標を下げて通すことはしない。
- **スコープ床（plugin-dev）**: 追加の新規テスト床は無い。既存スイートが緑であることのみ。
- fragment 本文（Step 2x / 4x / 5x / 1x、`in:Sensors`）は散文であり機械テストの対象外。仕様（BR1〜BR6）との
  読み合わせで検証し、結果を `code-summary.md` に表で残す。

### 既知の前提条件（本 Unit のテストには影響しない）

`tests/codex-dispatch-bridge.test.ts` は `aidlc-workflows/dist/codex/aidlc` の fixture を必要とし、
その dist が未生成の環境では 12 件が落ちる。`ddd/tests/README.md` が既知の前提条件として
記載しているとおりで、`aidlc-workflows/` は読み取り専用のサブモジュールである。
本 Unit のテストはこの fixture を使わないため影響を受けないが、
`bun run check` は `test` 段を含むため終了コード 0 にならない。

## モック・スタブの方針

- **ネットワークを呼ばない。** compose は使い捨てのローカルコピーに対して行う。
- **compose ツールはモックしない。** フレームワーク実物の `aidlc-plugin-test.ts` を子プロセスとして
  起動する。contribution が実際のグラフコンパイラに受理され、fragment が合成されることが検証対象だからである。
- **contribution を書き換えて通さない。** frontmatter の値と仕様の差は逸脱として記録する。
- 時刻・乱数に依存する分岐を持たない。同一の作業ツリーに対して同一の結果が得られる。

## テストデータの管理

- compose テストは使い捨てのコピーを作り、テスト側が後始末する。`ddd/` 配下に生成物を残さない。
- `dist/` は `.gitignore` の管理外であり、テストは `dist/` を参照しない。
- 本 Unit に fixture は無い。

## 失敗時の扱い

- compose テストが落ちた場合（drops がある、ノードに adds が載らない）、contribution の frontmatter を
  仕様（`functional-spec.md` §1、`rules.md` BR1）とコアのステージ定義の現行 Steps 番号に照らして原因を判定し、
  `code-summary.md` の逸脱欄に記録する。期待値を緩めない。
- 接頭辞テスト・FR11.5 テストが落ちた場合、U3 の規約（FR11.2、FR11.5）が正であり、contribution 側の差として記録する。
