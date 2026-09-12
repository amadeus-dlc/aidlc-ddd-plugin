# Code Summary — U3 プラグイン足場（u3-plugin-scaffold）

## この記録の位置づけ

本 Unit の足場は `ddd/` の作業ツリー上にすでに存在し、`ddd/CHANGELOG.md` の v0.1.0 に含まれている。
Step 1・3・5・7・8 は**既存の足場の検証**であり、既存ファイルの改変も新規の足場の書き起こしも行っていない。

本 Unit で唯一新しく書いた成果物は `ddd/tests/u3-plugin-scaffold.test.ts`（Step 2・4・6・9）である。
Standard 戦略の「コンポーネントあたり 5〜8 件」を満たすため、承認済み計画のとおり 6 件を置いた。

## Sources

- `inception/units-generation/unit-of-work.md`（U3 = PluginPackaging、kind: packaging、複雑度 S）
- `inception/requirements-analysis/requirements.md`（FR11.1、FR11.2、FR11.3、FR11.5）
- `ddd/.aidlc-plugin/plugin.json`、`ddd/package.json`、`ddd/biome.json`、`ddd/.gitignore`（既存の足場）
- `ddd/tests/README.md`（既存スイートの前提条件）
- `ddd/docs/domain-layer-design.md`（未実装機構の出典。193 行目）

## 作成物

`source-manifest.json` に 5 パスを列挙している。うち本 Unit が**新規作成したのは 1 パス**で、
残る 4 パスは既存の足場（検証のみ、無改変）である。

| パス | 本 Unit での扱い | 責務 |
|---|---|---|
| `tests/u3-plugin-scaffold.test.ts` | **新規作成** | 足場の契約を固定する 6 テスト |
| `.aidlc-plugin/plugin.json` | 検証のみ | `contributes` の 5 面宣言、`agents` / `scopes` を宣言しない（FR11.1、FR11.5） |
| `package.json` | 検証のみ | `validate` / `build:claude` / `build:codex` / `check` の配線（FR11.3） |
| `biome.json` | 検証のみ | 対象と除外、`lineWidth` 120、`linter.rules.preset: recommended` |
| `.gitignore` | 検証のみ | `dist/` と `node_modules/` の管理外 |

5 つの面（`stages/`、`contributions/`、`sensors/`、`knowledge/`、`tools/`）の中身は
U4〜U8 が所有するため、本 Unit の作成物には含めない。本 Unit は
`plugin.json` がその 5 面を指すことまでを固定する。

## 主要な実装判断（テスト側）

- **マニフェストをモックせず実物を読む。** 検証対象は宣言そのものであるため、
  `plugin.json` と `package.json` を実ファイルとして読む。一時ディレクトリも作らない。
  テストは読み取り専用で、後始末を要する状態を作らない。
- **パスはテストファイルの位置から解決する。** `import.meta.dir` を起点に組み立て、
  実行時の作業ディレクトリに依存しない。
- **ビルド成果物を読まない。** `dist/` は `.gitignore` の管理外でビルドに依存するため参照しない。
- **フロントマターは最小の行スキャナで読む。** `produces` と `adds.produces` の
  スカラー項目、および `adds` 直下のキーだけを取る小さな走査器を書いた。
  YAML ライブラリを追加しないため（追加依存なしの方針）。
- **後続 Unit が足しても壊れない形にする。** 論理名の集合そのものではなく
  「`ddd-` 接頭辞を持つこと」と「1 件以上あること」を固定する。U6〜U8 が
  `stages/`・`contributions/` に追加しても本テストは成立する。
- **未実装機構の判定は `adds` 直下のキーに限る。** ステージファイルの
  ステージ直下 `requires_stage:` は実装済みで U6 の仕様も要求するため、
  禁止対象は contribution の `adds.requires_stage` に限定した。
  出典は `ddd/docs/domain-layer-design.md` 193 行目
  （`adds.required_sections` は機械強制されない、`adds.requires_stage` は deferred）。

## テストカバレッジ

- **実行コマンド**: `cd ddd && bun test tests/u3-plugin-scaffold.test.ts`
- **実測**: **6 pass / 0 fail / 55 expect() 呼び出し**（2026-09-11 実測）
- **戦略**: Standard（コンポーネントあたり 5〜8 件）。本 Unit のコンポーネントは
  PluginPackaging の 1 つで、6 件は床（5 件）を満たす。
- **スコープ床（plugin-dev）**: 追加の新規テスト床は無い。既存スイートが緑であることのみ。
- **テストランナー**: `bun:test`（bun 組み込み）。追加の devDependency は導入していない。

