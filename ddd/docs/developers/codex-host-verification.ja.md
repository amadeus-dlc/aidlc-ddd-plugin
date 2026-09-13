# 過去のCodex実機検証

[English](codex-host-verification.md) | 日本語

このページと下記JSONは、2026年9月の旧Codex連携を調べた履歴である。**現在のAI-DLC 2.8.2でルール転送が動くという証明には使わない。** 現在の対応方針は[互換性](framework-compatibility.ja.md)、再検証は[T-05](completion-tasks.ja.md)を参照する。

初期調査では、ホストから届くツール名・暗号化された入力と、当時の転送処理の想定が合わず、子へのルール転送を確認できなかった。その後、旧構成へ独自bridgeを追加した条件で、ワークフロー状態と単独ステージ指定の経路を検証した。

| 証跡 | 適用範囲 |
|---|---|
| [初期調査](evidence/codex-host-verification.json) | 旧構成の入力形式、セッション付与、ルール転送失敗等 |
| [旧bridge適用後](evidence/codex-host-bridge-verification.json) | 独自bridgeを導入した旧構成での成功記録 |

JSON内の環境・日時・ハッシュは当時の値のまま保存する。生ログのローカルパスは履歴の所在であり、新しい作業コピーに存在するとは限らない。旧パッチの再適用や認証・信頼設定の変更を、現在の推奨手順として掲載しない。
