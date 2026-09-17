# 操作エラー集合の照合

[English](operation-error-set.md) | [業務エラー契約の解決](error-contract-resolution.ja.md) | [検査契約の設計](inspection-contract-design.ja.md)

`operation-error-set/1` は、一つの集約写像に含まれるコマンドと生成メソッドごとに、コードが宣言するエラーケースの集合が、正規モデルがその操作に与えた業務エラーの集合と一致するかを判定する契約です。公開入口は [`tools/ddd/lib/operation-error-set/index.ts`](../../tools/ddd/lib/operation-error-set/index.ts) です。

操作・結果契約・エラーケース集合の解決は [`error-contract/1`](error-contract-resolution.ja.md) が担います。本契約は、その観測結果を正規モデル（`schema_version: 2`）と実装写像（`schema_version: 2`）の1集約分に結び付け、操作ごとに判定を一つ返します。ソース、構文木、コンパイラのオブジェクトは読みません。シンボルIDも分解しません。本番センサーや承認ゲートへは接続していません。接続はT-10で行います。

`prepareOperationErrorSetRequest(input: unknown)` は、要求を持つ `prepared` か、理由を1件持つ `input-rejected` を返します。入力は次の3つを持つオブジェクトです。

| フィールド | 内容 |
|---|---|
| `model` | ローダーが正規化した正規モデル |
| `mapping` | ローダーが正規化した実装写像のうち、集約1件分のエントリ |
| `observations` | 写像した操作ごとの `{ operationRef, request }`。`request` は `error-contract/1` の準備済み要求 |

`inspectOperationErrorSet(request: unknown, executions: unknown)` は、判定結果を持つ `evaluated` か、`input-rejected` を返します。`executions` は操作ごとの `{ operationRef, execution }` で、`execution` は `error-contract/1` の実行結果です。正確なフィールドとタグは [`contract.ts`](../../tools/ddd/lib/operation-error-set/contract.ts) に定義しています。

## コマンド

```sh
bun run prepare:error-contract       # ネイティブ抽出器（protocol version 3）の構築と設置。Rust経路が使う
bun run verify:operation-error-set   # 共通シナリオをRust・TypeScript class・TypeScriptコンパニオンの3経路で検証し、証跡を出力する
bun run check                        # 上記を含む全体検査
```

`bun run verify:operation-error-set --write` は [`evidence/operation-error-set.json`](evidence/operation-error-set.json) を更新します。`cargo`、`rustc`、設置済みのネイティブ抽出器、TypeScript 6.0.3 が必要です。共通シナリオ `tests/fixtures/operation-error-set` のRust workspaceは依存を持たず、自身の `Cargo.lock` を同梱しています。期待値のいずれかと一致しない場合、コマンドは終了コード1で終わります。

## 要求の準備で拒否する入力

次のいずれかに当たる入力は、照合せずに `input-rejected` とします。

| 拒否する入力 | 理由 |
|---|---|
| 正規モデルの `schema_version` が2ではない | version 1には生成操作のエラーを書く場所がない |
| 写像の `aggregate_ref` が、モデル内のちょうど1つの集約を指していない | 期待する操作を一意に決められない |
| 集約内のエラーが宣言する `operation` が、そのエラーを含む操作と一致しない | どちらを所属とみなすかで、別操作所属の判定が変わる |
| 写像の操作が、集約のコマンドと生成操作を過不足・重複なく覆っていない | 判定しない操作が残る |
| 写像がある操作に並べたエラーを、その操作自身が宣言していない | 包含元と所属の不一致 |
| 写像が操作のエラーをすべて覆っていない、同じエラーを二度並べる、または1つの操作の2つのエラーを同じケース名に写像する | ケースからエラーを一意に決められない |
| 観測が `error-contract/1` の要求として正しくない（識別の改変を含む） | 観測を信用できない |
| 観測の言語、`target.operation`、`target.declarationPath` の末尾、`target.packageId` が指すパッケージの名前が、写像の言語・メソッド・型・パッケージと一致しない | 別の対象の観測である |
| 観測どうしで、ソース、解析条件、設定、ツール版のいずれかが異なる | 異なる解析スナップショットを混在させない |
| 観測が欠けている、1つの操作に2件ある、または写像にない操作を指している | 操作と観測を1対1に結び付けられない |

モジュールパスの配置は言語ごとに異なるため、照合器は写像の `module` と観測のファイル・宣言パスの前半を比べません。配置は各言語の検証経路が決めます。

## 要求識別

要求識別は、識別自身を除く全フィールドを正規化JSONにした値の `sha256:` です。フィールドは次のとおりです。

