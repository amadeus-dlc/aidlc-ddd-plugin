# Code Summary — U5 Rust コードセンサー（u5-rust-code-sensors）

## Sources

- `inception/units-generation/unit-of-work.md`（U5 = RustCodeSensorSuite + GoldenCaseSuite（Rust センサー分）、kind: library、複雑度 XL）
- `inception/units-generation/unit-of-work-story-map.md`（U5 の割当: FR7、FR7.1〜FR7.13、FR9.5、NFR1、NFR3）
- `inception/requirements-analysis/requirements.md`（FR7、FR8.3、FR8.6、FR9.5、NFR1、NFR3 の本文と受け入れ基準）
- `construction/u5-rust-code-sensors/functional-design/functional-spec.md`（WF1〜WF7、SM1・SM2、§1 マニフェスト表、§2 規則モジュール構成）
- `construction/u5-rust-code-sensors/functional-design/rules.md`（BR1〜BR10）
- `construction/u5-rust-code-sensors/functional-design/entities.md`（型定義）
- `construction/u5-rust-code-sensors/code-generation/code-generation-plan.md`、`unit-test-instructions.md`
- `construction/u4-design-sensors/code-generation/code-summary.md`（同種の乖離 — ゴールデンケースの TS 表、`ddd-domain-modeling` パス、`{{HARNESS_DIR}}` の扱い — の先行記録）
- `ddd/tests/README.md`（`codex-dispatch-bridge.test.ts` の fixture 前提、センサースクリプトを子プロセス起動する注記）

## この記録の位置づけ

本 Unit の実装は `ddd/` の作業ツリー上にすでに存在し、`ddd/CHANGELOG.md` の v0.1.0 に含まれている。
計画のとおり Step 1・3・5・7・9・10 は**既存実装の検証**、Step 2・4・6・8・11 は**テストの実行と記録**として
実施した。

**2026-09-12 の改訂で Step 12・12b・13 を追加し、既存ファイル 2 本に改変を加えた。**
これが本 Unit で唯一の改変である。

| ステップ | 所見 | 改変したファイル |
|---|---|---|
| Step 12 | R-03 の一部 | `ddd/tests/golden/rust/cases.ts`（層診断 3 ケースの追加、`Crate.bin` と `project()` の拡張） |
| Step 12b | Step 12 の実装中に発見 | `ddd/tools/ddd/lib/rules/evaluate.ts`（診断転送 1 行） |
| Step 13 | R-01 | 計画本文と `unit-test-instructions.md` のケース数（記録のみ） |

3 センサーのスクリプト（`ddd-sensor-rust-*.ts`）と判定器（`definitions.ts` の規則評価）は
1 行も変更していない。

作業開始時点の作業ツリーには、本 Unit の所有外である U2（`ddd/tools/ddd/lib/rust/analyzer.ts`、
`ddd/tests/u2-rust-analysis-foundation.test.ts`）と U8（`ddd/knowledge/**`）のファイルに未コミットの変更が
あった。これらは本 Unit の実施より前から存在し、本記録の実測はその作業ツリーに対して行った。

## 作成物（記録した既存ファイル）

`source-manifest.json` に 17 パスを列挙している。**全 17 パスが既存**（検証のみ、無改変）である。
`tools/ddd/lib/rules/` と `tools/ddd/lib/rules/rust/` は `ls` で実確認し、計画に挙げた 8 ファイル以外は無かった。