| # | テスト | 要件 | 検証している契約 |
|---|---|---|---|
| 1 | `FR11.1: contributes declares exactly the five faces, with no agents and no scopes` | FR11.1 | `contributes` が 5 面を過不足なく宣言し、マニフェスト全体のどこにも `agents` / `scopes` が現れない |
| 2 | `FR11.1: every contributed face is a directory that exists and holds at least one file` | FR11.1 | 5 面が実在するディレクトリで、再帰的に 1 件以上のファイルを持つ |
| 3 | `FR11.2: stage files sit under stages/ with the ddd- prefix` | FR11.2 | `stages/` 配下の全 `.md` のファイル名が `ddd-` で始まる |
| 4 | `FR11.3: package.json wires the four scripts and check runs its three stages in order` | FR11.3 | 4 スクリプトが存在し、`check` が `check:biome` → `validate` → `test` を順に束ねる |
| 5 | `FR11.2: logical artifact names produced by stages and contributions are prefixed` | FR11.2 | `produces` / `adds.produces` の全論理名が `ddd-` で始まる（両方とも 1 件以上ある） |
| 6 | `FR11.5: the scaffold declares nothing on mechanisms the framework has not implemented` | FR11.5 | `adds.requires_stage` / `adds.required_sections` / `when:` / `after-questions` / `memory/` 配布に依存せず、`dependencies` が版を固定しない |

テスト 3・5・6 は「1 件以上あること」を先に確かめてから全件を検査する。
空集合に対して `every` が真になる抜け道を塞ぐためである。

## 検証

承認済み計画の「検証」に挙げた項目の実測値。

### テスト

| コマンド | 実測 |
|---|---|
| `cd ddd && bun test tests/u3-plugin-scaffold.test.ts` | **6 pass / 0 fail**、55 expect、1 ファイル |
| `cd ddd && bun test tests/` | **142 pass / 12 fail**、339 expect、10 ファイル |

`bun test tests/` の 142 は直前の 136（U2 完了時点）に本 Unit の 6 件を加えた数である。
落ちている 12 件はすべて既存の `tests/codex-dispatch-bridge.test.ts` にあり、
`ENOENT: no such file or directory, scandir '<workspace>/aidlc-workflows/dist/codex/aidlc'`
の 1 原因に集約される。`framework-compatibility.test.ts` と `install.test.ts` は緑である。

### FR11.3 の 4 コマンド

| コマンド | 終了コード | 実測 |
|---|---|---|
| `cd ddd && bun run validate` | **0** | `Plugin validation: VALID`、Errors 0 / warnings 1（既存の `hooks/compose.ts [compose-hook-absent]`） |
| `cd ddd && bun run build:claude` | **0** | `Plugin build: COMPLETE`、出力 `ddd/dist/claude` |
| `cd ddd && bun run build:codex` | **0** | `Plugin build: COMPLETE`、出力 `ddd/dist/codex` |
| `cd ddd && bun run check` | **1** | `check:biome` と `validate` は通り、`test` 段で上記 12 件により失敗 |

`biome check --error-on-warnings .` は 51 ファイルを検査してエラー 0（本 Unit の新規テストを含む）。

### Step 8b の実測（2026-09-12）

改訂版の計画の承認後に Step 8b を実行し、上記の実測値をすべて取り直した。
**いずれも上表のとおり再現した**（`bun test tests/u3-plugin-scaffold.test.ts` 6 pass / 0 fail / 55 expect、
`bun test tests/` 142 pass / 12 fail、4 コマンドの終了コード 0 / 0 / 0 / 1）。
Step 8b は記録のみの修正であり、アプリケーションソースに触れていないため、これは想定どおりである。

修正後の `traceability.json` の `target` 3 件を実物で確認した。

| `target` | 実在 | `source-manifest.json` に含まれる |
|---|---|---|
| `ddd/.aidlc-plugin/plugin.json` | あり | はい |
| `ddd/tests/u3-plugin-scaffold.test.ts` | あり | はい |
| `ddd/package.json` | あり | はい |

他 Unit 所有のパスを `target` に据えている行は無くなった。

### センサー

| センサー | 判定 | 内容 |
|---|---|---|
| `required-sections`（計画） | **pass** | H2 を 9 件検出、findings 0 |
| `linter` | 実行不可（exit 127 `eslint-unavailable`） | advisory。本リポジトリの lint は Biome で、上記のとおりエラー 0 |
| `type-check` | 実行不可（exit 127 `tsc-unavailable`） | advisory。`bunx --package typescript@6` が本環境で利用不可（下記 逸脱 2） |
| `traceability` | `gaps: ["FR11.3"]`、他は 0 | `orphans` / `missing_from_table` / `invalid_entries` / `invalid_targets` はいずれも 0。`missing_from_upstream_ids` は 92 件（advisory、逸脱 3） |

