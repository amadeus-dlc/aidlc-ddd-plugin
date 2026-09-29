# TypeScriptの実行モデルと永続化方式の検証

[English](typescript-execution-persistence-verification.md) | 日本語 | [開発者向け文書](README.ja.md)

検証日: 2026-09-28。基準コミット: `7cda3bf634b8a4c58fc55d7a441c768a132af041`（T-03-03 の変更はこのコミットの上に積んだ未コミットの作業ツリーで実測した）。[実行記録](evidence/typescript-execution-persistence-verification.json)を参照。

[言語共通の設計](language-independent-design.ja.md) §11 が求める共通の振る舞いテスト7件と、TypeScriptだけのシナリオ1件を、TypeScriptの生成見本で実行し、各シナリオが検証する集約の `programming_model` × `persistence_method` を、コード表現とモジュール配置ごとに記録する。形式は[Rustの記録](rust-execution-persistence-verification.ja.md)にそろえた。どの試験も扱っていない組み合わせは未検証として記載し、対応済みとしては記載しない。

## 何を実行するか

見本は、コード生成の手順が教えるTypeScriptのコードそのものである（[`fixtures/typescript-generation/samples.ts`](../../tests/fixtures/typescript-generation/samples.ts)。実行用の手順の例と一字一句一致することを `generation-instructions.test.ts` が確かめる）。[`t11-typescript-behavior.test.ts`](../../tests/t11-typescript-behavior.test.ts) は、見本ごとに一時ディレクトリへ書き出し（`:37-50`）、各パッケージを `node_modules/@acme/*` にリンクする（`:47`）。見本は変更しない。

シナリオは、見本のディレクトリで、カバレッジを計測せずに起動した子プロセスの `bun test` で実行する（`t11-typescript-behavior.test.ts:60-77`）。子プロセスの中では、[`fixtures/typescript-behavior/sample-runner.ts`](../../tests/fixtures/typescript-behavior/sample-runner.ts) が、利用側が import する名前でパッケージを読み込み（`:34-49`）、書かれたソースのまま実行する。各シナリオを1件ずつテストとして登録し、それぞれの結果を登録順に JSON ファイルへ書き出す（`:51-69`）。別のプロセスで実行するのは、どの試験実行でも必ず実行される見本のソースを、`bun run test` が計測するカバレッジに入れないためである（`bunfig.toml` に書かれた規則）。振る舞いテストは子プロセスの報告だけを判定する。すべてのシナリオが順序どおりに報告され、子プロセスが0で終了していること（`t11-typescript-behavior.test.ts:103-111`）、各シナリオのテストはそのシナリオが成功と報告されたときだけ成功すること（`:113-118`）を確かめる。報告が無い、シナリオが欠けている、失敗が報告された、のいずれでも、子プロセスの出力を示してテストが失敗する。

見本は請求書を、replay メソッドを持たない `class` × `event-sourcing` として写像する。一つのコマンドは一つのイベントを生む。`addLine` → `line-added`、`issue` → `issued`、`recordPayment` → `payment-recorded`（`command-id-memory`、保持 `multiple`、`retention_count: 16`）である。`settled` のイベントは無く、`isSettled()` が状態から導く。ドメインメソッドは状態へ書き込まず、新しいインスタンスを返す。`addLine` と `issue` は `Result<{ next, event }, …>` を返し、`recordPayment` は `Result<CommandOutcome<Invoice, InvoiceEvent>, …>`（`next` とその1件のイベントを持つ `applied`、またはどちらも持たない `already-applied`）を返す。ユースケースは返された `next` を保存し、リポジトリの `store(invoiceId, invoice, expectedVersion, event)` は期待バージョンを照合してその1件のイベントを追記する。バージョンの競合で拒否した `store` は何も保存しない。

シナリオは [`fixtures/typescript-behavior/scenarios.ts`](../../tests/fixtures/typescript-behavior/scenarios.ts) に1回だけ定義する。共通のものは `BEHAVIOR_SCENARIOS`（`:169`）、TypeScriptだけのものは `TYPESCRIPT_SCENARIOS`（`:377`）である。`sample-runner.ts` の `SAMPLE_SCENARIOS`（`:23-26`）が共通のもの、続けてTypeScriptのものを実行し、4つの見本すべてに同じものを適用する（`t11-typescript-behavior.test.ts:91-127`）。共通シナリオがこの7件であることは `t11-typescript-behavior.test.ts:129-139` が、TypeScriptのシナリオがこの1件であることは `:141-143` が確かめる。同じ共通シナリオ7件をRustでは[`fixtures/rust-behavior/scenarios.rs`](../../tests/fixtures/rust-behavior/scenarios.rs)に書いている。