| パス | 責務 |
|---|---|
| `sensors/aidlc-ddd-rust-domain.md` | `id: ddd-rust-domain`。checks は `a` `b` `c` `d` `g` `layer.*` `model.invalid` の 7 行 |
| `sensors/aidlc-ddd-rust-use-case.md` | `id: ddd-rust-use-case`。checks は `g` `h` `i` `d` の 4 行 |
| `sensors/aidlc-ddd-rust-interface-adapter.md` | `id: ddd-rust-interface-adapter`。checks は `k` `l` `m` `n` `g` の 5 行 |
| `tools/ddd-sensor-rust-domain.ts` | `runSensor({sensor_id, severity: "blocking", budget_ms: 9000, evaluate})` に `["a","b","c","d","g"]` と `report_layer_diagnostics: true` を渡す |
| `tools/ddd-sensor-rust-use-case.ts` | 同じ形で `target_layers: ["use-case"]`、`["g","h","i","d"]` |
| `tools/ddd-sensor-rust-interface-adapter.ts` | 同じ形で `target_layers: ["interface-adapter","rmu"]`、`includes_query_side: true`、`["k","l","m","n","g"]` |
| `tools/ddd/lib/rules/definitions.ts` | `RuleDefinition` 11 件（a b c d g h i k l m n）。判定ロジックを持たない |
| `tools/ddd/lib/rules/lists.ts` | `REPLAY_EXEMPT` / `POST_INIT` / `MEDIA_WORDS` / `IO_CRATES` と名前変換（`toKebab` / `snakeToKebab` / `toPascal`） |
| `tools/ddd/lib/rules/types.ts` | `InspectionTarget` / `ModelAvailability` / `MutatorSymbol` / `DomainTypeSymbol` / `DomainSymbolTable` / `DependencyEdge` / `InspectionContext` |
| `tools/ddd/lib/rules/context.ts` | WF1 手順 2〜6（申告解決、Cargo 根、走査と層判定、分類、ModelAvailability、名前一覧、依存辺、不透明領域） |
| `tools/ddd/lib/rules/evaluate.ts` | WF1 手順 7〜8（`PER_FILE_EVALUATORS` / `CONTEXT_EVALUATORS` の独立評価、`checkBudget`、`(file, line, rule_id)` の重複統合） |
| `tools/ddd/lib/rules/rust/symbols.ts` | WF2（ドメイン層全クレートの列挙、`DomainTypeSymbol` の要約、`classifyMutator` の SM2） |
| `tools/ddd/lib/rules/rust/edges.ts` | WF6（use の先頭セグメントと Cargo.toml の依存から辺を作り、`isAllowed` と denylist で verdict） |
| `tools/ddd/lib/rules/rust/evaluators.ts` | ruleA〜ruleN の 11 判定器と 2 つの表 |
| `tests/golden/rust/cases.ts` | Rust ゴールデンケース 15 件の表 |
| `tests/u5-rust-code-sensors.test.ts` | 10 件。3 スクリプトを子プロセス起動 |
| `tests/u5-golden.test.ts` | 15 ケース＋規約 2 件（網羅性、決定性 3 回） |

U4 所有の `tests/golden/runner.ts` は共用するが、本 Unit の manifest には含めていない。

## 主要な実装判断（検証で確認したもの）

- **スクリプトは薄い（BR1.1、BR9.1）。** 3 本とも `initAnalyzer()` → `runSensor(...)` → `evaluateSensor(...)` の 3 手順だけで、
  規則の判定は `lib/rules/` に集約されている。tree-sitter ランタイムが `ready` でなければ `ToolUnavailableError` を投げ、
  U1 が終了コード 127 に写す。
- **マニフェスト・スクリプト・仕様 §1 の rule_id は一致する。** domain: マニフェスト `{a,b,c,d,g,layer.*,model.invalid}` /
  スクリプト `["a","b","c","d","g"]` + `report_layer_diagnostics`（`layer.*` を転記）+ `context.ts` の `model.invalid` / 仕様 §1 同。
  use-case: `{g,h,i,d}` の三者一致。interface-adapter: `{k,l,m,n,g}` の三者一致。差分は無い。
- **定義と判定器の分離（BR9.1、FR8.6）。** `definitions.ts` は `rule_id` / `name` / `statement` / `target_layers` / `requires_model` /
  `facts` / `source` / `per_file` だけを持つ。`evaluate.ts` はマニフェストが渡した rule_id を `rulesFor` で定義に写し、
  `per_file` の値でファイル単位（a b c d h i l m n）と文脈単位（g k。クレートごとの代表ファイル 1 件で評価）を分ける。
- **固定リストは 1 か所（BR9.2、ADR-009）。** `lists.ts` の `MEDIA_WORDS` 14 語は U4 `tools/ddd-sensor-layer-structure.ts` の一覧と同値。
  `IO_CRATES` は Q6 の初期 denylist 14 件（`aws-sdk-*` の前方一致を含む）。
- **判定は構文的事実のみ（FR7.12、BR7.2）。** `evaluators.ts` が import するのは U2 の問い合わせ（`calls` / `constructions` /
  `impls` / `structs` / `traits` / `uses`）と `Span` 型だけで、tree-sitter の Node を扱わない。型の判定は `stripType` による
  字面の外皮剥ぎ（`&` / `Box<` / `Arc<` / `Rc<` / `Option<` / `Vec<`）に限る。
