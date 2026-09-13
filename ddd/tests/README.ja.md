# DDDプラグインのテスト

[English](README.md) | 日本語

更新: 2026-09-13。プラグインルートで `bun test tests/` を実行します。規則ごとの網羅性は[契約対応表](../docs/sensor-coverage.ja.md)で管理します。全体テストには既知の旧依存20件の失敗が残ります。skipは標準側の単独完了不足を調べる任意実行の再現ケースです。

## 各テストの役割

| ファイル | 対象 |
|---|---|
| t1-model-artifacts / t1-gate-integration | 正規成果物の直接検査、Claude/Codexの通常承認開始 |
| t7-domain-packaging | 業務語彙による宣言と実モジュールの照合、技術分類・解析不能の検出 |
| t9-sensor-contract | センサー×規則の網羅性、正常・異常・境界例、依存方向表、予約名全件、対応表の更新漏れ |
| t8-declaration-language | 英語見出し・従来の日本語見出しの受理と、両言語の重複セクションの拒否 |
| u1-sensor-foundation | 正規モデルのローダー・ID・参照、完全性、所見と実行契約 |
| u2-rust-analysis-foundation | Cargoの層判定とRust構文解析 |
| u3-plugin-scaffold | プラグインの構成、接頭辞、コマンド、拡張宣言 |
| u4-design-sensors / u4-golden | 設計センサーの正常・違反入力、宣言規則と出力の比較 |
| u5-rust-code-sensors / u5-golden | Rustセンサーの正常・違反入力 |
| install / install-sandbox | 取得元ヘルパー、実CLIでの導入・更新・dry-run・失敗時の保護。ネットワーク取得は任意実行 |
| framework-compatibility | 現行Claude/Codexのcompose・冪等性テストと、失敗する旧連携テストが混在 |
| codex-dispatch-bridge | 旧bridgeと削除済みfixtureを前提にする。T-04で整理 |

## 配布物の検査

```sh
bun run build:claude
bun run build:codex
bun scripts/verify-dist.ts claude codex
```

配布物の検査は各277ケースを実行します。ランナーは一時ディレクトリを作り、実センサースクリプトを子プロセスとして呼びます。通常の承認処理や、モデルによるコード生成を実行するテストではありません。

`bun run test:sandbox` は、英日見出し・契約ケース・対応表の検査、Claude/Codexのビルド、一時コピーへのcompose・グラフ生成・冪等性、各277件の配布物検査、通常承認の統合検査を順に実行します。規則表から選んだ138入力を各環境の承認経路へ通し、監査記録と所見の規則IDも確認します。既存の結合検査40件も維持します。

## 回帰で確認した範囲と残る検証

承認開始時の欠落・不正・正常はt1-gate-integrationで検証済みです。VO・ポート・別ファイル・replayはT-02で回帰テストを追加しました。T-07は直接回帰55件と通常承認8件を追加しました。既存の正常ケースに対象構造が存在しない場合、その構造を正しく検査できる根拠にはしません。

パッケージングの代表的な7配置はrustc 1.95.0でもコンパイルしました。全ゴールデン入力のコンパイルや業務動作の証明ではありません。新規導入・更新CLIは[検証済み](../docs/installation-verification.ja.md)です。実際のモデル実行とルール到達は引き続き確認が必要です。

[残作業](../docs/completion-tasks.ja.md)と[実測](../docs/current-state-assessment.ja.md)を参照してください。テスト結果の更新時は対象バージョンと範囲を添えます。

## 対応表の更新

ケースと規則の対応は `golden/contract/coverage.ts`、追加ケースは `golden/contract/` に記載します。`bun scripts/report-sensor-coverage.ts --write` で英日両版を生成し、`bun run test:coverage` で参照切れや未検証項目を検出します。表は実装の全分岐・全Rust構文・業務上の意味の網羅率ではありません。

`bun run test:install` は通常のサンドボックスにも含まれる。実取得は `bun run test:install:remote` で実行する。
