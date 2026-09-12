# 集約・不変条件・コマンド

更新: 2026-09-13。設計規約と機械検査の範囲を分けて記す。規則IDは継続使用する。

## Purpose

DDD設計とコード生成で用いる規約。検査名の記載は、その規約全体の機械的保証を意味しない。通常承認のDDD検査は接続済み。単独完了の標準側ガードには不足がある。

## Rules

| Rule ID | 規約 | 現在の検証範囲 |
|---|---|---|
| K.aggregate-and-invariants.1 | 集約の状態とコマンドの状態効果を明示する。 | iiはstate_effectと遷移参照の対応のみ |
| K.aggregate-and-invariants.2 | 各集約に不変条件を持たせる。 | model-completeness.i |
| K.aggregate-and-invariants.3 | 各コマンドに状態効果と失敗条件を宣言する。 | ローダーと完全性検査 |
| K.aggregate-and-invariants.4 | 遷移する操作には名前付き状態と遷移を、遷移しない操作にはnoneを宣言する。 | ローダーとmodel-completeness.ii |
| K.aggregate-and-invariants.5 | 不変条件を所有できない集約候補は境界を見直す。 | 不変条件の存在はi、境界の意味はレビュー |
| K.aggregate-and-invariants.6 | 各コマンドにeffectとstate_effectを記載する。 | ローダー |
| K.aggregate-and-invariants.7 | 現行スキーマでは各コマンドにDomain Errorを1件以上記載する。 | schema.command-no-error |
| K.aggregate-and-invariants.8 | 集約間の参照はIDで行う。 | レビュー。規則bは埋め込みを検査しない |
| K.aggregate-and-invariants.9 | Domain Serviceは集約が担えない判断に限定する。 | 設計規約 |
| K.aggregate-and-invariants.10 | ストーリーから業務イベントを発見し、集約候補と不変条件を導く。 | 設計手順。導出順序はセンサーで強制しない |
| K.aggregate-and-invariants.11 | 名称変更はIDを維持し、分割・統合・削除はlineageへ記録する。 | ローダーによる系譜・参照検査 |

## Rationale

状態遷移なしの明示は有効なモデルである。完全性検査は業務上の遷移の正しさや、コードが全遷移を実装したことまでは保証しない。

## Examples

開発リポジトリの実在する検査入力は、[設計ケース](../../tests/golden/design/cases.ts)と[Rustケース](../../tests/golden/rust/cases.ts)にある。ケース名で探す。これらは検査入力であり、完成した業務アプリケーションの実装例ではない。対象構造が存在しない正常ケースは、その構造の正しさを証明しない。

配布先にはtestsやdocsが同梱されないため、リンクは開発リポジトリでの参照用。必要な規約は本ファイル本文に保持する。

## Retired rules

規則IDの廃止なし。2026-09-13に検査範囲の過大表記と誤った技術前提を訂正した。機械検査がない規約もレビュー上の義務として残せる。

## Sources

- [現行設計](../../docs/domain-layer-design.md)
- [実測と既知の不具合](../../docs/current-state-assessment.md)
- [残作業](../../docs/completion-tasks.md)
