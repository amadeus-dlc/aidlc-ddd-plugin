# Code Summary — U8 ナレッジ（u8-knowledge-pack）

## 1. 概要

U8 の実装は 8 本のナレッジ文書（`ddd/knowledge/<agent-slug>/ddd-*.md`）である。
本パスは、その既存実装を code-generation ステージの成果として検証し、
検証で見つかった **要件の未達 2 件と BR レベルの逸脱 6 点を本パス内で修正**
（Step 10〜15）したうえで記録するものである。実装の書き起こしは行っていない。

**ファイル名・配置・節構成・本文の主張は変えていない。** 変えたのは規則の書き方
（rule_id と文型）、Principles 節の形、Enforcement 列、Examples (index) 節、
Sources 節と Source 列、Conflicts 節の 4 行、および Step 10 で追加した 1 規則である。

## 2. 作成物

`source-manifest.json` に列挙した 8 パスが本 Unit の所有物である。

| # | パス | 主題 | 行数（修正前 → 修正後） |
|---|---|---|---|
| 1 | `knowledge/aidlc-architect-agent/ddd-always-valid-model.md` | Always Valid Domain Model、ADT 原則、4 種分類、ID 文法、メタ規律、コアとの矛盾 4 件 | 67 → 102 |
| 2 | `knowledge/aidlc-architect-agent/ddd-aggregate-and-invariants.md` | 集約＝FSM、不変条件、Command / Event / Domain Error、ID 系譜 | 49 → 74 |
| 3 | `knowledge/aidlc-architect-agent/ddd-use-case-conventions.md` | ユースケース規約 5 点セット、進行役原則、冪等性、プロセスマネージャー | 44 → 66 |
| 4 | `knowledge/aidlc-architect-agent/ddd-cqrs-and-consistency.md` | CQRS の層構造、2 軸の宣言、コマンド側からリードモデルを読まない | 49 → 75 |
| 5 | `knowledge/aidlc-developer-agent/ddd-rust-domain-conventions.md` | field-visibility、tell-dont-ask、factory-naming、interior-mutability、module-visibility、domain-equality、error-handling、first-class-collections、`&mut self` | 51 → 92 |
| 6 | `knowledge/aidlc-developer-agent/ddd-rust-persistence-conventions.md` | スタティックバインディング、ES 実装規約、decide/apply、replay、ポート配置 | 51 → 86 |
| 7 | `knowledge/aidlc-aws-platform-agent/ddd-interface-adapter-conventions.md` | ポート分類、リポジトリ命名・スコープ・動詞、DAO＋DTO、永続化基盤、RMU、upstream-contracts | 48 → 83 |
| 8 | `knowledge/aidlc-shared/ddd-layer-boundaries.md` | 4 層、許可方向、composition root、command/query 禁止 | 49 → 82 |
| | **合計** | | **408 → 660** |

BR3.3 の分量の目安（1 本 250 行以内、合計 1500 行以内）は満たしている
（最大 102 行、合計 660 行）。増分は Principles 節の `RuleEntry` 化、索引の網羅、
出典の明示によるもので、主題の追加は Step 10 の 1 件だけである。

### 節構成（Step 3 の確認結果）

8 本とも `functional-spec.md` §3 の順で H2 を持ち、**本パスで順序・種別を変えていない**。

| パス | Purpose | Principles | Rules | Rationale | Conflicts | Examples (index) | Retired rules | Meta-discipline | Sources |
|---|---|---|---|---|---|---|---|---|---|
| always-valid-model | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| aggregate-and-invariants | ○ | ○ | ○ | ○ | — | ○ | ○ | — | ○ |
| use-case-conventions | ○ | ○ | ○ | ○ | — | ○ | ○ | — | ○ |
| cqrs-and-consistency | ○ | ○ | ○ | ○ | — | ○ | ○ | — | ○ |
| rust-domain-conventions | ○ | ○ | ○ | ○ | — | ○ | ○ | — | ○ |
| rust-persistence-conventions | ○ | ○ | ○ | ○ | — | ○ | ○ | — | ○ |
| interface-adapter-conventions | ○ | ○ | ○ | ○ | — | ○ | ○ | — | ○ |
| layer-boundaries | ○ | ○ | ○ | ○ | — | ○ | ○ | — | ○ |

## 3. Unit 限定の検証コマンド

作業ディレクトリは `ddd/`（追加依存なし、`bun:test` と Biome 2.5.12 のみ）。

- `bun run check:biome` — リポジトリ全体の整形規約を壊していないこと
- `bun run validate` — プラグイン検証。`knowledge/` 面の宣言を受理すること
- `bun test tests/u3-plugin-scaffold.test.ts` — ナレッジ面を検査する唯一の既存テスト
- `bun run build:claude` / `bun run build:codex` — 8 本の投影

**使わないコマンド**: `bun test tests/`（プロジェクト全体）。Build and Test が Unit ごとに
実行するため、Unit 限定の指定が要る。コマンドの詳細は
`unit-test-instructions.md` に記録した。

## 4. 主要な実装判断

1. **本 Unit でテストを新設しない。** U8 は kind `spec` で、BR8.1／BR8.2 の検証
   （compose 後の `inline_context_paths` の実在、Sources 節の存在、example-index の
   fixture の実在）は functional-spec.md §4 WF4 と entities.md の `PlacementCheck` が
   **U9 の統合テスト（`bun run check`）** に課している。`tests/golden/` の所有者も U4・U5 である。
   したがって U9 が引き受ける検証項目を §13 に申し送りとして列挙した。
2. **規則 ID の採番**: `K.<topic>.<n>`。`<topic>` は `entities.md` の `KnowledgeFile.topic`
   （ファイル名の `ddd-` 以降）、`<n>` はファイル内で連番（Principles 節を先、Rules 節を後）。
   文書間の一意性は topic の一意性で担保する。結果は 8 topic × 連番で 83 規則、
   欠番・重複なし（§8 の照合結果）。
3. **BR4.3 の適用**: ALWAYS / NEVER を冠する規則は、センサー・ステージ契約・スキーマの
   いずれかで強制されていなければならない。実在する強制手段が無い規則は PREFER に
   言い換えて `guidance-only` にした。**弱めた規則は §12-1 に全件列挙する**（隠さない）。
4. **BR4.4 の例外記録**: `functional-spec.md` §3-3 は Rules 節の列を 6 列に固定しており、
   `entities.md` の `exceptions` に対応する列が無い。**例外は Rationale 列に
   「<例外> — <理由>」の形で書く**と解釈した。この解釈は
   `ddd-always-valid-model.md` の Meta-discipline 節にも明記した。
5. **example-index のロケータ形式**: BR6.1 は `tests/golden/<suite>/<sensor-id>/clean-*/`
   という**ディレクトリ**を索引する形を定めるが、そのディレクトリは存在しない。
   実際のゴールデンケースは `tests/golden/design/cases.ts` と `tests/golden/rust/cases.ts` の
   TypeScript の表にあり、ランナーが `files` を一時ディレクトリに実体化して実行する
   （**U4 の逸脱 1 として既に承認済み**。U8 はこの構造を継承する）。したがって
   `fixture_path` は `tests/golden/<suite>/cases.ts#<case-name>` と書いた。
6. **出典の差し替え先（Step 15 の精査）**: 計画は、`Source` 列が指す 2 本の実装ファイルを
   「U2 の設計に差し替える」としていた。精査の結果、`ddd/tools/ddd/lib/rules/lists.ts`
   （replay 名・post-init 名の固定リストと分類順）の正は **U5** であり（U5 の `rules.md` と
   `functional-spec.md` が分類順と両名リストを定める）、U2 ではない。よって
   `ddd-rust-domain-conventions.md` と `ddd-rust-persistence-conventions.md` は
   **U2（クレート命名・配置）と U5（規則の意味論と名リスト）の両方**を出典とし、
   `ddd/tools/ddd/lib/workspace/resolver.ts`（許可依存表）は **U2** に差し替えた。
   計画の Step 15 の範囲内での精緻化である（§12-4 に逸脱として記録）。
7. **Conflicts 節の書き方**: コアの記述は `.claude/knowledge/aidlc-architect-agent/ddd-patterns.md`
   の**英語原文の引用**とし、`core_location` は節名（`Repository Pattern` / `Design Heuristics` /
   `Entities` / `Domain Events`）まで書いた。`precedence = plugin` は全 4 行で維持し、
   コアのファイルは編集できないため列ではなく本文で明示した。
8. **BR8.1／BR8.2 は U9 が所有する（設計どおり）**。本 Unit は検証を新設せず申し送る。

## 5. Step 9 の基準値と是正後の再実行（差なし）

是正前（Step 9）と是正後（Step 16）で同じ 4 コマンドを実行した。**結果は完全に一致**した。

| コマンド | 是正前 | 是正後 | 終了コード |
|---|---|---|---|
| `bun run check:biome` | `Checked 51 files in 23ms. No fixes applied.` | `Checked 51 files in 25ms. No fixes applied.` | 0 / 0 |
| `bun run validate` | `Plugin validation: VALID`、Errors 0 / warnings 1 | `Plugin validation: VALID`、Errors 0 / warnings 1 | 0 / 0 |
| `bun test tests/u3-plugin-scaffold.test.ts` | `6 pass` / `0 fail`、55 expect() calls | `6 pass` / `0 fail`、55 expect() calls | 0 / 0 |
| `bun run build:claude` / `build:codex` | `Plugin build: COMPLETE` | `Plugin build: COMPLETE` | 0 / 0 |

- `validate` の warnings 1 件は `hooks/compose.ts [compose-hook-absent]`（vendored な compose
  フックが無く、ビルドが同梱フックを注入する旨）。**U8 の変更とは無関係で、是正前から同じ**。
- `build:claude` の投影先 `ddd/dist/claude/knowledge/` に 4 ディレクトリ
  （`aidlc-architect-agent` / `aidlc-aws-platform-agent` / `aidlc-developer-agent` /
  `aidlc-shared`）が生成されることを確認した（FR10.3 の配置面）。
- `bun run check` は `test` 段を含むため終了コード 1 になる見込みである（§12-5 に記載）。

## 6. Step 10 の是正 — FR10.2 の `module-visibility`

`ddd-rust-domain-conventions.md` の Rules 節に `K.rust-domain-conventions.12` を追加した。

| 項目 | 内容 |
|---|---|
| Statement | `PREFER keeping a module's items internal to that module, exporting only what the layer above must call.` |
| Applies to | module |
| Enforcement | `guidance-only` |
| Rationale | モジュール可視性は設計の一部だが、センサー (a) は**フィールド**の可視性しか読まず（`lib/rules/rust/symbols.ts` が `field.visibility` を比較する）、モジュール自身の可視性を読む検査は (a)〜(n) にも `layer.*` にも存在しない。主張を強制できる範囲に合わせるため PREFER + guidance-only とする。 |
| Source | `DL §9`（`module-visibility` の項） |

文型を PREFER にしたのは BR4.3 の帰結である（ALWAYS / NEVER のまま `guidance-only`
にはできない）。**この規則は新規追加であり、既存の主張を弱めたものではない**が、
FR10.2 が求めるトピックに対して「義務ではなく選好」と主張する点は §12-1 に併記する。

## 7. Step 11 の是正 — FR10.4 の ADR-010 の転記

`ddd-always-valid-model.md` の `## Conflicts with core knowledge` の 4 行を、
`inception/domain-design/decisions.md` ADR-010 の 4 件に置き換えた。
**1 対 1 対応は次のとおり**（4 行 ↔ ADR-010 の 4 件）。

| 行 | ADR-010 の矛盾 | コアの記述（英語原文の引用元） | プラグインの規約 | 適用範囲 |
|---|---|---|---|---|
| C-1 | Repository の動詞と条件付き検索 | `ddd-patterns.md` → Repository Pattern（`save(order: Order): void` / `findByCustomer(customerId): CustomerId): Order[]`） | `K.interface-adapter-conventions.6` | IA 層のポート設計（FR5.2、センサー (m)）。条件付き検索はクエリ側の DAO＋DTO に置く |
| C-2 | 集約の導出 | `ddd-patterns.md` → Design Heuristics（"Start with larger aggregates and split when you encounter contention or performance issues"） | `K.aggregate-and-invariants.10` | domain-modeling の集約導出手順（FR1.6、FR2.4） |
| C-3 | Entity の可変性と setter 禁止 | `ddd-patterns.md` → Entities（"Mutable — their state changes over time"） | `K.rust-domain-conventions.2`, `K.rust-domain-conventions.7` | ドメイン層のコード規約（FR7.1〜FR7.3） |
| C-4 | Event Sourcing とコマンドの戻り値 | `ddd-patterns.md` → Domain Events（"Build audit trails and event sourcing"） | `K.cqrs-and-consistency.5`, `K.rust-persistence-conventions.5` | コマンドの戻り値契約と復元経路（センサー (c)(n)）。**BC 間の連携パターン（通知、状態転送）はコアを引き続き適用する** |

- 表の列は `# | Core statement | Core location | Plugin rule | Scope | Precedence | Rationale`
  の **7 列**である（Step 17d で 5 列から是正。経緯は逸脱 13-8）。
  `core_location` と `precedence` はそれぞれ独立した列で、`entities.md` の
  `ConflictEntry` の属性定義と 1 対 1 に対応する。
  **訂正（2026-09-12）**: 本項は当初「表の列は `functional-spec.md` §3-5 が定める
  `# | Core statement | Plugin rule | Scope | Rationale` に合わせた」と書いていたが、
  **これは事実ではない**。§3-5（50 行目）は「`## Conflicts with core knowledge` —
  always-valid-model にのみ置く。ADR-010 の 4 件の表。」とだけ書いており、
  **列構成を定めていない**。5 列という選択は仕様の要求ではなく実装側の判断だった。
- `precedence = plugin` は全 4 行で維持し、表の直前に「**Precedence is `plugin` for all four
  rows**」、直後に「Source of the plugin-side wording: `inception/domain-design/decisions.md`
  ADR-010.」を書いた。
