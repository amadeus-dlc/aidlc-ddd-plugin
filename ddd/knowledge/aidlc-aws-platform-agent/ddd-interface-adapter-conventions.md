# インターフェイスアダプタの規約

更新: 2026-09-13。設計規約と機械検査の範囲を分けて記す。規則IDは継続使用する。

## Purpose

DDD設計とコード生成で用いる規約。検査名の記載は、その規約全体の機械的保証を意味しない。通常承認のDDD検査は接続済み。単独完了の標準側ガードには不足がある。

## Rules

| Rule ID | 規約 | 現在の検証範囲 |
|---|---|---|
| K.interface-adapter-conventions.1 | ポートは技術名より責務で命名する。 | 一般の命名はレビュー。リポジトリ名はm系検査 |
| K.interface-adapter-conventions.2 | リポジトリポートを集約名で命名する。 | 宣言側m-name |
| K.interface-adapter-conventions.3 | 初期実装はin-memoryから始める。 | 設計規約 |
| K.interface-adapter-conventions.4 | ポートをrepository、external-client、es-infrastructureに分類する。 | layer-structure.item |
| K.interface-adapter-conventions.5 | リポジトリポート名は<Aggregate>Repositoryとし、媒体名を入れない。 | m系検査。実装structの媒体接頭辞は許す |
| K.interface-adapter-conventions.6 | find_by_id、store、delete_by_idを基本に、担当集約の追加検索を許す。 | 宣言の動詞検査は一部。画面検索との分離はレビュー |
| K.interface-adapter-conventions.7 | in-memory実装でも競合・失敗時のポート契約をテストする。 | テスト |
| K.interface-adapter-conventions.8 | query側はDAOとDTOを使い、更新用ドメイン型を再利用しない。 | lは一部の参照形状を検査 |
| K.interface-adapter-conventions.9 | DB/RPCクライアントはIAへ置き、言語拡張用infrastructureへ置かない。 | 設計規約。gだけで全クライアント配置を保証しない |
| K.interface-adapter-conventions.10 | 外部モデルをそのまま採用するか、境界で変換するかを明示する。 | レビュー |
| K.interface-adapter-conventions.11 | 層構造宣言にcontext、CQRS、クレート、依存、ポート、復元、保存先を記載する。 | layer-structure.item等。通常承認へ接続済み。単独完了の制約あり |

## Rationale

コマンド側I/Oにはリポジトリ以外の外部クライアントも含む。storeは状態保存の安全な再保存、またはイベントの安全な追記として設計する。RDBをイベントの形式だけで除外しない。RMUは集約内の順序、配送順序、欠番、重複、更新と処理済み記録の確定を分けて設計する。DynamoDB Streamsの順序保証を別アイテム間へ拡張しない。

## Examples

開発リポジトリの実在する検査入力は、[設計ケース](../../tests/golden/design/cases.ts)と[Rustケース](../../tests/golden/rust/cases.ts)にある。ケース名で探す。これらは検査入力であり、完成した業務アプリケーションの実装例ではない。対象構造が存在しない正常ケースは、その構造の正しさを証明しない。

配布先にはtestsやdocsが同梱されないため、リンクは開発リポジトリでの参照用。必要な規約は本ファイル本文に保持する。

## Retired rules

規則IDの廃止なし。2026-09-13に検査範囲の過大表記と誤った技術前提を訂正した。機械検査がない規約もレビュー上の義務として残せる。

## Sources

- [現行設計](../../docs/interface-adapter-layer-design.md)
- [実測と既知の不具合](../../docs/current-state-assessment.md)
- [残作業](../../docs/completion-tasks.md)
