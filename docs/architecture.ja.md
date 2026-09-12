# DDDプラグインの構成

[English](architecture.md) | 日本語

更新: 2026-09-13。実装の全体像を示します。通常承認のDDD検査を接続済みです。単独完了の標準側ガードには不足があります。

## 正規モデルを共有する

```text
要求・ストーリー
  → ddd-domain-modeling: 正規モデルと人間向け説明
  → domain-design: 集約の型・モジュール・ポートへの写像
  → functional-design: ユースケースと回復宣言
  → infrastructure-design: 層構造と保存・復元
  → code-generation: Rustコードとsource-manifest
```

正式な業務要素は正規モデルだけが所有し、後続は安定IDで参照します。詳細は[設計文書](../ddd/docs/README.ja.md)に集約しています。

## 検査を接続する

設計センサー6本はモデルと宣言を読み、Rustセンサー3本はCargo構成・構文・モデルを使います。通常承認では、登録された成果物の実パスがセンサーの一致条件に合う必要があります。

正規モデルは標準のファイル名に揃え、ユースケース宣言はfunctional-spec、層構造宣言はcicd-pipelineの必須セクションにしました。欠落・不正・正常を承認開始処理で検証しています。[成果物契約](../ddd/docs/artifact-contract.ja.md)を参照してください。

## 配布と責務を分ける

`ddd/` のソースをClaude/Codex向けに `dist/<harness>/` へビルドし、composeが利用先のステージ・センサー・ツール・ナレッジへ反映します。配布フォルダと、利用先へ反映されたファイルは別です。

旧カスタムビルドとkimi・opencode対応は維持しません。標準AI-DLCとの接続、新規導入・更新、実際のルール転送の確認は[互換性](../ddd/docs/framework-compatibility.ja.md)にまとめています。