- Purpose・Meta-discipline・Sources 節は変更していない（BR3.2 の節順を壊さない）。
- 旧 4 行（Domain Primitive がコアの語彙に無い、コアが集約をデータの塊として扱う、
  コアが getter を許す、コアがコンテキスト間パターンを開いたままにする）は ADR-010 と
  一致しないため置換した。旧 C-2・C-3 に対応する主張は、ADR-010 の (2)・(3) として
  別の形で残っている。

## 8. Step 12 の是正 — 規則 ID と文型、Principles の `RuleEntry` 化

### 8-1. 採番

| ファイル | topic | 修正前 | 修正後 | 規則数（前 → 後） |
|---|---|---|---|---|
| `ddd-always-valid-model.md` | `always-valid-model` | AVM-1〜5 + Principles 4 | `K.always-valid-model.1`〜`.9` | 9 → 9 |
| `ddd-aggregate-and-invariants.md` | `aggregate-and-invariants` | AGG-1〜8 + Principles 3 | `K.aggregate-and-invariants.1`〜`.11` | 11 → 11 |
| `ddd-use-case-conventions.md` | `use-case-conventions` | UC-1〜7 + Principles 3 | `K.use-case-conventions.1`〜`.10` | 10 → 10 |
| `ddd-cqrs-and-consistency.md` | `cqrs-and-consistency` | CQ-1〜6 + Principles 3 | `K.cqrs-and-consistency.1`〜`.9` | 9 → 9 |
| `ddd-rust-domain-conventions.md` | `rust-domain-conventions` | RDC-1〜8 + Principles 3 | `K.rust-domain-conventions.1`〜`.12` | 11 → 12 |
| `ddd-rust-persistence-conventions.md` | `rust-persistence-conventions` | RPC-1〜7 + Principles 3 | `K.rust-persistence-conventions.1`〜`.10` | 10 → 10 |
| `ddd-interface-adapter-conventions.md` | `interface-adapter-conventions` | IAC-1〜8 + Principles 3 | `K.interface-adapter-conventions.1`〜`.11` | 11 → 11 |
| `ddd-layer-boundaries.md` | `layer-boundaries` | LB-1〜8 + Principles 3 | `K.layer-boundaries.1`〜`.11` | 11 → 11 |
| **合計** | | 57 規則 + 25 原則 | **83 規則** | 82 → **83** |

増分は Step 10 の 1 件のみである。

### 8-2. 照合結果

- **ID の文法**: 全 83 の `rule_id` が `K.<topic>.<n>` に一致し、8 topic の連番に
  欠番・重複は無い（`always-valid-model`: 1〜9、`aggregate-and-invariants`: 1〜11、
  `use-case-conventions`: 1〜10、`cqrs-and-consistency`: 1〜9、
  `rust-domain-conventions`: 1〜12、`rust-persistence-conventions`: 1〜10、
  `interface-adapter-conventions`: 1〜11、`layer-boundaries`: 1〜11）。
- **文型**: 全 83 の `statement` が ALWAYS（41）／ NEVER（16）／ PREFER（26）で始まる 1 文である。
- **旧表記の残存**: 8 本の中に `AVM-` / `AGG-` / `UC-` / `CQ-` / `RDC-` / `RPC-` / `IAC-` /
  `LB-` の旧表記は 1 件も残っていない（`grep` で 0 件）。`ddd/` の他の場所
  （テスト・ツール・contribution・docs・CHANGELOG）と `aidlc/` の記録にこれらの ID を
  参照する箇所が無いことは計画時に確認済みで、改名による参照切れは起きていない。
- **Principles 節**: 8 本すべてで箇条書きを `RuleEntry` の表（Rules 節と同じ 6 列
  `Rule ID | Statement | Applies to | Enforcement | Rationale | Source`）にした。
  機械強制がある原則（18 件）は ALWAYS / NEVER、それ以外（7 件）は PREFER + guidance-only。

### 8-3. Enforcement の内訳（BR4.3 の判定）

| Enforcement | 件数 | 対応する文型 |
|---|---|---|
| `sensor:*` | 49 | ALWAYS / NEVER のみ |
| `schema:*` | 5 | ALWAYS / NEVER のみ |
| `stage-contract:*` | 3 | ALWAYS / NEVER のみ |
| `guidance-only` | 26 | PREFER のみ |
| **合計** | **83** | |

**ALWAYS 41 + NEVER 16 = 57 = sensor 49 + schema 5 + stage-contract 3。**
PREFER 26 = guidance-only 26。したがって「ALWAYS / NEVER を冠するのに強制手段が無い規則」
および「PREFER なのに強制手段を主張する規則」は**いずれも 0 件**である（BR4.3 適合）。

## 9. Step 13 の是正 — Enforcement の深刻度と anchor

### 9-1. 深刻度の補完（`entities.md` は `level = sensor` のとき `severity` を必須とする）

| 修正前 | 修正後 | 免除の記述の移動先 |
|---|---|---|
| `RPC-2`: `sensor:c (replay exempt)` | `K.rust-persistence-conventions.5`: `sensor:c blocking` | Rationale に「sensor (c) ignores the replay path because a method that only applies an already-decided event is not a second construction path.」 |
| `RPC-3`: `sensor:b (exempt)` | `K.rust-persistence-conventions.6`: `sensor:b blocking` | Rationale に「Sensor (b) treats these four names as replay-exempt and reports no undeclared mutation for them, so the exemption is the reason the name list is fixed rather than free.」 |
| `LB-6`: `sensor:k (exempt when from rmu)` | `K.layer-boundaries.9`: `sensor:k blocking` | Rationale に「Sensor (k) exempts an edge that comes from an RMU crate rather than a command- or query-side crate; that exemption is the reason this rule reads as a permission inside the ban.」 |

免除の事実は `refs` に括弧書きで残さず Rationale に移した（`refs` は規則 ID・anchor・
スキーマ属性名の一覧であるため）。8 本の全 `sensor:` 行を走査し、**`level = sensor` で
深刻度の無いものが他に無いこと**を確認した（欠落 0 件）。

### 9-2. 実在しない anchor の是正

`AGG-7` の `stage-contract:after-step:3` は**実在しない**。本プラグインの contribution が
宣言する anchor は `after-step:1`（code-generation）、`:2`・`:4`（domain-design、
functional-design）、`:2`・`:5`（infrastructure-design）だけで、`ddd-domain-modeling` は
fragment を持たない（`ddd/contributions/**` と `ddd/stages/inception/ddd-domain-modeling.md`
で確認済み）。「イベントから集約を逆算する」はワークショップ手順であって機械強制できないため、
`K.aggregate-and-invariants.10` を **PREFER + guidance-only** に言い換えた。Rationale には
「導出の**結果**（全 Aggregate が不変条件と遷移を持つこと）は `sensor:model-completeness.i` /
`.ii` が強制する。導出の**順序**は強制しない」と書いた。

是正後に残る `stage-contract` の参照は `stage-contract:after-step:2` の 1 種のみで、
これは domain-design / functional-design の contribution が宣言する実在 anchor である
（3 規則: `K.use-case-conventions.3`, `.4`, `.6`）。

### 9-3. 参照の実在照合（BR4.2）

| 参照種別 | 参照先 | 実在 |
|---|---|---|
| `sensor:(a)`〜`(n)` | U5 の Rust センサー | ○ |
| `sensor:model-completeness.i/.ii`、`model-presence`、`reference-ids`、`mapping-declarations.*`、`layer-structure.*`、`design-advisories.*` | U4 の設計センサー | ○ |
| `sensor:layer.*` | U2 の層判定（ワークスペース走査時に評価） | ○ |
| `schema:id-grammar`、`schema:lineage`、`schema:Command.effect`、`schema:command-no-error` | U1 のスキーマ属性 | ○ |
| `stage-contract:after-step:2` | domain-design / functional-design の fragment | ○ |

書き換え後の 8 本について再度照合し、**実在しない参照は 0 件**である。

## 10. Step 14 の是正 — example-index の実在化と網羅

### 10-1. 索引先の対応

`level = sensor` の全規則（49 件）に索引を 1 件付けた。索引先は**その規則を強制する
センサーが実行する clean ケース**である（`pass: true` のケース）。

| センサー | suite | clean ケース | 索引した規則数 |
|---|---|---|---|
| `ddd-rust-domain`（(a)(b)(c)(d)） | rust | `clean-domain` | 20 |
| `ddd-rust-interface-adapter`（(g)(l)(m)(n)） | rust | `clean-repository` / `clean-domain` | 8 |
| `ddd-model-completeness`（.i/.ii） | design | `clean-complete` | 4 |
| `ddd-mapping-declarations`（.axes/.j/.process-manager-required/.use-case-item） | design | `clean-mapping` | 8 |
| `ddd-layer-structure`（.item/.m-name/.m-media） | design | `clean` | 5 |
| `ddd-design-advisories`（.store-upsert） | design | `clean` | 2 |
| `sensor:k` / `sensor:l`（宣言グラフ側） | design | `clean` | 2 |

`clean-mapping` と `clean` は suite 内で複数の規則が使うケース名であるため、
**`What it shows` 列に対象センサーを明記**して一意にした。

### 10-2. 違反ケースから clean ケースへの差し替え

| 修正前 | 問題 | 修正後 |
|---|---|---|
| `CQ-3` → `tests/golden/rust/.../violation-k` | BR6.1 は「違反なし」fixture を求める | `K.cqrs-and-consistency.6` → `tests/golden/design/cases.ts#clean` |
| `RPC-7` → `tests/golden/rust/.../violation-n` | 同上 | `K.rust-persistence-conventions.10` → `tests/golden/rust/cases.ts#clean-repository` |

### 10-3. `projection_note`（BR6.2）

全行に、投影先のハーネスからは参照できない旨（`tests/golden/` は `.claude/knowledge/` に
投影されない）と、プラグインのリポジトリでの参照方法（`tests/golden/<suite>/cases.ts` で
ケース名を引き、`bun test tests/u5-golden.test.ts` または `tests/u4-golden.test.ts` で
実行する）を書いた。修正前は "design fixture" / "rust fixture" の一言で、BR6.2 の内容を
持っていなかった。

### 10-4. 索引の残差（正直な申告）

- **`sensor:k` / `sensor:l` の索引は規則を実演していない。** rust suite の
  `clean-repository` にはコマンド側とクエリ側のクレート対が含まれていないため、
  この 2 規則の索引は「センサーが違反を報告しなかったケース」を指すにとどまる。
  design suite の `clean` は `command_side_crates: [billing-domain]` /
  `query_side_crates: [billing-query]` を `depends_on: []` で宣言するため、
  **宣言側の (k)(l) は空虚ではない**（両側が実在し、相互依存が無いことを確認している）。
- **BR6.1 のディレクトリ形式は実装に存在しない。** `tests/golden/<suite>/<sensor-id>/clean-*/`
  というディレクトリは無く、ケースは TypeScript の表にある。ロケータを
  `tests/golden/<suite>/cases.ts#<case-name>` としたのはこのためで、U4 の逸脱 1 に由来する
  残差である。U8 は `tests/golden/` の所有者ではないためケースを新設できない。
- **`RPC-2` / `RPC-3`（＝`K.rust-persistence-conventions.5` / `.6`）の索引は (c) / (b) の
  clean ケースを指し、Event Sourcing 固有の部分を実演しない。** `clean-domain` は
  event-sourced な集約を持たないため `decide` / `apply` の対も replay メソッドも存在しない。
- **`sensor:c` を索引した `clean-domain` では、`.5` だけでなく `.2` / `.3` の一般則も
  空虚に充足される。** `clean-domain` は正規モデルを投影しないため、`&mut self` メソッドは
  `classifyMutator` の分類で `unknown` になり、センサー (b) は**構成上**沈黙する
  （宣言された Command を見つけたから沈黙するのではない）。rust suite の clean ケースに
  「宣言された Command」を実行するケースは無い。
- **`sensor:n` の索引（`K.rust-domain-conventions.2` / `.6` の 2 番目のセンサー）は
  `clean-repository` を指す。** `clean-repository` には復元コードが無いため `.10` と同様に
  空虚な充足である。
- **`layer.*` の索引は rust の `clean-domain` を指す。** `clean-domain` は単一の domain
  クレートしか宣言しないため、adapter・use-case・infrastructure の規則
  （`K.layer-boundaries.4` / `.5` / `.7`）は「そうしたクレートが存在しない」ことによって
  満たされており、正しい辺が検査されたからではない。design の `clean` も RMU クレートを
  宣言しないため、`K.layer-boundaries.9` の免除は行使されていない。

## 11. Step 15 の是正 — 出典と BR5.2 の引用

### 11-1. BR7.1: 出典を Unit 設計に向ける

| 説明の対象 | 修正前の出典 | 修正後の出典 |
|---|---|---|
| 正規モデルのスキーマ、機械的な完了条件 (i)(ii)、ID 文法・系譜 | 一部 `U1 BR1.1` のみ | `construction/u1-sensor-foundation/functional-design/`（`functional-spec.md`、`entities.md`、`rules.md`） |
| クレート命名・配置、層の割り当て、許可依存表 | 実装ファイル `ddd/tools/ddd/lib/workspace/resolver.ts` | `construction/u2-rust-analysis-foundation/functional-design/`（`functional-spec.md`、`rules.md`） |
| replay 名・post-init 名の固定リストと分類順 | 実装ファイル `ddd/tools/ddd/lib/rules/lists.ts` | `construction/u5-rust-code-sensors/functional-design/`（`functional-spec.md`、`rules.md`） |
| 設計書の節（`ddd/docs/*.md §n`）と ADR | 変更なし | 変更なし（`SourceRef.kind = design-doc` / `adr` として正当） |

出典は `Sources` 節と各規則の `Source` 列の双方で `SourceRef.kind = unit-design` の形にした。
記録パスは `aidlc/spaces/default/intents/<intent>/` からの相対である旨を併記した。

### 11-2. BR5.2: 矛盾しないコアの記述の引用

