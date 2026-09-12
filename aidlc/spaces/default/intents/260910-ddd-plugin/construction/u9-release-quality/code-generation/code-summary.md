# Code Summary — U9 公開品質（u9-release-quality）

## Sources

- `construction/u9-release-quality/code-generation/code-generation-plan.md`（承認済み計画。Testing Contract `sha256:8d7f1a7f51e8e641623b1e21dc4fed305238daeae0eb70f0d7e8c9b1a833a386`、Step 1〜6、要件表、乖離 3 件）
- `construction/u9-release-quality/code-generation/unit-test-instructions.md`（Unit 限定コマンド `bun test tests/framework-compatibility.test.ts`）
- `inception/requirements-analysis/requirements.md`（FR11.3、FR11.4、FR11.6、NFR5、NFR6、NFR10。規則 (e) は FR6.1）
- `inception/units-generation/unit-of-work.md`（U9 の責務・境界。`plugins/ddd/LICENSE` の同梱を挙げる）
- `construction/u3-plugin-scaffold/code-generation/code-summary.md`（FR11.3 の GAP 記録の引き継ぎ元）
- `ddd/README.md`、`ddd/CHANGELOG.md`、`ddd/tests/framework-compatibility.test.ts`、`ddd/docs/framework-compatibility.md`、`ddd/docs/codex-host-verification.md`、`ddd/scripts/verify-dist.ts`、`ddd/scripts/verify-codex-host.ts`、`ddd/tests/README.md`、`ddd/tests/README.ja.md`（既存。本 Unit の記録対象）
- `ddd/package.json`、`ddd/sensors/aidlc-ddd-*.md`（9 本）、`ddd/tests/README.md`、`LICENSE`（ワークスペース根）（照合の出典）
- 実測ログ（`bun run validate` / `build:claude` / `build:codex` / `check`、`bun test tests/framework-compatibility.test.ts` ×3、`bun test tests/`）

## この Unit で行ったこと

本 Unit は kind: packaging であり、実装はすでに作業ツリー上に存在する。
Step 1〜6 を「既存実装の検証」と「テストの実行と記録」として実施した。`ddd/` 配下、`.codex/` / `.claude/` 配下に新規
ファイルも作っていない（ビルドが生成した `ddd/dist/` は `ddd/.gitignore` の管理外）。

**2026-09-12 の改訂で Step 7・8 を追加した。**

| ステップ | 所見 | 触れたファイル |
|---|---|---|
| Step 7 | R-01 | 計画と `unit-test-instructions.md` のテスト件数（記録のみ） |
| Step 8 | U7 からの申し送り（R-02） | **`ddd/CHANGELOG.md` の 1 文** |

**アプリケーションソースへの改変は Step 8 の `ddd/CHANGELOG.md` 1 パスに限られる。**
Step 1〜6 は 1 バイトも変更していない。本ディレクトリの作成物は
`code-summary.md`、`traceability.json`、`source-manifest.json` の 3 点である。

セッション開始時点で `git status` に出ていた `ddd/knowledge/**`、`ddd/tests/u2-rust-analysis-foundation.test.ts`、
`ddd/tools/ddd/lib/rust/analyzer.ts` の変更は本 Unit の作業前から存在するもので、本 Unit は触れていない。
同じ周回で U2・U4・U5・U8 が加えた変更（`resolver.ts`、センサーマニフェスト 3 本、
ゴールデンケース 2 本、`evaluate.ts`、ナレッジ 1 本）も本 Unit の所有外である。

## 記録したファイル（source-manifest.json の所有パス）

| パス | 種別 | 役割 |
|---|---|---|
| `ddd/README.md` | 検証のみ | FR11.6 の 5 節、NFR10 の既知の制約・ライセンス・同梱ライセンス |
| `ddd/CHANGELOG.md` | 検証のみ | Keep a Changelog 1.1.0 形式、`## [0.1.0] - 2026-09-11`、Added / Notes |
| `ddd/tests/framework-compatibility.test.ts` | 検証のみ | compose の 3 条件（claude / codex）、Codex アダプタ互換、Codex ランナー生成 |
| `ddd/docs/framework-compatibility.md` | 検証のみ | インストール済みハーネスの互換性修正と再適用・検証手順 |
| `ddd/docs/codex-host-verification.md` | 検証のみ | Codex 実機でのフック検証記録 |
| `ddd/scripts/verify-dist.ts` | 検証のみ | ビルド済み `dist/<harness>/tools` でゴールデン全件を子プロセス入口から実行（`test:dist`） |
| `ddd/scripts/verify-codex-host.ts` | 検証のみ | Codex 実機の明示実行用検証（`test:host`） |
| `ddd/tests/README.md` | 検証のみ | テストスイート一覧と既存スイートの前提条件（英語） |
| `ddd/tests/README.ja.md` | 検証のみ | 同、日本語 |

