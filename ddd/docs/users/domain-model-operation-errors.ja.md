# 正規モデルの操作ごとのエラー

[English](domain-model-operation-errors.md) | 日本語 | [利用者向け文書](README.ja.md)

`ddd-domain-model-yaml.md` の `schema_version: 2` は、業務エラーをそれを宣言した操作に閉じます。Command が自身のエラーを持つのは従来どおりで、FactoryRule（`create` などの生成操作）も自身のエラーを持つようになります。これは正規モデルのYAMLデータスキーマであり、独自の版管理を持つ[プロジェクト設定](project-settings.ja.md) `.ddd.toml` の `schema_version` とは別物です。

version 1 は引き続き有効な形式であり、現在すべての本番センサーが読むのはこちらです。自動で切り替わることはありません。[この形式が今どこまで使われるか](#この形式が今どこまで使われるか)を参照してください。

## 何が変わるか

キーが2か所変わるだけです。element_id、参照、条件の本文、およびその記述言語はそのまま保たれます。

| 箇所 | version 1 | version 2 |
|---|---|---|
| DomainError が名指しする所属 | `command: command.invoice.issue` | `operation: command.invoice.issue` |
| FactoryRule のエラー集合 | 形式に存在しない | `domain_errors:` に1件以上 |

```yaml
schema_version: 2
bounded_contexts:
  - element_id: "bc.billing"
    name: "Billing"
    aggregates:
      - element_id: "aggregate.invoice"
        name: "Invoice"
        bounded_context: "bc.billing"
        root_element: "entity.invoice"
        states:
          - "draft"
          - "issued"
        elements:
          - element_id: "entity.invoice"
            kind: "entity"
            name: "Invoice"
            aggregate: "aggregate.invoice"
        commands:
          - element_id: "command.invoice.issue"
            name: "Issue"
            aggregate: "aggregate.invoice"
            effect: "transition"
            state_effect: "none"
            domain_errors:
              - element_id: "error.invoice.issue.already-issued"
                name: "AlreadyIssued"
                operation: "command.invoice.issue"
                condition: "請求書が下書き状態ではない。"
            idempotency:
              strategy: "none"
        factory_rules:
          - element_id: "factory.invoice.open"
            name: "Open"
            target_element: "entity.invoice"
            preconditions:
              - "invariant.invoice.total-positive"
            domain_errors:
              - element_id: "error.invoice.open.negative-amount"
                name: "NegativeAmount"
                operation: "factory.invoice.open"
                condition: "要求された金額が負である。"
```

2つの綴りが混在することはありません。version 1 の文書に `operation` を、version 2 の文書に `command` を書くと、もう一方の形式として読み替えられるのではなく、未知のキーとして拒否されます。

## ローダーが検査すること

element_id の文法は変わりません。エラーIDは引き続き `error.<集約>.<操作>.<名前>` であり、中間のセグメントがコマンド名または生成操作名のどちらかを表すようになります。

| 検査 | 拒否 |
|---|---|
| 宣言された `operation` が包含元の操作であること | `schema.id-owner-mismatch`。実在する別の操作を名指しした場合も拒否する。参照が解決できることと、エラーの所属は別の問いである |
| エラーIDの集約セグメント・操作セグメントが包含元の操作と対応すること | `schema.id-owner-mismatch` |
| 生成操作のIDが包含元集約の名前を持つこと | `schema.id-owner-mismatch` |
| `operation` が現行の要素へ、期待する種別で解決すること | `schema.ref-undefined`、`schema.ref-deprecated`、`schema.ref-kind` |
| 同じ element_id が二度宣言されないこと。コマンドと生成操作をまたぐ場合も含む | `schema.id-duplicate` |
| すべての FactoryRule が1件以上の DomainError を宣言すること | `schema.factory-no-error` |

このうち2つの検査は新たに追加されたもので、version 1 の文書にも適用されます。そのため、これまで読み込めていた旧形式のモデルが `schema.id-owner-mismatch` で拒否されるようになることがあります。

| 新たに拒否される version 1 の条件 | 直し方 |
|---|---|
| DomainError の `command` キーが、包含元のコマンド以外の操作を名指ししている | キーを包含元のコマンドへ直す |
| 生成操作のIDが、包含元の集約とは別の集約名を持っている | IDを、包含元の集約名を使った `factory.<集約>.<操作>` へ直す |

コマンドの `schema.command-no-error` はそのままで、他の規則の意味も変わりません。

## この形式が今どこまで使われるか

移行後の文書は、このページの移行コマンドと、後述の読込入口が読みます。**本番センサーは `schema_version: 2` に対応していません。** 承認時に正規モデルを読み込む経路はいずれも version 1 を要求し、移行後の文書に対しては、経路ごとの規則で読込失敗を報告します。

| 正規モデルを読み込む経路 | センサー | 読込失敗 |
|---|---|---|
| モデルの完全性検査 | `ddd-model-completeness` | `model-completeness.schema` |
| モデルの存在検査 | `ddd-model-presence` | `model-presence.invalid` |
| 規則評価コンテキスト | `ddd-rust-domain`、`ddd-rust-use-case`、`ddd-rust-interface-adapter` | `model.invalid` |
| ドメインパッケージ検査 | `ddd-rust-domain` | `domain-packaging.reference` |
| 宣言読込 | `ddd-mapping-declarations` | `mapping-declarations.model` |
| 宣言読込 | `ddd-reference-ids` | `reference-ids.model` |
| 宣言読込 | `ddd-layer-structure` | `layer-structure.model` |

`ddd-domain-modeling` の生成指示も引き続き version 1 を生成します。

これらのゲートが成果物に対して所見を出してよい場合にだけ移行を適用し、承認ゲートが読む成果物は、後続のリリースで切り替わるまで version 1 のまま運用してください。

## どちらの形式でも読む

形式は呼び出し側が指定し、文書から推測することはありません。version 2 の文書が隣に現れても本番センサーが version 1 のままでいられるのは、このためです。

```ts
import { loadDomainModel } from "/path/to/project/.codex/tools/ddd/lib/schema/loader.ts";

const legacy = loadDomainModel("/path/to/ddd-domain-model-yaml.md");
const migrated = loadDomainModel("/path/to/ddd-domain-model-yaml.md", 2);
```

Claude Code では `.claude/tools/` を使います。版を省略すると version 1 を読むため、既存の呼び出し側の挙動は変わりません。もう一方の形式の文書は読まれず、`schema.structure` で拒否されます。

成功時の結果は、正規化されたモデルと要素索引を持ちます。両形式は同じ形へ正規化されます。所属はどちらの綴りでも `DomainError.operation` に入り、`FactoryRule.domain_errors` は version 1 の文書では空リストになります。

## 移行の preview と適用

このコマンドは `ddd-domain-model-yaml.md` 1件を変換します。`--apply` を付けない限り報告だけで、何も書き換えません。

```sh
bun /path/to/project/.codex/tools/ddd-domain-model.ts migrate --model /path/to/ddd-domain-model-yaml.md
```

Claude Code では `.claude/tools/` を使います。コマンドは JSON を1件出力し、`outcome` が結果を名指しします。終了コードだけに区別を依存させる必要はありません。

| `outcome` | 終了コード | 意味 |
|---|---|---|
| `candidate` | 0 | 適用できる preview。`model` が候補 |
| `missing-information` | preview は 0、`--apply` 付きは 1 | `missing` が、まだ書かれていない業務定義を列挙する |
| `already-migrated` | 0 | すでにこの形式。何も書き換えない |
| `applied` | 0 | YAMLブロックを `model` の内容へ置き換えた |
| `rejected` | 1 | `findings` がローダーの拒否内容を示す |
| `write-failed` | 3 | 検証は成立したが、ファイルへ書き込めなかった |
| `invalid-arguments` | 2 | `detail` が使い方を示す |

対象は登録済みの成果物1種類だけです。生の `.yaml` ファイルは拒否します。上記の読込入口は生YAMLも読めますが、それは下位のローダーAPIであり、このコマンドが書き換えてよい文書ではありません。

## 移行が捏造しないもの

version 1 には生成操作の業務エラーを記録する場所がありません。そのため、生成操作を宣言しているモデルは `missing-information` を報告し、何も書き込みません。

```json
{ "outcome": "missing-information", "missing": ["factory.invoice.open.domain_errors"] }
```

これらのエラーはご自身で記述してください。移行を通すためにエラー名・条件・生成操作を作り出すことはなく、適用後の文書が宣言する element_id は移行前と完全に一致します。

機械的に移せるものはすべてそのまま移ります。element_id、すべての参照値、`name`・`condition`・`statement`・`rationale` の本文、およびその記述言語です。日本語で記録された条件は日本語のまま残ります。本文にたまたま `command:` という字面を含む条件は業務上の値であってキーではありません。変換は字面の置換ではなく構造の解析で行うため、`transitions[].command` や Process Manager の `steps[].command`・`compensations[].command` もキー名のまま残ります。

## 適用が書き換える範囲

適用が置き換えるのは、ラベル付きYAMLブロック1つの本文だけです。周囲の散文、フェンスの記号、他のフェンス、および周辺のファイルはバイト列のまま残ります。`ddd-domain-model.md`、`ddd-aggregate-mapping.md`、`.ddd.toml` などの隣接成果物には触れません。

適用時は文書を読み直して検証し直すため、以前の preview が成功したことを理由に不正な文書が適用されることはありません。適用済みの文書へ同じコマンドを再実行すると `already-migrated` を報告し、バイト列はそのままです。書込に失敗した場合は `write-failed` を報告し、文書は元のまま残ります。書込は同じファイルへ直接行うため、同じファイルを書き換える処理と並行して移行を実行しないでください。

置き換えられたブロックは正規化されたモデルから生成するため、書式は元ファイルではなくコマンドのものになります。文字列はすべて引用符で囲まれ、リストは1行1項目で書かれ、モデルが空にしている任意のリストは省略されます。集約直下の `process_managers` も省略されます。ローダーが各 Process Manager の集約一覧から導出する値だからです。ただし、ローダーが必須とするリストは省略せず、空でも書き出します。ステップを持たない Process Manager は `steps: []` のまま残るため、適用後の文書を読み戻せます。