| シナリオ | 確認する内容 | 定義 |
|---|---|---|
| `state-change`（正常な状態変更） | `open` した請求書に `addLine` すると、合計と明細数が増えた次のインスタンスが返る。`issue` の後は、発行済みのインスタンスの `addLine` も `issue` も `already-issued` を返し、合計は変わらない。`IssueInvoice.execute` が成功する | `scenarios.ts:171-187`。Rustは `scenarios.rs:127` |
| `business-error-keeps-state`（業務エラー時の状態保持） | `negative-total` で拒否された `addLine` の後も合計と明細数が変わらない。明細の無い請求書の `issue` は `empty-lines` を返し、その後も下書きのまま追加と発行ができる。リポジトリ経由の `execute` が `already-issued`・`empty-lines` を返したとき、記録された状態は変わらない | `:188-212`。Rustは `scenarios.rs:144` |
| `invalid-value-rejected`（不正値の生成拒否） | `open` は `missing-customer` と `negative-total` を返す。`restore` は、顧客が空、明細の無い発行済み、合計が負、支払済み額が負または合計超過、下書きでの支払済み額や記憶中のID、保持件数を超えるIDのいずれでも `corrupt invoice state` で throw する | `:213-232`。Rustは `scenarios.rs:169` |
| `restore-after-persistence`（永続化後の復元） | `findById` で記録から復元した集約が記録の状態を持つ。コマンドが返したインスタンスを `execute` で保存した後の `findById` は、読み込んだ下書きではなく保存した発行済みの集約を返す。未知の ID は `invoice-not-found` を返す | `:233-258`。Rustは `scenarios.rs:186` |
| `duplicate-command-already-applied`（繰り返したコマンドは適用済み） | 同じコマンドIDで繰り返した `recordPayment` は、金額が違っても適用済みを返し、イベントも変更も保存もない。新しいIDは適用される。支払済み額と記憶中のIDを持つ状態から、`restore` で直接、または記録から `RecordPayment` 経由で復元した請求書は、記憶中のIDを適用済みとして答えて何も保存せず、復元した支払済み額に対する超過払いを拒否する。IDを記憶していない記録では、その支払いが適用される | `:259-301`。Rustは `scenarios.rs:211` |
| `rejected-command-keeps-state`（拒否したコマンドは状態を保つ） | `not-issued` や `overpayment` で拒否した `recordPayment` は何も変えず、何も保存せず、IDも記憶しない。そのため同じIDは、適用できるようになった時点で適用される | `:302-327`。Rustは `scenarios.rs:253` |
| `one-event-appended-per-command`（1コマンドにつき1件のイベントを追記） | 状態を変えるコマンドはどれも1件のイベントを返し、`IssueInvoice` と `RecordPayment` による保存は、どれもバージョンと保存イベント数を1つずつ進める。合計に達して請求書を完済にする支払いも同じである（`isSettled()` は状態から読む）。古い読み込みから得た次のインスタンスとイベントを渡した `store` は、間に別の読み込みがあっても `version-conflict` を返し、バージョンと保存イベントを変えない。読み直した請求書は拒否した変更を含まず、同じ支払いはそこで適用される | `:328-374`。Rustは `scenarios.rs:282` |

| TypeScriptだけのシナリオ | 確認する内容 | 定義 |
|---|---|---|
| `command-keeps-original-instance`（コマンドは元のインスタンスを変えない） | `addLine`・`issue`・`recordPayment` の後も、呼び出し元のインスタンスは合計、明細（以前に返した明細の配列を含む）、支払済み額、`isSettled()`、記憶中のコマンドIDを保つ。`issue` を呼んだインスタンスは明細をまだ受け付け、`recordPayment` を呼んだインスタンスは同じコマンドIDを再び適用する | `scenarios.ts:377-406`。Rustにはこのシナリオが無い。Rustのコマンドは `&mut self` で集約を変えるためである |

## 各軸を読むのはどこか

