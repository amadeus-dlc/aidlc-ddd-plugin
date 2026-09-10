## Developer Code Scan Results

対象リポジトリ: `ddd`（`ddd/` 配下、ワークスペース `/Users/j5ik2o/orca/workspaces/aidlc-ddd-plugin/base`）。
本スキャンの最重要の所見は「**存在するもの**（開発用の足場・ハーネス互換パッチ・テスト・設計文書）と、**空のまま足場だけあるもの**（stages / contributions / sensors / src）の差」である。プラグインとしての機能は**まだ1つも実装されていない**。

### Scan Coverage
- **Analyzed deeply**:
  - `./`（リポジトリ全体のファイル一覧）
  - `.aidlc-plugin/plugin.json`
  - `package.json`, `tsconfig.json`, `biome.json`, `.gitignore`, `bun.lock`, `README.md`
  - `tests/framework-compatibility.test.ts`, `tests/codex-dispatch-bridge.test.ts`
  - `scripts/apply-harness-patches.ts`, `scripts/verify-codex-host.ts`, `scripts/copy-reference-fixture.ts`
  - `patches/installed-harnesses.patch`（差分ヘッダ全件＋先頭ハンク群）
  - `docs/*.md`（6本、見出し構成と主要節）、`docs/evidence/*.json`（3本）
  - `stages/`, `contributions/`, `sensors/`, `src/`, `knowledge/`, `tools/`（中身の有無を実地確認）
- **Skimmed only**:
  - `dist/`（ビルド生成物、ファイル一覧と `.aidlc-plugin-projection.json` / `.claude-plugin/plugin.json` のみ確認）
  - `node_modules/`（`@biomejs` のみ、読み込まず）
  - `docs/domain-layer-design.md` ほか設計文書の本文詳細（設計入力として存在と役割のみ記録）
  - 親リポジトリ側の `.claude/`・`.codex/`・`aidlc-workflows/`（本スキャンの対象外）

### Packages Found
- `ddd`（`.aidlc-plugin/plugin.json`）— AI-DLC プラグイン — Markdown/TypeScript — DDD ワークフローを AI-DLC v2 に追加するプラグイン本体。**現状は宣言だけで、貢献する実体（stages / contributions / sensors / knowledge / tools）は空**。
- `ddd-plugin-dev`（`package.json`, `private: true`）— 開発用パッケージ — TypeScript(bun) — validate / build / test / ハーネス互換パッチ適用のスクリプト束。
- `scripts/` — 開発用ツール群 — TypeScript — 3ファイル（後述）。
- `tests/` — テストスイート — TypeScript — 2ファイル（後述）。
- `docs/` — 設計文書と検証証跡 — Markdown/JSON — **設計入力であり実装ではない**。
- 空の足場（`.gitkeep` のみ、実体ゼロ）: `stages/inception/`, `stages/construction/`, `contributions/inception/`, `contributions/construction/`, `sensors/`, `src/`, `knowledge/`, `tools/`。

### Build System
- **Type**: bun（`package.json` + `bun.lock`, `"type": "module"`, `lockfileVersion: 1`）。ビルド本体は AI-DLC 側のエンジンツールに委譲。
- **Config Files**: `package.json`, `tsconfig.json`(strict, `noEmit`, `types: ["bun"]`, include は `scripts/**` `src/**` `tests/**`), `biome.json`, `.gitignore`(`node_modules/`, `dist/`), `.aidlc-plugin/plugin.json`。
- **Build Dependencies**（スクリプト → 呼び出すエンジンツール）:
  - `validate` → `bun ../.codex/tools/aidlc-plugin-validate.ts .`
  - `build:claude` → `bun ../.codex/tools/aidlc-plugin-build.ts . claude`
  - `build:codex` → `bun ../.codex/tools/aidlc-plugin-build.ts . codex`
  - `check` → `check:biome` → `validate` → `test` の直列（`check:biome` は `biome check --error-on-warnings .`）
  - `test` → `bun test tests/`
  - `test:sandbox` → `bun ../.codex/tools/aidlc-plugin-test.ts . --install .. --harness claude` と同 `--harness codex` の2連
  - `test:host` → `bun scripts/verify-codex-host.ts`（実機 Codex CLI を呼ぶ opt-in 検証）
  - `prepare:harnesses` → `bun scripts/apply-harness-patches.ts`
  - `format` → `biome format --write .`
  - 依存方向: `ddd` → 親リポジトリの `../.codex/tools/*`（AI-DLC エンジン）、および `.aidlc-plugin/plugin.json` の `dependencies: ["core"]`。参照用サブモジュール `aidlc-workflows/` はテスト・実機検証のフィクスチャ供給元（読み取り専用）。
