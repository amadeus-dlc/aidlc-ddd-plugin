# 言語共通のレイヤー宣言

[English](layer-declaration.md) | 日本語 | [利用者向け文書](README.ja.md)

`cicd-pipeline.md` の `## DDD Layer Structure` 節の `schema_version: 2` は、文脈の依存規約を、特定の言語に縛られない形で記録します。どのパッケージが CQRS のどちら側か、どのパッケージが何に依存するか、文脈が経由するポート、集約を復元するリポジトリ、その背後の永続化基盤は業務上の事実であり、そのまま残ります。言語で書く名前はパッケージの識別だけで、パッケージはその名前を綴る言語と名前の組で識別します。

version 1（Rust 専用の crate 形式）は、引き続きすべての本番センサーが読む形式です。自動で切り替わることはありません。[この形式が今どこまで使われるか](#この形式が今どこまで使われるか)を参照してください。

## 何が変わるか

| 対象 | version 1 | version 2 |
|---|---|---|
| コマンド側 | `command_side_crates: [billing-domain]` | `role: command` の `packages[]` |
| クエリ側 | `query_side_crates: [billing-query]` | `role: query` の `packages[]` |
| 読み取りモデル更新 | `rmu_crates: [billing-rmu]` | `role: rmu` の `packages[]` |
| パッケージ | 上記リストの中の crate 名 | `code: { language, package }` |
| 依存関係 | `crate_dependencies[] { crate, depends_on: [crate] }` | `dependencies[] { code, depends_on: [code] }` |
| 文脈、cqrs、ポート、リポジトリ、復元経路、永続化基盤 | 宣言どおり | 変更なし。宣言どおり |

パッケージを名前だけで指すことはありません。Rust の `billing-domain` と TypeScript の `billing-domain` は別のパッケージであり、`packages` の要素や依存先を名前だけで書いた宣言は拒否します。

## Rust と TypeScript の例

正規モデルは `schema_version: 2` である必要があります（[操作ごとのエラー](domain-model-operation-errors.ja.md)を参照）。

```yaml
schema_version: 2
model_ref: inception/ddd-domain-modeling/ddd-domain-model-yaml.md
layer_structures:
  - context_ref: bc.billing
    cqrs: true
    packages:
      - role: command
        code: { language: rust, package: billing-domain }
      - role: query
        code: { language: rust, package: billing-query }
      - role: rmu
        code: { language: rust, package: billing-rmu }
    dependencies:
      - code: { language: rust, package: billing-domain }
        depends_on: []
      - code: { language: rust, package: billing-query }
        depends_on: []
      - code: { language: rust, package: billing-rmu }
        depends_on:
          - { language: rust, package: billing-domain }
          - { language: rust, package: billing-query }
    ports:
      - { name: InvoiceNumbering, kind: external-client, verbs: [next_number] }
    repositories:
      - name: InvoiceRepository
        aggregate_ref: aggregate.invoice
        io_unit: single
        verbs: [find_by_id, store, delete_by_id]
        store_semantics: upsert
    restoration_paths:
      - { aggregate_ref: aggregate.invoice, via: full-constructor }
    persistence_backend: postgres
```

同じ文脈の TypeScript 宣言は、パッケージの綴り方だけが異なります。文脈、側、依存辺、ポート、リポジトリ、復元経路、永続化基盤といった業務上の値はすべて同じです。

```yaml
    packages:
      - role: command
        code: { language: typescript, package: "@acme/billing-domain" }
      - role: query
        code: { language: typescript, package: "@acme/billing-query" }
```

ここに挙げたキーが全体です。省略できるのは `restoration_paths[].note` だけで、他のキーはすべて必須です。中身のないリストは、キーを省略せず `[]` と書きます。

| キー | 値 |
|---|---|
| `packages[].role` | `command`、`query`、`rmu` |
| `code.language` | `rust`、`typescript` |
| `ports[].kind` | `repository`、`external-client`、`es-infrastructure` |
| `repositories[].io_unit` | `single`、`collection`、`partial` |
| `repositories[].store_semantics` | `upsert`、`insert-only`、`unknown` |
| `restoration_paths[].via` | `full-constructor`、`other` |

`code.package` は言語ごとの文法で照合します。Rust は `^[A-Za-z][A-Za-z0-9_-]*$`、TypeScript は npm のパッケージ名（スコープ付きも可）です。`billing-domain@0.1.0` のようなバージョン付きの名前は、パッケージ名として扱わず拒否します。

## ローダーが拒否すること

ローダーは、文書、版、構造、名指しされた正規モデル、そのモデルに対する宣言、形式が求める値をすべて述べているか、の順に確認し、最初に失敗した段階で止まります。

| 規則 | 拒否する内容 |
|---|---|
| `layer-declaration.document` | `<record>/construction/<unit>/infrastructure-design/cicd-pipeline.md` 以外のパス、存在しない・読めないファイル、`## DDD Layer Structure` 節がない・2つ以上ある（英日の見出しは合わせて数える）、その節の中にラベル付き YAML ブロックがない・2つ以上ある・閉じていない、YAML として解析できない、ブロックがマッピングでない |
| `layer-declaration.version` | 数値の `2` 以外の `schema_version`。version 1 の文書をこの形式として読むことはなく、所見は移行を案内する |
| `layer-declaration.unknown-key` | 形式にないキー。`command_side_crates`、`query_side_crates`、`rmu_crates`、`crate_dependencies`、パッケージの役割と同じ階層の `crate`、パッケージ識別の中のモジュールの位置やバージョンを含む |
| `layer-declaration.structure` | 値の欠落や型の違い、真偽値でない `cqrs`、集合の外にある役割・ポート種別・入出力単位・保存意味・復元経路、名前だけで書いた、または言語のないパッケージ識別、その言語で使えない名前、文書がまったく述べていない値 |
| `layer-declaration.model` | `schema_version: 2` の正規モデルとして読めない `model_ref`。version 1 のままのモデルも含む |
| `layer-declaration.reference` | 文脈を指さない `context_ref`、集約を指さないリポジトリ・復元経路の `aggregate_ref`。未定義、系譜で廃止済み、種別違い、モデルIDでないものを含む |
| `layer-declaration.duplicate` | 同じ文脈の2つの structure、二重に宣言したパッケージ識別、同じパッケージの2つの依存行、1つの依存行の中で2回名指ししたパッケージ、同じ名前の2つのポート、同じ名前の2つのリポジトリ、同じ集約の2つの復元経路 |
| `layer-declaration.coverage` | この文脈が宣言していないパッケージの依存行。依存先には文脈の外のパッケージも書ける。その依存辺は書かれたとおりに保持し、`layer-declaration.query-domain-dependency` はパッケージ名で判定する |

リストが空になるのは、文書がそう書いたときだけです。`verbs: []` は空のリストを述べていますが、`verbs` を書かないことは何も述べておらず、拒否します。

## 層構造を検査する

宣言を読むことと、その層構造を判定することは別の入口です。移行が作ったばかりの宣言を、判定の前に読めます。層構造をレビューする側は、文書を読み直させる必要がありません。検査は所見だけを返します。

| 規則 | 報告する内容 |
|---|---|
| `layer-declaration.required-items` | 依存関係・ポート・リポジトリ・復元経路のうち、少なくとも1つが空の文脈 |
| `layer-declaration.dependency-row` | 依存行のない宣言済みパッケージ |
| `layer-declaration.cqrs-sides` | `cqrs: true` でありながら `role: query` のパッケージを宣言していない文脈 |
| `layer-declaration.side-dependency` | クエリ側に依存するコマンド側のパッケージ、およびその逆 |
| `layer-declaration.query-domain-dependency` | ドメイン層の標識（末尾の `-domain` または `_domain`）を持つ名前のパッケージに依存するクエリ側のパッケージ。TypeScript のスコープを外してから読むため、`@acme/shared-domain` は該当し、`@acme/shared-read-models` は該当しない |
| `layer-declaration.restoration-path` | `full-constructor` の復元経路がない、その文脈の集約 |

`role: rmu` のパッケージは、両側を見ることが役割そのものなので、その依存行には `layer-declaration.side-dependency` も `layer-declaration.query-domain-dependency` も適用しません。残る4つの規則は、他のパッケージと同じように適用します。リポジトリの命名規則（`layer-structure.m-name`、`layer-structure.m-media`）は移していません。1つの言語の綴り規約であり、この形式のリポジトリは言語を持たないためです。

## この形式が今どこまで使われるか

移行後の文書を読むのは、このページの読込入口、構造検査、移行コマンドです。**本番センサーはレイヤー宣言の `schema_version: 2` に対応していません。** `ddd-layer-structure` は version 1 を要求し、移行後の宣言を `layer-structure.item` として報告します。`ddd-design-advisories` も同じ version 1 の節を読みます。`infrastructure-design` の生成指示も引き続き version 1 を生成します。またこの形式は正規モデルの version 2 を必要としますが、こちらも本番センサーは受け付けません。

移行の適用は、これらのゲートが成果物に対して所見を出す状態を受け入れられる場所に限ってください。承認ゲートが読む成果物は、後のリリースで切り替わるまで version 1 のままにしてください。

## 宣言を読んで検査する

```ts
import {
  inspectLayerDeclaration,
  loadLayerDeclaration,
} from "/path/to/project/.codex/tools/ddd/lib/layer-declaration/index.ts";

const path = "/path/to/record/construction/u1/infrastructure-design/cicd-pipeline.md";
const loaded = loadLayerDeclaration(path);
if (loaded.ok) {
  const findings = inspectLayerDeclaration(loaded.declaration, loaded.model, path);
}
```

Claude Code では `.claude/tools/` を使います。成功した結果は、正規化済みの宣言、正規モデル、その要素索引を持ちます。失敗した結果は所見を持ちます。

## 移行を試して適用する

先に `ddd-domain-model.ts migrate` で正規モデルを移行してください。モデルが version 1 のままの crate 形式の宣言は `layer-declaration.model` で拒否します。

```sh
bun /path/to/project/.codex/tools/ddd-layer-declaration.ts migrate \
  --declaration /path/to/record/construction/u1/infrastructure-design/cicd-pipeline.md
```

Claude Code では `.claude/tools/` を使います。`--apply` がなければ報告だけを行い、`--apply` を付けるとブロックを書き換えます。結果は JSON 1件で出力し、`outcome` が結果を名指しするため、終了コードだけを読む必要はありません。

| `outcome` | 終了コード | 意味 |
|---|---|---|
| `candidate` | 0 | 適用できる変換候補。`declaration` がその内容 |
| `missing-information` | preview は 0、`--apply` は 1 | まだ述べていない値を `missing` が列挙する |
| `already-migrated` | 0 | すでにこの形式であり、読める。何も書き換えない |
| `applied` | 0 | YAML ブロックを `declaration` で置き換えた |
| `rejected` | 1 | `findings` が拒否の理由。欠落の報告より先に defect を報告する |
| `write-failed` | 3 | 検証は通ったが、ファイルを書けなかった |
| `invalid-arguments` | 2 | 不明なコマンドやオプション、値の欠落、`--declaration` の重複指定。`detail` が使い方を示す |

受け付けるのは intent レコード内の登録済み成果物だけです。レコードは `construction/<unit>/infrastructure-design/cicd-pipeline.md` を含むディレクトリで、`model_ref` はそこを基準に解決します。`functional-spec.md` や、別の場所に置いた pipeline 文書の写しは `layer-declaration.document` で拒否し、そのまま残します。

### version 1 が自動で補っていた値を述べる

crate 形式のリーダーは、`cqrs` がなければ `false`、ポート種別がなければ `""`、保存意味がなければ `"unknown"`、verbs がなければ `[]` を補います。移行はこれを行いません。文書が何も述べていない箇所は、述べていないと報告します。

```json
{
  "outcome": "missing-information",
  "missing": [
    "layer_structures[bc.billing].cqrs",
    "layer_structures[bc.billing].ports[InvoiceNumbering].kind",
    "layer_structures[bc.billing].ports[InvoiceNumbering].verbs",
    "layer_structures[bc.billing].repositories[InvoiceRepository].io_unit",
    "layer_structures[bc.billing].repositories[InvoiceRepository].verbs",
    "layer_structures[bc.billing].repositories[InvoiceRepository].store_semantics",
    "layer_structures[bc.billing].restoration_paths[aggregate.invoice].via"
  ]
}
```

並び順は文書の structure 順、structure の中では上記の順です。不足している値は、同じ version 1 のブロックに書き足してください。いずれも version 1 がすでに持っているキーです。書き足したうえで、移行を再実行します。

## 移行が作り出さないもの

述べていない cqrs、ポート種別、入出力単位、保存意味、復元経路を、コマンドが書くことはありません。crate 形式の宣言が述べていることは、そのまま持ち越します。文脈参照、crate 名、依存辺、ポート名、リポジトリ名、集約参照、復元経路の備考、永続化基盤を、書かれた言語のまま持ち越します。`persistence_backend` の値そのものが `crate: billing-domain` という字面を含んでいても、それは業務上の値であってキーではありません。変換は文字列の置換ではなく構造として行うため、ブロックの外の本文や他の節の中の旧キーの字面には届きません。

本番リーダーが黙って強制変換・欠落させる内容は、代わりに拒否します。本番リーダーが無視するキー、1つの文字列として書かれた crate リスト、`"true"` と書かれた `cqrs`、文字列でない crate 名や依存先、1つの文字列として書かれた `verbs`、文字列でない保存意味が該当します。

## 適用が書き換える範囲

適用は、節の見出しの下にあるラベル付き YAML ブロック1つの本体だけを置き換えます。パイプラインの本文、ビルド節の CI 設定のフェンス、フェンスの区切り記号、英日いずれの節の見出し、周囲のファイルは、すべてバイト単位でそのままです。`.github/workflows/ci.yml`、正規モデル、`functional-spec.md`、インフラ仕様、メモ、`.ddd.toml` に触れることはありません。

適用は文書を読み直して検証し直すので、先に成功した preview が後の変更を承認することはありません。適用済みの文書へ再実行すると `already-migrated` を報告し、バイトはそのままです。書き込みに失敗した場合は `write-failed` を報告し、文書は元のままです。新しい文書はコマンド自身が作るファイルへ書いてから登録済みパスへ rename するため、登録済みパスは元のバイトか新しい文書全体のいずれかで、途中まで書かれた状態にはなりません。失敗してもコマンド自身が作ったファイルは残しません。symbolic link の宣言文書は `write-failed` で拒否し、リンクとその指す先の両方のバイトを保ちます。先に通常のファイルへ置き換えてください。レコードから宣言文書までの間にあるディレクトリ（`infrastructure-design` など）が symbolic link の場合も `write-failed` で拒否し、リンクの先にあるファイルのバイトを保ちます。先に通常のディレクトリへ置き換えてください。適用は読み取った内容からブロック全体を組み立て直すため、同じファイルを別のプロセスが書いている間は移行を実行しないでください。そのプロセスの変更が失われます。

## ユースケース宣言はすでに言語共通である

`functional-spec.md` の `## DDD Use-case Declarations` 節は、ユースケースID、名前、対象集約、コマンド、再実行の根拠、回復方針、複数集約の戦略、読み取りモデルの公開範囲を記録します。いずれも言語が綴る名前ではないため、変換すべき形式版はなく、改名も行いません。読込は同じ共通経路（節の見出しの下のラベル付き YAML ブロック1つ、レコードを基準に解決する `model_ref`、正規モデルの要素索引で解決する参照）を通ります。今回の変更は、この宣言も、それを読むゲートも、そのままにします。