- **正規モデルのパスは `inception/ddd-domain-modeling/domain-model.yaml`（BR3.4 の本文とは異なるが実装が正しい）。**
  `readStageStatus(run, "ddd-domain-modeling")` で SKIP / absent を note 付きの skipped / absent に、読み込み失敗を `model.invalid` にする。
- **決定性の担保（BR8.1）。** ドメイン層ファイルの列挙は `localeCompare(…, "en")` 昇順、`types` と `edges` は整列済み、
  `dedupe` は `(file, line, rule_id)` キー。時刻・乱数・環境変数を読まない。
- **無実行・無通信（BR1.4）。** `lib/rules/` と 3 スクリプトを `cargo` / `fetch(` / `http` で grep し、Cargo.toml の読み取り以外に
  該当は無い。

## テストカバレッジ（実測）

作業ディレクトリ `ddd/`、bun 1.3.13。

| コマンド | 結果 | 終了コード |
|---|---|---|
| `bun test tests/u5-rust-code-sensors.test.ts` | 10 pass / 0 fail（12 expect） | 0 |
| `bun test tests/u5-golden.test.ts` | 17 pass / 0 fail（18 expect）— ゴールデンケース 15 件＋規約 2 件 | 0 |
| `bun test tests/`（全体） | 142 pass / 12 fail、154 tests / 10 files。fail 12 件はすべて `tests/codex-dispatch-bridge.test.ts` | 1 |
| `bun run validate` | Errors: 0; warnings: 1（`compose-hook-absent`。対応不要と明記） | 0 |
| `bun run build:claude` | `dist/claude` に投影。3 マニフェストが `dist/claude/sensors/` に存在 | 0 |
| `bun run build:codex` | `dist/codex` に投影。3 マニフェストが `dist/codex/sensors/` に存在 | 0 |
| `bun run check:biome` | Checked 51 files. No fixes applied | 0 |
| `bun run check` | `check:biome` と `validate` は通り、`test` 段で上の 12 件が落ちる | 1 |

Standard 戦略の床（コンポーネントあたり 5〜8 件）: RustCodeSensorSuite は `u5-rust-code-sensors.test.ts` の 10 件
（domain 6、use-case 2、interface-adapter 2）、GoldenCaseSuite（Rust 分）は 17 件で、いずれも床を満たす。
3 センサーそれぞれに正常系（clean-domain / h の Id 型は probe のみ / clean-repository）と違反系がある。
正規モデル SKIP 時の note、起動契約（1 行 JSON verdict、終了コード 0）、決定性 3 回一致が踏まれている。
本 Unit でテストは新設していない。

### 一時 probe による補完（`ddd/` 無改変、scratchpad のみ）

同梱 fixture が無い仕様上のケースについて、scratchpad に一時 fixture を実体化し、実運用と同じ引数で
3 スクリプトを子プロセス起動して挙動だけを確認した。**これらはテストとして残していない**（逸脱 3 の対処は承認ゲートの判断に委ねる）。

| ケース | 結果 |
|---|---|
| (c) replay 経路 `apply_event(&mut self)` を含むドメイン型 | domain: pass、所見 0 |
| (c) `init(&mut self)` | domain: `c` … `(c-post-init)` を検出 |
| (d) IA 層からの getter 呼び出し | interface-adapter: pass、所見 0 |
| (d) use-case 層からの getter 呼び出し | use-case: `d` を検出 |
| (g) use-case → interface-adapter の use | use-case: `g` … `(layer-forbidden)` を検出 |
| (g) use-case からの `use sqlx::Pool` | use-case: `g` … `(external-io)` を検出 |
| `model.invalid`（EXECUTE だが YAML 不正） | domain: `model.invalid@inception/ddd-domain-modeling/domain-model.yaml` を検出 |
| (h) `execute(&self, id: InvoiceId)` | use-case: pass（Id 型の許可） |
| (h) 自由関数 `pub fn execute(inv: Invoice)` | use-case: **pass（検出されない）**。逸脱 6 |
| (n) `Invoice::restore(..)`（宣言済みコンストラクタ）と `Invoice::from_row(..)` | interface-adapter: `from_row` だけを `n` で検出 |
| (k) rmu から command 側・query 側の両方を use | interface-adapter: pass |
| 性能: ドメインクレート 201 ファイル（全件申告、モデル SKIP） | domain: 139 / 148 / 168 ms、所見 400 件、3 回の verdict が完全一致 |