## 計画からの逸脱

### 逸脱 1: FR11.3 は未達である（`check` が終了コード 0 にならない）

計画の「FR11.3 の見込みについて」で申告したとおり、4 コマンドのうち `bun run check` だけが
終了コード 1 になる。原因は本 Unit の配線ではなく、既存の `tests/codex-dispatch-bridge.test.ts`
が要求する `aidlc-workflows/dist/codex/aidlc` の fixture が未生成であることである。

- 本 Unit の配線そのものは正しい。テスト 4 が `check` の 3 段構成を、テスト 1・2・5・6 が
  宣言と接頭辞規約を固定しており、いずれも緑である。
- `aidlc-workflows/` は本家参照用の読み取り専用サブモジュールで、`ddd/docs/reference-read-only.md`
  が再生成・保護解除を禁じている。`ddd/tests/README.md` も「skip-fail when that dist is not built」
  としてこの落ち方を既知の前提条件に挙げている。
- **`traceability.json` では FR11.3 を `GAP` として記録した。** FR11.3 は本 Unit に割り当てられた
  要件であり、その 4 コマンドの 1 つが実測で未達だからである（U2 では `check` は割り当て外の
  要件だったため逸脱として記録し、全行 `OK` とした）。目標を下げて `OK` にすることはしていない。
  解消には読み取り専用サブモジュールの dist 生成が必要で、明示的な指示を要する。

### 逸脱 2: `type-check` センサーは本環境で実行できない

`bun .claude/tools/aidlc-sensor-type-check.ts` は `bunx --package typescript@6 tsc` を呼ぶが、
本環境では exit 127 `tsc-unavailable` を返す。`linter` センサーも同様に exit 127
`eslint-unavailable` を返す（本リポジトリは ESLint ではなく Biome を使う）。

- いずれも `default_severity: advisory` であり、ステージ進行を止めない。
- **正直な申告**: 本 Unit のテストファイルは、`bun test` の実行によっても Biome によっても
  **型検査を受けたことにならない**（Bun は型を剥がすだけで検査しない）。型の誤りがあれば
  実行時に初めて現れるか、現れないまま残る。実測で 6 件が緑であることは、
  型が正しいことの証明にはならない。
- 代替の確認は `ddd/tsconfig.json`（`strict: true`、`noUnusedLocals`）に沿った記述を
  心がけることに限られており、機械的な裏付けは得られていない。

### 逸脱 3: `traceability` センサーは割り当て外 ID を advisory 所見として報告する

`missing_from_upstream_ids` が 92 件出る。内容は requirements.md の製品全体の FR／NFR で、
本 Unit に割り当てられていないもの（`FR11.4`、`FR11.6` は U9 が所有する）である。
`gaps` / `orphans` / `missing_from_table` / `invalid_entries` / `invalid_targets` は
いずれも 0 件で、`OK` 目標はすべて実在するワークスペース相対パスである。
U1（81 件）・U2（78 件）と同じ挙動であり、当該センサーは advisory である。

### 逸脱 4: 承認済み計画のチェックボックスの更新（レビュー所見 R-01 を受けて訂正）

当初、計画 Step 2・4・6・9 のチェックボックスを「承認後に計画を書き換えると承認内容が変わる」として
`[ ]` のまま残していたが、この根拠はステージ定義に反する（タスクマーカー `[x]` / `[ ]` は
`[Approval Fingerprint]` の射影から除外されており、書き換えても承認内容は変わらない）。
レビュー所見 R-01 を受け、Request Changes 後の修正周回で Step 2・4・6・9 を `[x]` に更新した。
実施結果は本記録の「テストカバレッジ」と「検証」に記載のとおりである。

### 逸脱 5: `traceability.json` の `target` 列の基準（レビュー所見 R-02 — **解消済み・2026-09-12**）

`coverage[].target` は「その要件を**最も直接に検証できる一次的な実体**」を指す。
宣言・配線・検証手段が混在して見えるのは、要件ごとに一次実体の種類が異なるためである。

前周回の本項は「FR11.1 / FR11.5 は宣言そのもの（`plugin.json`）、FR11.2 は接頭辞規約を
固定するテスト」と書いていたが、**実際の `traceability.json` はこの説明と食い違っていた**。
FR11.5 がテストファイルを、FR11.2 が `ddd/stages/inception/ddd-domain-modeling.md` を
指していたのである。後者は **U6（domain-modeling ステージ）が所有するファイル**で、
本 Unit の `source-manifest.json`（5 パス）にも含まれない。他 Unit 所有のファイルを
`target` に据えるのは、ステージ定義が示す `target` の契約（その要件を実装／検証している
自 Unit の既存ファイル）から外れる。

