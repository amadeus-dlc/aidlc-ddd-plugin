# DDDプラグインの利用ガイド

更新: 2026-09-13。現在は完成に向けた修正中です。[既知の問題](../ddd/docs/current-state-assessment.md)を確認し、検証用プロジェクトで利用してください。

## 導入前の条件

BunとAI-DLC導入済みのClaude CodeまたはCodex環境を使います。kimi・opencodeは対象外。Rustセンサーの解析自体にはCargoを使いませんが、生成アプリケーションのビルド・テストにはRust環境が必要です。

導入スクリプトは利用先のAI-DLCツールを参照します。ローカルソースの事前確認:

```sh
bun ddd/scripts/install.ts --project /path/to/project --from /path/to/aidlc-ddd-plugin --harness codex --dry-run
```

実導入は `--dry-run` を外す形式です。現行の新規導入・更新・失敗回復の一連の検証は[T-05](../ddd/docs/completion-tasks.md)で行います。旧パッチの復元や参照サブモジュールの取得は不要です。

## ワークフローでの役割

プラグインをcomposeすると、専用ステージ、既存ステージへの手順追加、センサー、ナレッジが登録されます。実行対象は、導入先で合成された計画と専用ステージの条件で決まります。

設計上は、要求から正規モデルを作り、集約写像、ユースケース宣言、層構造、コードへ進みます。通常承認のDDD検査は接続済みですが、実際の生成から人間の承認までの実機検証は別途必要です。センサーは `fire_on: gate` であり、ファイルを書くだけで検査されたとは扱わないでください。

単独実行の入口は `$aidlc --stage ddd-domain-modeling --single` です。主ワークフローの進行とは独立する設計ですが、標準AI-DLC 2.8.2は単独完了で一般成果物を検証しないため、ステージ本文に従ってセンサーを明示実行してください。途中導入、SKIP、単独生成したモデルの再利用は、修正後に確認します。モデル存在センサーがSKIP時に通ることだけでは、下流全体の成功を保証しません。

## 成果物を読む

正規モデルの形式と移行方法は[ドメイン層設計 §5](../ddd/docs/domain-layer-design.md)を参照してください。後続の写像は `ddd-aggregate-mapping.md`、ユースケース宣言はfunctional-spec、層構造宣言はcicd-pipelineの必須セクションです。[成果物契約](../ddd/docs/artifact-contract.md)を参照してください。

コード検査は `source-manifest.json` で申告されたRustファイルを入口にします。所見なしの場合も、申告・層判定・モデルの有無・注記を確認します。所見なしを業務上の正しさの証明としては使いません。

## 問題が出た場合

[互換性](../ddd/docs/framework-compatibility.md)と[残作業](../ddd/docs/completion-tasks.md)を照合し、対象バージョンと実行結果を記録してください。繰り返し再インストールする前に、単独完了の標準側の不足か、旧環境依存か、個別モデルの違反かを切り分けます。
