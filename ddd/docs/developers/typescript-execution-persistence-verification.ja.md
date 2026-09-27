# TypeScriptの実行モデルと永続化方式の検証

[English](typescript-execution-persistence-verification.md) | 日本語 | [開発者向け文書](README.ja.md)

検証日: 2026-09-27。基準コミット: `a1c9f8969100ed47bc7a63e603dc3b424395dc0d`（T-11-06 の変更はこのコミットの上に積んだ未コミットの作業ツリーで実測した）。[実行記録](evidence/typescript-execution-persistence-verification.json)を参照。

[言語共通の設計](language-independent-design.ja.md) §11 が求める共通の振る舞いテスト4件を、TypeScriptの生成見本で実行し、各シナリオが検証する集約の `programming_model` × `persistence_method` を、コード表現とモジュール配置ごとに記録する。形式は[Rustの記録](rust-execution-persistence-verification.ja.md)にそろえた。どの試験も扱っていない組み合わせは未検証として記載し、対応済みとしては記載しない。

## 何を実行するか

見本は、コード生成の手順が教えるTypeScriptのコードそのものである（[`fixtures/typescript-generation/samples.ts`](../../tests/fixtures/typescript-generation/samples.ts)。実行用の手順の例と一字一句一致することを `generation-instructions.test.ts` が確かめる）。[`t11-typescript-behavior.test.ts`](../../tests/t11-typescript-behavior.test.ts) は、見本ごとに一時ディレクトリへ書き出し（`:37-50`）、各パッケージを `node_modules/@acme/*` にリンクする（`:47`）。見本は変更しない。

シナリオは、見本のディレクトリで、カバレッジを計測せずに起動した子プロセスの `bun test` で実行する（`t11-typescript-behavior.test.ts:60-77`）。子プロセスの中では、[`fixtures/typescript-behavior/sample-runner.ts`](../../tests/fixtures/typescript-behavior/sample-runner.ts) が、利用側が import する名前でパッケージを読み込み（`:21-35`）、書かれたソースのまま実行する。各シナリオを1件ずつテストとして登録し、それぞれの結果を登録順に JSON ファイルへ書き出す（`:37-55`）。別のプロセスで実行するのは、どの試験実行でも必ず実行される見本のソースを、`bun run test` が計測するカバレッジに入れないためである（`bunfig.toml` に書かれた規則）。振る舞いテストは子プロセスの報告だけを判定する。すべてのシナリオが順序どおりに報告され、子プロセスが0で終了していること（`t11-typescript-behavior.test.ts:103-111`）、各シナリオのテストはそのシナリオが成功と報告されたときだけ成功すること（`:113-118`）を確かめる。報告が無い、シナリオが欠けている、失敗が報告された、のいずれでも、子プロセスの出力を示してテストが失敗する。

シナリオは [`fixtures/typescript-behavior/scenarios.ts`](../../tests/fixtures/typescript-behavior/scenarios.ts) の `BEHAVIOR_SCENARIOS`（`:81`）に1回だけ定義し、4つの見本すべてに同じものを適用する（`t11-typescript-behavior.test.ts:91-127`）。

| シナリオ | 確認する内容 | 定義 |
|---|---|---|
| `state-change`（正常な状態変更） | `open` した請求書に `addLine` すると合計と明細数が増える。`issue` の後は `addLine` も `issue` も `already-issued` を返し、合計は変わらない。`IssueInvoice.execute` が成功する | `scenarios.ts:82-98` |
| `business-error-keeps-state`（業務エラー時の状態保持） | `negative-total` で拒否された `addLine` の後も合計と明細数が変わらない。明細の無い請求書の `issue` は `empty-lines` を返し、その後も下書きのまま追加と発行ができる。リポジトリ経由の `execute` が `already-issued`・`empty-lines` を返したとき、記録された状態は変わらない | `:99-124` |
| `invalid-value-rejected`（不正値の生成拒否） | `open` は `missing-customer` と `negative-total` を返す。`restore` は、顧客が空、明細の無い発行済み、合計が負のいずれでも `corrupt invoice state` で throw する | `:125-135` |
| `restore-after-persistence`（永続化後の復元） | `findById` で記録から復元した集約が記録の状態を持つ。`execute` で保存した後の `findById` は、元の記録ではなく保存した発行済みの集約を返す。未知の ID は `invoice-not-found` を返す | `:136-161` |

## 各軸を読むのはどこか

| 軸 | 判定のために読む箇所 | 位置 |
|---|---|---|
| `programming_model` | 言語共通の宣言ゲートのみ。2つ以上の集約を対象とし、それがすべて `actor` であるユースケースに Process Manager を要求する | [`ddd-sensor-mapping-declarations.ts:111`](../../tools/ddd-sensor-mapping-declarations.ts) |
| `persistence_method` | TypeScriptのドメインゲートの replay 例外。`event-sourcing` 以外では例外が成立しない | [`rules/mutations.ts:81`](../../tools/ddd/lib/rules/mutations.ts)。TypeScriptの評価器は[`rules/typescript/evaluators.ts:32`](../../tools/ddd/lib/rules/typescript/evaluators.ts)でこれを使う |
| `.ddd.toml` の `typescript.code_representation`・`typescript.module_layout` | 見本ごとに異なる。振る舞いテストはこの値を読まず、見本のソースそのものを実行する | 見本の設定は `samples.ts:411` の `settings`、組み合わせは `REPRESENTATIONS`・`LAYOUTS`（`:25-26`） |