コアの `.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` の次の節を、
`core-knowledge` の `SourceRef` として `Rationale` 節（および該当規則の `Source` 列）に引用した。

| コアの節 | 引用した記述 | 引用先 |
|---|---|---|
| Aggregates | "Reference other aggregates by ID, not by object reference" / "Keep aggregates small" / "Transactions should not span multiple aggregates" | `ddd-always-valid-model.md`, `ddd-aggregate-and-invariants.md`, `ddd-layer-boundaries.md` |
| Repository Pattern | "One repository per aggregate root (not per entity or table)" / "Do not put query logic in repositories — use separate read models for complex queries" | `ddd-always-valid-model.md`, `ddd-use-case-conventions.md`, `ddd-cqrs-and-consistency.md`, `ddd-rust-persistence-conventions.md` |
| Value Objects | "Prefer value objects over primitives" | `ddd-always-valid-model.md`, `ddd-rust-domain-conventions.md` |

引用は「プラグイン側の根拠」として置き、矛盾する 4 件は
`ddd-always-valid-model.md` の Conflicts 節を唯一の一覧として参照させた（各ファイルの
Rationale から `C-1`〜`C-4` を名指しする）。これにより「矛盾しない記述は引用し、
矛盾する記述は 1 か所にまとめて優先順位を明示する」形になった。

## 12. Step 17 の是正 — レビュー所見 R-01・R-02・R-03

前回レビューで残った Minor 所見 3 件を、承認済みの Step 17 として是正した。

| ステップ | 所見 | 対象 |
|---|---|---|
| 17a | R-03 | `traceability.json`（記録のみ） |
| 17b | R-02 | `traceability.json`（記録のみ） |
| 17c | — | `code-generation-plan.md` のチェックボックス（記録のみ） |
| 17d | R-01 | `ddd-always-valid-model.md` の Conflicts 節（**ナレッジ文書 1 本**） |

**17a〜17c はナレッジ文書に一切触れていない。17d だけが 8 本のうち 1 本の 1 節に触れる。**
経緯と実測は逸脱 13-8 に記録した。

### 12-1. Step 17a — `target` がディレクトリだった 2 行（R-03）

`FR10`（status `OK`）と `FR10.3`（status `Deferred`）の `target` が `ddd/knowledge/` という
**ディレクトリ**を指しており、traceability センサーが `invalid_targets`
（"target file does not exist"）を報告していた。他 Unit の完了条件と同じく、
`target` は実在するワークスペース相対**ファイル**でなければならない。

両行を `ddd/knowledge/aidlc-shared/ddd-layer-boundaries.md` に改めた。
全エージェントが全ステージで読む shared の 1 本を代表として選んだ。
「8 本の集合」であることは既存の `note` が保持しているため、情報は失われていない。

**実測**: 是正後に traceability センサーを実行した。

```
bun .claude/tools/aidlc.ts engine sensor-traceability \
  --output-path <record>/construction/u8-knowledge-pack/code-generation/traceability.json \
  --stage-slug code-generation
```

| 判定 | 結果 |
|---|---|
| `invalid_targets` | **0 件**（是正前は `ddd/knowledge/` を報告していた） |
| `gaps` / `orphans` / `missing_from_table` / `invalid_entries` | いずれも 0 件 |
| `missing_from_upstream_ids` | 88 件（advisory） |
| `findings_count` | 88 |

`missing_from_upstream_ids` の 88 件は `requirements.md` の製品全体の FR／NFR であり、
本 Unit に割り当てられていない ID である。U1〜U5 の記録でも同じ挙動が確認されており
（U2 で 78 件、U4 でも同種）、当該 sensor は `default_severity: advisory` でステージ進行を止めない。
**BR を 26 件追加してもこの件数は変わらない**（この判定は FR／NFR だけを見るため）。

### 12-2. Step 17b — 自 Unit の業務規則 26 件を載せた（R-02）

是正前の `upstream_ids` は FR10 系 7 件のみで、本 Unit 自身の
`functional-design/rules.md` が定める **BR1.1〜BR8.2 の 26 件が 1 件も現れていなかった**。
ステージ定義 `code-generation.md` の期待 JSON スキーマ例は `AC` / `NFR` に加えて `BR` を
coverage 行として示しており、業務規則の対応も含める形が想定されている。

26 件を `upstream_ids` と `coverage` に追加した。**`target` は本 Unit 所有の 8 パスに限り**、
他 Unit 所有のファイルは 1 件も指していない（U3 で同種の所見を直したときと同じ規律）。

| BR 群 | 主題 | 代表 `target` |
|---|---|---|
| BR1.1〜BR1.4 | 配置と命名 | shared 1 本、architect の always-valid-model、aws-platform の IA 規約 |
| BR2.1〜BR2.3 | トピックの網羅 | architect / developer / aws-platform の各代表 |
| BR3.1〜BR3.3 | 言語と書式と分量 | shared 1 本、最長の always-valid-model |
| BR4.1〜BR4.5 | 規則の書き方 | developer の rust-domain-conventions、architect の aggregate-and-invariants |
| BR5.1〜BR5.3 | コアとの矛盾 | always-valid-model（`Conflicts` と `Meta-discipline` を持つ唯一のファイル） |
| BR6.1〜BR6.3 | 例の索引 | aggregate-and-invariants、shared 1 本 |
| BR7.1〜BR7.3 | 出典と失効 | rust-persistence-conventions、aggregate-and-invariants、shared 1 本 |
| BR8.1〜BR8.2 | 検証 | shared 1 本（**`Deferred`**） |

**`Deferred` にした 2 件**: BR8.1（compose 後に各ステージの `inline_context_paths` に
ナレッジが現れることの検証）と BR8.2（8 本の存在・接頭辞・衝突・Sources 節・fixture の実在を
テストで検証）は、いずれも規則本文が検証を **U9 の統合テスト**に課している。
本 Unit に属するテストファイルは実在しない（`ddd/tests/` に u8 のテストは無く、
ナレッジ面に触れる既存テストは U3 所有の `tests/u3-plugin-scaffold.test.ts` のみ）。
既存の FR10.3 と同じ理由で `Deferred` とした。

**各行の `note` は実測に基づく。** 推測で `OK` にした行は無い。特に次の 2 件は
「空虚に満たされている」ことを明記した。

- **BR6.3**（コード例は 15 行以下）— 8 本のいずれにもフェンス付きコードブロックが
  **1 件も存在しない**（`grep -c '```'` が全 8 本で 0）。良い例は Examples (index) の
  fixture 索引に一元化されている。
- **BR7.2**（失効規則は打ち消し線と失効注記で残す）— 8 本すべてが `## Retired rules` 節を
  持つが、実測では**全 8 本の内容が `None.`** である。節の器は用意されており、
  失効した規則がまだ 1 件も無い。

**実測による確認**:

| 項目 | 結果 |
|---|---|
| `upstream_ids` / `coverage` の件数 | 33 / 33（FR 7 + BR 26） |
| `upstream_ids` にあって `coverage` に無い ID | 0 件 |
| `source-manifest.json` の 8 パス外を指す `target` | **0 件** |
| 実在しない `target` | **0 件** |
| status の内訳 | `OK` 30 / `Deferred` 3（FR10.3、BR8.1、BR8.2） |

### 12-3. Step 17c — 計画のチェックボックスを実施済みに更新した

計画 `code-generation-plan.md` の Step 1〜16 が、本記録が実施を記録しているにもかかわらず
すべて `[ ]` のまま残っていた。タスクマーカーは承認フィンガープリントの射影から
明示的に除外される（`aidlc-testing-posture.ts`: 「List task markers are reset: `[x]`, `[X]`
and `[-]` become `[ ]` … A tick is a claim about execution, not a change to the plan.」）。

Step 1〜16 と Step 17a〜17c を `[x]` に更新した結果、**19/19 が実施済み、未チェック 0 件**。
更新後に承認状態を実測した。

```
ok: true, fingerprintValid: true, receiptValid: true
approvalFingerprint: sha256:v3:7f0f535a31adb915b8aa3117adcae3e4d20fa4043b96904ce34d0625eeaa9cdd
```

フィンガープリントは更新前と同一である。**チェックボックスの更新は承認を失効させない。**
一方、計画本文の**散文**は射影の対象で byte-exact に比較されるため書き換えられない。
実施状況の正はチェックボックスと本記録であり、計画の散文ではない。

### 12-4. Step 17 の前後で変わらなかったこと

Step 17a〜17c は記録のみの修正であり、17d もナレッジ 1 本の表の列構成だけを変えて
本文の主張・行 ID・節構成には触れていないため、次はすべて是正の前後で同一である。

| コマンド | 終了コード |
|---|---|
| `bun run validate` | 0 |
| `bun run build:claude` | 0 |
| `bun run build:codex` | 0 |
| `bun run check:biome` | 0 |
| `bun test tests/u3-plugin-scaffold.test.ts`（ナレッジ面に触れる唯一の既存テスト） | 6 pass / 0 fail / 55 expect |

## 13. 逸脱（正直な申告）

### 13-1. BR4.3 により PREFER に弱めた規則（全件）

`PREFER + guidance-only` は 26 件ある。内訳は次のとおりで、**主張が弱まったのは (b) の 8 件**である。

**(a) 修正前から `guidance-only` だった 16 件** — 実質的な主張は変わらない（文型のマーカーを付けただけ）。

| 修正後 ID | 修正前 ID | ファイル |
|---|---|---|
| `K.always-valid-model.6` | AVM-2 | always-valid-model |
| `K.always-valid-model.8` | AVM-4 | always-valid-model |
| `K.aggregate-and-invariants.9` | AGG-6 | aggregate-and-invariants |
| `K.use-case-conventions.10` | UC-7 | use-case-conventions |
| `K.cqrs-and-consistency.8` | CQ-5 | cqrs-and-consistency |
| `K.cqrs-and-consistency.9` | CQ-6 | cqrs-and-consistency |
| `K.rust-domain-conventions.7` | RDC-4 | rust-domain-conventions |
| `K.rust-domain-conventions.9` | RDC-6 | rust-domain-conventions |
| `K.rust-domain-conventions.10` | RDC-7 | rust-domain-conventions |
| `K.rust-domain-conventions.11` | RDC-8 | rust-domain-conventions |
| `K.rust-persistence-conventions.4` | RPC-1 | rust-persistence-conventions |
| `K.rust-persistence-conventions.9` | RPC-6 | rust-persistence-conventions |
| `K.interface-adapter-conventions.6` | IAC-3 | interface-adapter-conventions |
| `K.interface-adapter-conventions.7` | IAC-4 | interface-adapter-conventions |
| `K.interface-adapter-conventions.10` | IAC-7 | interface-adapter-conventions |
| `K.layer-boundaries.10` | LB-7 | layer-boundaries |

**(b) 修正前に義務として書かれていたが、実在する強制手段が無いため PREFER に弱めた 8 件。**
**これは主張の後退である。隠さない。**

| 修正後 ID | 修正前の書き方 | 弱めた理由 |
|---|---|---|
| `K.always-valid-model.2` | Principles の箇条書き「Operations define meaning; representation does not」（平叙の主張） | ADT 原則を読む検査は無い。設計上の立場であり機械強制できない |
| `K.always-valid-model.3` | Principles の箇条書き「Model the four kinds explicitly」（命令文） | 正規モデルは要素の種別を記録するが、種別を書かないモデルを拒否する検査は無い |
| `K.always-valid-model.4` | Principles の箇条書き「Name with the ubiquitous language」（命令文） | `<kind>.<segments>` の文法は機械検査されるが、セグメント内の語の選択は検査されない |
| `K.aggregate-and-invariants.10` | `AGG-7`、Enforcement `stage-contract:after-step:3` | **その anchor は実在しない**（§9-2）。導出の順序を強制する手段は無い。導出の**結果**は `model-completeness.i/.ii` が強制する |
| `K.use-case-conventions.1` | Principles の箇条書き「The use case orchestrates; it does not do domain work」（命令文） | 判断の配置は設計判断である。コード面の半分は `sensor:d`（規則 `.5`）が強制する |
| `K.cqrs-and-consistency.3` | Principles の箇条書き「The query side reads a model shaped for queries」（平叙の主張） | 読み取りモデルの形は設計判断である。分離の機械的な半分は `sensor:l`（規則 `.7`）が強制する |
| `K.interface-adapter-conventions.3` | Principles の箇条書き「Start in memory; add a backend only when the design needs it」（命令文） | 実装の着手順を読む検査は無い。`IAC-4` と同じ主張（`K.interface-adapter-conventions.7`）が既に guidance-only で並ぶ |
| `K.layer-boundaries.3` | Principles の箇条書き「The composition root is the only place allowed to depend on everything」（平叙の主張） | 結線が composition root に属するかは設計判断である。依存方向そのものは `sensor:g` が強制する |

**(c) 本パスで新設した 1 件** — `K.rust-domain-conventions.12`（module-visibility、§6）。
実在する検査が無いため、**作成時点から PREFER + guidance-only** である。既存の主張を
弱めたものではないが、FR10.2 のトピックに対する主張が「義務」ではなく「選好」である点を
明示する。

**(d) 修正前から選好として書かれていた 1 件** — `K.rust-persistence-conventions.1`
（旧 Principles「Prefer static binding」）。主張は変わらない。

### 13-2. U4 の逸脱 1 の継承（BR6.1 のロケータ形式）

BR6.1 が定める `tests/golden/<suite>/<sensor-id>/clean-*/` というディレクトリは
実装に存在しない。U8 は `tests/golden/<suite>/cases.ts#<case-name>` を索引する形を採った。
この形式差は **U4 の逸脱 1（既に承認済み）に由来する残差**であり、U8 が解消できるものではない
（`tests/golden/` の所有者は U4・U5）。

### 13-3. 索引の空虚な充足（§10-4 の再掲）

