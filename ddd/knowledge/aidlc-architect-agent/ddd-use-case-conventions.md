# ユースケースの規約

更新: 2026-09-13。設計規約と機械検査の範囲を分けて記す。規則IDは継続使用する。

## Purpose

DDD設計とコード生成で用いる規約。検査名の記載は、その規約全体の機械的保証を意味しない。通常承認のDDD検査は接続済み。単独完了の標準側ガードには不足がある。

## Rules

| Rule ID | 規約 | 現在の検証範囲 |
|---|---|---|
| K.use-case-conventions.1 | 業務判断をドメインへ委ね、取得・保存・回復の進行を管理する。 | レビュー |
| K.use-case-conventions.2 | 各ステップの再実行が安全である根拠を記載する。 | 宣言の存在は検査。安全性の意味はレビュー・テスト |
| K.use-case-conventions.3 | 集約単位の保存と、複数集約フローの途中失敗を区別する。 | 設計規約 |
| K.use-case-conventions.4 | 整合性、冪等性、順序、失敗と補償、観測方法を明示する。 | 設計手順・レビュー |
| K.use-case-conventions.5 | getterで値を取り出して業務判断しない。 | dはgetter名の検査。判断の配置全体はレビュー |
| K.use-case-conventions.6 | フロー全体の自動ロールバックを暗黙に約束しない。 | 設計規約 |
| K.use-case-conventions.7 | 再送の識別、保持期間、保存結果不明時の回復を定める。 | jは加算型コマンドのstrategyのみ。安全性はレビュー |
| K.use-case-conventions.8 | 複数集約の回復をProcess Managerまたは明示した再実行戦略で表す。 | 全対象がactorで写像が読める場合はprocess-manager-required |
| K.use-case-conventions.9 | ユースケースの6項目と識別子・名前を記載する。 | mapping-declarations.use-case-item等。通常承認へ接続済み。単独完了の制約あり |
| K.use-case-conventions.10 | CQSと、更新結果・新状態・イベントを返す契約を区別する。 | 設計規約 |

## Rationale

単一集約を強整合の基本境界とする。A保存後にBが失敗した場合はAのコミットが残り得る。補償は新しい処理であり、DBロールバックではない。upsertだけでは再実行安全性を保証しない。C1→C2→C1再送を許すなら、直前ID1件では足りない。サーガはclassでも実装可能で、混在フローの宣言方式はT-03で確定する。

## Examples

開発リポジトリの実在する検査入力は、[設計ケース](../../tests/golden/design/cases.ts)と[Rustケース](../../tests/golden/rust/cases.ts)にある。ケース名で探す。これらは検査入力であり、完成した業務アプリケーションの実装例ではない。対象構造が存在しない正常ケースは、その構造の正しさを証明しない。

配布先にはtestsやdocsが同梱されないため、リンクは開発リポジトリでの参照用。必要な規約は本ファイル本文に保持する。

## Retired rules

規則IDの廃止なし。2026-09-13に検査範囲の過大表記と誤った技術前提を訂正した。機械検査がない規約もレビュー上の義務として残せる。

## Sources

- [現行設計](../../docs/use-case-layer-design.md)
- [実測と既知の不具合](../../docs/current-state-assessment.md)
- [残作業](../../docs/completion-tasks.md)

## T-02の判定契約

規則b/d/h/iは、クレート・モジュールと明示的な型宣言を照合する。VO・ポートを集約や別ユースケースと混同しない。replayは集約写像のreplay_methods、event-sourcing、所属集約、単一イベント引数型が一致する場合だけ許す。

型推論・関連型・traitの実装選択等は対象外で、直接実行のJSONに未検査のnoteを残す。成功時のnoteを標準ディスパッチャが転送するとは限らないため、code-summaryへ記録してレビューする。[詳細](../../docs/rust-sensor-contract.md)。
