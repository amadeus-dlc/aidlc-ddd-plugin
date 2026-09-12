# AI-DLCとの互換性

[English](framework-compatibility.md) | 日本語

更新: 2026-09-13。確認基準はAI-DLC 2.8.2とBun 1.3.13。完成時の検証対象はClaude CodeとCodexであり、kimi・opencodeは対象外。

## 標準の導入済みツールを使う

`.claude/tools/`・`.codex/tools/` は第三者のフレームワーク配布物であり、このプラグインの実装変更先にしない。標準側の不足は再現条件と上流への修正提案として扱い、プラグインの実装修正は `ddd/` で行う。

この作業コピーでは `.claude/` と `.codex/` にAI-DLCが導入されている。DDDの開発用validate/build/testは `.codex/tools/` を使う。利用先のインストーラは、選択した環境に導入済みのツールを使う。

削除済みの参照サブモジュールや、そのdistは前提にしない。旧版向けの `prepare:harnesses`、dispatch bridge、カスタムビルドを現在の導入手順へ戻さない。残る補助コードはT-04で整理する。

## 検証済みと未検証を分ける

Claude/Codexのビルド・compose・既存ゴールデンケースは調査で成功した。T-01で成果物と通常承認のDDD検査を接続した。ただし標準の単独完了は一般成果物・センサーを検証せず、成果物なしでも完了を返す。再現と制約は[成果物契約](artifact-contract.ja.md)を参照。

Codexのルール転送は標準AI-DLCと実行ホストの連携に依存する。DDD側で現在の経路を実機確認する作業はT-05であり、旧bridgeの成功記録を代用しない。

## 互換性を直す順序

1. T-01の通常承認は接続済み。残る単独完了の保証は標準AI-DLC側で修正する。
2. T-04で対象2環境のビルド・検証経路と旧環境依存を整理する。
3. T-05で新規導入・更新と実際のステージ実行を確認する。

詳細は[残作業](completion-tasks.ja.md)と[実測](current-state-assessment.ja.md)。旧版の経緯は[過去のCodex検証](codex-host-verification.ja.md)に限定して保持する。
