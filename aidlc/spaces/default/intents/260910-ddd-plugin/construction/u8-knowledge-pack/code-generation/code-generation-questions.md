# Code Generation — 確認事項（U8 ナレッジ / u8-knowledge-pack）

## Sources

- `inception/units-generation/unit-of-work.md`（U8 = DddKnowledgePack、kind: spec、複雑度 M）
- `inception/units-generation/unit-of-work-story-map.md`（U8 の割当: FR10、FR10.1〜FR10.6）
- `inception/requirements-analysis/requirements.md`（FR10.1〜FR10.6）
- `construction/u8-knowledge-pack/functional-design/functional-spec.md`、`rules.md`、`entities.md`
- `inception/domain-design/decisions.md`（ADR-006、ADR-010）
- `construction/u1-sensor-foundation/functional-design/`、`construction/u2-rust-analysis-foundation/functional-design/`（出典の向き先）
- `ddd/knowledge/aidlc-{architect,developer,aws-platform}-agent/ddd-*.md`、`ddd/knowledge/aidlc-shared/ddd-layer-boundaries.md`（8 本、既存の実装）
- `ddd/tests/golden/design/cases.ts`、`ddd/tests/golden/rust/cases.ts`（索引先の fixture 名の実在確認）
- `ddd/contributions/`、`ddd/stages/inception/ddd-domain-modeling.md`、`ddd/.aidlc-plugin/plugin.json`（anchor と配置の実体）

## 前提

本 Unit の実装はすでに作業ツリー上に存在し、`ddd/CHANGELOG.md` の v0.1.0 に含まれている。
本計画は**既存の実装を code-generation ステージの成果として記録し、仕様に照らして検証し、
検証で見つかった未達と逸脱を本パスの中で修正する**。書き起こしは行わない。

**修正は 8 本すべてに及ぶ。** 要件の未達 2 件（Step 10・11）に加えて、BR レベルの逸脱 5 点
（Step 12〜15）を本パスで直す。その結果、8 本の中身は全面的に書き換わる
（ファイル名・配置・節構成・本文の主張は変えない）。**要件の未達も BR の逸脱も
`GAP` や逸脱記録のまま残して本 Unit を完了させない。**

U8 は kind `spec` で、実行時の型もテストランナーも持たない。
BR8.1／BR8.2 の検証は **U9 の統合テスト**が所有する（`functional-spec.md` §4 WF4、
`entities.md` の `PlacementCheck`）。したがって**本 Unit でテストを新設しない**。

## 承認時に確認されたい点

**1・2 は要件の未達、3〜7 は BR レベルの逸脱であり、いずれも本パス内で修正する**
（計画の Step 10〜15）。8 は設計どおりである。9 は既知の環境要因である。

**1. FR10.2 の `module-visibility` に対応する規則が無い（要件の未達）。**
FR10.2 は Rust のトピックとして `module-visibility` を挙げ、`ddd/docs/domain-layer-design.md` §9 も
取り込み候補として明記し、`functional-spec.md` §2 の対応表にも載っている。
`ddd-rust-domain-conventions.md` は Purpose の文に "module visibility" と書くだけで、
Rules 表にこれに対応する規則が 1 件も無い。他の 7 トピック（field-visibility、tell-dont-ask、
factory-naming、interior-mutability、domain-equality、error-handling、first-class-collections）は
すべて規則を持つ。BR2.2 は FR10.2 の Rust トピックがすべて運ばれることを求めている。
**Step 10 で修正する**: Rules 表に `module-visibility` を主題とする規則を 1 件追加する。
センサー (a) はドメイン型の**フィールド**の可視性だけを読み
（`tools/ddd/lib/rules/rust/symbols.ts`）、モジュールの可視性を読む検査は存在しないため、
**BR4.3 に従って `guidance-only` ＋ 文型 **PREFER** とする**（ALWAYS / NEVER のまま
guidance-only にはできない）。機械強制が無い理由を Rationale に書く。

