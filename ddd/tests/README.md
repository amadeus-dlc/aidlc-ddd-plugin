# DDDプラグインのテスト

更新: 2026-09-13。プラグインルートで `bun test tests/` を実行します。T-07実装後は279成功・1skip・20失敗です。skipは標準側の単独完了不足を調べる任意実行の再現ケースです。失敗する旧テストのために、削除済み参照サブモジュールや旧bridgeを復元する運用には戻しません。

## 各テストの役割

| ファイル | 対象 |
|---|---|
| t1-model-artifacts / t1-gate-integration | 正規成果物の直接検査、Claude/Codexの通常承認開始 |
| t7-domain-packaging | 業務語彙による宣言と実モジュールの照合、技術分類・解析不能の検出 |
| u1-sensor-foundation | 正規モデルのローダー・ID・参照、完全性、所見と実行契約 |
| u2-rust-analysis-foundation | Cargoの層判定とRust構文解析 |
| u3-plugin-scaffold | プラグインの構成、接頭辞、コマンド、拡張宣言 |
| u4-design-sensors / u4-golden | 設計センサーの正常・違反入力、宣言規則と出力の比較 |
| u5-rust-code-sensors / u5-golden | Rustセンサーの正常・違反入力 |
| install | インストーラの純関数等。新規導入・更新全体の実証ではない |
| framework-compatibility | 現行Claude/Codexのcompose・冪等性テストと、失敗する旧連携テストが混在 |
| codex-dispatch-bridge | 旧bridgeと削除済みfixtureを前提にする。T-04で整理 |

## 配布物の検査

```sh
bun run build:claude
bun run build:codex
bun scripts/verify-dist.ts claude codex
```

T-07実装後は各154ケース成功。ランナーは一時ディレクトリを作り、実センサースクリプトを子プロセスとして呼びます。通常の承認処理や、モデルによるコード生成を実行するテストではありません。

`bun run test:sandbox` はClaude/Codexのビルド、一時コピーへのcompose・グラフ生成・冪等性、配布物の各154ケース、t1-gate-integrationを順に実行します。引数なしの `test:dist` もClaude/Codexだけを対象にします。マニフェストのセンサーは `fire_on: gate` であり、書込み時に発火するという旧説明は訂正しました。

## 回帰で確認した範囲と残る検証

承認開始時の欠落・不正・正常はt1-gate-integrationで検証済みです。VO・ポート・別ファイル・replayはT-02で回帰テストを追加しました。T-07は直接回帰55件と通常承認8件を追加しました。既存の正常ケースに対象構造が存在しない場合、その構造を正しく検査できる根拠にはしません。

パッケージングの代表的な7配置はrustc 1.95.0でもコンパイルしました。全ゴールデン入力のコンパイルや業務動作の証明ではありません。新規導入・更新、実際のモデル実行とルール到達は引き続き確認が必要です。

[残作業](../docs/completion-tasks.md)と[実測](../docs/current-state-assessment.md)を参照してください。テスト結果の更新時は対象バージョンと範囲を添えます。