`sensor:c` / `sensor:b` / `sensor:n` / `layer.*` の索引は、いずれも
「その規則が主題とする構文を含まない clean ケース」を指しており、規則を実演していない。
とくに `clean-domain` は正規モデルを投影しないため、センサー (b) は
`classifyMutator` が `unknown` を返すことで**構成上**沈黙する。BR6.1 が
「U4 または U5 の clean fixture を 1 件選ぶ」と定めるため、U8 がケースを新設することはできない。

### 13-4. Step 15 の出典差し替えの精緻化（計画からのずれ）

計画 Step 15 は 2 本の実装ファイルの出典を「U2 の設計に差し替える」としていたが、
`ddd/tools/ddd/lib/rules/lists.ts` の正は **U5** である（U5 の `rules.md` と
`functional-spec.md` が分類順と replay / post-init の両名リストを定める）。したがって
該当 2 本は U2 と U5 の両方を出典とした。対象・完了条件は計画の Step 15 の範囲内である。

### 13-5. `bun run check` の扱い

`bun run check` は `test` 段を含むため、U3・U4 と同じ理由で**終了コード 0 にならない見込み**である
（`tests/codex-dispatch-bridge.test.ts` の 12 件が要求する `aidlc-workflows/dist/codex/aidlc` の
fixture が未生成。`ddd/tests/README.md` が既知の前提条件として記載し、`aidlc-workflows/` は
読み取り専用のサブモジュール）。本 Unit の FR10 群の検証欄はいずれも `bun run check` の緑を
挙げていないが、BR8.1／BR8.2 の `trigger` は `bun run check` である。**目標を下げて通すことは
しない。** `check` コマンドそのものの緑は U9 が所有し、U3 は `FR11.3` として既に GAP を
記録している。

### 13-6. FR10.1 のトピック数の数え方

計画は「FR10.1（基盤 19 トピック）」と記したが、要件本文の列挙を「Always Valid Domain Model
と Domain Primitive」を 1 項目として数えると **18 項目**である（19 は同項目の 2 語を別々に
数えた数）。**トピックの集合はどちらの数え方でも同じ**で、18 項目すべてが §5 の照合で
該当ファイルに現れることを確認した。件数の差はこの数え方の違いによる。

### 13-7. 計画の乖離 #8（設計どおり、逸脱ではない）

BR8.1／BR8.2 の検証は U9 が所有する。本 Unit の 8 本を対象にした検証
（compose 後の `inline_context_paths` の実在、Sources 節の存在、example-index の fixture の
実在）は `ddd/tests/` のどこにも実装されていない。`tests/u3-plugin-scaffold.test.ts` の
ナレッジ面の検査は面の存在と粒度に限られる。functional-spec.md §4 WF4・BR8.1・BR8.2・
entities.md の `PlacementCheck` はいずれも実行主体を U9 の統合テスト（`bun run check`）と
定めており、**これは設計どおりである**。`traceability.json` では FR10.3 を `Deferred` と
して記録した。Step 17b で BR8.1／BR8.2 も同じ理由で `Deferred` とした。

### 13-8. `ConflictEntry` の `core_location` / `precedence`（レビュー所見 R-01 — **解消済み・2026-09-12**）

前回レビューの Minor 所見 R-01。`entities.md` は `ConflictEntry` の属性として
`core_location` と `precedence` を定めているが、是正前の実装は 5 列の表
（`# | Core statement | Plugin rule | Scope | Rationale`）で、
`core_location` は `Core statement` セルに `— ddd-patterns.md → <節名>` の形で畳み込まれ、
`precedence` は表の直前の散文として 1 度だけ書かれていた。
**属性定義と文字どおり一致していなかった。**

**上流 2 文書は一致している。** 実測で確認した。

| 文書 | 記載 |
|---|---|
| `entities.md:72` | `{ name: core_location, type: string, required: true, … }` |
| `entities.md:76` | `{ name: precedence, type: enum, allowed: [plugin, core], required: true, … }` |
| `functional-spec.md:69`（WF2-2） | 「節名を core_location に書く」 |
| `functional-spec.md:71`（WF2-4） | 「precedence は plugin」 |
| `functional-spec.md:50`（§3-5） | 「`## Conflicts with core knowledge` — always-valid-model にのみ置く。ADR-010 の 4 件の表。」 |

**§3-5 は列構成を定めていない。** したがってこれは仕様間の不整合ではなく、
`entities.md` と `functional-spec.md` の双方が名前付きの項目として扱っているものを、
実装が 5 列表のセルと散文に畳み込んだ**実装側の逸脱**だった。
当初この項は accepted risk として残す方針で、その根拠に「列を増やすと機能仕様と食い違う」を
挙げていたが、**上流を実測した結果その根拠は成立しなかった**。上流への変更依頼も要らない。

### Step 17d — 7 列への是正

承認ゲートでレビュー前に是正する判断をした（レビュー確定後は `review-freeze` により
ゲートでの Request Changes が必要になり、全 Unit の回し直しを伴うため）。

`ddd/knowledge/aidlc-architect-agent/ddd-always-valid-model.md` の
`## Conflicts with core knowledge` の表を **5 列から 7 列**に改めた。

```
# | Core statement | Core location | Plugin rule | Scope | Precedence | Rationale
```

- `Core location` 列に `ddd-patterns.md` → `Repository Pattern` / `Design Heuristics` /
  `Entities` / `Domain Events` を移し、`Core statement` セルから
  `— ddd-patterns.md → <節名>` の接尾を外した。
- `Precedence` 列に 4 行とも `plugin` を書いた。表の直前にあった
  「The precedence is stated here rather than as a column …」の 2 文を削除した
  （列になったので説明が不要になった）。コアのファイルが編集できないため
  この一覧が唯一の調停である、という記述は残した。

**他ファイルへの影響なし**を実測で確認した。他の 3 本（`ddd-cqrs-and-consistency.md`、
`ddd-rust-persistence-conventions.md`、`ddd-interface-adapter-conventions.md`）は
`C-1` / `C-4` という**行 ID でのみ**参照しており、列構成に依存していない。

**是正後の実測**:

| 項目 | 結果 |
|---|---|
| ファイル行数 | 102 → **100 行**（散文 2 行削除、列追加は行を増やさない）。BR3.3 の 250 行以内を維持 |
| 節構成 | Purpose / Principles / Rules / Rationale / Conflicts / Examples (index) / Retired rules / Meta-discipline / Sources — **不変**（BR3.2 を維持） |
| `bun run check:biome` | exit 0 |
| `bun run validate` | exit 0 |
| `bun test tests/u3-plugin-scaffold.test.ts` | 6 pass / 0 fail / 55 expect |

**R-01 は解消した。** `core_location` と `precedence` は `entities.md` の
`ConflictEntry` の属性定義と 1 対 1 に対応する独立した列になった。

## 14. U9 への申し送り事項

U9 の統合テスト（`bun run check` の一部）が引き受ける検証項目と、本 Unit から渡す前提は
次のとおりである。

1. **配置と命名（BR8.2 / `PlacementCheck`）** — 8 本の実在、`knowledge/<agent-slug>/` の
   ディレクトリ名が消費エージェントの slug と完全一致すること（CON6。一致しない場合は
   **黙って無視される**）、`ddd-` 接頭辞、コアの `.claude/knowledge/` に同名ファイルが
   無いこと、Sources 節が存在すること。
2. **投影（BR8.1）** — `aidlc-plugin-test --install` の後に、対象 5 ステージ
   （`ddd-domain-modeling` / `domain-design` / `functional-design` / `infrastructure-design` /
   `code-generation`）の lead／support エージェントの `inline_context_paths` に、
   §2 の consumers 列が指すナレッジが現れること。本 Unit では `dist/<harness>/knowledge/`
   への投影までしか観測できていない。
3. **網羅の機械的な近似（WF4.3）** — functional-spec.md §2 の対応表の各トピックの見出し語が
   ファイル内に現れること。本 Unit の Step 5 では 18 + 11 = 29 項目を手作業で照合し、
   全件一致を確認した（§5・§7）。U9 ではこれを機械化できる。
4. **example-index の実在（BR8.2）** — 全 49 行の `fixture_path` が
   `tests/golden/<suite>/cases.ts` に実在し、`pass: true` のケースを指していること。
   本 Unit は索引先を「センサーが実行する clean ケース」に限定したが、
   **規則を実演しているかどうかまでは保証しない**（§10-4 の残差）。
5. **FR10.3 の検証欄** — `traceability.json` で `Deferred` とした。判定欄は
   compose 後の `inline_context_paths` であり、U9 の統合テストでしか測れない。
6. **`bun run check` の緑** — `test` 段の既知の 12 件（`codex-dispatch-bridge`）が解消されない
   限り緑にならない。U3 が `FR11.3` として記録済みの GAP と同じ原因である。
7. **`tests/golden/` の拡充（任意）** — §12-3 の空虚な充足を解消するには、
   「宣言された Command を持つ `&mut self` メソッド」「event-sourced な集約の
   `decide` / `apply` 対」「コマンド側とクエリ側のクレート対」「復元コード」「RMU クレート」
   を含む clean ケースを U4・U5 側に追加する必要がある。U8 は `tests/golden/` を所有しない。
8. **ナレッジの読み手** — U6 のリードは `ddd-domain-modeling` の開始時に architect の 4 本と
   shared を読む。U7 の fragment anchor は `after-step:1` / `:2` / `:4` / `:5` であり、
   `stage-contract` の索引はこの実在集合に限られる（§9-2）。

## 15. 付録 — 修正前後の全文

以下、8 本すべてについて修正前（`git show HEAD:<path>`）と修正後の全文を記録する。
**ファイル名・配置・節構成は変更していない。**

### 1. `ddd/knowledge/aidlc-architect-agent/ddd-always-valid-model.md`

#### 修正前（HEAD）

```markdown
# Always Valid Domain Model

## Purpose

The foundation of the DDD plugin: an Always Valid Domain Model built from
Domain Primitives and value objects. Read at the start of domain-modeling,
domain-design and functional-design.

## Principles

- A domain object can never exist in an invalid state.
- Operations define meaning; representation does not (the ADT principle).
- Model the four kinds explicitly: entity (global / local), value object,
  first-class collection, domain event.
- Name with the ubiquitous language; an aggregate ID is the aggregate name plus
  `Id`.

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| AVM-1 | validate every invariant at construction (full constructor) | domain type | sensor:c blocking | invalid states are unrepresentable | DL §6 |
| AVM-2 | wrap primitives with a meaningful domain primitive | primitives | guidance-only | closes primitive obsession | DL §3 |
| AVM-3 | reference another aggregate by ID only, never embed it | aggregate | sensor:b blocking | keeps aggregate boundaries | DL §3 |
| AVM-4 | a domain service is the last resort, not the default | domain service | guidance-only | behaviour belongs on the model | DL §6 |
| AVM-5 | stable element IDs follow the `<kind>.<segments>` grammar | model element | schema:id-grammar | IDs are permanent references | U1 BR1.1 |

## Rationale

Always Valid is not only about Domain Primitives: value objects, entities,
aggregates, their transitions and their operations all refuse to hold invalid
state. A separate `domain-modeling` stage exists because the standard workflow
would otherwise never produce these.

## Conflicts with core knowledge

| Conflict | Core location | Plugin rule | Scope | Precedence |
|---|---|---|---|---|
| C-1 Domain Primitive is not in the core vocabulary | ddd-patterns.md | AVM-2 | domain modelling | plugin |
| C-2 The core treats an aggregate as a data cluster, not an FSM | ddd-patterns.md | AGG-1 | domain modelling | plugin |
| C-3 The core allows getters for reading model state | ddd-patterns.md | RDC-2 | domain and use-case layers | plugin |
| C-4 The core leaves cross-context patterns open | ddd-patterns.md | AVM-3 | BC-internal references | plugin; core conformance patterns still apply between BCs |

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| AVM-1 | tests/golden/design/.../clean-complete | a complete canonical model | design fixture |

## Retired rules

None.

## Meta-discipline

- Precedence: plugin knowledge overrides core when they conflict; record the
  exception and the reason.
- Exceptions are always recorded with a reason; never silent.
- Index good examples by file, not by snippet.
- Retire rules with a strikethrough and a note; never delete.
- Anchor rules to measured code, not aspiration.
- Claim only as much as can be enforced.

## Sources

- ddd/docs/domain-layer-design.md §3–§6, §9
- aidlc/spaces/default/intents/.../decisions.md ADR-010
```

#### 修正後（本パス）