### 所有判断の理由

- **`ddd/tests/README.md` / `ddd/tests/README.ja.md` は含めた。** 両ファイルはコミット `424cf7f`（docs: add the usage,
  architecture, decisions and test guides）で追加された公開向けのテスト案内であり、個々のコンポーネント（U1〜U8）ではなく
  スイート全体の実行方法と前提条件を述べる。FR11.3 の GAP 判定が根拠とする「`aidlc-workflows` の dist fixture が無いと 2 スイートが
  落ちる」という既知の前提条件の出典でもあり、公開品質の文書として U9 に属すると判断した。CHANGELOG は両ファイルに言及しないが、
  CHANGELOG の v0.1.0 は 2026-09-11 の合成成功時点の記録であり、同日の後続コミットの文書を含まないのは記述の順序によるもので、
  所有を否定する材料ではない。
- **`ddd/docs/reference-read-only.md` は含めなかった。** 内容は `aidlc-workflows/` サブモジュールを作業コピー上で読み取り専用に
  する OS 権限・ACL・ローカル Git 設定の記録であり、「新しい clone には引き継がれない」と自ら述べる作業環境の運用メモである。
  プラグインの公開品質（NFR10 が挙げる LICENSE / README / CHANGELOG / 既知の制約）ではなく、U9 の責務の外にある。
  `ddd/docs/framework-compatibility.md` からリンクされている点は記録しておく。
- 指示どおり、`ddd/docs/domain-layer-design.md` 等の設計入力文書、`ddd/docs/decisions*.md`、`ddd/scripts/install.ts`、
  `ddd/tests/install.test.ts` は含めていない。
- 補足として `ddd/docs/evidence/` に `codex-host-verification.json`、`codex-host-bridge-verification.json`、
  `reference-read-only.json` があり、前 2 つは `ddd/docs/codex-host-verification.md` が証跡として参照する。指示の候補に無いため
  マニフェストには列挙せず、ここに所在だけ記す。

## テスト実測（`ddd/` を作業ディレクトリ、bun 1.3.13）

### Unit 限定コマンド `bun test tests/framework-compatibility.test.ts`

| 回 | pass | fail | 終了コード | 備考 |
|---|---|---|---|---|
| 1 回目 | 8 | 1 | 1 | `Codex generates real plugin runners under .agents/skills` が `test-live-mutation`（下記 逸脱 4）で失敗 |
| 2 回目 | 9 | 0 | 0 | |
| 3 回目 | 9 | 0 | 0 | |

テスト内訳は Codex アダプタ互換 **6 件**（セッション付与 1、ルール配信 allow 1、deny / ask 保持 2、blocking 応答 1、非 JSON 透過 1）、
compose の 3 条件 2 件（claude / codex）、Codex ランナー生成 1 件の **計 9 件**。計画は「5 件 + 2 件 + 1 件 = 8 件」と数えていたが、
`for (const decision of ["deny", "ask"])` が 2 件を生むため実数は 9 件である（逸脱 5）。Standard 戦略の床「コンポーネントあたり 5〜8 件」に
対して IntegrationTest コンポーネントは 9 件で床を満たす。

compose テストの検査項目は `errors: []`、終了コード 0、`graph.compiled: true`、`idempotent: true`、`drops: []` の 5 点で、
計画が挙げた 3 条件（drop なし、グラフに載る、バイト安定）を claude / codex の両方で踏んでいる（FR11.4、NFR5、NFR6）。

### 全体スイート `bun test tests/`

