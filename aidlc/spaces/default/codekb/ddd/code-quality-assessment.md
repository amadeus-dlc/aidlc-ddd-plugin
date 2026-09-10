# Code Quality Assessment — `ddd`

## サマリ

| 観点 | 評価 | 根拠 |
|---|---|---|
| Lint | 良好 | biome 2.5.12、`--error-on-warnings` で警告も失敗扱い |
| 型検査 | **実行不能** | `typescript` / `@types/bun` 未導入 |
| テスト | 限定的 | 2ファイル。**プラグイン機能のテストは0件** |
| カバレッジ | **計測手段なし** | 設定・閾値・レポータいずれも無し |
| CI/CD | **不在** | リポジトリ内に CI 設定ファイルなし |
| ドキュメント | 良好（ただし要注意） | README + docs 6本／`codex-host-verification.md` は二層構造 |
| 技術的負債 | **高** | 未実装 + 未上流化パッチ + 品質ゲートの穴 |

## Linting

- ツール: Biome `2.5.12`、設定 `ddd/biome.json`
- `linter.rules.preset: "recommended"`、formatter: space / インデント2 / 行幅120 / `quoteStyle: double`、`vcs.useIgnoreFile: true`
- 対象: `src/**` `scripts/**` `tests/**` と主要設定ファイル
- 実行: `check:biome` = `biome check --error-on-warnings .`（警告も失敗）
- org ルール「プロジェクトの linter 設定に従う」は満たしている

## 型検査 — 品質ゲートの穴 (1/3)

`tsconfig.json` は strict 一式（`noUnusedLocals` / `noUnusedParameters` / `noImplicitOverride`）＋ `noEmit` ＋ `types: ["bun"]` を指定するが、`typescript` も `@types/bun` も devDependencies に無い。`check` にも型検査ステップがない。**設定は書かれているが1度も実行されていない**。README も未対応を認めている。

## CI/CD — 品質ゲートの穴 (2/3)

`.github/workflows` 等の CI 設定ファイルが**リポジトリ内に存在しない**。品質ゲートは手元の `bun run check` のみ。

**org ルール「linter は CI で実行し、失敗は PR をブロックする」を現状満たせない。** 実装フェーズで CI 配線が必要。

## カバレッジ — 品質ゲートの穴 (3/3)

`bun test` にカバレッジ設定・閾値・レポータのいずれもない。スコープ `plugin-dev` は org の 80% 行カバレッジ床の対象外だが、「既存スイートをグリーンに保つ」要件はあり、カバレッジの機械的検査手段は存在しない。

## テスト

- ディレクトリ: `tests/`（2ファイル + `.gitkeep`）。フィクスチャの実体なし（`biome.json` は `tests/fixtures` を除外予約するがディレクトリは存在しない）
- フレームワーク: `bun:test`（`describe` / `test` / `expect`）、実行は `bun test tests/`
- 検証内容の詳細は `component-inventory.md` の `harness-compatibility-tests` を参照

**最重要の所見**: これら2本は**親リポジトリのハーネス互換パッチを検証**するものであり、DDD プラグインの機能を1つも検証していない。stages / contributions / sensors / knowledge / tools に対するテストは存在しない（貢献物自体が存在しないため）。

## 技術的負債

### TD-1: プラグイン機能が未実装（最重要）

`plugin.json` が5貢献面を宣言する一方、`stages/inception/`, `stages/construction/`, `contributions/inception/`, `contributions/construction/`, `sensors/`, `src/`, `knowledge/`, `tools/` はすべて `.gitkeep` のみ。`dist/` にも空ディレクトリが射影されている。設計文書が求める `domain-modeling` ステージ、`functional-design` / `infrastructure-design` への contribution、センサーと `tools/` のスクリプト対、`knowledge/<agent-slug>/` は**すべてこれから作る**。

### TD-2: 親リポジトリへの未上流化パッチ（425行）