```markdown
# Always Valid Domain Model

## Purpose

The foundation of the DDD plugin: an Always Valid Domain Model built from
Domain Primitives and value objects. Read at the start of domain-modeling,
domain-design and functional-design.

## Principles

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.always-valid-model.1 | ALWAYS keep a domain object out of invalid states: every invariant is validated at construction. | domain type | sensor:c blocking | An object that cannot be invalid needs no defensive checks downstream. | DL §6 |
| K.always-valid-model.2 | PREFER modelling operations over representation: a value's meaning is what it can do, not how it is stored (the ADT principle). | domain type | guidance-only | The choice of representation is a design stance; no sensor reads it. | DL §3 |
| K.always-valid-model.3 | PREFER modelling the four kinds explicitly: entity (global / local), value object, first-class collection, domain event. | model element | guidance-only | The canonical model records the kind of every element, but nothing rejects a model that leaves a kind unnamed. | U1 BR1.1 |
| K.always-valid-model.4 | PREFER naming with the ubiquitous language, and deriving an aggregate ID as the aggregate name plus `Id`. | model element | guidance-only | The `<kind>.<segments>` grammar is machine-checked; the words chosen inside a segment are not. | U1 BR1.1 |

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.always-valid-model.5 | ALWAYS validate every invariant in the full constructor of the domain type. | domain type | sensor:c blocking | Invalid states are unrepresentable. | DL §6 |
| K.always-valid-model.6 | PREFER wrapping a primitive in a domain primitive with a meaningful name. | primitives | guidance-only | Closes primitive obsession; no sensor reads the choice of wrapper type. | DL §3 |
| K.always-valid-model.7 | NEVER embed another aggregate; reference it by ID only. | aggregate | sensor:b blocking | Keeps aggregate boundaries and transaction scopes aligned. | DL §3 |
| K.always-valid-model.8 | PREFER a domain service only as a last resort, when no aggregate owns the behaviour. | domain service | guidance-only | Behaviour belongs on the model; placement is a design judgement. | DL §6 |
| K.always-valid-model.9 | ALWAYS follow the `<kind>.<segments>` grammar for stable element IDs. | model element | schema:id-grammar | IDs are permanent references and must stay resolvable. | U1 BR1.1 |

## Rationale

Always Valid is not only about Domain Primitives: value objects, entities,
aggregates, their transitions and their operations all refuse to hold invalid
state. A separate `domain-modeling` stage exists because the standard workflow
would otherwise never produce these.

The core agrees with the rest of this file and is cited as support, not as a
conflict: aggregates are referenced by ID, transactions do not span aggregates,
a repository exists per aggregate root, queries use a separate read model, and
value objects are preferred over primitives. The four places where the core
disagrees are listed below.

## Conflicts with core knowledge

`.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` is read by the same
architect agent in the same stages as this file, so the disagreements are
written out rather than left to whoever reads both. **Precedence is `plugin` for
all four rows**: the plugin's rule wins. The precedence is stated here rather
than as a column because the core file cannot be edited, so the list below is
the only arbitration there is.

| # | Core statement | Plugin rule | Scope | Rationale |
|---|---|---|---|---|
| C-1 | The Repository Pattern interface shows `save(order: Order): void` and `findByCustomer(customerId: CustomerId): Order[]` — `ddd-patterns.md` → Repository Pattern | K.interface-adapter-conventions.6 | Port design in the interface-adapter layer (FR5.2, sensor (m)); conditional search lives on the query side as a DAO plus a DTO | Allowing conditional finders on a repository makes the query side depend on domain types, which breaks the mechanical check (l) and the CQRS separation. |
| C-2 | "Start with larger aggregates and split when you encounter contention or performance issues" — `ddd-patterns.md` → Design Heuristics | K.aggregate-and-invariants.10 | The aggregate derivation procedure in domain-modeling (FR1.6, FR2.4) | Starting from a large aggregate leaves the home of the invariants undecided, which makes the mechanical completeness condition (i) — every aggregate carries an invariant — a formality. The core heuristic stays useful when refactoring an existing model. |
| C-3 | Entity: "Mutable — their state changes over time" — `ddd-patterns.md` → Entities | K.rust-domain-conventions.2, K.rust-domain-conventions.7 | Domain-layer code conventions (FR7.1–FR7.3) | Making mutability the default removes the grounds for banning setters and forcing a complete constructor, and Always Valid does not hold without them. |
| C-4 | Domain Events: "Build audit trails and event sourcing" — `ddd-patterns.md` → Domain Events | K.cqrs-and-consistency.5, K.rust-persistence-conventions.5 | The command return-value contract and the restoration path (sensors (c) and (n)); the core's integration patterns (notification, state transfer) still apply between Bounded Contexts | Without a per-aggregate persistence declaration the sensors cannot tell the restoration path from the construction path. |

Source of the plugin-side wording: `inception/domain-design/decisions.md` ADR-010.

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| K.always-valid-model.1 | tests/golden/rust/cases.ts#clean-domain | a domain type whose fields are private and which is never constructed outside its own `impl` | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.always-valid-model.5 | tests/golden/rust/cases.ts#clean-domain | the same case: sensor (c) reports no construction outside the full constructor | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.always-valid-model.7 | tests/golden/rust/cases.ts#clean-domain | the same case: sensor (b) reports no undeclared mutation, and the type holds no aggregate-valued field | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |

The three rows above name the clean case of the sensor suite that runs each
rule, not a case that exercises the rule's subject matter. Where the clean case
does not contain the construct a rule is about, the index records "the sensor
reported nothing", and the gap is listed in this unit's `code-summary.md`.

## Retired rules

None.

## Meta-discipline

- Precedence: plugin knowledge overrides core when they conflict; record the
  exception and the reason.
- Exceptions are always recorded with a reason; never silent. In this file an
  exception is written into the Rationale cell as `<exception> — <reason>`,
  because the Rules and Principles tables fix six columns and carry no separate
  column for exceptions.
- Index good examples by file, not by snippet.
- Retire rules with a strikethrough and a note; never delete.
- Anchor rules to measured code, not aspiration.
- Claim only as much as can be enforced.

## Sources

- `ddd/docs/domain-layer-design.md` §3–§6, §9
- `construction/u1-sensor-foundation/functional-design/` — the `<kind>.<segments>`
  ID grammar, the element kinds and the canonical model schema
  (`functional-spec.md`, `entities.md`, `rules.md`). Record-relative path under
  `aidlc/spaces/default/intents/<intent>/`.
- `inception/domain-design/decisions.md` ADR-010 — the four conflicts
- Core knowledge cited as non-conflicting: `.claude/knowledge/aidlc-architect-agent/ddd-patterns.md`
  → Aggregates ("Reference other aggregates by ID, not by object reference",
  "Transactions should not span multiple aggregates", "Keep aggregates small"),
  → Repository Pattern ("One repository per aggregate root (not per entity or
  table)", "Do not put query logic in repositories — use separate read models"),
  → Value Objects ("Prefer value objects over primitives")
```

### 2. `ddd/knowledge/aidlc-architect-agent/ddd-aggregate-and-invariants.md`

#### 修正前（HEAD）

```markdown
# Aggregates, invariants and commands

## Purpose

How to derive aggregates from events and how to specify their invariants,
commands, events, errors and transitions. Read during domain-modeling and
domain-design.

## Principles

- An aggregate is a finite state machine: its commands move it between named
  states and never leave it invalid.
- An invariant is a promise the aggregate always keeps; a candidate that cannot
  own one is not an aggregate.
- Every command declares its state effect and its failure conditions.

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| AGG-1 | an aggregate is an FSM with named states and transitions | aggregate | sensor:model-completeness.ii blocking | state is explicit | DL §9 |
| AGG-2 | every aggregate has at least one invariant | aggregate | sensor:model-completeness.i blocking | the boundary is the invariant | FR1.8 (i) |
| AGG-3 | every command declares `effect` and `state_effect` | command | schema:Command.effect | transitions are typed | Q3 |
| AGG-4 | every command has at least one Domain Error | command | schema:command-no-error | failures are part of the contract | FR2.2 |
| AGG-5 | reference other aggregates by ID only | aggregate | sensor:b blocking | no cross-aggregate object graph | DL §3 |
| AGG-6 | a domain service is justified only when no aggregate owns the behaviour | domain service | guidance-only | prefer the model | DL §6 |
| AGG-7 | derive aggregates bottom-up from past-tense events | model | stage-contract:after-step:3 | event storming | DL §2 |
| AGG-8 | record ID lineage for rename / split / merge / removal | model | schema:lineage | IDs are permanent | FR2.4 |

## Rationale

The workflow discovers events, groups the events that change the same state into
candidates, and confirms each candidate's invariant and bounded context. The ID
lineage keeps downstream references stable across model evolution.

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| AGG-2 | tests/golden/design/.../clean-complete | an aggregate with an invariant | design fixture |
| AGG-4 | tests/golden/design/.../clean-complete | a command with a Domain Error | design fixture |

## Retired rules

None.

## Sources

- ddd/docs/domain-layer-design.md §2–§5
```

#### 修正後（本パス）

```markdown
# Aggregates, invariants and commands

## Purpose

How to derive aggregates from events and how to specify their invariants,
commands, events, errors and transitions. Read during domain-modeling and
domain-design.

## Principles

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.aggregate-and-invariants.1 | ALWAYS model an aggregate as a finite state machine whose commands move it between named states and never leave it invalid. | aggregate | sensor:model-completeness.ii blocking | Explicit states are what make the transition table checkable. | DL §9 |
| K.aggregate-and-invariants.2 | ALWAYS give every aggregate at least one invariant; a candidate that cannot own one is not an aggregate. | aggregate | sensor:model-completeness.i blocking | The invariant is what makes the boundary a boundary. | FR1.8 (i) |
| K.aggregate-and-invariants.3 | ALWAYS have every command declare its state effect and its failure conditions. | command | schema:Command.effect | Transitions become typed data rather than prose. | Q3 |

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.aggregate-and-invariants.4 | ALWAYS give an aggregate named states and named transitions. | aggregate | sensor:model-completeness.ii blocking | State is explicit, not implied by a field. | DL §9 |
| K.aggregate-and-invariants.5 | ALWAYS give every aggregate at least one invariant. | aggregate | sensor:model-completeness.i blocking | The boundary is the invariant. | FR1.8 (i) |
| K.aggregate-and-invariants.6 | ALWAYS declare `effect` and `state_effect` on every command. | command | schema:Command.effect | Transitions are typed. | Q3 |
| K.aggregate-and-invariants.7 | ALWAYS give every command at least one Domain Error. | command | schema:command-no-error | Failures are part of the contract. | FR2.2 |
| K.aggregate-and-invariants.8 | NEVER reference another aggregate by object; reference it by ID only. | aggregate | sensor:b blocking | No cross-aggregate object graph. | DL §3 |
| K.aggregate-and-invariants.9 | PREFER a domain service only when no aggregate owns the behaviour. | domain service | guidance-only | Prefer the model; the placement is a design judgement. | DL §6 |
| K.aggregate-and-invariants.10 | PREFER deriving aggregates bottom-up from past-tense domain events and their invariants. | model | guidance-only | Derivation is a workshop procedure and has no mechanical check. The *result* of the derivation is enforced — sensor `model-completeness.i` requires every aggregate to carry an invariant and `.ii` requires named states — but the *order* in which the candidate is found is not. This is the rule that overrides the core's "start with larger aggregates" heuristic (see C-2 in `ddd-always-valid-model.md`). | DL §2 |
| K.aggregate-and-invariants.11 | ALWAYS record ID lineage for rename, split, merge and removal. | model | schema:lineage | IDs are permanent references across model evolution. | FR2.4 |

## Rationale

The workflow discovers events, groups the events that change the same state into
candidates, and confirms each candidate's invariant and bounded context. The ID
lineage keeps downstream references stable across model evolution.

The core agrees with the invariant-carrying aggregate and with ID-only
references between aggregates, and is cited here as support: "Reference other
aggregates by ID, not by object reference", "Keep aggregates small", and
"Transactions should not span multiple aggregates"
(`.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` → Aggregates). The one
place where the core disagrees — the "start with larger aggregates" heuristic —
is recorded as C-2 in `ddd-always-valid-model.md`, which owns the conflict list.

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| K.aggregate-and-invariants.1 | tests/golden/design/cases.ts#clean-complete | a canonical model whose aggregate declares states and transitions | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.aggregate-and-invariants.2 | tests/golden/design/cases.ts#clean-complete | the same case: sensor `model-completeness.i` reports no aggregate without an invariant | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.aggregate-and-invariants.4 | tests/golden/design/cases.ts#clean-complete | a canonical model whose aggregate carries named states and named transitions | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.aggregate-and-invariants.5 | tests/golden/design/cases.ts#clean-complete | the same case: sensor `model-completeness.i` reports no aggregate without an invariant | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.aggregate-and-invariants.8 | tests/golden/rust/cases.ts#clean-domain | a domain type that holds no aggregate-valued field and no undeclared mutation | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |

Sensor `model-completeness.i` reads the canonical model, so the index points at
the design suite; sensor (b) reads Rust source, so the index for
`K.aggregate-and-invariants.8` points at the rust suite. The rows name the clean
case of the suite that runs each sensor, not a case built to exercise the rule's
subject matter; the limitations are listed in this unit's `code-summary.md`.

## Retired rules

None.

## Sources

- `ddd/docs/domain-layer-design.md` §2–§5
- `construction/u1-sensor-foundation/functional-design/` — the canonical model
  schema and the mechanical completeness conditions (i) and (ii), the ID
  lineage record, and the `<kind>.<segments>` grammar (`functional-spec.md`,
  `entities.md`, `rules.md`). Record-relative path under
  `aidlc/spaces/default/intents/<intent>/`.
- `.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` → Aggregates,
  Design Heuristics (the core statements cited as support, and the heuristic
  recorded as conflict C-2 in `ddd-always-valid-model.md`)
```

### 3. `ddd/knowledge/aidlc-architect-agent/ddd-use-case-conventions.md`

#### 修正前（HEAD）

```markdown
# Use-case conventions

## Purpose

The five-point convention set and the orchestrator principle for use cases.
Read during functional-design.

## Principles

- The use case orchestrates; it does not do domain work.
- A use case is idempotent and re-execution-safe by construction.
- Declare the transactional consistency boundary explicitly.

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| UC-1 | the five-point set is explicit: consistency, idempotency, ordering, failure/compensation, observability | use case | stage-contract:after-step:2 | completeness | UC §2 |
| UC-2 | the use case orchestrates and delegates business judgement to the domain | use case | sensor:d blocking | Tell, Don't Ask | DL §6 |
| UC-3 | state the transactional consistency boundary | use case | stage-contract:after-step:2 | avoid implicit transactions | UC §3 |
| UC-4 | make the flow re-execution-safe and declare each step's idempotency | use case | sensor:mapping-declarations.j blocking | retries are the norm | UC §5 |
| UC-5 | model a cross-aggregate flow as a Process Manager, especially under actor models | process manager | sensor:mapping-declarations.process-manager-required blocking | long-running coordination | UC §6 |
| UC-6 | declare the six mandatory items per use case | use case | sensor:mapping-declarations.use-case-item blocking | reviewable contract | FR4.1 |
| UC-7 | CQS applies to state-changing operations, not to immutable re-derivation | use case | guidance-only | query vs command | DL §6 |

## Rationale

A use case is the consistency boundary. Naming the idempotency strategy of each
step makes retries safe; a Process Manager carries multi-aggregate flows without
collapsing aggregate boundaries.

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| UC-6 | tests/golden/design/.../clean-mapping | a complete use-case declaration | design fixture |

## Retired rules

None.

## Sources

- ddd/docs/use-case-layer-design.md §2–§8
```