- `schemaVersion`、`ruleId`、`language`、`aggregateRef`
- `model`: `schemaVersion` と、モデル全体の正規化JSONの `sha256:` である `digest`
- `operations`: コマンド、生成操作の順（それぞれモデル内の順）。各操作は `operationRef`、`kind`、`code`（`package`・`module`・`type`・`method`・`errorType`）、モデル内の順に並べた `errors`（`errorRef`・`case`）、`observation` を持つ

各観測の識別は、その解析スナップショットを覆っています。したがって、写像のメソッド・ケース・エラー型・モジュール・型・パッケージ、モデルの内容と版、解析スナップショットのいずれを変えても、要求識別が変わります。照合に使わない写像のフィールド（実行モデル、永続化方式、ポートなど）は識別に含めません。

変更前の観測に対する実行結果を変更後の要求に渡すと、`error-contract/1` の識別照合が `identity-mismatch` を返し、その操作は `unresolved` になります。古い結果で合格になることはありません。`inspectOperationErrorSet` は要求を読み直して識別を再計算するため、準備後に書き換えた要求も拒否します。照合器は結果をキャッシュしません。

## 判定

操作ごとに、`resolveErrorContract` へ自身の観測と実行結果を渡し、確定した事実だけを[検査契約の設計](inspection-contract-design.ja.md)の§6の順に読みます。

| `error-contract/1` が確定した事実 | 所見 |
|---|---|
| 結果契約が `absent` | `result-contract`（`detail: absent`） |
| 結果契約が標準Resultではない | `result-contract`（`detail: non-standard`） |
| 標準Resultで、エラー型が `unit` | `result-contract`（`detail: unnamed-error-type`） |
| 標準Resultで、エラー型が宣言を名指し、ケース集合が `absent` | `result-contract`（`detail: no-case-set`） |
| 標準Resultで、エラー型が宣言を名指し、ケース集合が `resolved` | 下表のケースごとの照合 |
| 操作、結果契約、またはケース集合が `unresolved` | 所見なし（理由は下記のとおり） |

結果契約に問題がある場合は、写像したケースごとに不足を報告するのではなく、所見を1件だけ返します。

| 観測したケース | 所見 |
|---|---|
| 自操作の写像にある | なし |
| 自操作の写像になく、他の操作の写像にある | `foreign-error`（`errorRef` と `owner`）。該当する他の操作ごとに1件 |
| どの操作の写像にもない | `unexpected-case`（`case` は観測した綴り） |
| 自操作の写像にあり、観測にない | `missing-error`。ケース集合が `complete` のときだけ判定する |

ケース名は完全一致で比べます。大文字小文字、`-` と `_`、空白を正規化しません。写像が言語ごとの綴りを定めているためです。同じ綴りが自操作と他の操作の両方の写像にある場合は、自操作のケースとして扱います。`partial` の集合からは不足を判定しませんが、写像の外にあると確定したケースは所見として残します。

`unresolvedReasons` と `executionState` は `resolveErrorContract` の結果をそのまま返します。照合器が理由を追加したり、分類し直したりすることはありません。`ruleResult` は、理由があれば `unresolved`、なければ所見があれば `violation`、どちらもなければ `pass` です。`unresolved` の場合も、確定した所見は残します。未解決の理由を所見に混ぜることはありません。結果は操作ごとに返し、集約全体の判定は作りません。所見はケースの観測順ではなく、その意味の順に並べます。

| 所見 | フィールド |
|---|---|
| `missing-error` | `operationRef`、`errorRef`、写像が期待した `case`、`error-contract/1` がケース集合の根拠として返す位置（Rustはenum宣言の名前、TypeScriptは標準Resultのエラー型引数。TypeScriptの位置はエラー型の宣言ではなく参照を指す） |
| `unexpected-case` | `operationRef`、観測した `case`、そのケースの位置 |
| `foreign-error` | `operationRef`、他の操作の `errorRef` と `owner`、観測した `case`、そのケースの位置 |
| `result-contract` | `operationRef`、`detail`、結果契約またはケース集合の根拠位置 |

## 両言語の検証経路

どちらの経路も、写像を `error-contract/1` の対象へ変換し、抽出器を実行して、同じ `prepareOperationErrorSetRequest` と `inspectOperationErrorSet` へ渡します。照合器のディレクトリから辿れるimportには、`tools/ddd/lib/rust/`、`tools/ddd/lib/typescript/`、`experiments/`、`typescript` パッケージのいずれも含みません。この境界は試験で確認しています。

