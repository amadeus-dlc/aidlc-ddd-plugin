# 言語共通のプロジェクト設定

[English](project-settings.md) | 日本語 | [利用者向け文書](README.ja.md)

プロジェクトが使う言語と、言語ごとの選択を、アプリケーションプロジェクト直下（`aidlc/` と同じ階層）の `.ddd.toml` に宣言します。この文書の形式はこのページが定めます。[モジュール配置契約](rust-module-layout.ja.md)は、その `rust.module_layout` 軸がRustソースに対して何を意味するかを説明します。既存ソースから選択を推測することはなく、設定が無い場合や不正な場合は補完せず拒否します。

```toml
schema_version = 2
languages = ["rust", "typescript"]

[rust]
module_layout = "file"

[typescript]
module_layout = "named-file"
code_representation = "class"
```

`languages` には実際に使う言語だけを書き、その言語に必要な選択軸をすべて宣言します。`languages` に無い言語のテーブルは書かないでください。配置とコード表現は別の軸で、片方を変えてももう片方は変わりません。

| 選択軸 | 値 | 意味 |
|---|---|---|
| `rust.module_layout` | `file` / `mod-rs` | 親が `src/invoice.rs` / 親が `src/invoice/mod.rs`。末端はどちらも `src/invoice/line.rs` |
| `typescript.module_layout` | `named-file` / `index-file` | 親が `src/invoice.ts` / 親が `src/invoice/index.ts`。末端はどちらも `src/invoice/line.ts` |
| `typescript.code_representation` | `class` / `companion` | class による表現か、型と同名コンパニオンによる表現か |

TypeScript のソースルートは、パッケージのルート（`package.json` のあるディレクトリ）直下の `src` です。モジュールを置くファイルを決めるのは、実装写像ではなくこの設定です。実装写像の `code.module` はモジュールパスだけを述べます。モジュールパス `[m1, …, mn]` のファイルは次のとおりです。

| `typescript.module_layout` | モジュールのファイル |
|---|---|
| `named-file` | `src/m1/…/mn.ts` |
| `index-file` | 子を持つモジュールは `src/m1/…/mn/index.ts`、末端のモジュールは `src/m1/…/mn.ts` |

[操作エラー集合の照合](../developers/operation-error-set.ja.md)（`operation-error-set/1`）は、この規約で、観測が指すファイルが写像したモジュールのファイルかを検査します。`src` 以外のソースルートは扱いません。

集約の実行モデルと永続化方式は `ddd-aggregate-mapping.md` が持ち続けます。ここに `programming_model` や `persistence_method` を書くと拒否されます。集約の実行モデルとしての `class` と、TypeScript のコード表現としての `class` は別物です。

## 各形式を検査がどう扱うか

Rust モジュール配置検査は、`ddd-check-rust-module-layout.ts` と `ddd-rust-module-layout` ゲートセンサーの両方の入口でこの形式を読みます。Rust の配置だけを書いていた `schema_version = 1` のままの文書は、移行の案内を添えた `module-layout.configuration` として報告します。

プロジェクトが名指しした言語が、配置検査のすべきことを決めます。`rust` を名指しせず、Cargo マニフェストも `.rs` ファイルも持たないプロジェクトには検査すべき Rust の配置がなく、検査は何も報告しません。`rust` を名指ししていないのにそのどちらかを持つプロジェクトは `module-layout.configuration` になります。設定が説明していない Rust を持っているためです。

1つの記録の正規モデル・実装写像・レイヤー宣言とあわせて設定を変換する[`ddd-artifact-set migrate`](artifact-migration.ja.md)で、プロジェクト一式を一度に移行してください。

## 読込と検証

```ts
import { readProjectSettings } from "/path/to/project/.codex/tools/ddd/lib/project-settings/index.ts";

const outcome = readProjectSettings("/path/to/project");
if (outcome.kind === "validated") console.log(outcome.selection);
else console.log(outcome.rejection.reason, outcome.rejection.subject, outcome.rejection.missing);
```

読込はゲートセンサーを起動せず、プロジェクトのソースも解析しません。拒否結果は、対象ファイル、拒否理由、問題のキーまたは不足項目を示します。TOML の解析器が位置情報を返さないため、行・桁は持ちません。

プロジェクトを設定するのはルートの文書だけです。探索対象の下位ディレクトリで見つかった `.ddd.toml` は拒否され、`rejectedDocuments` にパスが列挙されます。探索は隠しエントリと `node_modules`・`target`・`vendor`・`dist`・`aidlc` を読み飛ばし、その中へは降りません。そこに置かれた文書は採用も報告もされません。これはプロジェクト内の `.ddd.toml` をすべて検出する手段ではありません。