## 検証

- Step 1: 3 マニフェストが `kind: deterministic` / `default_severity: blocking` / `fire_on: gate` / `matches: "**/code-summary.md"` /
  `timeout_seconds: 10` / `checks` を持つことを確認。`lib/rules/` の 5 ファイルと `lib/rules/rust/` の 3 ファイルを確認。
- Step 2: `bun:test` の疎通と Unit 限定コマンド 2 本を実行（上表）。追加依存なし。
- Step 3・4: `definitions.ts` の 11 定義、`lists.ts` の 4 リスト、`types.ts` の 7 型を entities.md と照合。名前変換と denylist 照合は
  `violation-b`（`rename` → `command.invoice.rename` 不一致）と probe の `sqlx` で踏まれる。
- Step 5・6: `context.ts` / `symbols.ts` / `edges.ts` / `evaluators.ts` / `evaluate.ts` を WF1〜WF6・BR2〜BR8 に照合（相違は逸脱欄）。
  3 センサーそれぞれの正常系・違反系は上表。
- Step 7・8: 3 スクリプトの `runSensor` 引数、`ToolUnavailableError`、子プロセス起動、SKIP 時 note、決定性を確認。
- Step 9: ランナーが record/ と workspace/ を同じ一時ディレクトリに置き、`--stage code-generation --output-path <record>/construction/u1/code-generation/code-summary.md`
  で起動し、`(rule_id, file)` を完全一致で比較していることを確認。網羅性テスト・SKIP ケース・決定性テストの存在を確認。
- Step 10: `validate` / `build:claude` / `build:codex` の終了コード 0。cargo・ネットワーク不使用を grep で確認。
- Step 11: 本記録 3 ファイル。`source-manifest.json` の 17 パスと `traceability.json` の 17 target の実在をスクリプトで確認。

### Step 12 — 層診断 3 経路のゴールデンケースを追加した（R-03 の一部）

BR10.2 は violation 19 種・clean 7 種を列挙するが、是正前の実測は **15 件**
（violation 12・clean 3）で **12 種が不足**していた。うち `layer.unknown` /
`layer.conflict` / `layer.mixed-targets` の 3 種は `tests/u5-golden.test.ts` の
`NOT_IN_RUST_SUITE` で網羅性検査から除外されており、**どのテストでも一度も
踏まれていなかった**。この 3 種を追加した。

発火条件は `lib/workspace/resolver.ts` の実測による。

| ケース | 発火条件 | fixture |
|---|---|---|
| `violation-layer-unknown` | `:476` 層の接尾辞も層ディレクトリも無い | `packages/misc/billing-thing` |
| `violation-layer-conflict` | `:456` 接尾辞が指す層と配置が指す層の食い違い | `packages/use-case/billing-domain`（接尾辞 `-domain` 対 配置 `use-case`） |
| `violation-layer-mixed-targets` | `:405` 同一クレートに bin と lib の両ターゲット | `src/lib.rs` と `src/main.rs` を両方持つクレート |

**実装中に判明した 2 点**:

1. **診断はクレートの `Cargo.toml` に付く**（`resolver.ts:387` の `cargoFile`）。
   既存ケースが使う `withFiles` ヘルパは `src/lib.rs` を前提にするため、
   この 3 件は `expect.files` を明示的に組んだ。
2. **`evaluate.ts:28` の `empty` 早期 return が層診断ループ（`:35`）より前にある。**
   有効な domain クレートが 1 つも無いワークスペースでは `assembleContext` が
   `kind: "empty"` を返し、層診断が**一切報告されない**。`violation-layer-conflict` は
   食い違ったクレートの層が `unknown` になるため、正しく配置した domain クレート
   （`packages/domain/billing-core-domain`）を fixture に足して文脈を非空にした。
   この早期 return 自体は本 Unit では変更していない（逸脱欄に記録）。

