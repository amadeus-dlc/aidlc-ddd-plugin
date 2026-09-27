# TypeScript モジュール配置契約

[English](typescript-module-layout.md) | 日本語 | [利用者向け文書](README.ja.md)

アプリケーションプロジェクト直下（`aidlc/` と同じ階層）の `.ddd.toml` で、TypeScript の配置を1つ選びます。この文書の形式と2つの配置は[言語共通のプロジェクト設定](project-settings.ja.md)が定めます。このページは、それをどう検査するかを説明します。設定はプロジェクト内のすべてのパッケージの `src` に適用されます。設定が無い場合は TypeScript の承認を止めます。既存ファイルからチームの選択を推測することはありません。

```toml
schema_version = 2
languages = ["typescript"]

[typescript]
module_layout = "named-file"
code_representation = "class"
```

規則 `module-layout.configuration`・`module-layout.violation`・`module-layout.unresolved` の意味は、[Rust モジュール配置契約](rust-module-layout.ja.md)と同じです。

| 配置 | 親モジュール | 末端モジュール |
|---|---|---|
| `named-file` | `src/invoice.ts` | `src/invoice/line.ts` |
| `index-file` | `src/invoice/index.ts` | `src/invoice/line.ts` |

TypeScript のモジュールはファイルそのもので、親子を決める宣言はありません。ディレクトリ `src/invoice/` が自身の `index.ts` 以外の TypeScript ソースを持つとき、そのモジュールは親です。末端はどちらの配置でも名前付きファイルです。`src/index.ts` はパッケージの入口で、配置を判定するモジュールではありません。

## 検査する範囲

パッケージは `package.json` を持つディレクトリで、そのソースルートは直下の `src` です。検査はプロジェクト全体を走査し、`src` を持つすべてのパッケージを見つけて、その中の TypeScript モジュールの配置をすべて判定します。層、ドメインモデリングの状態、source-manifest の申告には依存しません。それ以外の場所の TypeScript（`src` の横の試験、ビルドスクリプト、設定ファイル、`src` を持たないワークスペースのルート）は、配置を判定するモジュールではありません。`src` 以外のソースルートは扱いません。

隠しエントリと aidlc・node_modules・vendor・target・dist は、Rust の検査と同じく走査から除外します。これらの外に `tsconfig.json` か TypeScript ソース（`.ts`・`.tsx`・`.mts`・`.cts`）があるとき、プロジェクトは TypeScript を持つとみなします。`package.json` だけでは TypeScript を持つとはみなしません。

次の構成は `module-layout.unresolved` として報告し、合格にしません。

| 構成 | 報告する場所 |
|---|---|
| 1つのモジュールを `src/invoice.ts` と `src/invoice/index.ts` の両方に置いている | 両方のファイル |
| 子を持つモジュールディレクトリに、どちらのモジュールファイルも無い | そのディレクトリ |
| 検査範囲内のシンボリックリンク（パッケージの外を指すものを含む） | そのリンク |
| `src` 内の TypeScript ソースのうち、モジュールファイルの名前にならないもの（`*.test.ts`、`*.d.ts`、`.tsx`、`.mts`、`.cts` など） | そのファイル |
| TypeScript を持つディレクトリで、名前がモジュール名にならないもの | そのディレクトリ |
| 別のパッケージの `src` の中にあるパッケージ | その `package.json` |
| 一覧を読めないディレクトリ | そのディレクトリ。上位のモジュールは重ねて判定しない |
| TypeScript の設定があるのに、`src` を持つパッケージが1つも無いプロジェクト | プロジェクトのルート（`.`） |

データファイルだけを持つディレクトリのように TypeScript を持たないディレクトリは、モジュールディレクトリではなく、モジュールに子を与えません。

## 承認と CI

blocking の `ddd-typescript-module-layout` センサーは、次の通常承認ゲートで実行されます。

| ステージ | 対象成果物 |
|---|---|
| code-generation | code-summary.md |
| build-and-test | build-and-test-summary.md |
| ci-pipeline | quality-gates.md |

TypeScript も `.ddd.toml` も持たないプロジェクトは対象外です。設定が typescript を名指しせず、TypeScript も持たないプロジェクトも対象外なので、Rust だけのプロジェクトはこのセンサーを通過します。TypeScript を持つのに `languages` が typescript を名指ししないプロジェクトは `module-layout.configuration` になります。

CI では、導入したコマンドを任意の作業ディレクトリから、アプリケーションプロジェクトのルートを指定して実行します。

```sh
bun /path/to/project/.codex/tools/ddd-check-typescript-module-layout.ts --project /path/to/project
```

Claude Code では `.claude/tools/` を使います。コマンドは JSON を出力し、1つ以上のパッケージを検査して所見が無い場合だけ 0 を返します。引数の誤り、パッケージ0件、解決できない構成、違反では 0 以外を返します。センサーとこのコマンドは同じ検査を呼ぶので、検査が適用されるプロジェクトでは同じ所見と同じ判定を返します。異なるのは対象外のプロジェクト（上で定義したもの）だけで、センサーは合格にし、このコマンドは検査したパッケージが0件のため 0 以外を返します。センサーの入口はフレームワークの JSON 判定プロトコルを使うもので、この CI コマンドの代わりにはなりません。検査はディレクトリの構成だけを読むので、どちらも事実抽出器を必要としません。

package.json や設定だけの変更、名前の変更、削除を含め、すべての変更でコマンドを実行してください。申告されたファイルや変更されたファイルで絞り込まないでください。型検査とアプリケーションの試験は別に維持します。ステージを単独で実行する場合は、完了を報告する前に同じコマンドの成功を確認してください。標準の AI-DLC 2.8.2 は、単独完了で一般のゲートセンサーを強制しません。

## 所見と移行

| 規則 | 対応 |
|---|---|
| module-layout.configuration | typescript を名指しする有効な設定をルートに1つだけ置き、入れ子の設定を削除する |
| module-layout.violation | 所見が示すパスへモジュールファイルを移動し、それを指す import を更新する |
| module-layout.unresolved | 重複を削除するか欠けたモジュールファイルを追加する。配置できないソースを `src` の外へ移す。リンクを実ファイルに置き換える。入れ子のパッケージを分離する |

親を `invoice/index.ts` から `invoice.ts` へ切り替えるときは、子を `invoice/` の下に残したまま旧ファイルを削除します。同じモジュールに両方のファイルは共存できません。モジュールが最後の子を失ったら、その `index.ts` を名前付きファイルへ移します。検査はファイルの配置だけを見て、import・export・コンパイルは検査しません。検査を通すためだけに利用者のコードを自動で移動したり、選んだ方針を書き換えたりしないでください。

正常・違反・境界の実行可能なケースは[対応表](../developers/sensor-coverage.ja.md)を参照してください。