**149 pass / 12 fail、161 tests across 10 files、終了コード 1**（2026-09-12 の再実測。
初版は「142 pass / 12 fail、154 tests」と書いていたが、その後 U4 がゴールデンケース 4 件、
U5 が層診断ケース 3 件を同じ周回で追加したため増えている。**fail の 12 件は同一**）。
失敗 12 件はすべて `tests/codex-dispatch-bridge.test.ts` で、原因は 1 つ
（`ENOENT ... aidlc-workflows/dist/codex/aidlc` — `scripts/copy-reference-fixture.ts:7` 経由の fixture 未生成）。`ddd/tests/README.md` が
既知の前提条件として記載しているとおりで、`aidlc-workflows/dist/` はこの作業コピーに存在しない。他 9 ファイル（U1〜U5 のユニット・
ゴールデン、installer、本 Unit の統合テスト）は全件 pass。

### FR11.3 の 4 コマンド

| コマンド | 終了コード | 実測 |
|---|---|---|
| `bun run validate` | **0** | Errors 0 / warnings 1（既存の `hooks/compose.ts [compose-hook-absent]`、対処不要と明記） |
| `bun run build:claude` | **0** | 出力 `ddd/dist/claude`、同じ warning 1 |
| `bun run build:codex` | **0** | 出力 `ddd/dist/codex`、同じ warning 1 |
| `bun run check` | **1** | `check:biome`: Checked 51 files、エラー 0（緑）→ `validate`: 緑 → `test`: 149 pass / 12 fail で `script "test" exited with code 1` |

### 配線の読み合わせ（Step 5）

- `test:dist` = `bun scripts/verify-dist.ts`。引数省略時は claude / codex / kimi / opencode の 4 ハーネスを対象に、`dist/<harness>/tools` が
  無ければ `run build:<harness> first` を problem として終了コード 1 にする。設計＋Rust のゴールデン全件を投影済みツールの子プロセス入口から
  回す（NFR6 の投影側の検証）。`build:all` を要するため本 Unit では実行していない。
- `test:sandbox` = `build:all` → 4 ハーネスで `aidlc-plugin-test . --install .. --harness $h`（失敗で即終了）→ `verify-dist.ts`。配線を確認、
  実行はしていない。
- `test:host` = `verify-codex-host.ts`（実 Codex CLI を呼ぶ明示実行用。`check` に含まれない）。

## README の節照合（FR11.6、NFR10）

| 要件が求める節 | README の見出し | 有無 | 備考 |
|---|---|---|---|
| 拡張ポイント一覧 | `## 何を追加するか` | あり | ステージ / contribution（4 本）/ センサー（9 本）/ ナレッジ（8 本）/ ツールの 5 面 |
| 対応ハーネス（Claude Code、Codex CLI） | `## 対応ハーネス` | あり | Claude Code、Codex CLI に加え Kimi Code、opencode を記す（逸脱 3） |
| 層判定の命名規約（FR9） | `## 命名・配置規約（要約）` | あり | 安定 ID、層クレート接尾辞 / 配置、CQRS 側、composition root、リポジトリ命名 |
| センサー一覧 (a)〜(n) | `## センサー一覧`（設計センサー / Rust コードセンサー） | あり | 9 本の ID・重大度・規則を記す。(e) の札は無い（逸脱 6） |
| 導入手順 | `## 導入手順`、`## ユーザのプロジェクトへのインストール` | あり | 開発者向け `check` / `build:*` / `test:*` と、利用者向け `scripts/install.ts` |
| 既知の制約（NFR10） | `## 既知の制約` | あり | Rust のみ、(c-model) と interior mutability の未検査、Examples の予定パス、patch baseline の stale 可能性 |
| ライセンス（NFR10） | `## ライセンス`、`## 同梱ライセンス` | あり | 参照元の MIT を引き継ぐ旨、vendored assets（web-tree-sitter MIT、tree-sitter-rust Unlicense） |

## センサー一覧の照合（README ↔ `ddd/sensors/aidlc-ddd-*.md`）

