# DDDプラグインの利用者向け文書

[English](README.md) | 日本語 | [文書一覧](../README.ja.md)

アプリケーション開発にDDDプラグインを使う方向けの文書です。導入・ワークフローのガイドから読み、成果物の作成やセンサーの結果確認では各契約を参照してください。

| 目的 | 文書 |
|---|---|
| 導入、ステージ実行、問題の切り分け | [利用ガイド](../../../docs/usage.ja.md) |
| 正規モデル、写像、必須宣言の作成 | [成果物契約](artifact-contract.ja.md) |
| ユビキタス言語に基づくドメインパッケージの命名 | [パッケージング契約](domain-packaging-design.ja.md) |
| Rustの型照合、replay宣言、未検査範囲の確認 | [Rustセンサー契約](rust-sensor-contract.ja.md) |

## 対応状況と制約の確認

プラグインは開発中です。採用前に[互換性](../developers/framework-compatibility.ja.md)と[残作業](../developers/completion-tasks.ja.md)を確認してください。導入・更新で検証した挙動は[導入検証](../developers/installation-verification.ja.md)に記載しています。モデルによる実際のステージ実行は未検証です。

プラグイン実装の変更、設計の根拠、テストの証跡については[開発者向け文書](../developers/README.ja.md)を参照してください。