**Step 8b でこれを直した。** FR11.2 を本 Unit が最も直接に検証しているのは自分のテスト 2 件
（`tests/u3-plugin-scaffold.test.ts:141` *stage files sit under stages/ with the ddd- prefix*、
同 `:161` *logical artifact names produced by stages and contributions are prefixed*）であり、
`target` をそのテストファイルに改めた。修正後の対応は次のとおりで、**4 件すべてが
本 Unit 所有のパス**を指す。

| 要件 | `target` | 種別 |
|---|---|---|
| FR11.1 | `ddd/.aidlc-plugin/plugin.json` | 宣言そのもの |
| FR11.2 | `ddd/tests/u3-plugin-scaffold.test.ts` | 接頭辞規約を固定するテスト 2 件 |
| FR11.3 | `ddd/package.json`（GAP） | 配線 |
| FR11.5 | `ddd/tests/u3-plugin-scaffold.test.ts` | 未実装機構への非依存を固定するテスト |

アプリケーションソースは変更していない。Step 8b は記録のみの修正である。

### 逸脱 6: `ddd/tsconfig.json` の申告追加と撤回（レビュー所見 R-03 / R-04 を受けて記録）

ステージ完了時の未申告パス検査で `ddd/tsconfig.json` が挙がったため、いったん本 Unit の
`source-manifest.json` に追加して再チェックを受けたが、レビューは「当該ファイルの最新変更は
U1 のコミット `0f08272`（tools/ を tsconfig / biome の対象に含める変更）であり、本 Unit の
ステージ実行中に生じたドリフトではない」と指摘した。根拠が成立しないため申告を撤回し、
`source-manifest.json` は当初の 5 パスに戻した。`tsconfig.json` の内容に責任を持つのは U1 である。

### 逸脱 7: 計画の Step 8b は承認時点で凍結されており、チェックボックスが未チェックのまま残る

Step 8b は**承認後に実行した**ため、計画 `code-generation-plan.md` は同ステップを
`- [ ]`（未実施）と記したままである。「この計画の位置づけ」と「検証」節も同様に
未実施として書いている。

計画本文は Plan Approval の承認フィンガープリント
（`sha256:v3:9e15193828ee203f2301ac1c5fcd8eb401977002fb957ef022e4f7f5e30429ad`）で
固定されており、Change Control が `strict` であるため、チェックボックス 1 個の更新でも
フィンガープリントが変わり承認が失効する。**そのため計画本文は書き換えず、本項で開示する。**

本 Unit における Step 8b の実施状況は次のとおりで、実態はこちらである。

- `traceability.json` の FR11.2 の `target` を `ddd/tests/u3-plugin-scaffold.test.ts` に変更済み
- `code-summary.md` の逸脱 5 の説明文を実データに一致させ済み
- アプリケーションソースの変更は無し

同種の食い違いは U2 でも Step 6c について生じており（U2 のレビュー所見 R-01）、
承認済み計画を持つステージに共通する構造的な制約である。恒久的な解消には、
チェックボックスの状態を承認フィンガープリントの対象から外すか、
実施状況を計画本文ではなく `code-summary.md` に一元化する設計変更が要る。

## 注記

- `ddd/stages/construction/` は `.gitkeep` のみを置いた空ディレクトリである。
  FR11.1 が求めるのは `contributes` の 5 面が実在し空でないことで、面の直下の
  サブディレクトリ構成までは求めていないため、契約違反ではない。
  construction フェーズのステージは U6 が追加する。
- 既存ファイルへの改変は 1 件も無い。`ddd/CHANGELOG.md` の v0.1.0 の内容は変わっていない。
- すべての変更は未コミットである。

## 完了条件の確認

- 本 Unit の全アプリケーションソース 5 パスを `source-manifest.json` に列挙した
  （うち新規作成は `tests/u3-plugin-scaffold.test.ts` の 1 パス）。
- `traceability.json` の `OK` 目標はすべて実在するワークスペース相対パスである
  （`invalid_targets` 0 件）。
- Step 1・3・5・7・8 は既存の足場に対する改変を行っていない。本 Unit の作成物は
  Step 2・4・6・9 のテスト新設 1 パスのみである。
- FR11.3 は未達（逸脱 1）。承認ゲートに上げる。