- **生成物**: `dist/claude/`・`dist/codex/`（計24ファイル）にハーネス別マニフェスト（`.claude-plugin/plugin.json` は `name: "aidlc-ddd"`、`.codex-plugin/`、`marketplace.json`）、`hooks/compose.ts`・`hooks/hooks.json`、および空ディレクトリの投影。`dist/` は `.gitignore` 対象。

### APIs Discovered
- HTTP/REST/GraphQL/gRPC の API は**存在しない**（サーバ実装なし）。
- 内部契約1: AI-DLC プラグイン貢献マニフェスト — `.aidlc-plugin/plugin.json` — `aidlc.contributes` に `stages/` `overlays: contributions/` `sensors/` `knowledge/` `tools/` の5面を宣言、`dependencies: ["core"]`。**宣言済みだが提供実体は0件**。
- 内部契約2: ハーネスフック契約（テストが検証している境界）— `.codex/hooks/aidlc-codex-adapter.ts` のターゲット `bind-bash-session` / `deliver-stage-rules` / `start-stage-rules` / `finish-stage-rules` / `plan-approval-guard`、イベント `PreToolUse` / `PostToolUse` / `SubagentStart`、ツール名 `spawn_agent` および `collaborationspawn_agent`。
- エクスポート関数: `copyReferenceFixture(source, destination): void`（`scripts/copy-reference-fixture.ts`）— テストと実機検証の双方から利用される唯一の共有 API。

### Frameworks & Libraries
- bun（ランタイム／テストランナー／パッケージマネージャ）— バージョン固定なし（`package.json` に engines 指定なし）— 実行基盤。
- `@biomejs/biome` — `2.5.12`（devDependency、唯一の依存）— lint / format / import 整理。
- TypeScript — **依存として未導入**（`tsconfig.json` は存在し `types: ["bun"]` を指定するが、`typescript` も `@types/bun` も devDependencies に無い）。README も「型検査を導入する際は追加が必要」と明記。
- Codex CLI `0.153.4` / モデル `gpt-6-astra` — 実機検証（`test:host`）の外部前提。
- AI-DLC エンジンツール（`aidlc-plugin-validate.ts` / `-build.ts` / `-test.ts`）— 親リポジトリ提供、バージョン管理は親側。

### Test Coverage
- **Test Directories**: `tests/`（2ファイル、ほかに `.gitkeep`）。フィクスチャディレクトリは無し（`biome.json` は `tests/fixtures` を除外予約しているが実体なし）。
- **Test Frameworks**: `bun:test`（`describe` / `test` / `expect`）。実行は `bun test tests/`。
- **Coverage Config**: **absent**（カバレッジ設定・閾値・レポータのいずれも無し）。
- 実際に検証している内容:
  - `tests/framework-compatibility.test.ts` — Codex アダプターの互換性。一時ディレクトリにフックをコピーし、コアフックをスタブ化して起動。(a) `bind-bash-session` が `permissionDecision: "allow"` と `AIDLC_SESSION_OVERRIDE=<session_id>` 付きコマンドを返し、`timeout_ms` を保持し、再実行で同一出力（冪等）。(b) `deliver-stage-rules` が `additionalContext` と `updatedInput` を失わずに `allow` を付与。(c) `deny` / `ask` はそのまま保持。(d) 終了コード2・stderr 診断・本文をそのまま透過。(e) 非 JSON 出力の素通し。加えて claude / codex 双方で `aidlc-plugin-test.ts` を使い捨てコピー上で実行し `drops: []` / `idempotent: true` / `graph.compiled: true` を要求、さらに `aidlc-workflows/plugins/test-pro` を使って Codex が `.agents/skills/<name>/SKILL.md` にランナーを生成することを検証。
  - `tests/codex-dispatch-bridge.test.ts` — 暗号化ディスパッチのブリッジ。`aidlc-workflows/dist/codex/aidlc` をフィクスチャとして複製し、`inception.md` に検証トークンを追記して確認する。暗号本文（`gAAAAA` 接頭辞）を書き換えずに子へルール束を渡すこと、ステージヒント欠落・不正時は exit 2、ワークフロー状態（`aidlc-state.md` の `Current Stage`）からのステージ選択、他セッション／他ロールへスナップショットが漏れないこと・後からのルール編集を拾わないこと、同一ロール重複起動の待ち合わせ、`PostToolUse` による予約解放、非 AI-DLC / composer エージェントの挙動不変、`.codex/hooks.json` の配線（`collaborationspawn_agent` マッチャー、`SubagentStart` / `PostToolUse`）、単独ステージヒントが `aidlc-state.md` を書き換えないこと、ガード拒否が予約を残さないこと。