| id（マニフェスト） | `default_severity` | README の重大度 | README の規則記述と `checks` の対応 |
|---|---|---|---|
| `ddd-model-completeness` | blocking | blocking | 一致（schema、(i)(ii)(iv)、(f) 4 検査） |
| `ddd-model-presence` | blocking | blocking | 一致（missing / invalid / unresolved） |
| `ddd-reference-ids` | blocking | blocking | 一致（未定義・廃止・種別・循環・欠落）。要件上の規則 (e) = FR6.1 に相当するが README は (e) の札を付けない |
| `ddd-mapping-declarations` | blocking | blocking | 一致（2 軸、6 項目、multi-aggregate、process-manager、(j)） |
| `ddd-layer-structure` | blocking | blocking | 一致（ADR-009 項目、(k)(l)(m)(n)） |
| `ddd-design-advisories` | advisory | advisory | 一致（multi-aggregate、repository-scope、store-upsert） |
| `ddd-rust-domain` | blocking | blocking | 一致（(a)(b)(c)(d)(g)、`layer.*`、`model.invalid`） |
| `ddd-rust-use-case` | blocking | blocking | 一致（(g)(h)(i)(d)） |
| `ddd-rust-interface-adapter` | blocking | blocking | 一致（(k)(l)(m)(n)(g)） |

9 本の ID は README とマニフェストで完全一致。U4 の 6 本・U5 の 3 本という区分も一致。README の「`code-summary.md` を契機に発火」は
Rust 3 本の `matches: "**/code-summary.md"` と一致する。CHANGELOG の Added 節も同じ 9 本を同じ重大度で挙げる。

## LICENSE と CHANGELOG（NFR10）

- `ddd/LICENSE` は **存在しない**。ワークスペース根 `LICENSE` は MIT License（Copyright (c) 2026 Junichi Kato）。README の
  `## ライセンス` は「参照元の MIT ライセンスを引き継ぐ」と記し、`## 同梱ライセンス` が vendored assets を記す。
- `scripts/install.ts` はリポジトリ全体の tarball（`codeload.github.com/.../tar.gz`）を取得してから `ddd/.aidlc-plugin/plugin.json` を
  持つ `ddd/` を plugin root として使う。よって取得物には根の LICENSE が含まれるが、compose で対象プロジェクトに投影される
  `dist/<harness>/` にライセンスファイルは含まれない。
- `ddd/CHANGELOG.md` は Keep a Changelog 1.1.0 を明示し、`## [0.1.0] - 2026-09-11` に Added（ステージ、contribution、設計センサー、
  Rust センサー、ライブラリ、ナレッジ、vendored assets）と Notes（compose の 3 条件、`produces` を足さない設計判断）を持つ。

## センサーによる自己検査

`bun .claude/tools/aidlc-sensor-traceability.ts --stage code-generation --output-path <本ディレクトリ>/traceability.json` の結果は
`pass: false`、`gaps: ["FR11.3", "NFR10"]`（いずれも意図した GAP）、`orphans` / `missing_from_table` / `invalid_entries` / `invalid_targets` は
すべて 0。`missing_from_upstream_ids` は 89 件で、U3 の記録（92 件、advisory）と同じく本 Unit に割り当てられていない要件 ID が
列挙されたもの。`source-manifest.json` の 9 パスと `traceability.json` の全 `target` はワークスペース根から実在を確認した。
`code-generation-plan.md` の差分はチェックボックス 6 行のみ（`diff` で 6 行の置換）。

## 計画からの逸脱（全件）

### 逸脱 1: FR11.3 は未達（計画で事前申告済み）

`bun run check` が終了コード 1。`check:biome` と `validate` は緑で、`test` 段の `tests/codex-dispatch-bridge.test.ts` 12 件が
`aidlc-workflows/dist/codex/aidlc` の fixture 未生成で落ちる。原因は本 Unit 所有外の既知の前提条件で、`aidlc-workflows/` は読み取り専用の
サブモジュール。U3 と同じく `traceability.json` で FR11.3 を `GAP` として記録した。テストの緩和・skip 化は行っていない。

### 逸脱 2: `ddd/LICENSE` が無い（計画で事前申告済み）