**2. ADR-010 の矛盾 4 件と、ナレッジの Conflicts 節 4 行が一致しない（要件の未達）。**
ストーリーマップは「FR10.4 の一覧の内容は `decisions.md` ADR-010 が出典」と定め、
`functional-spec.md` §3・WF2 と `rules.md` BR5.1 も ADR-010 の 4 件の転記を求めている。
ADR-010 の 4 件は (1) Repository の動詞、(2) 集約の導出、(3) Entity の可変性と setter 禁止、
(4) Event Sourcing とコマンドの戻り値である。ナレッジの 4 行は
(1) Domain Primitive がコアの語彙に無いこと、(2) コアが集約をデータの塊として扱うこと、
(3) コアが getter を許すこと、(4) コアがコンテキスト間パターンを開いたままにすることであり、
**ADR-010 の (1) と (4) が無く、(2) 以外は別の主張**である。
加えて `entities.md` の `ConflictEntry` が要求する `core_statement`（コアの記述の英語引用）と
`rationale`（採用理由）の列が無く、`core_location` は節名ではなくファイル名
（`ddd-patterns.md`）である。
**Step 11 で修正する**: Conflicts 節を ADR-010 の 4 件に置き換え、列を
`# | コアの記述 | プラグインの規約 | 適用範囲 | 採用理由` にし、`コアの記述` を英語引用、
`採用理由` を全 4 行に付け、`core_location` を `ddd-patterns.md` の**節名**
（`Repository Pattern` / `Aggregates` / `Entities` / `Domain Events`）にする。

**3. 規則 ID の文法と文型が BR4.1 と一致しない（BR 逸脱）。**
BR4.1 と `entities.md` は `rule_id` を `K.<topic>.<n>`、`statement` を ALWAYS / NEVER / PREFER で
始まる 1 文と定める。実装の 8 本が持つ **57 規則**は `AVM-1`・`AGG-1`・`CQ-1`・`UC-1`・
`IAC-1`・`RDC-1`・`RPC-1`・`LB-1` という短い接頭辞形式で、`statement` は小文字で始まる宣言文である。
`functional-spec.md` §3 が定める Rules 節の**表の列構成**（Rule ID / Statement / Applies to /
Enforcement / Rationale / Source）は一致している。
**Step 12 で修正する**: 全 83 規則（Step 10 の新規 1 件を含む）を `K.<topic>.<n>` に採番し直し、
文型を ALWAYS / NEVER / PREFER のいずれかで始まる 1 文に揃える。
**この改名による参照切れは起きない**（旧表記は `ddd/` の他の場所からも `aidlc/` の記録からも
参照されていないことを確認済み）。

**4. Principles 節の項目が `RuleEntry` になっていない（BR 逸脱）。**
`functional-spec.md` §3-2 は Principles を `RuleEntry`（level は多くが guidance-only または schema）
と定め、`entities.md` も `KnowledgeSection.entries` を `list<RuleEntry>`（kind = principles / rules の
とき 1 件以上）とする。実装の Principles は rule_id も Enforcement も Rationale も持たない
箇条書きである（8 本で計 25 項目）。
**Step 12 で修正する**: Rules 節と同じ 6 列の表にし、機械強制がある原則だけ ALWAYS / NEVER、
それ以外は PREFER + `guidance-only` とする。
あわせて BR4.4（例外には理由を記録する）を、`functional-spec.md` §3-3 が列を 6 列に固定していて
`exceptions` に対応する列が無いため、**Rationale 列に「<例外> — <理由>」の形で書く**という解釈で
満たす（`code-summary.md` に記録する）。

**5. Enforcement 列の一部が深刻度を欠き、1 件が実在しない anchor を指す（BR 逸脱）。**
`entities.md` は `level = sensor` のとき `severity` を必須とする。`RPC-2` の
`sensor:c (replay exempt)`、`RPC-3` の `sensor:b (exempt)`、`LB-6` の
`sensor:k (exempt when from rmu)` は深刻度を書いていない。
また `AGG-7` の `stage-contract:after-step:3` は、本プラグインの contribution が宣言する
anchor（`after-step:1` / `:2` / `:4` / `:5`）に存在しない（BR4.2）。`ddd-domain-modeling` は
fragment を 1 つも宣言していない。`sensor:` の (a)〜(n)、`model-completeness.*`、
`mapping-declarations.*`、`layer-structure.*`、`design-advisories.*`、`schema:*` の参照は
**すべて実在を確認した**。
**Step 13 で修正する**: 3 件に深刻度（`blocking`）を補い、免除の事実は `refs` から
**Rationale に移す**。`AGG-7` は「イベントから集約を逆算する」がワークショップ手順で
機械強制できないため、**PREFER + `guidance-only`** とし、Rationale に
「導出の**結果**は `sensor:model-completeness.i/.ii` が強制するが、導出の**順序**は強制しない」と書く。

