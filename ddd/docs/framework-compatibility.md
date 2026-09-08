# インストール済みハーネスの互換性修正

`aidlc-workflows/` は本家参照用の読み取り専用サブモジュールです。パッチ適用・依存導入・再生成・commit・pushを行いません。
変更先は親リポジトリの `.claude/`・`.codex/` に限定します。

## 修正内容

- 合成処理は、Codexで `.codex/skills` がない場合に `.agents/skills` を参照します。
- Bash入力の書き換え時に `permissionDecision: "allow"` を付けます。
- `collaborationspawn_agent` はアダプター内で通常の起動名に正規化し、既存のガードにも渡します。
- 暗号化本文は変更せず、起動前に保存したルール束を `SubagentStart` の追加コンテキストとして子へ渡します。

## 再適用と検証

`.claude/`・`.codex/` のコピーを配置した後、`ddd/` で実行します。

```sh
bun install
bun run prepare:harnesses
bun run check
bun run build:claude
bun run build:codex
```

`prepare:harnesses` は `patches/installed-harnesses.patch` を親リポジトリのコピーにだけ適用します。
適用済みなら何も変更せず、ローカル変更と一致しなければ上書きせず停止します。
サブモジュール用のパッチと適用スクリプトは削除しました。
検証・ビルドは `.codex/tools/` のコピーを使用します。

## 実機検証

```sh
bun run test:host state
bun run test:host task-name
```

これは実際のCodexモデルを呼び出す明示実行用の検証です。通常の `check` には含めません。
ワークフロー状態、または `task_name` による単独ステージ指定の両経路で検証用トークンの受信を確認しています。
生ログはGit管理対象外の `ddd-sandbox/` に保存します。

単独ステージ指定では、例えば `task_name: aidlc_stage_user_stories__review` を使います。
ステージを確定できない起動はエラーにします。同じ親セッション・同じ役割の起動は、先の子がルールを受け取るまで待ってから再試行してください。
変更済みフックの信頼状態は、通常のCodexセッションの `/hooks` で確認します。

詳しくは [実機検証結果](codex-host-verification.md) と [読み取り専用の運用](reference-read-only.md) を参照してください。