- **重要**: これらのテストは**プラグインの機能ではなく、親リポジトリのハーネス互換パッチを検証**している。DDD プラグインの stages / sensors に対するテストは1件も存在しない。

### Code Quality Indicators
- **Linting**: Biome 2.5.12。設定は `ddd/biome.json`（`linter.rules.preset: "recommended"`、formatter: space/2/幅120、quoteStyle: double、`vcs.useIgnoreFile: true`、対象は `src/**` `scripts/**` `tests/**` と主要設定ファイル）。`check:biome` は `--error-on-warnings` で警告も失敗扱い。
- **CI/CD**: **リポジトリ内に CI 設定ファイルは存在しない**（`.github/workflows` 等なし）。品質ゲートは手元の `bun run check` のみ。
- **Documentation**: `README.md` は日本語で拡張ポイント表・検証手順・既知の制約を記載。`docs/` に設計文書6本（`domain-layer-design.md` 205行、`use-case-layer-design.md` 124行、`interface-adapter-layer-design.md` 100行、`framework-compatibility.md` 45行、`codex-host-verification.md` 58行、`reference-read-only.md` 29行、計561行）と `docs/evidence/` に検証証跡3本（`codex-host-bridge-verification.json` = 修正後 VERIFIED、`codex-host-verification.json` = 修正前の shell VERIFIED / stage dispatch NOT VERIFIED、`reference-read-only.json`）。**前3本は設計入力であり、実装済み機能ではない**（domain-layer-design は domain-modeling ステージ新設・センサー方針・ナレッジ構成・プラグイン機構の調査結果 §10 を、use-case / interface-adapter の2本は既存ステージへの contribution 拡張方針を記述する）。コード側のドックコメントは最小限（`copy-reference-fixture.ts` と `verify-codex-host.ts` の冒頭コメントのみ）。

### Technical Debt Signals
- **プラグイン機能が未実装**: `stages/inception/`, `stages/construction/`, `contributions/inception/`, `contributions/construction/`, `sensors/`, `src/`, `knowledge/`, `tools/` はいずれも `.gitkeep` のみ。`plugin.json` の `contributes` が5面を宣言しているのに提供実体は0件で、`dist/` にも空ディレクトリが投影されている。設計文書が求める `domain-modeling` ステージ、`functional-design` / `infrastructure-design` への contribution、各層のセンサーとナレッジは**すべてこれから作る**。
- **TypeScript 型検査が動かない**: `tsconfig.json` は strict 一式（`noUnusedLocals` / `noUnusedParameters` / `noImplicitOverride`）を指定するが `typescript` / `@types/bun` が未導入で、`check` にも型検査ステップが無い。README も未対応であることを認めている（`ddd/README.md`、`ddd/package.json` scripts）。
- **CI 不在**: lint とテストがローカル実行に依存。org ルールの「lint は CI で実行し失敗はマージをブロック」を満たす配線が無い。
- **カバレッジ閾値の不在**: `bun test` にカバレッジ設定なし。スコープ既定の 80% 行カバレッジ床を機械的に検査する手段が無い。
- **親リポジトリへのパッチ依存**: `patches/installed-harnesses.patch`（425行）が親の `.claude/hooks/aidlc-deliver-stage-rules.ts`（`isAidlcAgent` の export 化）、`.claude/tools/data/plugin-hooks-template/compose.ts` と `.codex/tools/...` の同ファイル（Codex で `.codex/skills` が無い場合に `.agents/skills` を使う分岐、drop メッセージの相対パス化）、`.codex/hooks.json`（マッチャーを `spawn_agent|collaborationspawn_agent` に拡張、`PostToolUse` の `finish-stage-rules`、`SubagentStart` の `start-stage-rules` 追加）、`.codex/hooks/aidlc-codex-adapter.ts`（複数ハンク）、および新規ファイル `.codex/hooks/aidlc-codex-dispatch.ts`（169行）を書き換える。`scripts/apply-harness-patches.ts` は `git apply --check` の順逆両方で適用状態を判定し、いずれにも一致しなければエラー停止する設計だが、**上流の `.claude/`・`.codex/` が更新されるたびにパッチが壊れる**構造的な負債。上流本体には取り込まれていない。
- **Codex 汎用検証器との非互換（README 明記）**: 生成マニフェストに `interface` が無いため `plugin-creator` 検証器では失敗する。Codex アプリへの導入互換性は未確認。
- **実機検証が手動・opt-in**: `test:host` は実際の Codex CLI 認証（`~/.codex/auth.json`）とネットワークを必要とし、モデル `gpt-6-astra` と 180 秒タイムアウトをハードコード、証跡は Git 管理外の `ddd-sandbox/` に出力。再現性は環境依存。
- **サブモジュール保護が環境ローカル**: `docs/reference-read-only.md` が認めるとおり、ファイル権限・ACL・ローカル Git 設定は clone に引き継がれない。別作業コピーでは保護が失われる。
- **`docs/codex-host-verification.md` の情報が二層**: 冒頭に修正後 VERIFIED の追記があり、本文は修正前の NOT VERIFIED の調査記録。読み手が誤読しうる構成。