#### 修正後（本パス）

```markdown
# Use-case conventions

## Purpose

The five-point convention set and the orchestrator principle for use cases.
Read during functional-design.

## Principles

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.use-case-conventions.1 | PREFER letting the use case orchestrate and hand every business judgement to the domain. | use case | guidance-only | The placement of a decision is a design judgement; the code-level half of it is enforced by sensor (d), which is rule `.5` below. | DL §6 |
| K.use-case-conventions.2 | ALWAYS make a use case re-execution-safe by construction: every step declares its idempotency. | use case | sensor:mapping-declarations.j blocking | Retries are the norm, so safety cannot depend on the caller's discipline. | UC §5 |
| K.use-case-conventions.3 | ALWAYS declare the transactional consistency boundary of the use case. | use case | stage-contract:after-step:2 | An implicit boundary is a boundary nobody agreed to. | UC §3 |

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.use-case-conventions.4 | ALWAYS write the five-point set explicitly: consistency, idempotency, ordering, failure/compensation, observability. | use case | stage-contract:after-step:2 | Completeness of the declaration. | UC §2 |
| K.use-case-conventions.5 | NEVER let the use case make a business judgement; it orchestrates and delegates to the domain. | use case | sensor:d blocking | Tell, Don't Ask. | DL §6 |
| K.use-case-conventions.6 | ALWAYS state the transactional consistency boundary. | use case | stage-contract:after-step:2 | Avoids implicit transactions. | UC §3 |
| K.use-case-conventions.7 | ALWAYS make the flow re-execution-safe and declare each step's idempotency. | use case | sensor:mapping-declarations.j blocking | Retries are the norm. | UC §5 |
| K.use-case-conventions.8 | ALWAYS model a cross-aggregate flow as a Process Manager, especially under actor models. | process manager | sensor:mapping-declarations.process-manager-required blocking | Long-running coordination must not collapse aggregate boundaries. | UC §6 |
| K.use-case-conventions.9 | ALWAYS declare the six mandatory items per use case. | use case | sensor:mapping-declarations.use-case-item blocking | A reviewable contract. | FR4.1 |
| K.use-case-conventions.10 | PREFER applying CQS to state-changing operations only, not to immutable re-derivation. | use case | guidance-only | Query versus command is a judgement at the edge; no sensor reads it. | DL §6 |

## Rationale

A use case is the consistency boundary. Naming the idempotency strategy of each
step makes retries safe; a Process Manager carries multi-aggregate flows without
collapsing aggregate boundaries.

The core agrees on this layer's shape and is cited as support: a repository
exists per aggregate root and query logic belongs in a separate read model
(`.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` → Repository
Pattern), which is what keeps the use case orchestrating rather than querying.

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| K.use-case-conventions.2 | tests/golden/design/cases.ts#clean-mapping | a use-case declaration whose steps each carry an idempotency strategy | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.use-case-conventions.5 | tests/golden/rust/cases.ts#clean-domain | a domain type whose getters are not called from outside the domain | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.use-case-conventions.7 | tests/golden/design/cases.ts#clean-mapping | a mapping document whose use-case declaration sensor `mapping-declarations.j` accepts | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.use-case-conventions.8 | tests/golden/design/cases.ts#clean-mapping | the same case: no cross-aggregate flow is left without a Process Manager | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.use-case-conventions.9 | tests/golden/design/cases.ts#clean-mapping | the same case: a use-case declaration that carries all six mandatory items | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |

The rows name the clean case of the sensor suite that runs each rule, not a case
built to exercise the rule's subject matter; the limitations are listed in this
unit's `code-summary.md`.

## Retired rules

None.

## Sources

- `ddd/docs/use-case-layer-design.md` §2–§8
- `construction/u1-sensor-foundation/functional-design/` — the
  `<kind>.<segments>` ID grammar and the completeness check that the
  declaration sensors build on (`functional-spec.md`, `entities.md`,
  `rules.md`). Record-relative path under
  `aidlc/spaces/default/intents/<intent>/`.
- `.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` → Repository
  Pattern (the core statements cited as support)
```

### 4. `ddd/knowledge/aidlc-architect-agent/ddd-cqrs-and-consistency.md`

#### 修正前（HEAD）

```markdown
# CQRS and consistency

## Purpose

The CQRS layer structure, the two declaration axes, and why the command side
never reads the read model. Read during domain-design, functional-design and
infrastructure-design.

## Principles

- Separate the command side from the query side; do not let one depend on the
  other.
- Declare every aggregate on two axes: programming model × persistence method.
- The command side writes; the query side reads a model shaped for queries.

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| CQ-1 | declare `programming_model` (actor / class) per aggregate | aggregate mapping | sensor:mapping-declarations.axes blocking | drives the concurrency model | FR3.3 |
| CQ-2 | declare `persistence_method` (state-sourcing / event-sourcing) per aggregate | aggregate mapping | sensor:mapping-declarations.axes blocking | drives the code shape | FR3.3 |
| CQ-3 | the command side never reads the read model | crate graph | sensor:k blocking | keeps write logic pure | IA §3 |
| CQ-4 | the query side never references a domain type or repository port | query crate | sensor:l blocking | query models are separate | IA §4 |
| CQ-5 | an RMU bridges the command side to the query side | crate graph | guidance-only | read-model upkeep | IA §4 |
| CQ-6 | choose strong or weak consistency explicitly | use case | guidance-only | consistency is a decision | UC §6 |

## Rationale

CQRS makes the write model and the read model independently shaped. The two axes
capture the two independent choices that change everything downstream: whether
the aggregate is an actor or a class, and whether it is stored as state or as
events.

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| CQ-1 | tests/golden/design/.../clean-mapping | both axes declared | design fixture |
| CQ-3 | tests/golden/rust/.../violation-k | a cross-side reference | rust fixture |

## Retired rules

None.

## Sources

- ddd/docs/interface-adapter-layer-design.md §2–§4
- ddd/docs/use-case-layer-design.md §6
- ddd/docs/domain-layer-design.md §7-2
```

#### 修正後（本パス）

```markdown
# CQRS and consistency

## Purpose

The CQRS layer structure, the two declaration axes, and why the command side
never reads the read model. Read during domain-design, functional-design and
infrastructure-design.

## Principles

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.cqrs-and-consistency.1 | NEVER let the command side and the query side depend on each other. | crate graph | sensor:k blocking | A dependency in either direction destroys the independence of the two models. | IA §3 |
| K.cqrs-and-consistency.2 | ALWAYS declare every mapped aggregate on both axes: programming model × persistence method. | aggregate mapping | sensor:mapping-declarations.axes blocking | The two axes are what make the downstream code shape predictable. | FR3.3 |
| K.cqrs-and-consistency.3 | PREFER shaping the query side's model for queries rather than reusing the domain model. | query side | guidance-only | The read-model shape is a design judgement; the mechanical half of the separation is enforced by rule `.7` below. | IA §4 |

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.cqrs-and-consistency.4 | ALWAYS declare `programming_model` (actor / class) per aggregate. | aggregate mapping | sensor:mapping-declarations.axes blocking | Drives the concurrency model. | FR3.3 |
| K.cqrs-and-consistency.5 | ALWAYS declare `persistence_method` (state-sourcing / event-sourcing) per aggregate. | aggregate mapping | sensor:mapping-declarations.axes blocking | Drives the code shape, including the command return value and the restoration path. | FR3.3 |
| K.cqrs-and-consistency.6 | NEVER let the command side read the read model. | crate graph | sensor:k blocking | Keeps write logic pure. | IA §3 |
| K.cqrs-and-consistency.7 | NEVER let the query side reference a domain type or a repository port. | query crate | sensor:l blocking | Query models are separate. | IA §4 |
| K.cqrs-and-consistency.8 | PREFER an RMU to bridge the command side to the query side. | crate graph | guidance-only | Read-model upkeep is a design choice; an RMU is the shape that keeps both sides independent. | IA §4 |
| K.cqrs-and-consistency.9 | PREFER choosing strong or weak consistency explicitly. | use case | guidance-only | Consistency is a decision, not a default, but no sensor reads the choice. | UC §6 |

## Rationale

CQRS makes the write model and the read model independently shaped. The two axes
capture the two independent choices that change everything downstream: whether
the aggregate is an actor or a class, and whether it is stored as state or as
events.

The core agrees and is cited as support: "Do not put query logic in repositories
— use separate read models for complex queries" and "One repository per
aggregate root (not per entity or table)"
(`.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` → Repository
Pattern). The one place where the core disagrees — the free choice of a
persistence style and a free command/event correspondence — is recorded as C-4
in `ddd-always-valid-model.md`, which owns the conflict list.

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| K.cqrs-and-consistency.1 | tests/golden/design/cases.ts#clean | a declared layer structure with `cqrs: true` and no dependency between the two sides | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.cqrs-and-consistency.2 | tests/golden/design/cases.ts#clean-mapping | an aggregate mapping that declares both axes for every aggregate | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.cqrs-and-consistency.4 | tests/golden/design/cases.ts#clean-mapping | an aggregate mapping that declares both axes for every aggregate | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.cqrs-and-consistency.5 | tests/golden/design/cases.ts#clean-mapping | the same case: `persistence_method` is declared per aggregate | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.cqrs-and-consistency.6 | tests/golden/design/cases.ts#clean | a declared layer structure with a command-side crate and a query-side crate, and no dependency between them | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.cqrs-and-consistency.7 | tests/golden/design/cases.ts#clean | the same case: the query-side crate's declared dependencies are empty, so no domain-layer crate or repository port appears | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |

Rules `.6` and `.7` are checked twice: sensor (k) and sensor (l) run against the
declared crate graph in `ddd-layer-structure` and against Rust source in
`ddd-rust-interface-adapter`. The rows above index the design suite, whose clean
case does declare a command side and a query side; the rust suite's clean case
contains no such crate pair, and that limitation is listed in this unit's
`code-summary.md`.

## Retired rules

None.

## Sources

- `ddd/docs/interface-adapter-layer-design.md` §2–§4
- `ddd/docs/use-case-layer-design.md` §6
- `ddd/docs/domain-layer-design.md` §7-2
- `construction/u2-rust-analysis-foundation/functional-design/` — layer
  assignment from the crate graph and the allowed-dependency table that sensors
  (k) and (l) consult (`functional-spec.md`, `rules.md`). Record-relative path
  under `aidlc/spaces/default/intents/<intent>/`.
- `.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` → Repository
  Pattern (the core statements cited as support)
```

### 5. `ddd/knowledge/aidlc-developer-agent/ddd-rust-domain-conventions.md`

#### 修正前（HEAD）

```markdown
# Rust domain conventions

## Purpose

The Rust-specific rules for the domain layer: field visibility,
Tell-Don't-Ask, factory naming, interior mutability, module visibility, domain
equality, error handling, first-class collections, and the `&mut self` business
operation. Read during code-generation and as support during functional-design.

## Principles

- Domain state is private; behaviour is explicit.
- Construct only through a full constructor; never add a setter.
- A `&mut self` method is a business operation and must be a declared Command,
  except for the replay path.

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| RDC-1 | no non-private field on a domain type | domain type | sensor:a blocking | state is encapsulated | DL §6 |
| RDC-2 | do not call a getter from the domain or use-case layer | call site | sensor:d blocking | Tell, Don't Ask | DL §7-1 |
| RDC-3 | name factories by intent; build only through a full constructor | domain type | sensor:c / sensor:n blocking | one construction path | DL §6 |
| RDC-4 | no interior mutability to fake a setter | domain type | guidance-only | `&self` must not mutate | DL §6 |
| RDC-5 | a `&mut self` method is a declared Command, else use the replay names | domain type | sensor:b blocking | mutations are commands | FR7.2 |
| RDC-6 | implement equality by meaning, not by identity | domain type | guidance-only | value semantics | DL §9 |
| RDC-7 | model errors explicitly (a hand-written error enum) | domain type | guidance-only | no panics in the domain | DL §6 |
| RDC-8 | use a first-class collection instead of a raw `Vec` | domain type | guidance-only | collection invariants | DL §9 |

## Rationale

The Rust rules come from the domain layer design's code conventions and from the
language-specific handling of `&mut self`. Complete-constructor and
replay-naming are what let the sensors distinguish a real mutation from a replay
or an incomplete initialisation.

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| RDC-1 | tests/golden/rust/.../clean-domain | private fields only | rust fixture |
| RDC-5 | tests/golden/rust/.../clean-domain | `issue(&mut self)` declared as a Command | rust fixture |

## Retired rules

None.

## Sources

- ddd/docs/domain-layer-design.md §6, §9
- ddd/tools/ddd/lib/rules/lists.ts
```

#### 修正後（本パス）

