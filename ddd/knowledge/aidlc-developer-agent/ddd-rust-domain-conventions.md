# Rustドメイン層の規約

更新: 2026-09-13。設計規約と機械検査の範囲を分けて記す。規則IDは継続使用する。

## Purpose

DDD設計とコード生成で用いる規約。検査名の記載は、その規約全体の機械的保証を意味しない。通常承認のDDD検査は接続済み。単独完了の標準側ガードには不足がある。

## Rules

| Rule ID | 規約 | 現在の検証範囲 |
|---|---|---|
| K.rust-domain-conventions.1 | ドメインの状態を公開フィールドで外へ出さない。 | aによるstructフィールド検査 |
| K.rust-domain-conventions.2 | 完全コンストラクタで生成し、未宣言のsetterを設けない。 | b/cは一部の形状。全前提条件はレビュー・テスト |
| K.rust-domain-conventions.3 | 変更メソッドを宣言済みコマンドまたは明示したイベント適用経路へ限定する。 | b。集約写像のreplay_methods・保存方式・型と照合 |
| K.rust-domain-conventions.4 | フィールドを非公開にする。 | a |
| K.rust-domain-conventions.5 | ドメイン層・ユースケース層からgetterを呼ばない。 | d。明示された受信側の型を照合。推論が必要なら注記 |
| K.rust-domain-conventions.6 | 生成の意図を名前で表し、不変条件を満たす経路に集約する。 | 命名の意味はレビュー。c/nは生成形状の一部 |
| K.rust-domain-conventions.7 | 内部可変性で未宣言の業務変更を隠さない。 | レビュー。キャッシュとの区別を含む |
| K.rust-domain-conventions.8 | 正当なreplayかどうかを、apply等の名前だけで判断しない。 | b。replay_methodsとの一致を検査。処理内容はレビュー |
| K.rust-domain-conventions.9 | VOは値の意味で、Entityは識別性を踏まえて同値性を設計する。 | レビュー |
| K.rust-domain-conventions.10 | 業務エラーを明示し、エラー時に途中変更を残さない。 | レビュー・動作テスト。破損した履歴の復元中断と区別 |
| K.rust-domain-conventions.11 | 集合の不変条件がある場合は専用のコレクション型を使う。 | 設計規約 |
| K.rust-domain-conventions.12 | 必要な操作だけ公開し、モジュール内部を隠す。 | レビュー。aはモジュール可視性の検査ではない |

## Rationale

VOとDomain Primitiveは不変。Rustの集約・Entityには排他的な&mut selfによる業務変更を許す。宣言型と別ファイルのimplも照合し、ファイル分割による検査の見逃しを防ぐ。不変条件の意味とエラー時の無変更は動作テストで確認する。

## Examples

開発リポジトリの実在する検査入力は、[設計ケース](../../tests/golden/design/cases.ts)と[Rustケース](../../tests/golden/rust/cases.ts)にある。ケース名で探す。これらは検査入力であり、完成した業務アプリケーションの実装例ではない。対象構造が存在しない正常ケースは、その構造の正しさを証明しない。

配布先にはtestsやdocsが同梱されないため、リンクは開発リポジトリでの参照用。必要な規約は本ファイル本文に保持する。

## Retired rules

規則IDの廃止なし。2026-09-13に検査範囲の過大表記と誤った技術前提を訂正した。機械検査がない規約もレビュー上の義務として残せる。

## Sources

- [現行設計](../../docs/domain-layer-design.md)
- [実測と既知の不具合](../../docs/current-state-assessment.md)
- [残作業](../../docs/completion-tasks.md)

## T-02の判定契約

規則b/d/h/iは、クレート・モジュールと明示的な型宣言を照合する。VO・ポートを集約や別ユースケースと混同しない。replayは集約写像のreplay_methods、event-sourcing、所属集約、単一イベント引数型が一致する場合だけ許す。

型推論・関連型・traitの実装選択等は対象外で、直接実行のJSONに未検査のnoteを残す。成功時のnoteを標準ディスパッチャが転送するとは限らないため、code-summaryへ記録してレビューする。[詳細](../../docs/rust-sensor-contract.md)。

## ドメインのパッケージング

[共有のパッケージング規約](../aidlc-shared/ddd-domain-packaging.md)に従い、業務語彙でクレート・modを命名する。domain_packagesの宣言を実配置と照合する。Rustのimpl構文と、禁止する技術分類パッケージを区別する。
