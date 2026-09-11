# Component Inventory — `ddd`

各コンポーネントの状態は **implemented**（実装あり）／**scaffolded-empty**（`.gitkeep` のみ、実体ゼロ）のいずれか。

## plugin-manifest

- **Status**: implemented（宣言のみ）
- **Path**: `.aidlc-plugin/plugin.json`
- **責務**: プラグイン識別、`dependencies: ["core"]`、5貢献面のパス宣言
- **依存**: AI-DLC コア（`core`）
- **注記**: 宣言は完全だが、指すディレクトリはすべて空

## build-scripts

- **Status**: implemented
- **Path**: `package.json`（scripts 10 本）, `bun.lock`
- **責務**: validate / build / check / test / format / prepare:harnesses の実行入口
- **依存**: 親リポジトリの `../.codex/tools/aidlc-plugin-{validate,build,test}.ts`、`@biomejs/biome`、bun
- **注記**: 詳細は `api-documentation.md` §1

## harness-patch-toolchain

- **Status**: implemented
- **Path**: `scripts/apply-harness-patches.ts`, `patches/installed-harnesses.patch`（425行）
- **責務**: 親リポジトリの `.claude/` `.codex/` へハーネス互換パッチを適用。`git apply --check` を順逆両方で試し、どちらにも一致しなければエラー停止
- **依存**: 親リポジトリのファイル配置、git
- **注記**: 未上流化の構造的負債（`code-quality-assessment.md` 参照）

## reference-fixture-helper

- **Status**: implemented
- **Path**: `scripts/copy-reference-fixture.ts`
- **責務**: `copyReferenceFixture(source, destination)` — `aidlc-workflows/dist/codex/aidlc` の複製
- **依存**: `aidlc-workflows/`（読み取り専用サブモジュール）
- **注記**: テストと実機検証の双方が使う唯一の共有 API

## host-verification-script

- **Status**: implemented
- **Path**: `scripts/verify-codex-host.ts`
- **責務**: 実機 Codex CLI（`0.153.4` / モデル `gpt-6-astra`）を起動した opt-in 検証。180 秒タイムアウト、証跡は Git 管理外の `ddd-sandbox/` へ出力
- **依存**: `~/.codex/auth.json`、ネットワーク、`reference-fixture-helper`

## harness-compatibility-tests

- **Status**: implemented
- **Path**: `tests/framework-compatibility.test.ts`, `tests/codex-dispatch-bridge.test.ts`
- **責務**: Codex アダプターの互換性（`allow` 付与、`additionalContext` / `updatedInput` 保持、`deny` / `ask` 透過、exit code 2 と stderr の透過、冪等性）と暗号化ディスパッチブリッジ（暗号本文の非改変、ステージヒント欠落時 exit 2、セッション／ロール間のスナップショット非漏洩、予約と解放）
- **依存**: 親リポジトリの hooks、`aidlc-workflows/` フィクスチャ、`bun:test`
- **注記**: **DDD プラグインの機能テストではない**。プラグイン機能に対するテストは0件

## design-documents

- **Status**: implemented（文書として存在）／**設計入力であり実装ではない**
- **Path**: `docs/domain-layer-design.md`(205), `docs/use-case-layer-design.md`(124), `docs/interface-adapter-layer-design.md`(100), `docs/framework-compatibility.md`(45), `docs/codex-host-verification.md`(58), `docs/reference-read-only.md`(29), `docs/evidence/*.json`(3)
- **責務**: これから作るべきステージ・contribution・センサー・ナレッジの規定、およびプラグイン機構の制約調査結果（`domain-layer-design.md` §10）
- **注記**: 前3本の内容を実装済み機能として扱ってはならない

## stages-contribution

- **Status**: **scaffolded-empty**
- **Path**: `stages/inception/`, `stages/construction/`（`.gitkeep` のみ）
- **想定責務**: 新設ステージ `domain-modeling` ほか
- **設計入力**: `docs/domain-layer-design.md` §2・§8〜§10

## overlays-contribution

- **Status**: **scaffolded-empty**
- **Path**: `contributions/inception/`, `contributions/construction/`（`.gitkeep` のみ）
- **想定責務**: `functional-design` / `infrastructure-design` への `adds.*` / `fragments` 追加
- **設計入力**: `docs/use-case-layer-design.md` §1・§7〜§9、`docs/interface-adapter-layer-design.md` §1・§8〜§9

## sensors-contribution

- **Status**: **scaffolded-empty**
- **Path**: `sensors/`（`.gitkeep` のみ）
- **想定責務**: `aidlc-<id>.md` 形式のセンサーマニフェスト
- **依存（意図）**: `tools-contribution`

## knowledge-contribution

- **Status**: **scaffolded-empty**
- **Path**: `knowledge/`（`.gitkeep` のみ）
- **想定責務**: `<agent-slug>/` 単位のナレッジ。slug 完全一致でなければ黙って無視される

## tools-contribution

- **Status**: **scaffolded-empty**
- **Path**: `tools/`（`.gitkeep` のみ）
- **想定責務**: センサーが `command` から呼ぶ実行スクリプト

## src-placeholder

- **Status**: **scaffolded-empty**
- **Path**: `src/`（`.gitkeep` のみ）
- **注記**: `tsconfig.json` の include 対象だが実装なし

## build-output

- **Status**: implemented（生成物）
- **Path**: `dist/claude/`, `dist/codex/`（計24ファイル、`.gitignore` 対象）
- **内容**: ハーネス別マニフェスト（`.claude-plugin/plugin.json` は `name: "aidlc-ddd"`、`.codex-plugin/`、`marketplace.json`）、`hooks/compose.ts`、`hooks/hooks.json`、および**空ディレクトリの射影**

## 集計

| 状態 | 件数 |
|---|---|
| implemented | 8（うち design-documents は設計入力、build-output は生成物） |
| **scaffolded-empty** | **6** |
| プラグイン貢献面として機能するもの | **0 / 5** |

## Sources

- `ddd/` のファイル一覧および各ファイル本体
- `developer-scan-ddd.md`（Packages Found / Test Coverage / Technical Debt Signals / Handoff Summary）