```markdown
# Rust domain conventions

## Purpose

The Rust-specific rules for the domain layer: field visibility,
Tell-Don't-Ask, factory naming, interior mutability, module visibility, domain
equality, error handling, first-class collections, and the `&mut self` business
operation. Read during code-generation and as support during functional-design.

## Principles

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.rust-domain-conventions.1 | NEVER expose domain state through a non-private field; behaviour is the only public surface. | domain type | sensor:a blocking | Encapsulation is what makes an invariant enforceable at all. | DL §6 |
| K.rust-domain-conventions.2 | NEVER construct a domain value outside its full constructor, and never add a setter. | domain type | sensor:c blocking | One construction path is what makes "always valid" checkable. | DL §6 |
| K.rust-domain-conventions.3 | ALWAYS make a `&mut self` method a declared Command, or use one of the replay names. | domain type | sensor:b blocking | Every state change is then either a declared operation or a replayed event. | FR7.2 |

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.rust-domain-conventions.4 | NEVER put a non-private field on a domain type. | domain type | sensor:a blocking | State is encapsulated. | DL §6 |
| K.rust-domain-conventions.5 | NEVER call a getter from the domain or use-case layer. | call site | sensor:d blocking | Tell, Don't Ask. | DL §7-1 |
| K.rust-domain-conventions.6 | ALWAYS name factories by intent and build only through a full constructor. | domain type | sensor:c / sensor:n blocking | One construction path. | DL §6 |
| K.rust-domain-conventions.7 | PREFER not using interior mutability to fake a setter. | domain type | guidance-only | `&self` must not mutate; the judgement is whether a given cell is a cache or a setter, and no sensor reads that intent, so the rule states a preference rather than an obligation. | DL §6 |
| K.rust-domain-conventions.8 | ALWAYS make a `&mut self` method a declared Command, or use one of the replay names. | domain type | sensor:b blocking | Mutations are commands. | FR7.2 |
| K.rust-domain-conventions.9 | PREFER implementing equality by meaning rather than by identity. | domain type | guidance-only | Value semantics is a modelling decision; the sensor cannot tell the two implementations apart. | DL §9 |
| K.rust-domain-conventions.10 | PREFER modelling errors explicitly, with a hand-written error enum. | domain type | guidance-only | No panics in the domain; the choice of error representation is not read by any sensor. | DL §6 |
| K.rust-domain-conventions.11 | PREFER a first-class collection over a raw `Vec` field. | domain type | guidance-only | Collection invariants need a home; whether a given `Vec` needs one is a judgement. | DL §9 |
| K.rust-domain-conventions.12 | PREFER keeping a module's items internal to that module, exporting only what the layer above must call. | module | guidance-only | Module visibility is part of the design, but sensor (a) reads *field* visibility only (`lib/rules/rust/symbols.ts` compares `field.visibility`), and no check reads a module's own visibility. The rule therefore states a preference rather than an obligation, so that the knowledge claims exactly what can be enforced. | DL §9 |

## Rationale

The Rust rules come from the domain layer design's code conventions and from the
language-specific handling of `&mut self`. Complete-constructor and
replay-naming are what let the sensors distinguish a real mutation from a replay
or an incomplete initialisation: a `&mut self` method is classified
replay-exempt → post-init → unknown → declared-command / undeclared, and only
`undeclared` is a finding.

The core agrees with the immutability-first stance in spirit and is cited as
support: value objects are preferred over primitives
(`.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` → Value Objects). The
place where the core disagrees — "Mutable — their state changes over time" — is
recorded as C-3 in `ddd-always-valid-model.md`, which owns the conflict list.

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| K.rust-domain-conventions.3 | tests/golden/rust/cases.ts#clean-domain | a domain type whose `&mut self` methods are none of the replay-exempt names and produce no finding | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.rust-domain-conventions.1 | tests/golden/rust/cases.ts#clean-domain | a domain type whose fields carry no visibility modifier | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.rust-domain-conventions.2 | tests/golden/rust/cases.ts#clean-domain | the same case: no struct literal, no `Default`, and no post-init method outside the type's own `impl` | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.rust-domain-conventions.4 | tests/golden/rust/cases.ts#clean-domain | the same case: sensor (a) reports no non-private field | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.rust-domain-conventions.5 | tests/golden/rust/cases.ts#clean-domain | the same case: the type's getter is not called from outside the domain | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.rust-domain-conventions.6 | tests/golden/rust/cases.ts#clean-domain | the same case: sensor (c) reports no incomplete construction | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.rust-domain-conventions.8 | tests/golden/rust/cases.ts#clean-domain | the same case: sensor (b) reports no undeclared mutation | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |

Each row names the clean case of the suite that runs the rule's first-listed
sensor, not a case built to exercise the rule's subject matter. Two caveats
belong with this table:

- Sensor (n), which rules `.2` and `.6` also list, runs in the
  interface-adapter suite; its clean case is
  `tests/golden/rust/cases.ts#clean-repository`.
- `clean-domain` projects no canonical model, so a `&mut self` method is
  classified `unknown` and sensor (b) stays silent by construction rather than
  by finding a declared Command. No rust clean case exercises a declared
  Command.

Both caveats are listed in this unit's `code-summary.md`.

## Retired rules

None.

## Sources

- `ddd/docs/domain-layer-design.md` §6, §9
- `construction/u2-rust-analysis-foundation/functional-design/` — the crate
  naming and placement conventions, the layer assigned from the crate graph, and
  the symbol queries the rules read (`functional-spec.md`, `entities.md`,
  `rules.md`). Record-relative path under
  `aidlc/spaces/default/intents/<intent>/`.
- `construction/u5-rust-code-sensors/functional-design/` — the rule semantics for
  (a)–(d), the mutator classification order, and the fixed name lists
  (replay-exempt names `apply` / `apply_event` / `replay` / `on_event`,
  post-init names `init` / `setup` / `initialize` / `reset` / `configure`) that
  `ddd-rust-domain` reads (`functional-spec.md`, `rules.md`)
- `.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` → Value Objects,
  Entities (the core statements cited as support, and the one recorded as
  conflict C-3 in `ddd-always-valid-model.md`)
```

### 6. `ddd/knowledge/aidlc-developer-agent/ddd-rust-persistence-conventions.md`

#### 修正前（HEAD）

```markdown
# Rust persistence conventions

## Purpose

The Rust-specific persistence rules: static binding by default, an
event-store-adapter-style event-sourcing implementation, decide/apply
separation, the replay path, port trait placement and implementation naming,
and `store` as upsert. Read during code-generation.

## Principles

- Prefer static binding; reach for dynamic dispatch only when the design needs a
  seam.
- Separate `decide` (business decision) from `apply` (state change).
- A repository `store` is an upsert.

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| RPC-1 | static binding is the default | adapter | guidance-only | performance and clarity | UC §5 |
| RPC-2 | an event-sourced aggregate separates decide from apply | aggregate | sensor:c (replay exempt) | replayable history | DL §6 |
| RPC-3 | the replay path is `apply` / `apply_event` / `replay` / `on_event` | method | sensor:b (exempt) | replay is not a command | Q5 |
| RPC-4 | place a port trait next to its domain and name the implementation by the medium | adapter | sensor:m blocking | the trait names the contract | IA §5 |
| RPC-5 | a repository `store` is an upsert | repository | sensor:design-advisories.store-upsert advisory | idempotent writes | UC §5 |
| RPC-6 | commands return events under event sourcing, `Result<(), E>` otherwise | command | guidance-only | persistence-linked return | DL §6 |
| RPC-7 | restore only through a full constructor | adapter | sensor:n blocking | no bypass of invariants | DL §6 |

## Rationale

The reference implementation is `event-store-adapter-rs`. The rules (g)–(i) and
(k)–(n) map the same ideas onto code the sensors can inspect: forbidden
dependencies, aggregate arguments, cross-side references, repository naming and
restoration bypass.

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| RPC-3 | tests/golden/rust/.../clean-domain | a replay method not flagged by (b) | rust fixture |
| RPC-7 | tests/golden/rust/.../violation-n | a struct-literal restoration | rust fixture |

## Retired rules

None.

## Sources

- ddd/docs/domain-layer-design.md §6–§7
- ddd/docs/use-case-layer-design.md §5
- ddd/docs/interface-adapter-layer-design.md §5, §9
```

#### 修正後（本パス）

```markdown
# Rust persistence conventions

## Purpose

The Rust-specific persistence rules: static binding by default, an
event-store-adapter-style event-sourcing implementation, decide/apply
separation, the replay path, port trait placement and implementation naming,
and `store` as upsert. Read during code-generation.

## Principles

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.rust-persistence-conventions.1 | PREFER static binding, and reach for dynamic dispatch only where the design needs a seam. | adapter | guidance-only | Performance and clarity; whether a seam is needed is a design judgement. | UC §5 |
| K.rust-persistence-conventions.2 | ALWAYS separate `decide` (the business decision) from `apply` (the state change) in an event-sourced aggregate. | aggregate | sensor:c blocking | The history is replayable only if the state change has no side conditions. | DL §6 |
| K.rust-persistence-conventions.3 | ALWAYS treat a repository `store` as an upsert. | repository | sensor:design-advisories.store-upsert advisory | Idempotent writes; the check is advisory, so it reports without closing the gate. | UC §5 |

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.rust-persistence-conventions.4 | PREFER static binding as the default. | adapter | guidance-only | Performance and clarity. | UC §5 |
| K.rust-persistence-conventions.5 | ALWAYS separate `decide` from `apply` in an event-sourced aggregate. | aggregate | sensor:c blocking | Replayable history. The exemption is not a hole in the sensor: sensor (c) ignores the replay path because a method that only applies an already-decided event is not a second construction path. | DL §6 |
| K.rust-persistence-conventions.6 | ALWAYS name the replay path `apply`, `apply_event`, `replay` or `on_event`. | method | sensor:b blocking | Replay is not a command. Sensor (b) treats these four names as replay-exempt and reports no undeclared mutation for them, so the exemption is the reason the name list is fixed rather than free. | Q5 |
| K.rust-persistence-conventions.7 | ALWAYS place a port trait next to its domain and name the implementation by the medium. | adapter | sensor:m blocking | The trait names the contract and the implementation names the technology. | IA §5 |
| K.rust-persistence-conventions.8 | ALWAYS declare a repository `store` as an upsert. | repository | sensor:design-advisories.store-upsert advisory | Idempotent writes. | UC §5 |
| K.rust-persistence-conventions.9 | PREFER commands that return events under event sourcing and `Result<(), E>` otherwise. | command | guidance-only | The return value is bound to the persistence style, which is declared per aggregate; no sensor reads the signature. | DL §6 |
| K.rust-persistence-conventions.10 | ALWAYS restore an aggregate only through its full constructor. | adapter | sensor:n blocking | No bypass of invariants on the way back in. Sensor (n) exempts calls to the replay path (`apply` / `apply_event` / `replay` / `on_event`), because those are not construction. | DL §6 |

## Rationale

The reference implementation is `event-store-adapter-rs`. The rules (g)–(i) and
(k)–(n) map the same ideas onto code the sensors can inspect: forbidden
dependencies, aggregate arguments, cross-side references, repository naming and
restoration bypass.

The core agrees with the port side of this file: "One repository per aggregate
root (not per entity or table)"
(`.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` → Repository
Pattern). The place where the core disagrees — event sourcing as merely one
option, with a free command/event correspondence — is recorded as C-4 in
`ddd-always-valid-model.md`, which owns the conflict list.

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| K.rust-persistence-conventions.2 | tests/golden/rust/cases.ts#clean-domain | a domain type that sensor (c) accepts as a single construction path | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.rust-persistence-conventions.3 | tests/golden/design/cases.ts#clean | a declared layer structure whose repository declares `store_semantics: upsert`, so sensor `design-advisories.store-upsert` reports nothing | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.rust-persistence-conventions.5 | tests/golden/rust/cases.ts#clean-domain | a domain type with no construction path other than its own `impl`, so sensor (c) reports nothing | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.rust-persistence-conventions.6 | tests/golden/rust/cases.ts#clean-domain | the same case: no mutation is reported by sensor (b) | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.rust-persistence-conventions.7 | tests/golden/rust/cases.ts#clean-repository | a `InvoiceRepository` trait beside an `InMemoryInvoiceRepository` implementation | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.rust-persistence-conventions.8 | tests/golden/design/cases.ts#clean | a declared layer structure whose repository declares `store_semantics: upsert` | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.rust-persistence-conventions.10 | tests/golden/rust/cases.ts#clean-repository | the same case: no domain type is built by a struct literal or an update expression in the adapter crate | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |

Each row names the clean case of the suite that runs the rule's sensor, not a
case built to exercise the rule's subject matter. Two caveats belong with this
table:

- `clean-domain` declares no event-sourced aggregate, so it contains no
  `decide` / `apply` pair and no replay method. Rules `.5` and `.6` are
  therefore satisfied vacuously there rather than demonstrated.
- `clean-repository` contains no restoration code at all, so rule `.10` is
  likewise satisfied vacuously.

Both caveats are listed in this unit's `code-summary.md`.

## Retired rules

None.

## Sources

- `ddd/docs/domain-layer-design.md` §6–§7
- `ddd/docs/use-case-layer-design.md` §5
- `ddd/docs/interface-adapter-layer-design.md` §5, §9
- `construction/u2-rust-analysis-foundation/functional-design/` — the layer
  assigned from the crate graph and the placement conventions the port rules
  build on (`functional-spec.md`, `rules.md`). Record-relative path under
  `aidlc/spaces/default/intents/<intent>/`.
- `construction/u5-rust-code-sensors/functional-design/` — the rule semantics
  for (c), (m) and (n) and the replay-exemption list that rules `.5`, `.6` and
  `.10` describe (`functional-spec.md`, `rules.md`)
- `.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` → Repository
  Pattern, Domain Events (the core statements cited as support, and the one
  recorded as conflict C-4 in `ddd-always-valid-model.md`)
```

### 7. `ddd/knowledge/aidlc-aws-platform-agent/ddd-interface-adapter-conventions.md`

#### 修正前（HEAD）

```markdown
# Interface-adapter conventions

## Purpose

Port responsibility classification, repository naming and scope, verbs, the
medium-name ban, starting in memory, the query side as DAO + DTO, persistence
backend selection, RMU design, upstream contracts, and the
`ddd-layer-structure` declaration. Read during infrastructure-design.

## Principles

- A port describes a responsibility, not a technology.
- Name a repository after its aggregate, never after its storage.
- Start in memory; add a backend only when the design needs it.

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| IAC-1 | classify every port as repository / external-client / es-infrastructure | port | sensor:layer-structure.item blocking | explicit responsibility | FR5.2 |
| IAC-2 | name a repository `<Aggregate>Repository`; no storage medium in the port name | repository | sensor:layer-structure.m-name / .m-media blocking | technology-agnostic naming | IA §5 |
| IAC-3 | repository verbs are `find_by_id` / `store` / `delete_by_id` | repository | guidance-only | a small stable surface | FR5.2 |
| IAC-4 | start with an in-memory implementation | adapter | guidance-only | tests run without infrastructure | IA §5 |
| IAC-5 | the query side is a DAO plus a DTO, not a domain object | query adapter | sensor:l blocking | separate read model | IA §4 |
| IAC-6 | the infrastructure layer holds language extensions only | infrastructure crate | sensor:g blocking | no RPC or DB clients there | IA §3 |
| IAC-7 | an external system uses a conformist or an anti-corruption layer | adapter | guidance-only | bound the foreign model | IA §8 |
| IAC-8 | declare the layer structure with the ADR-009 mandatory items | layer structure | sensor:layer-structure.item blocking | machine-checkable design | U4 |

