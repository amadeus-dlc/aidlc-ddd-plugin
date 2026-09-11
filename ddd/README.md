# DDD プラグイン

AI-DLC v2 にドメイン駆動設計（DDD）のワークフローを追加するプラグインです。
識別子は `ddd`、バージョンは `0.1.0` です。Domain Primitive と Always Valid
Domain Model を設計工程として組み込み、生成コードが規約に従っているかを
センサーで機械的に検証します。

## 何を追加するか

| 面 | 実体 | 内容 |
| --- | --- | --- |
| ステージ | `stages/inception/ddd-domain-modeling.md` | 正規モデル（集約境界まで）を確定する inception ステージ |
| contribution | `contributions/`（4本） | domain-design / functional-design / infrastructure-design / code-generation への追加 |
| センサー | `sensors/`（9本） | 設計成果物と Rust コードを検査 |
| ナレッジ | `knowledge/`（8本） | DDD/クリーンアーキテクチャと Rust 規約 |
| ツール | `tools/` | センサー実行スクリプトと共有ライブラリ（`tools/ddd/lib/`） |

## センサー一覧

### 設計センサー（U4）

| id | 重大度 | 検査 |
| --- | --- | --- |
| `ddd-model-completeness` | blocking | 正規モデルの読み込み・完了条件 (i)(ii)(iv)・`domain-model.md` との整合 (f) |
| `ddd-model-presence` | blocking | domain-modeling 実行時にモデルが存在・読み込み・参照解決できること |
| `ddd-reference-ids` | blocking | 宣言 ID の解決（未定義・廃止・種別・循環） |
| `ddd-mapping-declarations` | blocking | 集約写像の 2 軸・ユースケース 6 項目・(j) |
| `ddd-layer-structure` | blocking | 層構造宣言の必須項目と (k)(l)(m)(n)（設計側） |
| `ddd-design-advisories` | advisory | 複数集約・リポジトリスコープ・upsert store |

### Rust コードセンサー（U5）

すべて blocking、`code-summary.md` を契機に発火します。規則 (a)〜(n) は
構文と字面だけで判定し、型推論・名前解決・実行は行いません。

| id | 規則 |
| --- | --- |
| `ddd-rust-domain` | (a) 公開フィールド / (b) 未宣言の状態変更 / (c) 不完全な生成経路 / (d) getter 呼び出し / (g) 依存方向と外部 I/O / 層診断 / `model.invalid` |
| `ddd-rust-use-case` | (g) DIP と外部 I/O / (h) execute の集約引数 / (i) ユースケース連鎖 / (d) getter |
| `ddd-rust-interface-adapter` | (k) コマンド側⇄クエリ側 / (l) クエリ側のドメイン参照 / (m) リポジトリ命名 / (n) 復元経路の迂回 / (g) |

## 対応ハーネス

Claude Code（`.claude`）、Codex CLI（`.codex`）、Kimi Code（`.kimi-code`）、
opencode（`.opencode` / `.aidlc`）向けに投影します（`aidlc-plugin-build` の
plugin-targets に準拠）。

## 導入手順

```sh
cd ddd
bun install
bun run check          # biome + validate + test
bun run build:claude   # dist/claude を生成
bun run build:codex    # dist/codex を生成
bun run build:kimi     # dist/kimi を生成
bun run build:opencode # dist/opencode を生成
bun run build:all      # 4 ハーネスを一括ビルド
bun run test:sandbox   # 4 ハーネスに compose し、dist ツールでゴールデン検証
bun run test:dist      # ビルド済み dist/<harness>/tools でゴールデン検証
```

`test:sandbox` は 4 ハーネスを一括ビルドしたうえで `aidlc-plugin-test` を
claude / codex / kimi / opencode に対して実行し（drops ログが空・グラフに
搭載・冪等）、続けて `scripts/verify-dist.ts` で設計＋Rust のゴールデン全件を
投影済み `dist/<harness>/tools` の子プロセス入口から実行します。

## 命名・配置規約（要約）

- **安定 ID**: `<kind>.<segments>`（`aggregate.invoice`、`command.invoice.issue`）。
- **層クレート**: 接尾辞 `-domain` / `-use-case` / `-interface-adapter` /
  `-infrastructure`、または `packages|modules/<layer>/` 配置。
- **CQRS 側**: `command` / `query` / `rmu` の名前セグメントまたは配置。
- **composition root**: bin 専用、`-composition-root` 接尾辞、または
  `packages|modules/composition-root/`。
- **リポジトリ**: ポートは `<Aggregate>Repository`（媒体語禁止）。実装は
  媒体プレフィックス可（`InMemoryInvoiceRepository`）。

## 同梱ライセンス

- `tools/ddd/lib/rust/vendor/` — `web-tree-sitter@0.25.10`（MIT）、
  `tools/ddd/wasm/tree-sitter-rust.wasm` — `tree-sitter-wasms` の
  tree-sitter-rust（The Unlicense、ABI 14）。詳細は
  `tools/ddd/lib/rust/vendor/NOTICE.md`。

## 既知の制約

- 対応言語は Rust のみ（第2言語は `tools/ddd/lib/rules/<lang>/` を追加する）。
- common-name の (c-model)（FactoryRule の前提条件を検査しない復元経路）と
  interior mutability はナレッジに委ね、初版では機械検査しない。
- 例の索引（`knowledge/*` の Examples）は U5 の clean fixture を指す予定パスを含む。
- `prepare:harnesses` の patch baseline は 2.8.1 再投影で stale になり得る。
  codex の compose skills 配置（`.codex/skills` → `.agents/skills`）は
  `.codex/tools/data/plugin-hooks-template/compose.ts` に直接反映済み。

## ライセンス

参照元の MIT ライセンスを引き継ぎます。フレームワークにはサブモジュール内の
ライセンスが適用されます。
