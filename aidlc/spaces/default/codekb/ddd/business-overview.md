# Business Overview — `ddd`

## ドメインと目的

`ddd` は、AI-DLC v2 に **ドメイン駆動設計（DDD）のワークフローを追加する**ためのプラグインリポジトリである。マニフェスト `ddd/.aidlc-plugin/plugin.json` は自身を「AI-DLC v2 にドメイン駆動設計のワークフローを追加するプラグインのひな型」と記述し、`dependencies: ["core"]` でコアフレームワークの上に載る拡張であることを宣言している。

想定される価値は、AI-DLC の標準ライフサイクル（ideation → inception → construction → operation）に、ドメイン層・ユースケース層・インタフェースアダプタ層という DDD/クリーンアーキテクチャの設計視点を持ち込み、ステージ・センサー・ナレッジとして機械的に強制することである。

## 現状 — 機能は未実装

**重要**: 本リポジトリには、プラグインとしての機能が1つも実装されていない。

`plugin.json` の `aidlc.contributes` は5つの貢献面（`stages/` / `overlays: contributions/` / `sensors/` / `knowledge/` / `tools/`）を宣言しているが、対応する6ディレクトリ（`stages/inception/`, `stages/construction/`, `contributions/inception/`, `contributions/construction/`, `sensors/`, `src/`, `knowledge/`, `tools/`）はいずれも `.gitkeep` のみで実体がゼロである。

したがって現在の `ddd` は「動作するプラグイン」ではなく、**検証済みのビルド／テスト足場（development scaffolding）**である。詳細な差分は `architecture.md` の「宣言と実装のギャップ」節、状態別の一覧は `component-inventory.md` を参照。

## 現に存在する機能

| 機能 | 実体 | 位置づけ |
|---|---|---|
| プラグインの検証・ビルド | `package.json` の `validate` / `build:claude` / `build:codex` | 親リポジトリのエンジンツールに委譲 |
| 品質ゲート | `check`（biome → validate → test の直列） | ローカル実行のみ |
| ハーネス互換パッチの適用 | `scripts/apply-harness-patches.ts` + `patches/installed-harnesses.patch` | 親リポジトリの `.claude/` `.codex/` を書き換える |
| ハーネス互換テスト | `tests/framework-compatibility.test.ts`, `tests/codex-dispatch-bridge.test.ts` | **親リポジトリのパッチを検証**するもので、DDD プラグインの機能テストではない |
| 実機検証 | `scripts/verify-codex-host.ts`（`test:host`） | opt-in、実 Codex CLI 認証が必要 |

## 設計入力（実装ではない）

`ddd/docs/` 配下の3本の層設計文書 — `domain-layer-design.md`（205行）、`use-case-layer-design.md`（124行）、`interface-adapter-layer-design.md`（100行） — は、**これから作るべきものを規定する設計入力**である。実装済み機能として読んではならない。これらが要求する成果物は、新設ステージ `domain-modeling`、`functional-design` / `infrastructure-design` への contribution、`sensors/aidlc-<id>.md` と `tools/` の実行スクリプト対、`knowledge/<agent-slug>/` のナレッジであり、すべて未着手である。

## 利用者

- AI-DLC v2 を DDD で運用したい開発チーム（プラグイン利用者、まだ提供物なし）
- 本プラグインを実装する開発者（現在の唯一の実利用者）

## Sources

- `ddd/.aidlc-plugin/plugin.json`, `ddd/package.json`, `ddd/README.md`
- `developer-scan-ddd.md`（Packages Found / Handoff Summary）