## Rationale

Ports are where the design meets the outside world. Keeping them named by
responsibility — and free of medium words — keeps the design technology-neutral;
the implementation is where `InMemoryInvoiceRepository` and friends appear.

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| IAC-2 | tests/golden/rust/.../clean-repository | a `InvoiceRepository` trait and an in-memory implementation | rust fixture |
| IAC-8 | tests/golden/design/.../clean | a complete layer structure | design fixture |

## Retired rules

None.

## Sources

- ddd/docs/interface-adapter-layer-design.md §5–§9
```

#### 修正後（本パス）

```markdown
# Interface-adapter conventions

## Purpose

Port responsibility classification, repository naming and scope, verbs, the
medium-name ban, starting in memory, the query side as DAO + DTO, persistence
backend selection, RMU design, upstream contracts, and the
`ddd-layer-structure` declaration. Read during infrastructure-design.

## Principles

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.interface-adapter-conventions.1 | NEVER name a port after a technology; a port describes a responsibility. | port | sensor:layer-structure.m-media blocking | A port whose name carries a medium cannot be implemented in memory, and cannot be swapped. | IA §5 |
| K.interface-adapter-conventions.2 | ALWAYS name a repository after its aggregate, never after its storage. | repository | sensor:layer-structure.m-name blocking | The aggregate names the boundary the repository serves. | IA §5 |
| K.interface-adapter-conventions.3 | PREFER starting in memory and adding a backend only when the design needs it. | adapter | guidance-only | Tests run without infrastructure; whether a given port needs a real backend is a design judgement. | IA §5 |

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.interface-adapter-conventions.4 | ALWAYS classify every port as repository, external-client or es-infrastructure. | port | sensor:layer-structure.item blocking | The responsibility of a port is explicit, not inferred from its name. | FR5.2 |
| K.interface-adapter-conventions.5 | ALWAYS name a repository `<Aggregate>Repository` and keep every storage medium out of the port name. | repository | sensor:layer-structure.m-name / .m-media blocking | Technology-agnostic naming. | IA §5 |
| K.interface-adapter-conventions.6 | PREFER the repository verbs `find_by_id`, `store` and `delete_by_id`, and put conditional search on the query side. | repository | guidance-only | A small stable surface; no sensor reads the verb list. This is the rule that overrides the core's `save` / `findByCustomer` example (see C-1 in `ddd-always-valid-model.md`). | FR5.2 |
| K.interface-adapter-conventions.7 | PREFER starting with an in-memory implementation. | adapter | guidance-only | Tests run without infrastructure. | IA §5 |
| K.interface-adapter-conventions.8 | NEVER let the query side be a domain object; it is a DAO plus a DTO. | query adapter | sensor:l blocking | Separate read model. | IA §4 |
| K.interface-adapter-conventions.9 | NEVER place RPC or database clients in the infrastructure layer; it holds language extensions only. | infrastructure crate | sensor:g blocking | Keeps the dependency direction inward. | IA §3 |
| K.interface-adapter-conventions.10 | PREFER a conformist or an anti-corruption layer for an external system. | adapter | guidance-only | Bounds the foreign model; which of the two fits is a design judgement. | IA §8 |
| K.interface-adapter-conventions.11 | ALWAYS declare the layer structure with the ADR-009 mandatory items. | layer structure | sensor:layer-structure.item blocking | A machine-checkable design. | U4 |

## Rationale

Ports are where the design meets the outside world. Keeping them named by
responsibility — and free of medium words — keeps the design technology-neutral;
the implementation is where `InMemoryInvoiceRepository` and friends appear.

The core agrees with the repository-scope part of this file: "One repository per
aggregate root (not per entity or table)" and "Do not put query logic in
repositories — use separate read models for complex queries"
(`.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` → Repository
Pattern). The place where the core disagrees — its `save` /
`findByCustomer(customerId)` example — is recorded as C-1 in
`ddd-always-valid-model.md`, which owns the conflict list.

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| K.interface-adapter-conventions.1 | tests/golden/design/cases.ts#clean | a declared layer structure whose port names carry no storage medium | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.interface-adapter-conventions.2 | tests/golden/design/cases.ts#clean | the same case: a repository named `InvoiceRepository` after its aggregate | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.interface-adapter-conventions.4 | tests/golden/design/cases.ts#clean | the same case: every port declares a kind | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.interface-adapter-conventions.5 | tests/golden/design/cases.ts#clean | the same case: sensors `.m-name` and `.m-media` report no repository name | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.interface-adapter-conventions.8 | tests/golden/design/cases.ts#clean | the same case: the query-side crate declares no dependency on a domain-layer crate | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.interface-adapter-conventions.9 | tests/golden/rust/cases.ts#clean-domain | a domain crate whose only external edge is nowhere, so sensor (g) reports no forbidden direction | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.interface-adapter-conventions.11 | tests/golden/design/cases.ts#clean | the same case: a `ddd-layer-structure` declaration carrying all ADR-009 mandatory items | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |

The design rows all name the single clean case of the `ddd-layer-structure`
suite, because that declaration is the only artifact the `.item` / `.m-name` /
`.m-media` and (l) checks run against. Sensor (g) reads Rust source, so rule `.9`
points at the rust suite instead. The rows name the case the sensor accepted,
not a case built to exercise the rule's subject matter; the limitations are
listed in this unit's `code-summary.md`.

## Retired rules

None.

## Sources

- `ddd/docs/interface-adapter-layer-design.md` §5–§9
- `construction/u4-design-sensors/functional-design/` — the
  `ddd-layer-structure` declaration schema, its ADR-009 mandatory items, and
  the sensor rule ids `.item` / `.m-name` / `.m-media` / `.n`
  (`functional-spec.md` §WF6, `entities.md`). Record-relative path under
  `aidlc/spaces/default/intents/<intent>/`.
- `construction/u2-rust-analysis-foundation/functional-design/` — the layer
  assigned from the crate graph and the allowed-dependency table that sensor (g)
  and sensor (l) consult (`functional-spec.md` §WF2, §WF5)
- `inception/domain-design/decisions.md` ADR-009 — the split between the
  declaration-side and code-side checks of (k)(l)(m)(n)
- `.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` → Repository
  Pattern (the core statements cited as support, and the example recorded as
  conflict C-1 in `ddd-always-valid-model.md`)
```

### 8. `ddd/knowledge/aidlc-shared/ddd-layer-boundaries.md`

#### 修正前（HEAD）

```markdown
# Layer boundaries and dependency direction

## Purpose

The dependency rules every DDD stage shares: the four layers, the allowed
directions, the composition root, and the command/query ban. Read during
domain-design, functional-design, infrastructure-design and code-generation.

## Principles

- Layers are physically separated by subproject (`packages/<layer>/` or
  `modules/<layer>/`).
- A dependency that the rules forbid is a build error, not a review note.
- The composition root is the only place allowed to depend on everything.

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| LB-1 | interface-adapter depends only on use-case, domain and infrastructure | crate graph | sensor:g blocking | I/O adapts inward | IA §3 |
| LB-2 | use-case depends only on domain and infrastructure | crate graph | sensor:g blocking | orchestration without I/O | IA §3 |
| LB-3 | domain depends only on infrastructure | crate graph | sensor:g blocking | domain is pure | IA §3 |
| LB-4 | infrastructure depends on no layer | crate graph | sensor:g blocking | it holds language extensions only | IA §3 |
| LB-5 | command side and query side do not depend on each other | crate graph | sensor:k blocking | CQRS separation | IA §3 |
| LB-6 | an RMU may depend on both sides | crate graph | sensor:k (exempt when from rmu) | read-model updaters bridge | IA §4 |
| LB-7 | the composition root wires all layers | crate graph | guidance-only | DI lives outside the rules | ADR-005 |
| LB-8 | layer is derived from the crate, never from a config file | crate graph | sensor:layer.* blocking | mechanical, not declarative | FR9.4 |

## Rationale

The dependency direction is the same one the domain layer design fixes: the
domain stays pure, use cases orchestrate, adapters perform I/O, and
infrastructure carries only language extensions. CQRS adds the command/query
split, bridged only by RMUs.

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| LB-1 | tests/golden/rust/.../clean-domain | domain crate with no outward edge | mirror fixture for the Rust sensor |

## Retired rules

None.

## Sources

- ddd/docs/interface-adapter-layer-design.md §3–§4
- ddd/tools/ddd/lib/workspace/resolver.ts (permission table)
```

#### 修正後（本パス）

```markdown
# Layer boundaries and dependency direction

## Purpose

The dependency rules every DDD stage shares: the four layers, the allowed
directions, the composition root, and the command/query ban. Read during
domain-design, functional-design, infrastructure-design and code-generation.

## Principles

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.layer-boundaries.1 | ALWAYS take a crate's layer from the crate itself, never from a configuration file. | crate graph | sensor:layer.* blocking | A layer that has to be declared separately can drift from the code it describes. | FR9.4 |
| K.layer-boundaries.2 | NEVER let a forbidden dependency into the build; it is a build error, not a review note. | crate graph | sensor:g blocking | A rule that only a reviewer enforces is a rule that decays. | IA §3 |
| K.layer-boundaries.3 | PREFER confining the everything-depends-on-everything wiring to the composition root. | crate graph | guidance-only | Wiring has to live somewhere; whether a given edge belongs to the composition root is a design judgement. | ADR-005 |

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.layer-boundaries.4 | ALWAYS keep interface-adapter depending only on use-case, domain and infrastructure. | crate graph | sensor:g blocking | I/O adapts inward. | IA §3 |
| K.layer-boundaries.5 | ALWAYS keep use-case depending only on domain and infrastructure. | crate graph | sensor:g blocking | Orchestration without I/O. | IA §3 |
| K.layer-boundaries.6 | ALWAYS keep domain depending only on infrastructure. | crate graph | sensor:g blocking | The domain is pure. | IA §3 |
| K.layer-boundaries.7 | NEVER let infrastructure depend on a layer. | crate graph | sensor:g blocking | It holds language extensions only. | IA §3 |
| K.layer-boundaries.8 | NEVER let the command side and the query side depend on each other. | crate graph | sensor:k blocking | CQRS separation. | IA §3 |
| K.layer-boundaries.9 | ALWAYS keep the command/query ban, allowing an RMU to depend on both sides. | crate graph | sensor:k blocking | Read-model updaters bridge the two sides by design. Sensor (k) exempts an edge that comes from an RMU crate rather than a command- or query-side crate; that exemption is the reason this rule reads as a permission inside the ban. | IA §4 |
| K.layer-boundaries.10 | PREFER wiring all layers in the composition root. | crate graph | guidance-only | DI lives outside the rules. | ADR-005 |
| K.layer-boundaries.11 | ALWAYS derive a crate's layer from the crate, never from a config file. | crate graph | sensor:layer.* blocking | Mechanical, not declarative. | FR9.4 |

## Rationale

The dependency direction is the same one the domain layer design fixes: the
domain stays pure, use cases orchestrate, adapters perform I/O, and
infrastructure carries only language extensions. CQRS adds the command/query
split, bridged only by RMUs.

The core agrees with the shape of the dependency rules and is cited as support:
transactions do not span aggregates and queries use a separate read model
(`.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` → Aggregates,
Repository Pattern).

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| K.layer-boundaries.1 | tests/golden/rust/cases.ts#clean-domain | a workspace whose single crate is assigned a layer from its path, with no layer conflict or unknown | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.layer-boundaries.2 | tests/golden/rust/cases.ts#clean-domain | the same case: sensor (g) reports no forbidden dependency direction | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.layer-boundaries.4 | tests/golden/rust/cases.ts#clean-domain | the same case: no adapter crate declares an inward-forbidden edge | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.layer-boundaries.5 | tests/golden/rust/cases.ts#clean-domain | the same case: no use-case crate declares a forbidden edge | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.layer-boundaries.6 | tests/golden/rust/cases.ts#clean-domain | the same case: the domain crate declares no dependency outside the allowed set | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.layer-boundaries.7 | tests/golden/rust/cases.ts#clean-domain | the same case: no infrastructure crate declares an outward edge | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.layer-boundaries.8 | tests/golden/design/cases.ts#clean | a declared layer structure with a command-side crate and a query-side crate and no dependency between them | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.layer-boundaries.9 | tests/golden/design/cases.ts#clean | the same case: the declaration lists no RMU crate, so no exempt edge is needed | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.layer-boundaries.11 | tests/golden/rust/cases.ts#clean-domain | the same case: the crate's layer is resolved without a config file | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |

Seven of the nine rows point at the one rust clean case because rules `.1`,
`.2` and `.4`–`.7` and `.11` all read the same crate graph. Two caveats belong
with this table:

- `clean-domain` declares a single domain crate, so the adapter, use-case and
  infrastructure rules (`.4`, `.5`, `.7`) are satisfied because no such crate
  exists there, not because a correct edge was checked.
- The `clean` design case declares no RMU crate, so the exemption in rule `.9`
  is not exercised.

Both caveats are listed in this unit's `code-summary.md`.

## Retired rules

None.

## Sources

- `ddd/docs/interface-adapter-layer-design.md` §3–§4
- `construction/u2-rust-analysis-foundation/functional-design/` — the layer
  assigned from the crate graph and the allowed-dependency table
  (`isAllowed`) that sensors (g), (k) and `layer.*` consult
  (`functional-spec.md` §WF2, §WF5, `rules.md`). Record-relative path under
  `aidlc/spaces/default/intents/<intent>/`.
- `inception/domain-design/decisions.md` ADR-005 — the composition root
- `.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` → Aggregates,
  Repository Pattern (the core statements cited as support)
```

