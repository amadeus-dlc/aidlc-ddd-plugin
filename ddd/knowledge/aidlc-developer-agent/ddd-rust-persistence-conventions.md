# Rust永続化の規約

更新: 2026-09-13。設計規約と機械検査の範囲を分けて記す。規則IDは継続使用する。

## Purpose

DDD設計とコード生成で用いる規約。検査名の記載は、その規約全体の機械的保証を意味しない。通常承認のDDD検査は接続済み。単独完了の標準側ガードには不足がある。

## Rules

| Rule ID | 規約 | 現在の検証範囲 |
|---|---|---|
| K.rust-persistence-conventions.1 | 静的ディスパッチを基本に、必要な箇所で動的ディスパッチを選ぶ。 | 設計規約 |
| K.rust-persistence-conventions.2 | イベントソーシングで業務判断とイベント適用を分離する。 | レビュー。規則cによる強制という旧表記は訂正 |
| K.rust-persistence-conventions.3 | storeの再保存・追記が同じ要求を二重適用しないよう設計する。 | レビュー・テスト。保存宣言の助言は一部のみ |
| K.rust-persistence-conventions.4 | ポートのtraitを使い、具体実装を結線で差し込む。 | 設計規約 |
| K.rust-persistence-conventions.5 | decide/applyの役割を分離し、replayで新しい業務判断をしない。 | レビュー・動作テスト。cはこの分離を検証しない |
| K.rust-persistence-conventions.6 | apply、apply_event、replay、on_eventはイベント適用経路の命名候補とする。 | replay_methodsでメソッドとイベントIDを明示し、保存方式・型を照合 |
| K.rust-persistence-conventions.7 | ポートを内側の利用者に合わせて配置し、IA実装名に媒体名を使える。 | 命名検査mは一部。配置全体はレビュー |
| K.rust-persistence-conventions.8 | 状態保存は安全な再保存、イベント保存は不変な履歴への追記を行う。 | レビュー。現行upsert助言は保存方式を十分に区別しない |
| K.rust-persistence-conventions.9 | 初回成功、重複成功、拒否の結果を区別する。 | 設計規約。具体的な戻り値はT-03 |
| K.rust-persistence-conventions.10 | DTOからの復元で不変条件を検証し、replayとは区別する。 | nは生成呼出しの形状。全不変条件はレビュー・テスト |

## Rationale

状態保存のupsertは無条件の上書きを意味しない。イベント保存で既存の履歴を書き換えない。重複成功では新規イベント0件、初回の状態変更成功は1件を基本とする。保存結果が不明なら要求ID等で照合し、保存前の作業状態を外部へ確定公開しない。

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