| 経路 | 入口 | 対象の決め方 |
|---|---|---|
| Rust | [`observeRustOperations`](../../tools/ddd/lib/operation-error-set-verification/rust.ts) | ホストのターゲットトリプルとfeatureなしで `resolveCargoCondition` を実行する。写像のモジュールを、ライブラリcrateルートと同じディレクトリの `<module>.rs` に置く。宣言パスは `[...module, type]`、モジュール配置は `file` |
| TypeScript | [`observeTypeScriptOperations`](../../tools/ddd/lib/operation-error-set-verification/typescript.ts) | プロジェクトごとに `resolveTypeScriptCondition` を実行する。写像のモジュールを `<packageRoot>/src/<module>.ts` に置く。宣言パスは `[type]`、モジュール配置は `named-file`、コード表現は `class` または `companion` |

モデルと写像は [`scenario.ts`](../../tools/ddd/lib/operation-error-set-verification/scenario.ts) が本番のローダーで読みます。

## 共通シナリオ

正規モデルは、集約 `aggregate.invoice` にコマンド `command.invoice.issue`（`already-issued`、`empty-lines`）と生成操作 `factory.invoice.open`（`negative-amount`、`missing-customer`）を持ちます。Rustの写像とTypeScriptの写像は同じモデルを参照し、業務IDも共通です。異なるのはケースの綴り（`AlreadyIssued` と `already-issued` など）だけです。TypeScriptは、class方式とコンパニオン方式の2プロジェクトが同じ写像を共有します。1プロジェクトの中で2つの表現を混在させません。

各プロジェクトのモジュールが1つのシナリオです。写像の `module` をそのモジュールへ向けて到達します。期待値はシナリオから手書きしたもので、実行結果を写したものではありません。

| モジュール | 内容 | Rust | TypeScript（両表現） |
|---|---|---|---|
| `invoice` | 写像どおりの閉じた集合 | 両操作 `pass` | 同左 |
| `missing` | 各操作が1ケースを欠く | `missing-error` の `violation` | 同左 |
| `extra` | どの写像にもないケースを1つ追加 | `unexpected-case` の `violation` | 同左 |
| `foreign` | 他の操作のケースを1つ追加 | `foreign-error` の `violation` | 同左 |
| `contract` | コマンドは戻り値なし、生成操作は標準Result以外を返す | `result-contract`（`absent`・`non-standard`）の `violation` | 同左 |
| `shadowed` | 同名の独自 `Result` | `shadowed-result-identity` の `unresolved`。`non-standard` の所見を保持 | `shadowed-result-identity` の `unresolved` |
| `widened` | 開いたエラー集合 | `#[non_exhaustive]` による `incomplete-case-set` の `unresolved` | `\| string` による `open-error-type` の `unresolved` |
| `unreferenced` | エラー型をスナップショットにないモジュールから読む | `missing-referent` の `unresolved` | 同左 |
| `inferred` | 戻り値を本体だけが確定させる | `expression-inference-required` の `unresolved` | 同左 |
| `undeclared` | 型はあるが、写像した操作がない | `target-missing` の `unresolved` | 同左 |
| `open_extra` | 開いたenumが写像外のケースも持つ（Rustのみ） | `incomplete-case-set` の `unresolved`。`unexpected-case` と `foreign-error` を保持 | 対象外 |

変更をまたぐ確認は3経路それぞれで行います。

| 変更 | 確認すること |
|---|---|
| 写像のメソッド名 | 要求識別が変わり、新しい観測では `target-missing` になる。変更前の実行結果は `identity-mismatch` |
| 正規モデルの内容 | エラーを追加すると要求識別が変わり、同じ観測から `missing-error` になる。`schema_version: 1` のモデルは拒否する |
| 解析スナップショット | ソースからケースを除くと要求識別が変わり、`missing-error` になる。変更前の実行結果は両操作とも `identity-mismatch` |
| スナップショットの混在 | 変更前と変更後の観測を1つの要求に混ぜると拒否する |
| 観測の言語 | 別の言語の写像に対する観測は拒否する |

## 限界

- 写像の `code.error_type` の綴りと、解決したエラー型の宣言名は比べません。`error-contract/1` はエラー型を内部形式を前提にしない `symbolId` としてだけ返すためです。比べるには `error-contract/1` に宣言名を公開する変更が必要で、T-10/T-11の前提作業として親課題に記録します。
- 2つの操作が同じエラー型を共有しているかは検査しません。他の操作のエラーを含むunionは、ケース単位の `foreign-error` で検出します。
- 本番センサーと承認ゲートには接続していません。
- シナリオのモジュールをコンパイラが受理するかは測りません。いくつかのモジュールは、意図的にコンパイルできない形で書いています。
- このシナリオが使う配置は、Rustの `file` とTypeScriptの `named-file` だけです。もう一方の配置は `error-contract/1` の検証が扱います。
- 型とケースの一致は、各失敗経路の状態維持や不変条件を証明しません。
- 確認した環境は、証跡に記録した darwin-arm64、rustc 1.95.0、cargo 1.95.0、Bun 1.3.13、TypeScript 6.0.3、syn 3.0.5 です。