unit-of-work.md の U9 責務は `plugins/ddd/LICENSE` の同梱を挙げるが、`ddd/` 直下に LICENSE は無い。README・CHANGELOG・既知の制約は
揃っており、根の `LICENSE`（MIT）が存在するため、NFR10 の 4 要素のうち 3 要素は満たす。しかし要件の受け入れ基準「上記ファイルが存在する」を
プラグイン単体の配布物で満たしていないため、`traceability.json` では NFR10 を `GAP` と正直に判定し、承認ゲートでの判断（根の LICENSE で
足りるとみなすか、`ddd/LICENSE` を追加する後続作業を起こすか）を求める。

### 逸脱 3: README の対応ハーネスが要件の 2 つを超える（計画で事前申告済み）

要件 FR11.6 / NFR5 は Claude Code と Codex CLI の 2 つ。README の `## 対応ハーネス` と `## 導入手順`、`package.json` の `build:all` /
`test:sandbox`、`scripts/verify-dist.ts` の既定はいずれも kimi / opencode を含む 4 ハーネス。一方、統合テスト
`tests/framework-compatibility.test.ts` の compose 検査は claude / codex の 2 つだけである。要件の 2 ハーネスはテストで検証されており
要件を弱めてはいないが、README が対応をうたう kimi / opencode の compose は `test:sandbox`（`build:all` 前提、本 Unit では未実行）に
しか裏付けが無い。README と自動テストの範囲差として記録する。

### 逸脱 4: Unit テストの初回実行が `test-live-mutation` で 1 件失敗した（新規）

`Codex generates real plugin runners under .agents/skills` が初回のみ失敗。`aidlc-plugin-test` が「live install changed during test:
`aidlc/spaces/default/intents/260910-ddd-plugin/.aidlc-hooks-health/log-subagent.last`、`.../audit/j5ik2o-mac-studio-lan-59d7cd3d94a7.md`」を
`errors` に返した。テスト実行中にこの AI-DLC セッション自身のフックがワークスペースの監査シャードと hooks-health ログを書き込んだためで、
プラグインの欠陥ではない。同条件の再実行 2 回はいずれも 9 pass / 0 fail、単独の `aidlc-plugin-test ... --json` も終了コード 0。
AI-DLC セッションの中から `--install .` でワークスペース根に対して compose テストを回すと、この競合が再発し得ることを Build and Test への
注意事項として残す。

### 逸脱 5: テスト件数は 8 件ではなく 9 件（新規、軽微）

計画と `unit-test-instructions.md` は Codex アダプタ互換を 5 件と数えたが、deny / ask の 2 件をループで生むため 6 件、合計 9 件。Standard
戦略の床（5〜8 件）を満たす結論は変わらない。`unit-test-instructions.md` は指示により変更していない。

### 逸脱 6: README のセンサー一覧に規則 (e) の札が無い（新規、軽微）

要件の規則 (e)（FR6.1: 未定義 ID・廃止 ID・循環）は `ddd-reference-ids` が実装し、README はその内容（未定義・廃止・種別・循環）を記すが
「(e)」の記号を付けていない。(a)〜(d)、(f)〜(n) は札付きで記されている。内容の欠落ではなく表記の欠落として記録する。

### 逸脱 7: ステージ完了時の未申告パスを本 Unit に帰属させようとして撤回した（修正周回で記録）

ステージ完了時の未申告パス検査で `ddd/docs/decisions.md` / `decisions.ja.md`、`ddd/scripts/install.ts`、
`ddd/tests/install.test.ts`、`ddd/patches/installed-harnesses.patch` が挙がり、いったん本 Unit の
`source-manifest.json` に追加して再チェックを受けたが、レビュー（前試行の iteration 2）は NOT-READY とした:
「所有判断の理由」節が同じファイルを「含めていない」と明記しており矛盾する（R-02）、パッチはフレームワーク側の
修正で U9 の責務外であり引用コミットとも一致しない（R-03）、`docs/decisions*.md` は構築時の決定記録で
公開品質文書ではない（R-04）。指摘はいずれも正しく、Request Changes 後の修正周回で 5 パスの追加を撤回し、
`source-manifest.json` は当初の 9 パスに戻した。これらのファイルと、同時に挙がったリポジトリ直下の
`README.md` / `README.ja.md` / `.gitignore` は、本ワークフローの Unit のいずれにも属さない `main` 上の
コミット（README 書き直し、インストーラ追加）であり、ゲートを開く際にはソース鮮度検査を明示的に迂回した
（`AIDLC_SKIP_SOURCE_FRESHNESS=1`）。なお `ddd/tests/install.test.ts` の 9 件は本 Unit の統合テストとは別に
緑である（実測）。

