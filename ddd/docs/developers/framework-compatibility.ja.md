# AI-DLCとの互換性

[English](framework-compatibility.md) | 日本語

更新: 2026-09-13。確認基準はAI-DLC 2.8.2とBun 1.3.13。完成時の検証対象はClaude CodeとCodexであり、kimi・opencodeは対象外。

## 標準の導入済みツールを使う

`.claude/tools/`・`.codex/tools/` 内のフレームワーク実装は第三者の配布物であり、プラグインの実装修正は `ddd/` で行う。このリポジトリが作成した開発スコープの定義と、scope-grid内の同名エントリーは、こちらが保守する設定拡張である。

対応対象のAI-DLC版で扱える入力・成果物・明示的な検査を供給する責任は、プラグインと開発スコープ側にある。連携に失敗したら、まず既存の利用手段でこちらの設定と生成手順を直す。調査はローカルに残し、外部への報告にはユーザーの明示指示を必要とする。

この作業コピーでは `.claude/` と `.codex/` にAI-DLCが導入されている。DDDの開発用validate/build/testは `.codex/tools/` を使う。利用先のインストーラは、選択した環境に導入済みのツールを使う。

開発時の検証は現行の標準ツールに接続する。

## 2.8.2での開発スコープの追跡

`plugin-dev`は、`domain-design`と`units-generation`の前に`user-stories`を実行する。承認済み要件から利用者・目的・受入条件を持つ実際のストーリーを作り、要件→ストーリー→Unitを検証する。要件IDを維持し、別のストーリーIDを定義する。要件IDの付け替えだけでストーリーを作ったことにはしない。

これは標準2.8.2の対応表センサーで確認した経路であり、開発スコープは要件からUnitへの直接対応に依存しない。`plugin-bugfix`と`plugin-refactor`はUnitを生成しないため、この条件によってUser Storiesを追加しない。

`ddd/`から`bun run test:development-scopes`を実行する。`bun run check`にも含まれる。導入されているリポジトリ所有の開発スコープを確認し、一時ワークスペースで実際の`aidlc`コマンドを呼び、二つの対応関係の合格と、不一致Unitの拒否を検証する。Bunと対応対象の`aidlc`がPATH上に必要である。

User StoriesなしでUnits Generationまで進んだintentでは、標準の経路変更でUser Storiesを追加・実行し、影響する対応表を更新する。再利用するスコープ定義だけを直しても、進行中の成果物は修復されない。

## 検証済みと未検証を分ける

Claude/Codexのビルド・compose・既存ゴールデンケースは調査で成功した。T-01で成果物と通常承認のDDD検査を接続した。ただし標準の単独完了は一般成果物・センサーを検証せず、成果物なしでも完了を返す。再現と制約は[成果物契約](../users/artifact-contract.ja.md)を参照。

Codexのルール転送は標準AI-DLCと実行ホストの連携に依存する。DDD側で現在の経路を実機確認する作業はT-05であり、旧bridgeの成功記録を代用しない。

## 互換性を直す順序

1. T-01の通常承認と、単独完了前の明示的な直接検査を維持する。完了や終了コードだけで検査成功を判断しない。
2. T-04のビルド・検証経路はClaude/Codexの現行ツールを対象とする。
3. T-05の導入・更新CLIは検証済み。実モデルによるステージ実行を確認する。

詳細は[残作業](completion-tasks.ja.md)と[実測](current-state-assessment.ja.md)。旧版の経緯は[過去のCodex検証](codex-host-verification.ja.md)に限定して保持する。