| 軸 | 判定のために読む箇所 | 位置 |
|---|---|---|
| `programming_model` | 言語共通の宣言ゲートのみ。2つ以上の集約を対象とし、そのいずれか一つでも `actor` であるユースケースに Process Manager を要求する（2026-09-28に「すべて `actor`」から変更。T-03-01）。写像が対象の一部を写像していないまま2つ以上の集約をまたいで再実行するユースケースは、`mapping-declarations.execution-model-undetermined` で拒否する | [`ddd-sensor-mapping-declarations.ts:127`](../../tools/ddd-sensor-mapping-declarations.ts)（Process Managerの条件）、`:110-118`（実行モデルの未確定） |
| `persistence_method` | TypeScriptのドメインゲートはこの値を読まない。規則(b)も規則(c)も、モデルや写像の宣言に左右されない。モデル・コマンド・replay の宣言やモデルの有無にかかわらず、ドメインのインスタンスメソッドでの状態の書込みは規則(b)の所見になり、状態を書く post-init メソッドは規則(c)の所見になる | [`rules/typescript/evaluators.ts:63-77`](../../tools/ddd/lib/rules/typescript/evaluators.ts) の `ruleB`。`ruleC` の post-init の判定は `:109-119` |
| `.ddd.toml` の `typescript.code_representation`・`typescript.module_layout` | 見本ごとに異なる。振る舞いテストはこの値を読まず、見本のソースそのものを実行する | 見本の設定は `samples.ts:640` の `settings`、組み合わせは `REPRESENTATIONS`・`LAYOUTS`（`:33-34`） |

振る舞いテストの側は、どちらの軸も読んで振る舞いを変えることはない。見本のコマンドの結果は、宣言した `event-sourcing` に規約として従う（各コマンドが1件のイベントを返す）。戻り値の形を確かめるゲートは無い。記録する値は、見本の集約写像が宣言している値である。`samples.ts:607-608` が `programming_model: class` と `persistence_method: event-sourcing` を宣言し、`t11-typescript-behavior.test.ts:122-125` が4つの見本それぞれでこの2つの値を確かめる。

## 検証済みの組み合わせ

| `programming_model` | `persistence_method` | コード表現 | モジュール配置 | シナリオ | 根拠 |
|---|---|---|---|---|---|
| `class` | `event-sourcing`（replay なし） | `class` | `named-file` | 共通7件とTypeScriptの1件すべて | `generation sample behavior: class / named-file` |
| `class` | `event-sourcing`（replay なし） | `class` | `index-file` | 共通7件とTypeScriptの1件すべて | `generation sample behavior: class / index-file` |
| `class` | `event-sourcing`（replay なし） | `companion` | `named-file` | 共通7件とTypeScriptの1件すべて | `generation sample behavior: companion / named-file` |
| `class` | `event-sourcing`（replay なし） | `companion` | `index-file` | 共通7件とTypeScriptの1件すべて | `generation sample behavior: companion / index-file` |

組み合わせが4通りそろっていることは `t11-typescript-behavior.test.ts:145-153` が、共通シナリオが7件であることは `:129-139` が、TypeScriptのシナリオが1件であることは `:141-143` が確かめる。表の各行のテストは、`describe` の名前として `t11-typescript-behavior.test.ts:92` で作られる。

ここでの `programming_model: class` は集約の実行モデルであり、コード表現の `class` とは別の軸である。コード表現が `companion` の見本も、実行モデルは `class`（集約をメソッド呼び出しで直接操作する）である。

同じ4つの見本は、振る舞いテストとは別に次の経路でも実行している。どれも `class` × `event-sourcing` の同じ写像を使う。

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
| `class` | `state-sourcing` | 生成見本はすべて `event-sourcing` を宣言するため、`Result<Invoice, …>` を返すステートソーシングのコマンドを動かす振る舞いテストはない。振る舞いテストはステートソーシングを扱わなくなった |
| `class` | replay を持つ `event-sourcing` | `replay_methods` を宣言する生成見本はない。見本は請求書を、イベントの replay ではなく状態全体の記録から復元する |
| `actor` | `state-sourcing` | 集約に `actor` を宣言し、TypeScriptのソースを伴う見本がない |
| `actor` | `event-sourcing` | この組を宣言する見本がない |

いずれも、試験が無いという事実であり、その組み合わせが非対応または不正であるという主張ではない。同じ共通の振る舞いテストをRustで実行した結果と、それが検証する組み合わせは、[Rustの実行モデルと永続化方式の検証](rust-execution-persistence-verification.ja.md)に記録している。

## 限界

- リポジトリは `InMemoryInvoiceRepository` であり、各請求書を状態の全体を持つ記録（`InvoiceRecord`）として、バージョンと保存したイベントとともに保持する。`store` は期待バージョンを照合し、記録を書き、バージョンを1つ進め、1件のイベントを追記する。`findById` は毎回その記録から `Invoice.restore` で新しい集約を復元する。永続化の「往復」は、リポジトリが最初に受け取った記録から復元する経路と、`store` が書いた記録から復元する経路で確かめている。保存したイベントの replay による請求書の再構築と、直列化してデータベースやファイルへ書き、読み戻す経路は検証していない。
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