## 移行の preview・補完・適用

`schema_version = 1` のままの Rust プロジェクトでこのコマンドを使います。`--apply` を付けない限り報告だけで、何も書き換えません。

```sh
bun /path/to/project/.codex/tools/ddd-project-settings.ts migrate --project /path/to/project
```

Claude Code では `.claude/tools/` を使います。コマンドは JSON を1件出力し、`outcome` が結果を名指しします。終了コードだけに区別を依存させる必要はありません。

| `outcome` | 終了コード | 意味 |
|---|---|---|
| `candidate` | 0 | 適用できる preview。`selection` が候補 |
| `missing-information` | preview は 0、`--apply` 付きは 1 | `missing` が、まだ与えていない値を列挙する |
| `already-migrated` | 0 | すでにこの形式。何も書き換えない |
| `applied` | 0 | ルート文書を `selection` の内容へ置き換えた |
| `rejected` | 1 | `reason` と `subject` または `missing` が拒否の理由を示す |
| `write-failed` | 3 | 検証は成立したが、ファイルを置き換えられなかった |
| `invalid-arguments` | 2 | `detail` が使い方を示す |

Rust の配置は移行の前後で意味が変わりません。TypeScript の値が旧設定から作り出されることはありません。TypeScript を使う場合は、2つの値を自分で指定してください。

```sh
bun /path/to/project/.codex/tools/ddd-project-settings.ts migrate --project /path/to/project \
  --typescript-layout named-file --typescript-representation class --apply
```

2つのうち片方だけを与えた場合は `missing-information` を報告し、適用しません。適用時は文書を読み直して検証し直すため、以前の preview が成功したことを理由に不正な入力が適用されることはありません。適用済みの文書へ同じコマンドを再実行すると `already-migrated` を報告し、バイト列はそのままです。

適用が置き換えるのはルートの `.ddd.toml` だけです。ソース、生成コード、正規モデル、集約写像、レイヤー宣言のバイト列は変わりません。置き換えは同じディレクトリに用意した一時ファイルの rename で行うため、書込に失敗しても中途半端な文書は残りません。ルートの `.ddd.toml` がシンボリックリンクの場合は `write-failed` で拒否します。rename がリンク先ではなくリンク自体を置き換えてしまうためです。読込から rename までの間に別の書き手が加えた変更は検出しません。同じファイルを書き換える処理と並行して移行を実行しないでください。

## 拒否されたときの直し方

| `reason` | 直し方 |
|---|---|
| `file-absent` | プロジェクト直下に `.ddd.toml` を作り、このページ冒頭の内容を書く |
| `unreadable` | 読み取れる通常ファイルにする。同名のディレクトリは文書ではない |
| `malformed-syntax` | TOML を直す。メッセージは解析器の内容で、同じキーを二度定義することはできない |
| `nested-config-found` | `rejectedDocuments` の各パスを削除または移動する。設定するのはルート文書だけ |
| `aggregate-mapping-leak` | `programming_model` と `persistence_method` を削除する。これらは `ddd-aggregate-mapping.md` の持ち物 |
| `version-missing` | `schema_version = 2` を追加する |
| `legacy-modern-mixed` | 文書が `schema_version = 1` である。版を手で書き換えず、上記コマンドで移行する |
| `version-unknown` | `schema_version` を整数の `2` にする |
| `duplicate-choice-on-axis` | `subject` が複数の方式を持つ軸を示す。1つだけ残す |
| `unknown-key-or-value` | `subject` が契約外のキー・テーブル・値を示す。このページの表の値を使う |
| `type-mismatch` | `subject` が型の誤った値を示す。言語名は配列、各軸は文字列1つ |
| `required-choice-missing` | `missing` が宣言すべき項目を示す。`languages`、または使用中の言語の選択軸 |

## 限定共通検査への受け渡し

`bindInspectionInput` は検証済みの選択を検査入力へ入れます。この値は要求識別に参加するため、同じソースでも妥当な選択が違えば別の要求になり、同じ選択からは常に同じ要求が得られます。

選択と要求対象が食い違う場合は、要求を組み立てる前に拒否します。設定が `companion` なのに `ts-class` を要求した場合や、設定が使用中にしていない言語を要求した場合は `input-rejected` を返します。利用者が選んでいない表現を抽出器が代用することはありません。この受け渡しを経ずに抽出器へ届いた設定は、黙って無視せず `unsupported-syntax` として報告します。選んだ配置は渡されますが抽出内容を変えることはなく、同じソースならどちらの配置でも同じ根拠が得られます。
