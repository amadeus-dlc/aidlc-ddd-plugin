# DDDプラグインの開発者向け文書

[English](README.md) | 日本語 | [文書一覧](../README.ja.md)

このプラグインを保守する開発者向けの文書です。現状評価と残作業を確認し、関連する設計を読んだうえで、テストガイドに沿って変更を検証してください。

## 設計と実装

| 論点 | 文書 |
|---|---|
| プラグインの責務とデータの流れ | [アーキテクチャ概要](../../../docs/architecture.ja.md) |
| 現行の方針と根拠 | [判断記録](decisions.ja.md) |
| ドメインの規約と境界 | [ドメイン層設計](domain-layer-design.ja.md) |
| 再実行、一貫性、回復 | [ユースケース層設計](use-case-layer-design.ja.md) |
| CQRS、永続化、RMU | [インターフェイスアダプタ層設計](interface-adapter-layer-design.ja.md) |
| フレームワークとの接続と制約 | [AI-DLC互換性](framework-compatibility.ja.md) |

各層の設計は、生成するアプリケーションとプラグインの規約を定義します。成果物の形式やセンサーの挙動を変える際は、[利用者向けの契約](../users/README.ja.md)も確認してください。規約の記載だけで、自動検査の実装を保証するものではありません。

## 検証と残作業

| 論点 | 文書 |
|---|---|
| 現在の進捗と完了条件 | [残作業](completion-tasks.ja.md) |
| 各時点での実測 | [現状評価](current-state-assessment.ja.md) |
| テストコマンドと入力の構成 | [テストガイド](../../tests/README.ja.md) |
| センサーごとの正常・異常・境界ケース | [検査契約の対応表](sensor-coverage.ja.md) |
| 新規導入、更新、失敗時の挙動 | [導入検証](installation-verification.ja.md) |
| 以前のCodexホスト検証の根拠 | [過去のホスト検証](codex-host-verification.ja.md) |
| 機械可読な実行記録 | [検証記録](evidence/) |

実測には日付と対象範囲を添えてください。現状評価は各時点の記録を保持し、タスク表は現在の進捗を管理します。以前のホスト検証結果は、現在のルール転送を保証しません。

対応表は `ddd/` で `bun scripts/report-sensor-coverage.ts --write` を実行すると、このディレクトリの英日両版を再生成します。`bun run test:coverage` でテスト入力との整合を確認してください。文書構造を変える際は、参照元と生成スクリプトを合わせて更新します。
