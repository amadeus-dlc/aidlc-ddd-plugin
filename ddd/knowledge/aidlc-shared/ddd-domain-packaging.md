# ドメイン層のパッケージング

## Purpose

ドメイン層のクレートと内部パッケージをユビキタス言語で命名し、業務概念ごとにまとめる。設計担当と実装担当は同じ規約を使う。

## Rules

| Rule ID | 規約 | 検証 |
|---|---|---|
| K.domain-packaging.1 | パッケージ名を業務語彙へ結び付け、用語・モデル参照・配置理由を宣言する | 宣言の存在とID解決は機械検査。意味の適切さはレビュー |
| K.domain-packaging.2 | aggregate/、impl/、vo/、entities/等の技術分類で分けない | domain-packaging.technical-name |
| K.domain-packaging.3 | 各クレートのrootと、パッケージ階層の各段をdomain_packagesに記録する | domain-packaging.coverage |
| K.domain-packaging.4 | 同じ業務概念に属する集約・Entity・VOを、型の分類だけで別々の場所へ移さない | 設計レビュー |
| K.domain-packaging.5 | 共有する値も、common/vo等の入れ物を先に作らず、moneyやaddress等の責務から配置を決める | 設計レビュー |
| K.domain-packaging.6 | 宣言と実モジュールを照合する。空・非公開・インラインmodも対象にする | domain-packaging.coverage / unresolved |
| K.domain-packaging.7 | モデルの種別ID、Rustのimpl構文、外部のuse参照を、こちらのパッケージ宣言と混同しない | ASTと所属クレートで区別 |
| K.domain-packaging.8 | 物理配置はdomain-designが所有し、下流は勝手に再分類しない | ステージ手順とレビュー |

予約名は `aggregate`、`aggregates`、`impl`、`impls`、`implementation`、`implementations`、`vo`、`vos`、`entity`、`entities`、`value_object`、`value_objects`、`valueobject`、`valueobjects`。大小文字とRustのraw identifierを正規化し、名前の要素単位で照合する。部分文字列では判定しない。common/shared/utils等を含む名前の適切さはレビューする。

`billing-domain` の `-domain` と `packages/domain` は既存の層表示として維持する。内部の `invoice/vo` は層表示ではなく技術分類なので許可しない。`src`、`lib.rs`、`mod.rs`等の配置上の要素は、業務パッケージ名と区別する。

## Examples

請求書・請求書番号・明細が業務語彙として確認できているなら、`invoice/` にその責務をまとめる。`aggregates/invoice`、`vo/invoice_number`、`entities/invoice_line` という分断は避ける。

1集約＝1パッケージを強制する規則ではない。複数のモデル要素をまとめる名前は、語彙の定義と配置理由を説明する。コード名と日本語の用語の文字列一致は求めない。センサーの通過を、意味的な正しさの証明には使わない。

## Declaration

`ddd-aggregate-mapping.md` の正規YAMLにdomain_packagesを記載する。rootは `module: crate`、内部はクレート相対のRustパスを使う。term、model_refs、rationaleは必須。予約名を別表記へ変えるだけで、責務の混在を残さない。

実装前のパッケージを計画として宣言することはできる。コード検査は、変更があるドメインクレートの実モジュールが宣言に含まれるかを検査し、未実装の将来パッケージまで今のUnitで作らせない。

## Scope

ドメインクレートのlib/binからmodをたどる。`#[cfg(test)]` のモジュール、tests/benches/examples/vendor/target配下の内容、外部依存の名前空間を業務コードとして一律に検査しない。ただしアプリケーション側が書いたmod宣言は対象になる。項目マクロ、曖昧なpath属性、参照先不明等は、検査済みとせずunresolvedで停止する。

## Sources

- [実装契約](../../docs/domain-packaging-design.md)
- [回帰ケース](../../tests/golden/packaging/cases.ts)

リンクは開発リポジトリ向け。配布先でも必要な規約は本ファイル本文に保持する。