`project()` ヘルパには `Crate.bin`（省略可）を追加した。指定したクレートにだけ
`src/main.rs` を書き、Cargo の自動検出（`resolver.ts:170`）が bin ターゲットとして拾う。
**既存 15 ケースの挙動は変わらない**（`bin` を指定していないため）。

### Step 12b — 層診断の rule_id の二重接頭辞を除去した

Step 12 のケースを実行したところ、期待した `layer.unknown` ではなく
**`layer.layer.unknown`** が発行された。原因は `lib/rules/evaluate.ts:38` である。

```
rule_id: `layer.${diagnostic.code}`
```

`DiagnosticCode`（`lib/workspace/resolver.ts:27-35`）は **8 種すべてが既に名前空間
接頭辞を持つ**（`layer.unknown` / `layer.conflict` / `layer.mixed-targets` /
`layer.unowned` / `cqrs.conflict` / `cqrs.query-domain` / `workspace.unreadable` /
`workspace.no-members`）。したがって**接頭辞が正しくなるコードは 1 つも存在せず**、
すべての層診断が二重接頭辞で発行されていた。

実測（是正前）:

```
unexpected finding layer.layer.unknown       @ packages/misc/billing-thing/Cargo.toml
unexpected finding layer.layer.conflict      @ packages/use-case/billing-domain/Cargo.toml
unexpected finding layer.layer.mixed-targets @ packages/domain/billing-domain/Cargo.toml
```

`rule_id: diagnostic.code` に直した。`layer.layer.*` / `layer.cqrs.*` /
`layer.workspace.*` に依存するコード・文書・fixture は `ddd/` 全体に **1 件も無い**ことを
grep で確認してから変更した。**判定器と 3 センサーのスクリプトは変更していない。**

**`NOT_IN_RUST_SUITE` の除外は残した。** マニフェストの宣言は `layer.*` という
ワイルドカードで、findings は `layer.unknown` のような具体名で出る。
網羅性テストは集合の完全一致で照合するため、除外を外すと
`ddd-rust-domain:layer.*` が `missing` として恒久的に落ちる。
除外のコメントは「U2 テストと domain センサーの他ケースでカバー」と書いているが、
**実際の理由は宣言名と発行名の形式が違うこと**である。この点は逸脱欄に記録する。

**`cqrs.conflict` / `cqrs.query-domain` / `workspace.unreadable` / `workspace.no-members`
は是正後もどのマニフェストにも宣言されていない。** U4 の未宣言 rule_id と同種の
ギャップであり、本 Unit では直していない（逸脱欄に記録）。

### Step 12・12b の実測

| 実測 | 是正前 | 是正後 |
|---|---|---|
| `bun test tests/u5-rust-code-sensors.test.ts tests/u5-golden.test.ts` | 27 pass / 0 fail / 30 expect | **30 pass / 0 fail / 33 expect** |
| `bun test tests/` 全体 | 146 pass / 12 fail / 343 expect | **149 pass / 12 fail / 346 expect** |
| ゴールデンケース数 | 15（violation 12・clean 3） | **18（violation 15・clean 3）** |
| `validate` / `build:claude` / `build:codex` / `check:biome` | 0 / 0 / 0 / 0 | **0 / 0 / 0 / 0** |
| `bunx tsc --noEmit -p .` の変更 2 ファイル由来のエラー | — | **0 件** |

12 fail は U2〜U4・U8 と同一の既知フィクスチャ欠落で、是正の前後で変わらない。

### Step 13 — ケース数の記載を実測に合わせた（R-01）

計画 L117・L296 と `unit-test-instructions.md` L44 は「ゴールデンケース 16 件」と
書いていたが、是正前の実測は **15 件**だった。前周回は両ファイルが承認フィンガープリントで
凍結されていて直せなかった。本改訂で計画を再提示する機会に、Step 12 追加後の値である
**18 件**へ直した。

## 計画からの逸脱

計画に挙げた 4 点をコードで確認し、追加で 6 点を見つけた。
実装を書き換えたのは Step 12・12b の 2 ファイルのみで、それ以外は書き換えていない。

### 逸脱 1: Rust 判定器の配置が「1 規則 1 ファイル」ではない（計画どおり確認）

