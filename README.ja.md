# aidlc-ddd-plugin

[English](README.md) | 日本語

[AI-DLC v2](https://github.com/awslabs/aidlc-workflows) にドメイン駆動設計（DDD）を追加する、追加型プラグインです。`ddd-domain-modeling` ステージが要件から**正規ドメインモデル**（集約＝有限状態機械、不変条件、コマンド、イベント、ドメインエラー、状態遷移、Domain Primitive、Always Valid Model）を作り、設計センサーがそのモデルと下流の宣言成果物を、Rust コードセンサーが生成コードを規則 (a)〜(n) と層依存表に対して検査します。コアは変更しません。プラグインを無効化すれば、素のワークフローに戻ります。

これは開発ワークスペースです。プラグイン本体は [`ddd/`](ddd/) にあり、設計はその [README](ddd/README.md) を参照してください。

## ハイライト

- **本物のゲートを持つ正規モデル** — `ddd-domain-modeling` ステージが集約境界までを所有し、機械条件 (i)〜(v) でゲートします。全集約に不変条件、全コマンドに状態効果とドメインエラー、全参照 ID の解決、`domain-model.yaml` と派生 `domain-model.md` の一致。yaml が正で、markdown は派生です。
- **2 軸の宣言を検査** — 集約ごとに `programming_model`（actor/class）× `persistence_method`（state-sourcing/event-sourcing）を宣言。複数集約に跨がるユースケースは Process Manager か明示的な再実行戦略を要求します。
- **安定 ID と系譜** — 要素 ID は不変（`aggregate.invoice`、`command.invoice.issue`）。rename / split / merge / 削除は `lineage:` に記録され、下流参照が黙って壊れません。
- **設計センサー** — 6 本（blocking 5・advisory 1）が、正規モデル、宣言 ID の解決、集約写像、ユースケース宣言、層構造宣言（規則 (k)〜(n) を含む）を検査します。
- **Rust コードセンサー** — 3 本（すべて blocking）が生成コードに規則 (a)〜(n) を適用します。公開フィールド禁止、宣言なき状態変更の禁止、完全コンストラクタ経由の生成、ドメイン／ユースケース層からの getter 呼び出し禁止、依存方向と外部 I/O (g)、ユースケース連鎖、コマンド側⇄クエリ側、リポジトリ命名、復元経路の迂回。
- **解析時にツールチェーン不要** — Rust 解析器は tree-sitter-rust の WASM 文法を同梱し、bun だけで動作します。cargo・Node.js・ネットワークは不要。
- **決定的・ゴールデン検証済み** — 設計と Rust のゴールデンケースが各規則を実スクリプト入口で実行し、複数回実行でバイト一致することを検証します。

## クイックスタート

### 前提

- [bun](https://bun.sh/)
- [AI-DLC v2](https://github.com/awslabs/aidlc-workflows) が導入済みの対象プロジェクト

Rust ツールチェーンは不要です。コードセンサーは同梱の WASM 文法で解析します。

### AI-DLC プロジェクトへのインストール

特定の安定リリースをインストールします。ブートストラップスクリプトと導入されるソースは同じ不変タグから取得します。

```sh
VERSION=v0.1.0
curl -fsSL "https://raw.githubusercontent.com/amadeus-dlc/aidlc-ddd-plugin/${VERSION}/ddd/scripts/install.ts" |
  bun - --project <your-aidlc-project> --tag "${VERSION}"   # --harness codex, kimi, opencode, …（既定: claude）
```

最初のタグが公開されるまでは、開発チェックアウトからインストールします。

```sh
git clone --recurse-submodules https://github.com/amadeus-dlc/aidlc-ddd-plugin.git
bun aidlc-ddd-plugin/ddd/scripts/install.ts --project <your-aidlc-project> --from aidlc-ddd-plugin
# または --ref main
```

インストーラは `ddd/dist/<harness>/` にハーネス投影をビルドし、ステージ・contribution・センサー・ツール・ナレッジを対象プロジェクトのハーネスツリー（`.claude/`・`.codex/`・`.kimi-code/`・`.aidlc/` など）へ compose します。store 系ハーネス（Claude Code / Codex / Kimi Code / opencode）は `dist/` から直接 compose し、プロジェクトへは何もコピーしません。storeless 系（Kiro / Kiro IDE / Cursor）は、それらのホストが期待する形で投影をプロジェクトルートへ folder-drop します。`--dry-run` で対象を変更せずに compose を検証できます。対象プロジェクト以外は変更されず、プラグインを無効化すれば素のワークフローが再 compose されます。更新時は、compose の前に自プラグインの既存ファイルを更新するため、古いスキーマやツールは残りません。

ソースと更新のセレクタ:

| オプション | 意味 |
|---|---|
| セレクタなし | 最新の安定 Semantic Versioning タグを解決してインストール。 |
| `--tag v0.1.0` | 不変の 1 リリースをインストール。本番ではこれを推奨。 |
| `--from <repo-root>` | ローカルチェックアウトからビルド。プラグイン開発中に有用。 |
| `--ref <branch>` | 可動なブランチを取得。再現性が要る導入ではなく開発追従向け。 |
| `--update` | 記録済みセレクタを再利用。latest は再解決、local/ref は同じソースを再取得。固定タグは不変のため `Changed 0`。セレクタとは併用不可。 |

インストールに成功すると、バージョン・ソースセレクタ・タイムスタンプ・payload ダイジェストを対象プロジェクトの `<harness>/tools/data/ddd-install.json` に記録します。`<harness>` は選択したハーネスツリー（`.claude` や `.codex` など）です。配布に npm パッケージや GitHub Release アセットは使わず、タグ／ブランチのインストールは GitHub のソースアーカイブを直接取得します。

> インストーラは folder-drop であり、導入時のトラストゲートがありません。実行してよいと判断できるビルドにだけ向けてください。

注: ステージは `scopes: [enterprise, feature, mvp, classic, workshop, refactor]` を宣言するため、それらのスコープで作成した intent で実行されます。

### 途中からの導入

このプラグインから始めている必要はありません。合成は追加型なので、AI-DLC ワークフローが進行中のプロジェクトへ導入しても他は変わりません。そして**導入前に作られた intent もモデリングできます**。既存 intent に対して、ワークフローを進めずにステージを単独実行します。

```
/aidlc --stage ddd-domain-modeling --single
```

（合成される `/ddd-domain-modeling` スキルとしても提供されます。）エンジンは intent の既存要件・ストーリーを解決し、ステージはその intent の記録の下に正規モデルを書きます。ワークフローの Current Stage は変更されません。ステージが SKIP のときは `ddd-model-presence` センサーが note 付きで pass するため、下流ステージは緑のままです。導入後に作られた intent は自動的にこのステージを取り込みます。

## 開発

開発時はサブモジュール込みで clone し、プラグインの開発依存をインストールします。

```sh
git clone --recurse-submodules https://github.com/amadeus-dlc/aidlc-ddd-plugin.git
cd aidlc-ddd-plugin/ddd
bun install        # 開発依存のみ。どのプロジェクトにも何もインストールしません
```

変更の検証:

```sh
bun run check          # biome + プラグイン検証 + ユニット / ゴールデンテスト
bun run build:all      # dist/claude, codex, kimi, opencode
bun run test:sandbox   # 4 ハーネスを compose し、ビルド済みツールを検証
bun run test:dist      # ビルド済み dist/<harness>/tools をゴールデンで検証
```

`test:sandbox` は claude / codex / kimi / opencode に対して `aidlc-plugin-test --install` を実行し（drops 0・ステージがグラフ搭載・2 回目 compose が冪等）、続けて設計と Rust のゴールデンケースを投影済みツールで実行します。

## リポジトリ構成

| パス | 役割 |
|---|---|
| [`ddd/`](ddd/) | プラグインのソース: ステージ、contribution、センサー、ツール、ナレッジ、テスト |
| `ddd/scripts/install.ts` | ユーザプロジェクト用のワンコマンド・インストーラ |
| [`aidlc-workflows/`](https://github.com/j5ik2o/aidlc-workflows) | フレームワークのサブモジュール。validate/build/test ツールチェーンを提供し、ここでは編集しません |
| `ddd-sandbox/` | compose テスト対象に使う使い捨て AI-DLC インストール。git 管理外 |
| `aidlc/` | このリポジトリ自身の AI-DLC ワークスペース状態（正規モデル、CodeKB、intent 成果物） |

## ドキュメント

- 利用ガイド（新規プロジェクト／途中導入）: [docs/usage.ja.md](docs/usage.ja.md)
- 図解付きアーキテクチャ概要: [docs/architecture.ja.md](docs/architecture.ja.md)
- プラグインの設計・センサー・導入・制約: [ddd/README.md](ddd/README.md)
- リリース履歴: [ddd/CHANGELOG.md](ddd/CHANGELOG.md)
- 設計入力（ドメイン層・ユースケース層・インターフェイスアダプタ層設計）: [ドメイン層](ddd/docs/domain-layer-design.md)、[ユースケース層](ddd/docs/use-case-layer-design.md)、[IA 層](ddd/docs/interface-adapter-layer-design.md)
- インストール済みハーネスの互換パッチ: [ddd/docs/framework-compatibility.md](ddd/docs/framework-compatibility.md)

## ヘルプ

- Issues: <https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues>

## ライセンス

MIT。[LICENSE](LICENSE) を参照。同梱の `web-tree-sitter`（MIT）と `tree-sitter-rust` WASM（The Unlicense）は、それぞれ [`ddd/tools/ddd/lib/rust/vendor/`](ddd/tools/ddd/lib/rust/vendor/) と [`ddd/tools/ddd/wasm/`](ddd/tools/ddd/wasm/) に独自ライセンスを持ちます。