振る舞いテストの側は、どちらの軸も読んで振る舞いを変えることはない。記録する値は、見本の集約写像が宣言している値である。`samples.ts:383-384` が `programming_model: class` と `persistence_method: state-sourcing` を宣言し、`t11-typescript-behavior.test.ts:122-125` が4つの見本それぞれでこの2つの値を確かめる。

## 検証済みの組み合わせ

| `programming_model` | `persistence_method` | コード表現 | モジュール配置 | シナリオ | 根拠 |
|---|---|---|---|---|---|
| `class` | `state-sourcing` | `class` | `named-file` | 4件すべて | `generation sample behavior: class / named-file` |
| `class` | `state-sourcing` | `class` | `index-file` | 4件すべて | `generation sample behavior: class / index-file` |
| `class` | `state-sourcing` | `companion` | `named-file` | 4件すべて | `generation sample behavior: companion / named-file` |
| `class` | `state-sourcing` | `companion` | `index-file` | 4件すべて | `generation sample behavior: companion / index-file` |

組み合わせが4通りそろっていることは `t11-typescript-behavior.test.ts:138-146` が、シナリオが4件であることは `:129-136` が確かめる。表の各行のテストは、`describe` の名前として `t11-typescript-behavior.test.ts:92` で作られる。

ここでの `programming_model: class` は集約の実行モデルであり、コード表現の `class` とは別の軸である。コード表現が `companion` の見本も、実行モデルは `class`（集約をメソッド呼び出しで直接操作する）である。

同じ4つの見本は、振る舞いテストとは別に次の経路でも実行している。どれも `class` × `state-sourcing` の同じ写像を使う。

| 経路 | 何を確かめるか | 位置 |
|---|---|---|
| ソースツリーのゲート | 4つのTypeScriptゲートが検査したうえで合格し、CI用入口が0を返す | [`t11-typescript-generation-samples.test.ts`](../../tests/t11-typescript-generation-samples.test.ts) |
| 配布物 | 同じゲートとCI用入口を `dist/<harness>/tools` から実行する | [`scripts/verify-dist.ts`](../../scripts/verify-dist.ts) |
| 導入済みのプロジェクト | 同じゲートとCI用入口を導入済みのツリーから実行する | [`install-sandbox.test.ts:232`](../../tests/install-sandbox.test.ts) |
| 承認経路 | 全DDDセンサーのもとで code-generation のゲートを開く。ゲートは合格時の判定の note を残さないため、その後、導入済みの各TypeScriptゲートを、監査記録にある出力パスで、ゲートが判定したツリーに対してもう一度実行し、見本を検査したうえでの合格であることを確かめる（`:645-653`） | [`t1-gate-integration.test.ts:615-618`](../../tests/t1-gate-integration.test.ts) |
| Next.js 統合 | サーバー側 Node.js 上の ESM Next.js アプリでビルドし、HTTP で `IssueInvoice` を実行する | [Next.js統合の検証](nextjs-integration-verification.ja.md) |

## 未検証の組み合わせ

共通の振る舞いテストが次の組み合わせを実行することはない。TypeScriptのゲートのゴールデンケースが個々の規則の判定でこれらの値を使うことはあるが、それは集約を動かす振る舞いの検証ではない。

| `programming_model` | `persistence_method` | 未検証である理由 |
|---|---|---|
| `class` | `event-sourcing` | 生成見本は `state-sourcing` だけを宣言し、replay メソッドを持たない。TypeScriptのドメインゲートの replay 例外（`rules/mutations.ts:81`）を通す生成見本はない |
| `actor` | `state-sourcing` | 集約に `actor` を宣言し、TypeScriptのソースを伴う見本がない |
| `actor` | `event-sourcing` | この組を宣言する見本がない |

いずれも、試験が無いという事実であり、その組み合わせが非対応または不正であるという主張ではない。Rustの共通の振る舞いテストは、まだ実装していない（[残作業](completion-tasks.ja.md)）。

## 限界

- リポジトリは `InMemoryInvoiceRepository` であり、保存した集約の参照を保持する。永続化の「往復」は、記録（`InvoiceRecord`）から `Invoice.restore` で復元する経路と、保存した集約を次の `findById` が返す経路で確かめている。直列化してデータベースやファイルへ書き、読み戻す経路は検証していない。
- 見本は1つの集約（`invoice`）と1つの子モジュール（`invoice/line`）だけを持つ。複数の集約や集約間の協調は扱わない。
- 振る舞いテストは bun で実行する。Node.js での実行は[Next.js統合の検証](nextjs-integration-verification.ja.md)が扱う範囲に限る。
- すべての実測は `darwin-arm64` で、実行記録に書いた版で行った。

## 再実行して結果を確認する

```sh
cd ddd
bun install --frozen-lockfile
bun test tests/t11-typescript-behavior.test.ts
```

`bun run check` はCIワークフローが使う入口と同じで、`bun test tests/` によりこの試験も含む。