仕様 §2 は `rust/a-public-field.ts … n-restoration-bypass.ts` を書くが、実装は `rust/evaluators.ts` 1 ファイル（392 行）に
ruleA〜ruleN を置き、`PER_FILE_EVALUATORS` / `CONTEXT_EVALUATORS` で rule_id に写す。定義と判定器の分離、U2 の事実のみの入力、
`per_file` による評価単位の区別は満たしている。ファイル分割の差であり、記録のみ。

### 逸脱 2: ゴールデンケースは TypeScript の表で `expected.json` を持たない（計画どおり確認、U4 と同じ）

BR10.1 の `tests/golden/rust/<sensor-id>/<case-name>/{record,workspace,expected.json}` に対し、実装は `tests/golden/rust/cases.ts` の
`RUST_CASES` 表で、ランナーが一時ディレクトリに Cargo.toml・クレート・record を実体化する。record/ と workspace/ の同根、
実引数起動、`(rule_id, file)` 完全一致、決定性は満たしている。

### 逸脱 3: ゴールデンケースの網羅が BR10.2〜BR10.4 に届いていない（計画どおり確認。**要件の受け入れ基準に関わる**）

同梱ケースは 15 件（clean 3: `clean-domain` / `clean-model-skipped` / `clean-repository`、violation 12: a / b / c-literal / c-default /
d（domain）/ g（domain → IA）/ h / i / k / l / m-media / n）。**計画本文の「16 件」は誤りで 15 件**である。
「宣言された rule_id ごとに violation 1 件以上」は満たすが、BR10.2 の必須 clean 7 種（replay、IA getter、rmu 両側、InMemory 実装名、
Id 引数、宣言済み Command、private フィールド）のうち同梱は InMemory 実装名・宣言済み Command・private フィールドの 3 種のみ、
必須 violation 19 種のうち c-post-init / d（use-case）/ g（use-case → IA）/ g（external-io）/ layer.unknown / layer.conflict /
layer.mixed-targets が無く、BR10.3 の `model.invalid` ケースと BR10.4 の性能計測ケースも無い。
`u5-golden.test.ts` は `layer.*` と `model.invalid` を網羅性検査から除外している。

要件側では **FR7.3 の受け入れ基準「replay 経路を含む fixture が pass する」と FR7.4 の「IA 層からの呼び出しを含む fixture が pass する」
に対応する同梱 fixture が無い**。判定器と文脈組み立てには実装されており、一時 probe では両方が期待どおりに pass した（上表）ため
`traceability.json` では `OK` に note を付けて記録したが、**要件の検証欄を同梱テストで恒久的に固定してはいない**。
fixture の追加を本 Unit で行うか、Build and Test か後続 Unit に回すかは承認ゲートで判断されたい。目標を下げてはいない。

### 逸脱 4: 正規モデルのパスは `inception/ddd-domain-modeling/`（計画どおり確認、U4 と同じ）

BR3.4 本文の `inception/domain-modeling/domain-model.yaml` に対し、`context.ts` は `readStageStatus(run, "ddd-domain-modeling")` と
`inception/ddd-domain-modeling/domain-model.yaml` を読む。ステージ slug は `ddd-domain-modeling`（FR11.2 の `ddd-` 接頭辞）であり、
実装が正しく仕様本文が不正確。テストと golden も同じパスを使う。

### 逸脱 5: `bun run check` は終了コード 1（計画どおり確認）

`check:biome`（0）と `validate`（0）は通り、`test` 段で `tests/codex-dispatch-bridge.test.ts` の 12 件が落ちる。原因は
`aidlc-workflows/dist/codex/aidlc` の fixture 未生成で、`ddd/tests/README.md` が既知の前提条件として記載している。本 Unit の 27 件は
影響を受けず全件緑。FR8.7 の検証欄「`bun run check` で全 fixture のテストが緑」は本 Unit の割当外（U9 が `check` を所有）だが、
現状の作業ツリーでは満たせないことを正直に記す。

### 逸脱 6（追加）: (h) は impl 内メソッドの `execute` だけを照合し、自由関数 `fn execute` を照合しない

BR5.2 は「MethodDecl と FnDecl のうち name = execute」と書くが、`ruleH` は `impls(target.tree)` のメソッドしか見ない。
probe で `pub fn execute(inv: Invoice)` が検出されなかった。ユースケースは通常 struct + impl で書くため実害は小さいが、規則本文との差である。

### 逸脱 7（追加）: (l) の引数型照合が無く、フィールド型照合はドメイン層の名前一覧に依存する

