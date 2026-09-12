# CQRSと整合性

更新: 2026-09-13。設計規約と機械検査の範囲を分けて記す。規則IDは継続使用する。

## Purpose

DDD設計とコード生成で用いる規約。検査名の記載は、その規約全体の機械的保証を意味しない。通常承認のDDD検査は接続済み。単独完了の標準側ガードには不足がある。

## Rules

| Rule ID | 規約 | 現在の検証範囲 |
|---|---|---|
| K.cqrs-and-consistency.1 | CQRS構成のcommand側とquery側を相互依存させない。 | 宣言側kとRust側k。承認接続・対象範囲に制約あり |
| K.cqrs-and-consistency.2 | 集約ごとにプログラミングモデルと保存方式を宣言する。 | mapping-declarations.axes |
| K.cqrs-and-consistency.3 | 問い合わせに適した読み取りモデルを用意する。 | 設計規約 |
| K.cqrs-and-consistency.4 | programming_modelをactorまたはclassで宣言する。 | mapping-declarations.axes |
| K.cqrs-and-consistency.5 | persistence_methodをstate-sourcingまたはevent-sourcingで宣言する。 | mapping-declarations.axes。コード形状は保証しない |
| K.cqrs-and-consistency.6 | 更新判断のためにquery側の読み取りモデルを参照しない。 | kによる依存検査。実際の整合性はレビュー |
| K.cqrs-and-consistency.7 | query側から更新用ドメイン型・リポジトリを参照しない。 | lによる構文・宣言検査 |
| K.cqrs-and-consistency.8 | RMUは両側をつなぐ独立したコンポーネントにする。 | 設計規約。RMU発の辺を例外扱いする |
| K.cqrs-and-consistency.9 | 保存の整合性と読み取り側の反映遅延を明示する。 | レビュー・動作テスト |

## Rationale

非同期の読み取りモデルは最新変更が未反映の場合がある。「常に古い」とは断定しない。保存方式とアクター採用は別の軸である。状態保存でもドメインイベントを利用できる。

## Examples

開発リポジトリの実在する検査入力は、[設計ケース](../../tests/golden/design/cases.ts)と[Rustケース](../../tests/golden/rust/cases.ts)にある。ケース名で探す。これらは検査入力であり、完成した業務アプリケーションの実装例ではない。対象構造が存在しない正常ケースは、その構造の正しさを証明しない。

配布先にはtestsやdocsが同梱されないため、リンクは開発リポジトリでの参照用。必要な規約は本ファイル本文に保持する。

## Retired rules

規則IDの廃止なし。2026-09-13に検査範囲の過大表記と誤った技術前提を訂正した。機械検査がない規約もレビュー上の義務として残せる。

## Sources

- [現行設計](../../docs/interface-adapter-layer-design.md)
- [実測と既知の不具合](../../docs/current-state-assessment.md)
- [残作業](../../docs/completion-tasks.md)
