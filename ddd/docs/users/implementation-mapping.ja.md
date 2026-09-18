# 言語共通の実装写像

[English](implementation-mapping.md) | 日本語 | [利用者向け文書](README.ja.md)

`ddd-aggregate-mapping.md` の `schema_version: 2` は、モデルの実装場所を、特定の言語に縛られない形で記録します。業務上の識別（モデルID、業務語彙、実行モデル、永続化方式）は各エントリの第1階層に置きます。言語で書く名前（パッケージ、モジュールの位置、型、メソッド、エラーケース）は、その記述言語とともに `code` の下に置きます。同じ写像で、コマンド・生成操作をメソッドへ、業務エラーをケースへ対応付けます。

すべてのゲートがこの形式を読みます。version 1（Rust 専用の crate/module 形式）は、記録を移行する元の形式です。[各形式をゲートがどう扱うか](#各形式をゲートがどう扱うか)を参照してください。

## 何が変わるか

| 対象 | version 1 | version 2 |
|---|---|---|
| パッケージ | `crate: billing-domain` | `code.package: billing-domain` と `code.language` |
| モジュールの位置 | `module: crate::invoice::number` | `code.module: [invoice, number]`。パッケージのルートは `[]` |
| 集約の型 | 記録しない | `code.type` |
| ポートとリポジトリ | 業務IDと同じ階層の `ports`、`repository` | `code.ports`、`code.repository` |
| replay メソッド | `{ method, event_ref }` | `{ event_ref, code: { method } }` |
| コマンドと生成操作 | 記録しない | `operation_ref`、`code.method`、`code.error_type` を持つ `operations[]` |
| 業務エラー | 記録しない | `error_ref` と `code.case` を持つ `operations[].errors[]` |
| 業務語彙、実行モデル、永続化方式、参照ID | 各エントリの第1階層 | 変わらず各エントリの第1階層 |

モジュールの位置は要素のリストなので、特定の言語の区切り記号を形式に組み込みません。Rust の要素は綴りをそのまま保ちます。raw 識別子の `r#type` も同様で、`r#type` と `type` は同じモジュールを指します。

## Rust と TypeScript の例

正規モデルは `schema_version: 2` である必要があります（[操作ごとのエラー](domain-model-operation-errors.ja.md)を参照）。生成操作が自身の業務エラーを持てるのは、この形式だけだからです。

```yaml
schema_version: 2
model_ref: inception/ddd-domain-modeling/ddd-domain-model-yaml.md
aggregate_mappings:
  - aggregate_ref: aggregate.invoice
    programming_model: class
    persistence_method: event-sourcing
    reference_ids: [entity.invoice]
    replay_methods:
      - event_ref: event.invoice.issued
        code: { method: apply_issued }
    code:
      language: rust
      package: billing-domain
      module: [invoice]
      type: Invoice
      ports: [InvoiceNumbering]
      repository: InvoiceRepository
    operations:
      - operation_ref: command.invoice.issue
        code: { method: issue, error_type: IssueInvoiceError }
        errors:
          - error_ref: error.invoice.issue.already-issued
            code: { case: AlreadyIssued }
      - operation_ref: factory.invoice.open
        code: { method: open, error_type: OpenInvoiceError }
        errors:
          - error_ref: error.invoice.open.negative-amount
            code: { case: NegativeAmount }
domain_packages:
  - term: 請求
    model_refs: [bc.billing]
    rationale: 請求のドメインを所有する
    code: { language: rust, package: billing-domain, module: [] }
  - term: 請求書
    model_refs: [aggregate.invoice]
    rationale: 請求書の状態と操作をまとめる
    code: { language: rust, package: billing-domain, module: [invoice] }
```

同じモデルに対する TypeScript の写像は、`code` の下だけが異なります。業務ID、用語、所有関係はすべて同じです。

```yaml
    replay_methods:
      - event_ref: event.invoice.issued
        code: { method: applyIssued }
    code:
      language: typescript
      package: "@acme/billing-domain"
      module: [invoice]
      type: Invoice
    operations:
      - operation_ref: command.invoice.issue
        code: { method: issue, error_type: IssueInvoiceError }
        errors:
          - error_ref: error.invoice.issue.already-issued
            code: { case: already-issued }
```

所有関係は位置から読み取るため、エントリと所有者を結ぶ追加のキーはありません。集約は、その `code` の位置に宣言されたパッケージに属します。パッケージの親は、モジュールの要素を1つ上がった位置のパッケージです。操作は並べられた集約に、エラーケースは並べられた操作に属します。集約ごとに記述言語を書くため、1つの記録に異なる言語の集約を含められます。ただし、集約とその位置のパッケージは同じ言語でなければなりません。

例に現れるキーが、使えるキーのすべてです。`replay_methods`、`code.ports`、`code.repository` は省略できます。それ以外のキーは `operations` と `errors` を含めて必須で、`reference_ids` と `model_refs` は1件以上必要です。

## 各言語で使える名前

| 名前 | Rust | TypeScript |
|---|---|---|
| `code.package` | `^[A-Za-z][A-Za-z0-9_-]*$` | npm のパッケージ名。スコープ付きも可: `^(?:@[a-z0-9][a-z0-9._~-]*/)?[a-z0-9][a-z0-9._~-]*$` |
| `code.module` の要素 | 識別子。raw 識別子も可: `^(?:r#)?[A-Za-z_][A-Za-z0-9_]*$` | `^[A-Za-z_$][A-Za-z0-9_$-]*$` |
| `code.type`、`code.method`、`code.error_type` | `^[A-Za-z_][A-Za-z0-9_]*$` | `^[A-Za-z_$][A-Za-z0-9_$]*$` |
| `code.case` | Rust の識別子 | 空でない任意の文字列 |

`invoice.rs` や `invoice.ts` のようなファイル名、ソースの行、`billing-domain@0.1.0` のようなバージョン付きの名前は、名前として扱わず拒否します。Rust では1つの集約のメソッド名が1つの名前空間を共有するため、コマンドと生成操作の両方に `issue` を使えません。TypeScript では生成操作は static メンバー、コマンドはインスタンスメンバーなので、同じ名前を使えます。

## ローダーが拒否すること

ローダーは、文書、版、構造、名指しされた正規モデル、そのモデルに対する写像の順に確認し、最初に失敗した段階で止まります。

| 規則 | 拒否する内容 |
|---|---|
| `aggregate-mapping.document` | `<record>/inception/domain-design/ddd-aggregate-mapping.md` 以外のパス、存在しない・読めないファイル、ラベル付き YAML ブロックがない・2つ以上ある・閉じていない、YAML として解析できない、ブロックがマッピングでない |
| `aggregate-mapping.version` | 数値の `2` 以外の `schema_version`。version 1 の文書をこの形式として読むことはなく、所見は移行を案内する |
| `aggregate-mapping.unknown-key` | 形式にないキー。業務IDと同じ階層の `crate`・`module`、コンパイラのシンボルIDやパッケージID、ファイル・行・範囲、export の一覧など |
| `aggregate-mapping.structure` | 値の欠落や型の違い、対応していない言語、空白だけの用語・理由、空の `reference_ids`・`model_refs`、`actor`・`class` 以外の実行モデル、`state-sourcing`・`event-sourcing` 以外の永続化方式、その言語で使えない名前 |
| `aggregate-mapping.model` | `schema_version: 2` の正規モデルとして読めない `model_ref`。version 1 のままのモデルも含む |
| `aggregate-mapping.reference` | 未定義、廃止済み、種別違い、またはモデルIDでない（`src/invoice.rs:12` など）`aggregate_ref`、`model_refs` の要素、`reference_ids` の要素、`event_ref`、`operation_ref`、`error_ref` |
| `aggregate-mapping.owner-mismatch` | IDが解決できても、他の集約の操作や、他の操作が宣言するエラーを並べたもの |
| `aggregate-mapping.duplicate` | 同じ位置の2つのパッケージ、同じ集約の二重の写像、同じ型への2つの集約、同じ操作・エラーの二重の写像、同じメソッドへの2つの操作、同じケースへの2つのエラー |
| `aggregate-mapping.coverage` | ルートパッケージのないパッケージの使用、親が宣言されていないパッケージ、位置にパッケージのない集約、写像のないモデルの集約、`code.type` のない集約、写像のないモデルのコマンド・生成操作・業務エラー |
| `aggregate-mapping.technical-name` | 技術分類（`aggregate`、`impl`、`vo`、`entities`、`value_objects` など、[予約名](domain-packaging-design.ja.md#技術分類名の機械検査)の一覧）で名付けたパッケージやモジュールの要素、および `domain` だけの名前のパッケージ |

予約名は名前の全体で照合します。部分文字列でも、名前に含まれる一語でもありません。パッケージ名は小文字化し、末尾の `-domain` 標識を外し、`-` を `_` と読み替えます。TypeScript のパッケージ名はさらにスコープを外し、`.` を `_` と読み替えます。モジュール要素も同じ扱いで、`-` を `_` と読み替えて比較します。`value-objects`、`ValueObjects`、`@acme/value-objects-domain` は名前そのものが技術分類なので拒否します。`identity` や `invoice-entities` は、予約語で終わるだけの業務用語なので拒否しません。業務用語としての適切さは、引き続きレビューで確認します。

ローダーが照合する相手は正規モデルだけです。名指しされたパッケージ・型・メソッド・ケースがソースに実在するかは、後続の検査で確認します。

## 各形式をゲートがどう扱うか

承認時に写像を読む経路はいずれも `schema_version: 2` を読みます。version 1 のままの文書は、別の形式として読み替えることなく拒否します。

| 写像を読む経路 | センサー | version 1 の写像に対する結果 |
|---|---|---|
| domain-design の写像検査 | `ddd-mapping-declarations` | `mapping-declarations.document` |
| domain-design の参照解決 | `ddd-reference-ids` | `reference-ids.document` |
| functional-design の Process Manager 要否の判定 | `ddd-mapping-declarations` | 写像を対象とする `mapping-declarations.document` |
| ドメインパッケージ検査 | `ddd-rust-domain` | `domain-packaging.declaration` |
| 規則評価コンテキストでの replay メソッド照合 | `ddd-rust-domain`、`ddd-rust-use-case`、`ddd-rust-interface-adapter` | 無効になり、`replay.disabled: aggregate mapping is invalid` と注記する |

写像が存在しないことと、存在するが読めないことは別の事実です。functional-design では、写像が存在しなければ Process Manager の要否を評価せずその旨を判定結果に注記しますが、存在して読めない写像はブロック要因になります。`ddd-layer-structure` は写像を読みません。集約のコードの置き場所は、そのコンテキストが集約を復元すべきかどうかを決めないためです。

この形式は version 2 の正規モデルを必要とし、ゲートもその版を読みます。設定・モデル・写像・レイヤー宣言をまとめて変換し、書き込む前に相互の整合を検査する[`ddd-artifact-set migrate`](artifact-migration.ja.md)で、記録一式を一度に移行してください。

ゲートが報告する所見は、この形式の読込処理の所見を、承認契約が宣言する規則IDへ転記したものです。読込処理が名指しした欠陥（軸の欠落、未知のキー、重複、未写像の操作など）は、読込処理の規則IDをメッセージ先頭に付けた `mapping-declarations.document` として報告します。正規モデルを読めなかった場合は `mapping-declarations.model`、パッケージ名が技術分類になっている場合は `domain-packaging.technical-name` です。

## 写像を読む

```ts
import { loadAggregateMapping, packageAt } from "/path/to/project/.codex/tools/ddd/lib/aggregate-mapping/index.ts";

const loaded = loadAggregateMapping("/path/to/record/inception/domain-design/ddd-aggregate-mapping.md");
if (loaded.ok) {
  const invoice = loaded.mapping.aggregate_mappings[0];
  const owner = packageAt(loaded.mapping, invoice.code);
}
```

Claude Code では `.claude/tools/` を使います。成功時の結果は、正規化された写像と、正規モデルの要素索引を持ちます。失敗時は所見を持ちます。正規化された写像は常に `replay_methods` と `code.ports` を持ち、文書で省略された場合は空リストになります。`parentLocation(location)` は、モジュールの要素を1つ上がった位置を返し、パッケージのルートでは `undefined` を返します。

## 移行の preview と適用

先に `ddd-domain-model.ts migrate` で正規モデルを移行してください。モデルが version 1 のままの旧形式の写像は、`aggregate-mapping.model` で拒否します。

```sh
bun /path/to/project/.codex/tools/ddd-aggregate-mapping.ts migrate \
  --mapping /path/to/record/inception/domain-design/ddd-aggregate-mapping.md \
  --supplement /path/to/mapping-supplement.yaml
```

Claude Code では `.claude/tools/` を使います。`--apply` を付けない限り報告だけで、`--apply` を付けると文書を書き換えます。コマンドは JSON を1件出力し、`outcome` が結果を名指しします。終了コードだけに区別を依存させる必要はありません。

| `outcome` | 終了コード | 意味 |
|---|---|---|
| `candidate` | 0 | 適用できる preview。`mapping` が候補 |
| `missing-information` | preview は 0、`--apply` 付きは 1 | `missing` が、まだ与えていない名前を列挙する |
| `already-migrated` | 0 | すでにこの形式で、読込にも成功する。何も書き換えず、補足入力も読まない |
| `applied` | 0 | YAML ブロックを `mapping` の内容へ置き換えた |
| `rejected` | 1 | `findings` が拒否の内容を示す。不足よりも欠陥を先に報告する |
| `write-failed` | 3 | 検証は成立したが、ファイルへ書き込めなかった |
| `invalid-arguments` | 2 | `detail` が使い方を示す |

対象は、記録ディレクトリの中にある登録済みの成果物だけです。`inception/domain-design/ddd-aggregate-mapping.md` を含むディレクトリを記録ディレクトリとみなし、`model_ref` はそこを基準に解決します。

### version 1 に書けない情報を補う

version 1 には型名、操作の写像、エラーケースを書く場所がありません。移行はこれらをモデルの名前やIDから作りません。補足入力がなければ、すべてを列挙します。

```json
{
  "outcome": "missing-information",
  "missing": [
    "aggregate_mappings[aggregate.invoice].code.type",
    "aggregate_mappings[aggregate.invoice].operations[command.invoice.issue]",
    "aggregate_mappings[aggregate.invoice].operations[factory.invoice.open]"
  ]
}
```

並び順は、文書の集約の順と、集約の中ではモデルの順です。型、各コマンドと生成操作の順に並び、写像済みの操作については、まだ足りないエラーを並べます（`...operations[<操作>].errors[<エラー>]`）。

名前は YAML ファイルに書き、`--supplement` で渡します。

```yaml
aggregate_mappings:
  - aggregate_ref: aggregate.invoice
    code: { type: Invoice }
    operations:
      - operation_ref: command.invoice.issue
        code: { method: issue, error_type: IssueInvoiceError }
        errors:
          - error_ref: error.invoice.issue.already-issued
            code: { case: AlreadyIssued }
```

このファイルは Markdown ではなく YAML そのものです。ルートはマッピングでなければならず（そうでなければ `aggregate-mapping.document`）、キーは `aggregate_mappings` だけです。各行は旧形式の文書が写像している集約を1回だけ名指しし、version 2 と同じ形の `aggregate_ref`、`code.type`、`operations` だけを持てます。名前はその集約の言語で検査します。実行モデル、パッケージ、モジュールなど、それ以外は `aggregate-mapping.unknown-key` で拒否します。そのため補足入力は旧形式の文書に追加するだけで、上書きはできません。ファイルが存在しない・解析できない場合は `aggregate-mapping.document` で拒否し、補足入力自体の内容に関する所見はすべて補足入力のファイルを名指しします。

## 移行が作り出さないもの

与えていない型、メソッド、エラー型、ケースを書くことはなく、コマンドIDやモデルの名前からそれらを作ることもありません。旧形式の文書に書かれていることは、すべてそのまま移ります。集約IDと参照ID、実行モデル、永続化方式、ポート、リポジトリ、replay メソッド、各パッケージの用語・モデル参照・理由、およびその記述言語です。用語にたまたま `crate::invoice` という字面が含まれていても、それは業務上の値であってキーではありません。変換は字面の置換ではなく構造の解析で行います。

crate は `code.package` になり、モジュールの位置は `::` の区切りと先頭の `crate` だけを除きます。`crate` は `[]`、`crate::invoice` は `[invoice]`、`invoice::number` は `[invoice, number]` になり、`r#type` は `[r#type]` のままです。`invoice/number`、`::invoice`、`invoice::`、空文字列のように Rust のパスでないモジュールは拒否します。本番の読込処理が黙って変換したり捨てたりする内容も拒否します。読込処理が無視するキー、1つの文字列で書いた `ports`、文字列でない参照ID・リポジトリ・用語、`domain_packages` のない文書です。

## 適用が書き換える範囲

適用が置き換えるのは、ラベル付き YAML ブロック1つの本文だけです。周囲の散文、フェンスの記号、他のフェンス、および周辺のファイルはバイト列のまま残ります。正規モデル、レビュー用の文書、メモ、`.ddd.toml` には触れません。

適用時は両方のファイルを読み直して検証し直すため、以前の preview が成功したことを理由に、その後の変更が適用されることはありません。適用済みの文書へ同じコマンドを再実行すると `already-migrated` を報告し、バイト列はそのままです。書込に失敗した場合は `write-failed` を報告し、文書は元のまま残ります。新しい文書はコマンド自身が作る隣のエントリへ書き出し、書き終えてから元の位置へ置き換えるため、登録済みの位置には元のバイト列か新しい文書全体のどちらかしか現れず、書きかけの文書は現れません。失敗しても自分で作ったエントリは残しません。写像文書がシンボリックリンクの場合は `write-failed` で拒否するため、リンクとそのリンク先はバイト列のまま残ります。通常のファイルに置き換えてから実行してください。レコードから写像文書までの間にあるディレクトリ（`domain-design` など）がシンボリックリンクの場合も `write-failed` で拒否し、リンク先のファイルはバイト列のまま残ります。通常のディレクトリに置き換えてから実行してください。適用は読み込んだ内容から文書全体を組み立て直すため、同じファイルを書き換える処理と並行して移行を実行しないでください。相手の変更が失われます。

置き換えられたブロックは正規化された写像から生成します。文字列はすべて引用符で囲まれ、リストは1行1項目で書かれます。`code.module`、`operations`、`errors`、`aggregate_mappings`、`domain_packages` は空でも書き出し、空の `ports`、空の `replay_methods`、存在しない `repository` は省略します。

## export の一覧は持たない

写像が名指しするのは、正規モデルが必要とするもの（パッケージ、集約の型、操作、エラーケース）だけです。パッケージのすべての export を並べることはなく、そのためのキーもありません。公開 API を手作業でもう1つ管理すると、コードとずれていくためです。実際の公開範囲の確認は、ソースの検査が担います。