BR6.3 は use の末尾セグメントに加えて `FieldDecl` / `ParamDecl` の型字面を照合すると書く。`ruleL` は use パスを照合したうえで、
`context.symbols.types` のうち `symbol.file === target.tree.file` の `field_type_texts` を照合するが、名前一覧は
ドメイン層クレートだけから作られる（BR8.3）ため、クエリ側ファイルでこの分岐が成立することは実質無い。`ParamDecl` の照合は無い。
クエリ側がドメイン型を使うには `use` が要るため `violation-l` は検出されるが、完全修飾パスで直接書かれた参照は漏れる。

### 逸脱 8（追加）: (i) の path-call 判定が BR5.3 より広い

BR5.3 は「名前が UseCase / Interactor で終わる型への関連関数呼び出しからの execute」と書くが、`ruleI` は `callee_text.endsWith("::execute")`
をすべて所見にする。false negative は生まないが、命名規約に従わない型の `X::execute` も違反として報告する（広め）。

### 逸脱 9（追加）: note の重複と、対象 0 件時の note 文言

`context.ts` が「`<n> files outside <layer>`」を、`evaluate.ts` が「`<n> non-target files skipped`」を別々に付けるため、
同じ事実が note に 2 度現れる（probe の `1 files outside interface-adapter/rmu; 1 non-target files skipped`）。また .rs を申告して
いても対象層のファイルが 0 件で所見も 0 件なら `context.ts` は `"no rust sources claimed"` を返し、BR2.2 の文言をそのまま流用している
（BR1.2 の「<件数> files outside <layer>」ではない）。判定結果には影響しない。

### 逸脱 10（追加）: 計画 Step 10 の「`{{HARNESS_DIR}}` を展開して投影する」は不正確（U4 逸脱 5 と同じ）

ビルドは `{{HARNESS_DIR}}` を展開せず、`dist/{claude,codex}/sensors/aidlc-ddd-rust-*.md` は
`command: bun {{HARNESS_DIR}}/tools/ddd-sensor-rust-<layer>.ts` をそのまま持つ。展開は `ddd/scripts/install.ts` のインストール時である。
Step 10 の実質（追加ツールチェーン不要で 3 マニフェストが投影される）は満たしている。

### 逸脱 11（追加・2026-09-12）: BR10.2 の不足 9 種は `Deferred` のまま残る

Step 12 で層診断 3 種を追加したが、BR10.2 が列挙する violation 19 種・clean 7 種に対して
**なお 9 種が不足している**。「網羅している」とは書かない。不足の内訳は次のとおりである。

| 区分 | 不足しているケース | BR10.2 の該当箇所 |
|---|---|---|
| violation | `c-post-init` | 必須 violation 一覧 |
| violation | `d（use-case 層からの getter 呼び出し）` | 同上（現存の `violation-d` は domain 層） |
| violation | `g（use-case → IA の layer-forbidden）` | 同上 |
| violation | `g（domain → use-case の layer-forbidden）` | 同上（現存の `violation-g` は domain → IA で、列挙されたどれでもない） |
| violation | `g（external-io）` | 同上 |
| clean | `(c)` ES replay 経路（`apply_event`） | 必須 clean 一覧 |
| clean | `(d)` IA 層からの getter 呼び出し | 同上 |
| clean | `(k)` rmu からの両側依存 | 同上 |
| clean | `(h)` Id 型引数 | 同上 |

clean 4 種の不足は逸脱 3（FR7.3 / FR7.4 の `Deferred`）と同じ根である。
`c-post-init` は判定器に実装があるが fixture が無い。
恒久的な解消には Rust fixture の追加が要る。

### 逸脱 12（追加・2026-09-12）: 層診断の宣言 `layer.*` と発行名の形式が一致しない

Step 12b で二重接頭辞を直した結果、層診断は `layer.unknown` /
`layer.conflict` / `layer.mixed-targets` として発行されるようになった。
しかしマニフェスト `aidlc-ddd-rust-domain.md` の宣言は
`{ rule_id: "layer.*", requirement: FR9.4, … }` という**ワイルドカード 1 件**である。