**6. example-index の `fixture_path` が実在パスではなく、`projection_note` が BR6.2 の内容を持たない（BR 逸脱）。**
索引は `tests/golden/design/.../clean-complete` のように `...` を含む**予定パス**で、
リポジトリ相対の実在パスではない。実際のゴールデンケースは
`ddd/tests/golden/design/cases.ts` と `ddd/tests/golden/rust/cases.ts` の TypeScript の表にあり
（U4 の逸脱 1 と同じ構造）、`tests/golden/<suite>/<sensor-id>/clean-*/` という
ディレクトリは存在しない。索引が指す**ケース名はすべて実在**する（`clean-complete`、
`clean-execute`、`clean-skip`、`clean-mapping`、`clean`、`clean-repository`、`clean-domain`）が、
`CQ-3` は `violation-k`、`RPC-7` は `violation-n` と、BR6.1 が求める「違反なし」以外の
ケースを指している。`projection_note` は "design fixture" / "rust fixture" の一言で、
BR6.2 が求める「投影先のハーネスからは参照できない旨と、リポジトリでの参照方法」を書いていない。
索引は 8 本で **10 行**しかなく、`level = sensor` の全規則を覆っていない（BR4.5、WF3.1）。
**Step 14 で修正する**: ロケータを `tests/golden/<suite>/cases.ts#<case-name>` の形にし、
`level = sensor` の全規則を、その規則を強制するセンサーが実行する clean ケースに索引し、
`projection_note` を BR6.2 の内容にする。
**残る限界（正直な申告）**: (k)・(l) の clean ケース（`clean-repository`）にはコマンド側と
クエリ側のクレート対が含まれず、`RPC-2`・`RPC-3` の Event Sourcing 固有部分も
`clean-domain` では空である。**`tests/golden/` の所有者は U4・U5 であり、U8 はケースを新設できない**
（BR6.1 も「U4 または U5 の clean fixture を 1 件選ぶ」と定める）。したがって索引は
「センサーが違反を報告しなかったケース」を指すにとどまり、規則を**実演**してはいない。
この残差は `code-summary.md` の逸脱欄に記録し、U9 への申し送りに含める。
**BR6.1 の literal な形（ディレクトリ）自体が実装に存在しないことも、同じ欄に記録する**
（U4 の逸脱 1 に由来する残差）。

**7. BR7.1 の出典が U1／U2 の Unit 設計を指していない（BR 逸脱）。**
BR7.1 は出典を `SourceRef.kind = unit-design` で `construction/u1-*/functional-design/` に
向けることを求める。実装の `Sources` 節は `ddd/docs/*.md` を指し、
`AVM-5` の `Source: U1 BR1.1` だけが例外である。2 本のファイルは設計ではなく実装ファイル
（`ddd/tools/ddd/lib/rules/lists.ts`、`ddd/tools/ddd/lib/workspace/resolver.ts`）を指す。
BR5.2 が求める「矛盾しないコアの記述」（集約間参照は ID、トランザクションは集約を跨がない、
リポジトリは集約ルート単位、クエリは別の読み取りモデル、VO をプリミティブより優先）も
`core-knowledge` の `SourceRef` として引用されていない（BR5.2 の違反列は「なし」であり、方針の話である）。
**Step 15 で修正する**: スキーマと ID 文法の説明の出典を U1 の、
クレート命名と配置規約の説明の出典を U2 の Unit 設計に向け、2 本の実装ファイル参照を差し替え、
コアの非矛盾記述を Rationale 節と `Source` 列で `core-knowledge` として引用する。
`ddd/docs/*.md`（design-doc）と ADR の出典はそのまま残す。

**8. BR8.1／BR8.2 の検証は U9 が所有する（設計どおり）。**
本 Unit の 8 本を対象にした検証（`inline_context_paths` の実在、Sources 節の存在、
example-index の fixture の実在）は、`ddd/tests/` のどこにも実装されていない。
`tests/u3-plugin-scaffold.test.ts` のナレッジ面の検査は面の存在と粒度に限られる。
`functional-spec.md` §4 WF4・BR8.1・BR8.2・`entities.md` の `PlacementCheck` はいずれも
実行主体を U9 の統合テスト（`bun run check`）と定めており、**これは設計どおりである**。
本 Unit は U9 への申し送り事項を `code-summary.md` に列挙する。
**`traceability.json` では FR10.3 を `Deferred` として記録する。**