## Handoff Summary
- **Intent-relevant finding**: `ddd/.aidlc-plugin/plugin.json` は `aidlc.contributes` として `stages/` `overlays: contributions/` `sensors/` `knowledge/` `tools/` の5面を宣言しているが、その5ディレクトリはすべて `.gitkeep` だけで実体がゼロである（`ddd/stages/inception/.gitkeep` ほか）。すなわち `ddd` は現時点で**動作するプラグインではなく、検証済みのビルド／テスト足場**であり、本 intent が作るべきものは `docs/domain-layer-design.md` §2・§8・§9・§10 と `docs/use-case-layer-design.md` §1・§7〜§9、`docs/interface-adapter-layer-design.md` §1・§8・§9 が設計入力として指定する成果物——新設ステージ `domain-modeling`、`functional-design` / `infrastructure-design` への contribution、`sensors/aidlc-<id>.md` ＋ `tools/` の実行スクリプト対、`knowledge/<agent-slug>/` のナレッジ——のすべてである。
- **Risks / follow-up**:
  - センサーの機械的な制約は `docs/domain-layer-design.md` §10 に調査結果として記録済み: マニフェストは `sensors/aidlc-<id>.md` というファイル名がハード要件でフラット走査、必須フィールドは `id` / `kind` / `command` / `default_severity` / `description`、`kind` は `deterministic` のみ。**blocking が実効を持つのは `fire_on: gate` ＋ `default_severity: blocking` の組み合わせだけ**（write 発火の blocking は advisory に降格）。
  - contribution は**追加のみ**で上書き・削除は不可。利用可能面は `adds.produces` / `adds.consumes` / `adds.sensors` / `adds.scopes` / `fragments` に限られ、`adds.required_sections` は機械強制されず、`adds.requires_stage` は deferred。ナレッジは `knowledge/<agent-slug>/` のディレクトリ名がエージェント slug と完全一致でなければ**黙って無視される**。
  - `patches/installed-harnesses.patch` は親リポジトリの `.claude/`・`.codex/` に対する未上流化の 425 行パッチで、上流更新のたびに `bun run prepare:harnesses` が「ベースラインと異なる」と停止する。プラグイン実装前に必ず `prepare:harnesses` → `check` の順で足場の健全性を確認すること。
  - 品質ゲートの穴が3つ: 型検査が実行不能（`typescript` / `@types/bun` 未導入）、CI 設定が無い、カバレッジ閾値が無い。org ルールの「lint は CI で失敗ブロック」と scope 既定の 80% 行カバレッジ床を満たすには、実装フェーズでこれらを整備する必要がある。
  - `aidlc-workflows/` は読み取り専用サブモジュール（リビジョン `a277af218f0df7f325d3b8be7b6d90fce2c5bd40`）で、`tests/codex-dispatch-bridge.test.ts` と `scripts/verify-codex-host.ts` が `aidlc-workflows/dist/codex/aidlc` をフィクスチャ供給元として参照している。書き込み・パッチ適用は禁止。
  - `docs/` の3本の層設計文書は**設計入力であって実装ではない**。アーキテクトはこれらを要件源として扱い、実装済み機能として記録しないこと。
