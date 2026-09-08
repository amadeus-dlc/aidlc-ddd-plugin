# 作業ルール

- 返答は日本語にする。
- `aidlc-workflows/` は本家参照専用の読み取り専用サブモジュールとして扱う。
- `aidlc-workflows/` とそのGit管理領域への書き込みは禁止する。ファイル編集、依存導入、生成物の再生成、Gitのcommit・push・checkout・更新操作を行わない。
- 読み取り専用設定の解除や回避を行わない。参照元の更新が必要なら、ユーザーから更新について明示的な指示を得る。
- 修正は `.claude/`、`.codex/`、`ddd/` 側で行う。検証・ビルドには `.codex/tools/` のコピーを使う。
- Git管理対象外の検証環境は `ddd-sandbox/` に置く。
- 次の作業を提案する場合は、重複のない選択肢を推奨順に提示する。
- GitHubのPull Requestに言及するときはリンクを付ける。
- worktreeモードでは `mise trust` を実行する。
- `amadeus/**/*.md`、`.kiro/specs/**/*.md`、`openspec/**/*.md` は日本語で作成する。