`tests/u5-golden.test.ts` の網羅性テストは「宣言された rule_id の集合」と
「violation ケースが発火させた rule_id の集合」を完全一致で照合するため、
`layer.*` は具体名のどれとも一致しない。したがって `NOT_IN_RUST_SUITE` の除外を
外すと `ddd-rust-domain:layer.*` が恒久的に `missing` として落ちる。**除外は残した。**

除外のコメントは「U2 テストと domain センサーの他ケースでカバー」と書いているが、
**実際の理由は宣言名と発行名の形式が違うこと**である。恒久的な解消には、
マニフェストでワイルドカードを具体名 4 件（`layer.unknown` / `layer.conflict` /
`layer.mixed-targets` / `layer.unowned`）に展開するか、網羅性テストに
ワイルドカード照合を実装するかの設計判断が要る。本 Unit では直していない。

### 逸脱 13（追加・2026-09-12）: `cqrs.*` / `workspace.*` の診断がどのマニフェストにも宣言されていない

`DiagnosticCode` の 8 種のうち `cqrs.conflict` / `cqrs.query-domain` /
`workspace.unreadable` / `workspace.no-members` の 4 種は、Step 12b の是正後に
その名前のまま発行されるが、**3 つの Rust マニフェストのいずれの `checks:` にも無い**。
是正前は `layer.cqrs.conflict` のように発行されていたため、ワイルドカード `layer.*` の
下に隠れて見えなかった。

これは U4 の未宣言 rule_id（`mapping-declarations.document` など）と同種のギャップである。
U4 では Step 12 で宣言を追加して解消したが、本 Unit では**直していない** —
`cqrs.*` と `workspace.*` は層判定ではなく CQRS 側とワークスペース読み取りの診断で、
どのマニフェストの検査面に属するかが設計判断を伴うためである。

### 補記: 文脈評価器の予算確認

`evaluate.ts` は `per_file` の判定器ループでは `api?.checkBudget()` を呼ぶが、文脈評価器（g / k）のループでは呼ばない。
g / k はクレート単位で辺を filter するだけで重い処理を含まないため、BR8.2 の趣旨（ファイル境界での予算確認）は損なわれていない。

## 完了条件の確認

- 本 Unit が所有する全アプリケーションソース 17 パスが `source-manifest.json` に列挙され、全件実在する。
- `traceability.json` の 17 件のうち 14 件は `OK`、**FR7.3 / FR7.4 / FR7.6 の 3 件は `Deferred`** とした
  （修正周回のレビュー所見 R-02 / R-04 を受けて `OK` から引き下げ）。FR7.3 / FR7.4 は受け入れ基準の
  「replay 経路 / IA 層からの呼び出しを含む fixture が pass する」に対応する同梱 fixture が無く、一時 probe は
  再現可能な証拠にならないため（逸脱 3）。FR7.6 は判定器が自由関数 `fn execute` を照合せず BR5.2 に対して
  偽陰性があるため（逸脱 6）。いずれも `target` はワークスペース相対の実在パスで、note に理由を記した。
  FR7.5 / NFR3 の note にも同梱 fixture の不足を明記している。
- Step 1・3・5・7・9・10 で既存実装への改変は行っていない。
- **既存ファイルへの改変は Step 12・12b の 2 パスに限られる** —
  `ddd/tests/golden/rust/cases.ts`（層診断 3 ケース、`Crate.bin` と `project()` の拡張）と
  `ddd/tools/ddd/lib/rules/evaluate.ts`（診断転送 1 行）。
  いずれも `source-manifest.json` に既に含まれており、追加は不要だった。
- `bun test tests/u5-golden.test.ts` が緑で、**ケース数は 18 件**（violation 15・clean 3）。
- 追加した 3 件は `layer.unknown` / `layer.conflict` / `layer.mixed-targets` を発火させ、
  `expect.rules` と findings が完全一致する。`expect.files` は当該クレートの `Cargo.toml`。
- **層診断の rule_id に二重接頭辞は無い**。`layer.layer.*` は 1 件も発行されない（実測）。
- Step 12・12b は 3 センサーのスクリプトと判定器を 1 行も変えていない。
- **BR10.2 の不足 9 種を逸脱 11 に一覧で明示した。**「網羅している」という記述は無い。
- 計画本文と `unit-test-instructions.md` のケース数が実測と一致している（Step 13、18 件）。
- 検証で見つかった乖離 13 件（計画時 5 件＋追加 8 件）と補記 1 件をすべて本欄に記録した。