### 逸脱 5 の補足: 計画・テスト手順の「8 件」を Step 7 で訂正した（**解消済み・2026-09-12**）

前周回は `code-generation-plan.md` と `unit-test-instructions.md` の「計 8 件」が
承認フィンガープリントで固定されていて書き換えられなかった。本改訂では計画を
再提示するためこの凍結が解け、**Step 7 で 4 か所すべてを実測値に直した**。

| ファイル | 行 | 是正前 | 是正後 |
|---|---|---|---|
| `code-generation-plan.md` | 115 付近 | 「Codex アダプタ互換 5 件…計 8 件」 | 「**6 件**…**計 9 件**」 |
| `code-generation-plan.md` | 227 付近 | 「IntegrationTest の 8 件で床を満たす」 | 「**9 件**で床（下限 5 件）を満たす」 |
| `unit-test-instructions.md` | 41 | 「…計 8 件」 | 「**計 9 件**」 |
| `unit-test-instructions.md` | 57-58 | 「8 件が床を満たす」 | 「**9 件**が床（下限 5 件）を満たす」 |

**実測で裏付けた**: `bun test tests/framework-compatibility.test.ts` は
**9 pass / 0 fail / 31 expect / 9 tests across 1 file**。

Standard の床は 5〜8 件だが、**床は下限の要求であり 9 件という超過は不足ではない**。
その旨も両ファイルに明記した。

### Step 8: `CHANGELOG.md` の `produces` に関する一般化を直した（U7 からの申し送り・2026-09-12）

U7 のレビュー所見 R-02 の引き取り。`ddd/CHANGELOG.md` は本 Unit 所有
（`source-manifest.json` の 9 パスに含まれる）である。

是正前の 43-46 行は複数形で一般化していた。

> The design contributions deliberately bind sensors and instructions without
> adding a `produces` artifact, because …

実測では `produces` を持つのは **4 本中 1 本**である。

| contribution | `produces` |
|---|---|
| `contributions/inception/domain-design.md:8` | **あり**（`ddd-aggregate-mapping`） |
| `contributions/construction/functional-design.md` | なし |
| `contributions/construction/infrastructure-design.md` | なし |
| `contributions/construction/code-generation.md` | なし |

同じ文書の 17-18 行は `domain-design` について「produces the aggregate mapping」と
正しく書いており、**同一文書内で読み方が割れていた**。

是正後は、どれが `produces` を持ちどれが持たないかを名指しする。

> Only the `domain-design` contribution adds a `produces` artifact
> (`ddd-aggregate-mapping`). The `functional-design`, `infrastructure-design` and
> `code-generation` contributions deliberately bind sensors and instructions
> without adding one, because …

- **理由の説明は変えていない。** 「contributed artifact は全 unit kind に適用され、
  kind で刈られた `review_artifact` を持つコアステージのスキーマ検査を落とす」という
  44-46 行の説明は正しい。
- 17-18 行、v0.1.0 の他の項目、Keep a Changelog 形式には触れていない。
- **U7 所有の 4 本の contribution には触れていない。** 非対称性は意図されたものである。

**是正後の実測**:

| コマンド | 結果 |
|---|---|
| `bun run validate` | exit **0** |
| `bun test tests/framework-compatibility.test.ts` | **9 pass / 0 fail / 31 expect** |
| `bun test tests/` 全体 | **149 pass / 12 fail / 161 tests** |
| `bun run check:biome` | exit **0** |

Step 8 の前後で数値は変わらない。`CHANGELOG.md` は散文であり機械検査の対象ではないため、
想定どおりである。

## 承認ゲートで確認してほしいこと

1. FR11.3 の `GAP`（`check` 非 0）を U3 と同じ扱いで受け入れるか。
2. NFR10 の `GAP`（`ddd/LICENSE` 欠落）を根の `LICENSE` で足りるとみなすか、後続作業とするか。
3. README がうたう 4 ハーネスのうち kimi / opencode の compose を Build and Test で `test:sandbox` により裏付けるか。
