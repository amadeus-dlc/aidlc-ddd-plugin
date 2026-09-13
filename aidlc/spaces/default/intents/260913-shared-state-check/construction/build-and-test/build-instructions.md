# ビルドと全体検証の手順

## Sources

- [U1計画](../u1-state-exposure-inspection/code-generation/code-generation-plan.md)、[U1手順](../u1-state-exposure-inspection/code-generation/unit-test-instructions.md)、[U1結果](../u1-state-exposure-inspection/code-generation/code-summary.md)。
- [U2計画](../u2-language-state-verification/code-generation/code-generation-plan.md)、[U2手順](../u2-language-state-verification/code-generation/unit-test-instructions.md)、[U2結果](../u2-language-state-verification/code-generation/code-summary.md)。
- [要件](../../inception/requirements-analysis/requirements.md)、[ストーリー](../../inception/user-stories/stories.md)。

## Environment and Dependencies

作業ディレクトリはddd。Bun 1.3.13、TypeScript 6.0.3、@types/bun 1.3.13、Biome 2.5.12、Rust 1.95.0、syn 3.0.5、sha2 0.10.9を使用する。既存キャッシュと固定ロックを利用し、Rust依存の取得は完了済み。再取得はC2から行わない。

```sh
bun install --frozen-lockfile
bun run build:all
bun run check
```

build:allはClaude/Codex向けの生成物を作る。checkは形式検査、plugin validate、開発scope確認、明示的Rust準備、通常全試験、native試験、版1比較、C2、限定型検査を順に行う。途中失敗時は後続を成功扱いせず、未実行を記録する。生成物は配布・公開しない。

## Unit Command Inventory

両Unitのunit-test-instructions.mdからshブロックを抽出し、同一文字列のコマンドを重複排除して一度ずつ実行する。個別ファイル指定と複数ファイル指定は異なるコマンドとして保存するが、同じ試験を複数回数えない。check配下で実行済みの同一コマンドはそのログを参照する。実行一覧と終了コードをevidence/command-results.jsonへ記録する。

U1のBun束ね確認は指定の/tmp出力を使用し、静的型検査と区別する。U2の準備・native試験はcheck内の成功を利用する。C2の--case allは明示形式でも実行して、check内の既定all結果との再現性を確認する。

## Execution Isolation and Troubleshooting

全体検証の間はアプリケーションと成果物の編集を止める。互換性試験の一時ファイル更新検出と、実際のソース差分を区別する。source-manifestの全パスのハッシュを開始前後で比較する。

prepareは同一内容の再コピーを省く。新しいネイティブ実行ファイルはmacOSで起動待ちを生じることがある。準備のビルド上限120秒・版probe上限180秒、版1一時コピーのwarmup上限180秒、版1本試験10秒、C2既定30秒を維持し、待ち時間を隠さない。失敗したコマンドは診断し、この段階の設定修正は二回を上限とする。生成コードの不具合は所定の修正経路へ戻す。