**9. `bun run check` は終了コード 0 にならない見込みである（既知の環境要因）。**
U3・U4 と同じ理由（`tests/codex-dispatch-bridge.test.ts` の 12 件が要求する
`aidlc-workflows/dist/codex/aidlc` の fixture が未生成。読み取り専用サブモジュール）である。
FR10 群の**検証欄**はいずれも `bun run check` の緑を挙げていないが、BR8.1／BR8.2 の `trigger` は
`bun run check` である。計画は要件本文に照らして判定し、実測値と生の証拠を
`code-summary.md` に併記する。目標を下げて通すことはしない。

**10. 前回レビューの Minor 所見 2 件を、本改訂で Step 17 として取り込んだ。**
いずれも `traceability.json` の記録の修正であり、**ナレッジ文書 8 本には一切触れない**。

- **R-03（Step 17a）** — `FR10`（status `OK`）と `FR10.3` の `target` が `ddd/knowledge/`
  というディレクトリで、traceability センサーが `invalid_targets`
  （"target file does not exist"）を報告する。両行を
  `ddd/knowledge/aidlc-shared/ddd-layer-boundaries.md` に改める。
  8 本という集合であることは既存の `note` が保持する。
- **R-02（Step 17b）** — `upstream_ids` が FR10 系 7 件のみで、本 Unit 自身の `rules.md` が
  定める **BR1.1〜BR8.2 の 26 件が 1 件も現れない**。26 件を追加する。
  `target` は本 Unit 所有の 8 パスのいずれかに限り、他 Unit のファイルは指さない。
  BR8.1・BR8.2 は上記 8 のとおり検証を U9 が所有するため `Deferred` とし、残る 24 件を `OK` とする。
- **Step 17c** — 計画の Step 1〜16 が `code-summary.md` の記録に反して `[ ]` のまま残っている。
  タスクマーカーは承認フィンガープリントの射影から除外されるため、更新しても承認は失効しない。
  `code-summary.md` が実施を記録している範囲に限って `[x]` にし、更新後に
  `verify --unit u8-knowledge-pack` が `ok: true` を返すことを実測で確認する。

**11. 前回レビューの Minor 所見 R-01 も、本改訂で Step 17d として取り込んだ。**
**この 1 ステップだけがナレッジ文書に触れる**（8 本のうち 1 本、節は 1 つ）。

`entities.md:72,76` は `ConflictEntry` の必須属性として `core_location` と `precedence` を定め、
`functional-spec.md:69,71`（WF2-2・WF2-4）も「節名を core_location に書く」「precedence は plugin」
と名前付きの項目として扱う。一方 `functional-spec.md:50`（§3-5）は「ADR-010 の 4 件の表」と
だけ書き、**列構成を定めていない**。

したがって現状の 5 列（`# | Core statement | Plugin rule | Scope | Rationale`）は仕様の要求ではなく
実装側の判断であり、上流 2 文書と食い違っている。**上流への変更依頼は要らず、実装側で直せる。**

Step 17d で `ddd-always-valid-model.md` の `## Conflicts with core knowledge` の表を
**7 列**（`# | Core statement | Core location | Plugin rule | Scope | Precedence | Rationale`）に
改める。本文の主張・行 ID（C-1〜C-4）・節構成・ファイル名・配置は変えない。
他の 3 本は行 ID でのみ参照しており列構成に依存しないことを事前に確認する。

**この 11 点はいずれも隠さず計画に明記している。** 1〜7 は Step 10〜15 で本パス内に修正し、
8 は設計どおり、9 は既知の環境要因として記録し、10 は Step 17a〜17c、11 は Step 17d で修正する。

---

## Plan Approval

承認対象は次の 3 つである。

1. `construction/u8-knowledge-pack/code-generation/code-generation-plan.md`（埋め込みの Testing Contract を含む）
2. `construction/u8-knowledge-pack/code-generation/unit-test-instructions.md`
3. 上記 2 つに埋め込まれた Testing Contract（`contract_sha256: sha256:8d7f1a7f51e8e641623b1e21dc4fed305238daeae0eb70f0d7e8c9b1a833a386`）

[Approval Fingerprint]: sha256:v3:44776f261a67085acbaacb2c38c73d2602f5575ad85a9e8f1d840dc07ba4c2ab
[Planned Source]: f314b0f70447432b8b1590d17b062b3a08a0ed072c6753c095e87c182067e507

- Request Changes — revise the plan
- Approve Plan — proceed to code generation

[Answer]: Approve Plan