`patches/installed-harnesses.patch` は親の `.claude/hooks/aidlc-deliver-stage-rules.ts`（`isAidlcAgent` の export 化）、`.claude/tools/data/plugin-hooks-template/compose.ts` と `.codex/tools/` の同ファイル（Codex で `.codex/skills` が無い場合に `.agents/skills` を使う分岐、drop メッセージの相対パス化）、`.codex/hooks.json`（マッチャーの `spawn_agent|collaborationspawn_agent` 拡張、`PostToolUse` の `finish-stage-rules`、`SubagentStart` の `start-stage-rules` 追加）、`.codex/hooks/aidlc-codex-adapter.ts`（複数ハンク）を書き換え、新規 `.codex/hooks/aidlc-codex-dispatch.ts`（169行）を追加する。

`scripts/apply-harness-patches.ts` は `git apply --check` を順逆両方で試して適用状態を判定し、いずれにも一致しなければエラー停止する設計だが、**上流の `.claude/` `.codex/` が更新されるたびにパッチが壊れる**構造的負債である。上流本体には取り込まれていない。

**推奨アクション**: プラグイン実装に着手する前に、必ず `bun run prepare:harnesses` → `bun run check` の順で足場の健全性を確認すること。

### TD-3: 読み取り専用サブモジュールへの依存

`aidlc-workflows/`（リビジョン `a277af218f0df7f325d3b8be7b6d90fce2c5bd40`）は書き込み禁止だが、`tests/codex-dispatch-bridge.test.ts` と `scripts/verify-codex-host.ts` がそのフィクスチャに依存する。保護はファイル権限・ACL・ローカル Git 設定に依存し clone に引き継がれないため、別作業コピーでは失われる（`docs/reference-read-only.md` が認めている）。

### TD-4: Codex 汎用検証器との非互換

生成マニフェストに `interface` フィールドが無いため、`plugin-creator` 検証器では失敗する（README 明記）。Codex アプリへの導入互換性は未確認。

### TD-5: 実機検証が手動・opt-in・環境依存

`test:host` は実 Codex CLI 認証（`~/.codex/auth.json`）とネットワークを要し、モデル `gpt-6-astra` と 180 秒タイムアウトをハードコード、証跡は Git 管理外の `ddd-sandbox/` へ出力する。再現性が環境に依存する。

### TD-6: `docs/codex-host-verification.md` の情報が二層

冒頭に修正後 VERIFIED の追記があり、本文は修正前の NOT VERIFIED の調査記録。読み手が誤読しうる構成。`docs/evidence/` も同様に `codex-host-bridge-verification.json`（修正後 VERIFIED）と `codex-host-verification.json`（修正前 shell VERIFIED / stage dispatch NOT VERIFIED）が併存する。

## ドキュメント品質

- `README.md`（日本語）: 拡張ポイント表・検証手順・既知の制約を記載。型検査未対応と `plugin-creator` 非互換を自ら明記しており誠実
- `docs/` 6本 計561行 + `docs/evidence/` 3本
- **`domain-layer-design.md` / `use-case-layer-design.md` / `interface-adapter-layer-design.md` の3本は設計入力であり実装ではない**。実装済み機能として参照してはならない
- コード側のドックコメントは最小限（`copy-reference-fixture.ts` と `verify-codex-host.ts` の冒頭コメントのみ）

## 実装フェーズへの推奨（優先順）

1. `prepare:harnesses` → `check` で足場の健全性を確認（TD-2）
2. `typescript` / `@types/bun` の導入と `check` への型検査ステップ追加
3. CI 設定の追加（lint + test をマージ前に実行）
4. 5貢献面の実装と、それに対するテストの追加（TD-1）
5. カバレッジ計測の導入

## Sources

- `ddd/biome.json`, `ddd/tsconfig.json`, `ddd/package.json`, `ddd/README.md`, `ddd/patches/installed-harnesses.patch`, `ddd/docs/`
- `developer-scan-ddd.md`（Test Coverage / Code Quality Indicators / Technical Debt Signals / Risks・follow-up）
