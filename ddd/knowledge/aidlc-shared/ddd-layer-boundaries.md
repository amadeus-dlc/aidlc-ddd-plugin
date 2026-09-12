# 層の境界と依存方向

更新: 2026-09-13。設計規約と機械検査の範囲を分けて記す。規則IDは継続使用する。

## Purpose

DDD設計とコード生成で用いる規約。検査名の記載は、その規約全体の機械的保証を意味しない。通常承認のDDD検査は接続済み。単独完了の標準側ガードには不足がある。

## Rules

| Rule ID | 規約 | 現在の検証範囲 |
|---|---|---|
| K.layer-boundaries.1 | 層はクレート名・配置から判定する。 | layer系診断 |
| K.layer-boundaries.2 | 禁止方向の依存を持ち込まない。 | g。物理分割だけで全禁止方向がコンパイルエラーになるわけではない |
| K.layer-boundaries.3 | 結線をcomposition rootへ集める。 | 設計規約 |
| K.layer-boundaries.4 | IAからuse-case、domain、infrastructureへの依存を許す。 | gの依存検査 |
| K.layer-boundaries.5 | use-caseからdomain、infrastructureへの依存を許す。 | gの依存検査 |
| K.layer-boundaries.6 | domainからinfrastructureへの依存を許す。 | gの依存検査 |
| K.layer-boundaries.7 | 言語拡張用infrastructureから他層へ依存しない。 | 設計規約。現行Rustセンサーの対象層にinfrastructureは含まれない |
| K.layer-boundaries.8 | CQRSのcommand/query間の相互依存を禁止する。 | k。申告されたファイルとセンサーの対象範囲に依存 |
| K.layer-boundaries.9 | RMUから両側への依存を許す。 | RMU発の辺をkの例外として判定 |
| K.layer-boundaries.10 | composition rootは両側の実装とポートを結線する。 | 設計規約 |
| K.layer-boundaries.11 | 名前・配置が曖昧なら層を独自設定で補わず、規約との対応を明示する。 | layer系診断とレビュー |

## Rationale

このinfrastructureは言語拡張用であり、DB/RPCクライアントはIAに置く。層の名前と役割はこのプラグインの規約である。Rustセンサーは全ワークスペースを無条件に検査するものではなく、申告されたソースを入口にする。

## Examples

開発リポジトリの実在する検査入力は、[設計ケース](../../tests/golden/design/cases.ts)と[Rustケース](../../tests/golden/rust/cases.ts)にある。ケース名で探す。これらは検査入力であり、完成した業務アプリケーションの実装例ではない。対象構造が存在しない正常ケースは、その構造の正しさを証明しない。

配布先にはtestsやdocsが同梱されないため、リンクは開発リポジトリでの参照用。必要な規約は本ファイル本文に保持する。

## Retired rules

規則IDの廃止なし。2026-09-13に検査範囲の過大表記と誤った技術前提を訂正した。機械検査がない規約もレビュー上の義務として残せる。

## Sources

- [現行設計](../../docs/domain-layer-design.md)
- [実測と既知の不具合](../../docs/current-state-assessment.md)
- [残作業](../../docs/completion-tasks.md)
