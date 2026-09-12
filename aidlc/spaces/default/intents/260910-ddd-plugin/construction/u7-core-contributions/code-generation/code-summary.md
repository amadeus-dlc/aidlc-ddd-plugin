# Code Summary — U7 コアステージ contribution（u7-core-contributions）

## Sources

- `construction/u7-core-contributions/code-generation/code-generation-plan.md`（承認済み計画。Step 1〜10、Testing Contract、要件表、事前申告の乖離 5 点）
- `construction/u7-core-contributions/code-generation/unit-test-instructions.md`（Unit 限定コマンド 2 つと全体確認 3 つ）
- `construction/u7-core-contributions/functional-design/functional-spec.md`（§1 contribution 一覧、§2 宣言成果物の指示内容、WF1〜WF5、§8 未決事項）
- `construction/u7-core-contributions/functional-design/rules.md`（BR1.1〜BR6.4）
- `construction/u7-core-contributions/functional-design/entities.md`（Contribution / ContributionAdds / Fragment ほか）
- `inception/requirements-analysis/requirements.md` 82〜105 行目、144 行目（FR3.1〜FR5.5、FR8.3）
- `inception/units-generation/unit-of-work.md`（U7 の境界）
- 実装: `ddd/contributions/inception/domain-design.md`、`ddd/contributions/construction/functional-design.md`、`ddd/contributions/construction/infrastructure-design.md`、`ddd/contributions/construction/code-generation.md`
- 周辺: `ddd/.aidlc-plugin/plugin.json`、`ddd/sensors/aidlc-ddd-*.md`（9 本の `id` と `matches`）、`ddd/CHANGELOG.md` v0.1.0 Notes、`ddd/tests/README.md`
- コアのステージ定義: `.claude/aidlc-common/stages/inception/domain-design.md`、`.claude/aidlc-common/stages/construction/functional-design.md`、`.claude/aidlc-common/stages/construction/infrastructure-design.md`、`.claude/aidlc-common/stages/construction/code-generation.md`（`### Step <n>` 見出し）
- テスト: `ddd/tests/framework-compatibility.test.ts`（compose 2 件）、`ddd/tests/u3-plugin-scaffold.test.ts`（FR11.2 / FR11.5）
- compose の実測: `bun ../.codex/tools/aidlc-plugin-test.ts . --install .. --harness claude --json` の出力と、`rmSync` を無効化した scratchpad 上の写しで残した使い捨てコピーの `stage-graph.json` / `plugin-contrib-ddd.json` / 合成後ステージ本文

## 本 Unit の性質と作業の立場

U7 は kind: spec の Unit であり、実装は既存の contribution 4 本である。本ステージ（Code Generation Part 2）では **`ddd/` 配下と `.codex/` / `.claude/` 配下を一切改変せず**、既存実装を承認済み計画の Step 1〜10 に沿って検証し、結果を本書と `traceability.json` / `source-manifest.json` に記録した。作成物は記録 3 ファイルのみである。作業前後で `git status` の差分は本 Unit の記録ディレクトリ配下と `code-generation-plan.md` のチェックボックスに限られ、`ddd/` 配下に本作業による変更は無い。

## 記録したファイル

| パス | 所有 | 役割 |
|---|---|---|
| `ddd/contributions/inception/domain-design.md` | U7（本 Unit） | domain-design への contribution。consumes 1 / produces 1 / sensors 3、fragment 2 本（after-step:2 / after-step:4） |
| `ddd/contributions/construction/functional-design.md` | U7（本 Unit） | functional-design への contribution。sensors 3、fragment 2 本（after-step:2 / after-step:4） |
| `ddd/contributions/construction/infrastructure-design.md` | U7（本 Unit） | infrastructure-design への contribution。sensors 2、fragment 2 本（after-step:2 / after-step:5） |
| `ddd/contributions/construction/code-generation.md` | U7（本 Unit） | code-generation への contribution。sensors 3、fragment 2 本（after-step:1 / in:Sensors） |
| `construction/u7-core-contributions/code-generation/code-summary.md` | 本ステージの記録 | 本書 |
| `construction/u7-core-contributions/code-generation/traceability.json` | 本ステージの記録 | 15 要件の対応（OK 11、Gap 3、Deferred 1） |
| `construction/u7-core-contributions/code-generation/source-manifest.json` | 本ステージの記録 | 本 Unit が所有する 4 パス |

`plugin.json` の `contributes` は `"overlays": "contributions/"` で contribution 面を宣言している。キー名は `overlays` だが、`.codex/tools/aidlc-plugin-validate.ts` はこれを正規のキーとして `contributions/` に既定で対応づけており、`bun run validate` は VALID を返す。

## 主要な判断

1. **既存実装を書き換えない。** 仕様との差はすべて「計画からの逸脱」欄に記録し、目標を下げて通すことも、テストの期待値を緩めることもしていない。
2. **anchor の `<n>` はコアの現行 Steps 番号と一致する。** domain-design は Step 1〜8、functional-design は 1〜6、infrastructure-design は 1〜7、code-generation は 1〜7 で、`after-step:2` / `after-step:4` / `after-step:5` / `after-step:1` はいずれも実在する番号であり、`in:Sensors` は 4 ステージすべてが持つ `## Sensors` 区画に対応する。
3. **FR4.2、FR5.2、FR5.3 は Gap と判定した。** 受け入れ基準「挿入された手順が compose 後の本文に現れる」は形式上満たすが、要件本文が列挙する手順の内容が fragment に無い、または別の内容になっているためである（乖離 6・7）。これは計画時に申告していなかった追加の乖離であり、承認ゲートで判断を求める。
4. **FR4.3 は Deferred、FR8.3 は OK（注記付き）とした。** FR4.3 は仕様 §8 が「ゲートで人間の判断に委ねる」と明記した設計上の分離（乖離 3）で、本 Unit の実装はその設計どおりである。FR8.3 は受け入れ基準（code-generation ノードの sensors に全 Rust センサー ID）を実測で満たし、`matches` の値は U5 が所有し ADR-003 で決まっている（乖離 2）ため OK としつつ注記した。
5. **`model_ref` の既定パスは実装側が正しい。** BR6.1 は `inception/domain-modeling/domain-model.yaml` と書くが、実装の 3 本は `inception/ddd-domain-modeling/domain-model.yaml` を書く。U6 のステージ slug は `ddd-domain-modeling`（FR11.2 の接頭辞規約）であり、U4 の `ddd-model-presence` / `ddd-model-completeness` と U5 の `context.ts` も同じパスを読む。実装は一貫しており、仕様本文の方が古い（乖離 8 として記録）。

## テスト実測

すべて `ddd/` を作業ディレクトリとして実行した（bun 1.3.13）。

| コマンド | 結果 | 終了コード |
|---|---|---|
| `bun test tests/framework-compatibility.test.ts --test-name-pattern "composes"` | 2 pass / 0 fail（7 filtered out、10 expect） | 0 |
| `bun test tests/u3-plugin-scaffold.test.ts --test-name-pattern "FR11.2\|FR11.5"` | 3 pass / 0 fail（3 filtered out、34 expect） | 0 |
| `bun test tests/`（全体） | 149 pass / 12 fail（161 tests、10 files） | 1 |
| `bun test`（`tests/codex-dispatch-bridge.test.ts` を除く 9 ファイル） | 148 pass / 0 fail | 0 |
| `bun test tests/codex-dispatch-bridge.test.ts` 単独 | 1 pass / 12 fail（13 tests） | 1 |
| `bun run validate` | Plugin validation: VALID（Errors: 0; warnings: 1 `compose-hook-absent`） | 0 |
| `bun run build:claude` | Plugin build: COMPLETE → `dist/claude`（同じ warning 1） | 0 |
| `bun run build:codex` | Plugin build: COMPLETE → `dist/codex`（同じ warning 1） | 0 |
| `bun run check:biome` | Checked 51 files. No fixes applied | 0 |
| `bun run check` | biome と validate は通過、`test` 段で 149 pass / 12 fail | 1 |

**全体スイートの件数について（2026-09-12 に再実測）**: 本記録の初版は
「142 pass / 12 fail、154 tests」と書いていた。その後 U4（ゴールデンケース 4 件）と
U5（層診断ケース 3 件）が同じ周回でテストを追加したため、**149 pass / 12 fail、161 tests**に
増えている。**fail の 12 件は同一**で、原因も同じである。本 Unit の契約を踏むテスト
（compose 2 件、FR11.2 / FR11.5 の 3 件）は増減しておらず、いずれも緑のままである。
上表は再実測後の値に更新した。

12 件の失敗はすべて `tests/codex-dispatch-bridge.test.ts` の `copyReferenceFixture` が `aidlc-workflows/dist/codex/aidlc` を `scandir` できない ENOENT に起因し、`ddd/tests/README.md` が既知の前提条件として記載する fixture 未生成である（乖離 5）。本 Unit の contribution を踏むテストはいずれも緑で、既存スイートは fixture 起因の 12 件以外に失敗が無い。`dist/` は `.gitignore` の管理下にあり、ビルドで作業ツリーの追跡ファイルは変わっていない。

Standard 戦略の床（コンポーネントあたり 5〜8 件）に対し、本 Unit の契約を踏む既存テストは compose 2 件と FR11.2 / FR11.5 の 3 件（うち本 Unit に関わるのは 2 件）で、床を満たしていない（乖離 4）。記録の立場からテストを新設していない。

## compose の確認結果

`bun ../.codex/tools/aidlc-plugin-test.ts . --install .. --harness claude --json`（終了コード 0）の出力は `errors: []`、`drops: []`、`graph.compiled: true`、`graph.presentStages: ["ddd-domain-modeling"]`、`graph.missingStages: []`、`idempotent: true` で、`changedFiles` は 7 件（コアの 4 ステージ本文、`SKILL.md`、`scope-grid.json`、`stage-graph.json`）である。合成後の使い捨てコピーから読んだ `stage-graph.json` の 4 ノードは次のとおり（コア由来の面は省略し、ddd 由来の面のみ抜き出す）。

| ノード | consumes（ddd 由来） | produces（ddd 由来） | sensors（ddd 由来） |
|---|---|---|---|
| `domain-design` | `ddd-domain-model-yaml`（required: true） | `ddd-aggregate-mapping` | `ddd-model-presence`、`ddd-reference-ids`、`ddd-mapping-declarations` |
| `functional-design` | — | —（乖離 1） | `ddd-reference-ids`、`ddd-mapping-declarations`、`ddd-design-advisories` |
| `infrastructure-design` | — | —（乖離 1） | `ddd-layer-structure`、`ddd-design-advisories` |
| `code-generation` | — | — | `ddd-rust-domain`、`ddd-rust-use-case`、`ddd-rust-interface-adapter` |

合成後のステージ本文には fragment が次の位置に現れる: domain-design `### Step 2x (ddd): Ask the mapping axes and targets`（Step 2 と Step 3 の間）と `### Step 4x (ddd): Write the aggregate mapping`（Step 4 と Step 5 の間）、functional-design `### Step 2x (ddd): Ask the use-case items and conventions` と `### Step 4x (ddd): Write the use-case declarations`、infrastructure-design `### Step 2x (ddd): Ask the layer structure and persistence` と `### Step 5x (ddd): Write the layer structure`（Step 5 と Step 6 の間）、code-generation `### Step 1x (ddd): Read the DDD conventions`（Step 1 と Step 2 の間）と `## Sensors` 区画末尾の `<!-- plugin:ddd:in:Sensors:100:… -->` で囲まれた段落。`plugin-contrib-ddd.json` にも 4 ステージ 8 fragment のハッシュが記録されている。`sensors` に列挙された 8 ID はすべて `ddd/sensors/aidlc-ddd-*.md` の `id` に実在する。使い捨てコピーは確認後に削除した。

## frontmatter の照合（functional-spec.md §1、BR1）

| contribution | 面 | 仕様 §1 | 実装 | 判定 |
|---|---|---|---|---|
| domain-design | consumes | `ddd-domain-model-yaml`（required: true） | 同じ | 一致 |
| domain-design | produces | `ddd-aggregate-mapping` | 同じ | 一致 |
| domain-design | sensors | `ddd-model-presence`、`ddd-reference-ids`、`ddd-mapping-declarations` | 同じ 3 ID | 一致 |
| domain-design | fragments | after-step:2 / after-step:4 | 同じ（order 100） | 一致 |
| functional-design | consumes | — | 無し | 一致 |
| functional-design | produces | `ddd-use-case-declarations` | **無し** | 乖離 1 |
| functional-design | sensors | `ddd-reference-ids`、`ddd-mapping-declarations`、`ddd-design-advisories` | 同じ 3 ID | 一致 |
| functional-design | fragments | after-step:2 / after-step:4 | 同じ | 一致 |
| infrastructure-design | consumes | — | 無し | 一致 |
| infrastructure-design | produces | `ddd-layer-structure` | **無し** | 乖離 1 |
| infrastructure-design | sensors | `ddd-layer-structure`、`ddd-design-advisories` | 同じ 2 ID | 一致 |
| infrastructure-design | fragments | after-step:2 / after-step:5 | 同じ | 一致 |
| code-generation | consumes / produces | — / — | 無し / 無し | 一致 |
| code-generation | sensors | `ddd-rust-domain`、`ddd-rust-use-case`、`ddd-rust-interface-adapter` | 同じ 3 ID | 一致 |
| code-generation | fragments | after-step:1 / in:Sensors | 同じ | 一致 |

4 本とも `target` / `plugin: ddd` / `adds` / `fragments` を持ち、`adds` は consumes / produces / sensors 以外の面（`required_sections`、`requires_stage`、`when:`、`after-questions`、`dependencies`）を使っていない。論理名はすべて `ddd-` 接頭辞である。本文の `## fragment: <anchor>` 節は各ファイルとも `fragments` の宣言数（2）と同数である。

## 本文の読み合わせ（BR1〜BR6）

| BR | 要点 | 判定 | 根拠 |
|---|---|---|---|
| BR1.1 | 1 ステージ 1 ファイル、frontmatter 4 項目、fragment 節の数 | 適合 | 上表 |
| BR1.2 | adds は 3 面のみ | 適合 | 上表。FR11.5 テストも緑 |
| BR1.3 | anchor 4 種、`<n>` はコアの現行番号 | 適合 | コアの `### Step <n>` 見出しと照合、drops は [] |
| BR1.4 | 追加のみ、上書き・削除の表現無し | 適合 | 「代わりに」「省略してよい」に類する指示は無い。code-generation の「Report only source files in `source-manifest.json`」はコアの手順と同じ向き |
| BR1.5 | fragment は 40 行目安、yaml 断片は 15 行以内 | ほぼ適合（軽微な乖離） | 本文は 6〜28 行。yaml は 11 / 14 / **17** 行で、infrastructure-design Step 5x の 17 行だけが目安を超える（乖離 9） |
| BR1.6 | 英語、preserved token をそのまま | 適合 | 4 本とも英語。論理名・センサー ID・anchor は原文どおり |
| BR2.1 | consumes に正規モデル（required） | 適合 | compose 後の consumes に実測 |
| BR2.2 | produces と Step 4x の形式、1 行 1 Aggregate、reference_ids ≥ 1、再定義禁止 | 適合 | yaml の項目は aggregate_ref / programming_model / persistence_method / crate / module / ports / repository / reference_ids の 8 項目。「at least one」「Never redefine」を明記 |
| BR2.3 | Step 2x の 2 軸と写像先の質問、組み合わせの影響をナレッジ参照で示す | 部分適合 | 2 軸と写像先（crate / module / ports / repository / reference_ids）は含む。アクターモデル → Process Manager の一文はあるが、クラスベース → 再実行可能ユースケースの影響と `ddd-cqrs-and-consistency.md` への参照が無い（乖離 10） |
| BR2.4 | sensors 3 ID | 適合 | compose 後の sensors に実測 |
| BR3.1 | produces `ddd-use-case-declarations` と Step 4x の形式、`use_cases: []` | 部分適合 | 指示の形式（8 項目、2 集約以上で multi_aggregate_strategy 必須、`use_cases: []` と一文）は適合。produces を持たない（乖離 1） |
| BR3.2 | 規約 5 点、進行役、整合性境界、再実行可能性の手順、6 項目の質問 | **乖離** | 6 項目の質問と進行役の原則は適合。5 点セットの中身が要件と異なり、整合性境界の「集約＝強、ユースケース＝弱」と再実行可能性の設計手順 4 点、集約境界の引き直しの促し、`ddd-use-case-conventions.md` への参照が無い（乖離 6） |
| BR3.3 | sensors 3 ID | 適合 | compose 後の sensors に実測。(g)(h)(i)(d) は code-generation 側（乖離 3） |
| BR3.4 | 複数集約は advisory で進行は止まらないと案内 | **乖離** | multi_aggregate_strategy の要請はあるが、「検出されてもレビュー対象で進行は止まらない」の案内が無い（乖離 11） |
| BR4.1 | produces `ddd-layer-structure` と Step 5x の形式、必須項目、`layer_structures: []` | 部分適合 | yaml の 10 項目、crate_dependencies と full-constructor 復元経路の必須化は適合。produces を持たない（乖離 1）。対象のない Unit の `layer_structures: []` と一文の指示が無い（乖離 12） |
| BR4.2 | 層構造、ポート規約 7 点、永続化基盤、RMU の手順 | **乖離** | 層構造と依存方向、ポート 3 分類と動詞、backend と store の upsert、RMU が両側に依存できること、復元経路は含む。命名と I/O 単位は Step 5x の yaml にのみ現れる。媒体名の禁止、in-memory から始める、DAO＋DTO、基盤選定基準（CDC 対応 KVS / RDB）、RMU の順序保証とシーケンス番号の条件付き書き込み、`ddd-interface-adapter-conventions.md` への参照が無い（乖離 7） |
| BR4.3 | sensors 2 ID | 適合 | compose 後の sensors に実測 |
| BR5.1 | sensors 3 ID、produces / consumes 無し | 適合 | compose 後の sensors に実測。`matches` は 3 本とも `**/code-summary.md`（乖離 2） |
| BR5.2 | 命名・配置、3 層の規約要点、Command 以外の状態変更禁止、replay 名、I/O クレート一覧 | 部分適合 | 接尾辞 4 種、`packages/<layer>/` / `modules/<layer>/`、command / query / rmu セグメント、composition root、3 層の要点、replay 名 4 種は含む。I/O クレートの固定一覧とナレッジ（`ddd-rust-domain-conventions.md` / `ddd-rust-persistence-conventions.md`）への参照が無い（乖離 13） |
| BR5.3 | in:Sensors で契機、rule_id の意味、直し方、正規モデル無しの省略 | 部分適合 | 契機（`code-summary.md`）、3 マニフェストごとの規則 ID 一覧、直し方の一文は含む。rule_id（a〜n、layer.*、model.invalid）の意味と、正規モデルが無いワークフローで正規モデル依存の検査が省略されることの記述が無い（乖離 13） |
| BR6.1 | fenced yaml が正、人間向けの表、`schema_version: 1` と `model_ref` | 部分適合 | 3 本とも「The first fenced yaml block is canonical」と `schema_version: 1` / `model_ref` を持つ。人間向けの表の併記は domain-design のみ明記し、functional-design / infrastructure-design に無い（乖離 14）。`model_ref` の既定パスは実装が正しく仕様本文が古い（乖離 8） |
| BR6.2 | ElementId で参照、再定義しない | 適合 | domain-design と functional-design は明文。infrastructure-design は `bc.*` / `aggregate.*` の参照のみで再定義禁止の一文は無いが、再定義を促す記述も無い |
| BR6.3 | 対象のない Unit は空配列で宣言 | 部分適合 | functional-design は適合、infrastructure-design に無い（乖離 12） |
| BR6.4 | 論理名は `ddd-` 接頭辞 | 適合 | FR11.2 テスト緑、compile が受理 |

## 計画からの逸脱（全件）

計画で申告した 5 点（1〜5）を実際に確認し、読み合わせで見つかった追加の 9 点（6〜14）を併記する。いずれも実装は書き換えていない。

1. **functional-design / infrastructure-design の contribution が `adds.produces` を持たない。** 実測で compose 後の 2 ノードの produces に `ddd-use-case-declarations` / `ddd-layer-structure` が無いことを確認した。`CHANGELOG.md` v0.1.0 Notes のとおり、contributed artifact が全 Unit kind に適用され、kind で刈り込まれた `review_artifact` を持つコアステージがスキーマ検査に失敗するための意図的な選択である。宣言成果物はゲートの必須成果物にならず、書き出しは fragment の指示と U4 の gate センサー（`matches` に該当パスを持つ）に依存する。要件の判定条件（FR4.x / FR5.x）は produces を直接は要求しないため、traceability では FR4 / FR5 を OK とし、注記した。
2. **FR8.3 の `matches: **/*.rs` は満たさない。** 3 本の Rust マニフェストは `**/code-summary.md` を契機に申告ソースを検査する（ADR-003、U5 BR1.1）。本 Unit の責務であるバインドは実測で満たしている。
3. **FR4.3 の (g)(h)(i)(d) は code-generation に束ねている。** functional-design の sensors は 3 ID で、5 ID ではない。仕様 §8 / BR3.3 の設計どおりであり、traceability では Deferred として承認ゲートの判断に委ねる。
4. **本 Unit の契約を踏むテストが Standard の床を満たさない。** 実測 2 + 3 件（本 Unit に関わるのは 4 件）。fragment 本文の出現を固定するテストは無く、compose 出力の目視確認で代替した。
5. **`bun run check` は終了コード 1。** `tests/codex-dispatch-bridge.test.ts` の 12 件が `aidlc-workflows/dist/codex/aidlc` の fixture を必要とする。本 Unit のテストには影響しない。
6. **functional-design Step 2x の規約 5 点セットが要件と異なる（追加、FR4.2 → Gap）。** 要件（FR4.2、BR3.2）は DIP、execute の引数は集約 ID と VO のみ、ユースケース間呼出禁止、業務判断はドメインに置く、I/O はポート経由のみ、と定めるが、fragment は「transactional consistency boundary, idempotency, ordering, failure and compensation, observability」を 5 点と呼ぶ。整合性境界の強弱、再実行可能性の設計手順（store は upsert、同値更新の許容、コマンド ID 記憶、作成系のゴミ集約の許容）、集約境界の引き直しの促し、ナレッジ参照も無い。なお要件の 5 点のうち「execute の引数」と「ユースケース間呼出禁止」は code-generation Step 1x に実装規約として現れるが、FR4.2 が求める functional-design の手順ではない。
7. **infrastructure-design Step 2x にポート規約と永続化・RMU の手順の一部が無い（追加、FR5.2 / FR5.3 → Gap）。** 媒体名の禁止、in-memory 実装から始めること、クエリ側は DAO＋DTO（FR5.2）、基盤選定基準と RMU の順序・冪等性（FR5.3）が本文に無い。
8. **BR6.1 の `model_ref` 既定パスは仕様本文が古い（追加、実装は正）。** 実装は `inception/ddd-domain-modeling/domain-model.yaml` で、U6 の slug、U4 / U5 の読み取りパスと一致する。仕様側の追随が必要。
9. **BR1.5 の yaml 15 行目安を infrastructure-design Step 5x の 17 行が超える（追加、軽微）。**
10. **BR2.3 のナレッジ参照とクラスベース側の影響が無い（追加、軽微）。**
11. **BR3.4 の advisory 案内が無い（追加）。** 複数集約の検出が進行を止めないことを fragment が述べていない。
12. **BR4.1 / BR6.3 の `layer_structures: []` の指示が無い（追加）。** 対象のない Unit での書き方が infrastructure-design にだけ欠けている。
13. **BR5.2 / BR5.3 の I/O クレート固定一覧、rule_id の意味、正規モデル無しの省略、ナレッジ参照が無い（追加）。**
14. **BR6.1 の人間向け表の併記が functional-design / infrastructure-design に無い（追加、軽微）。**

追加の乖離 6〜14 のうち要件の未達にあたるのは 6 と 7 で、traceability では FR4.2 / FR5.2 / FR5.3 を Gap とした。8〜14 は BR（仕様の規則）レベルの差で、要件の判定条件には直接触れないため注記にとどめた。修正は本 Unit の後続反復（fragment の追記のみで済み、frontmatter と anchor は変えない）で対応できる。

### Step 11 — レビュー所見 R-01・R-02 の記録と引き取り先（2026-09-12）

前回レビューの未解決 2 件はいずれも**本 Unit の所有外**にある。
原因を実測で特定し、引き取り先を明示する。**アプリケーションソースには一切触れていない。**

#### 乖離 15（R-01・Minor）: `reviewer-scope` フックの字面判定がアンカーされていない — **引き取り先はフレームワーク**

前回のレビュアーが `ddd/contributions/construction/functional-design.md` と
`ddd/contributions/construction/infrastructure-design.md` を読もうとして拒否された件。
原因を `.claude/hooks/aidlc-reviewer-scope.ts` で特定した。

`judgeLexicalPath`（313-322 行）は `construction` という名前の**パス要素を位置に関係なく**探し、
見つかった位置以降を `judgeOccurrence`（228-239 行）に渡す。`judgeOccurrence` は
次の要素が担当 Unit でなければ拒否する（237 行の `fold(seg) === unitFolded` が偽なら
exempt に無い限り `true` = 拒否）。したがって

```
ddd/contributions/construction/functional-design.md
                  ^^^^^^^^^^^^ ここで一致 → 次の要素 "functional-design.md" ≠ "u7-core-contributions" → 拒否
```

となり、記録の `<record>/construction/<unit>/` とは**無関係なパス**まで巻き込まれる。

同じファイルの `judgeResolvedPath`（324 行〜）は `scope.constructionRoot`
（= `<record>/construction`、287 行で解決）に正しくアンカーされている。
**字面判定だけがアンカーを欠いている。**

- **本 Unit の成果物の欠陥ではない。** `.claude/hooks/` はフレームワークのファイルで、
  DDD プラグイン（`ddd/`）にも本 Unit の `source-manifest.json`（4 パス）にも含まれない。
- **回避手段は無い。** `ddd/dist/{claude,codex}/contributions/construction/...` への投影パスも
  同じ要素を含むため同様に拒否される。
- **引き取り先はフレームワーク側の修正**であり、本ワークフローの範囲外である。
  影響は `contributions/construction/` というレイアウトを持つ任意のプラグインリポジトリに及ぶ。

#### 乖離 16（R-02・Minor）: `CHANGELOG.md` の文言が実装の非対称性と食い違う — **引き取り先は U9**

`ddd/CHANGELOG.md:43-46` は次のように複数形で一般化する。

> The design contributions deliberately bind sensors and instructions without
> adding a `produces` artifact, because a contributed artifact is applicable to
> every unit kind and would make a core stage with a kind-pruned
> `review_artifact` fail its schema check.

実測では `produces` を持つのは **4 本中 1 本**である。

| contribution | `produces` |
|---|---|
| `contributions/inception/domain-design.md:8` | **あり**（`ddd-aggregate-mapping`） |
| `contributions/construction/functional-design.md` | なし |
| `contributions/construction/infrastructure-design.md` | なし |
| `contributions/construction/code-generation.md` | なし |

同じ文書の 17-18 行は `domain-design` について
「consumes the canonical model, produces the aggregate mapping」と正しく書いており、
**同一文書内で読み方が割れる**。43 行の「design contributions」が
`functional-design` と `infrastructure-design` の 2 本だけを指すのか、
`domain-design` を含む全体を指すのかが文面から決まらない。

- **`ddd/CHANGELOG.md` は U9 所有である。** `u9-release-quality` の
  `source-manifest.json` に含まれ、本 Unit の 4 パスには含まれない。
- **引き取り先は U9**。本 Unit は contribution 側の実態（1 本のみ `produces` を持つ）が
  正しいことを実測で確認した。
- **4 本の contribution 自体に欠陥は無い。** 非対称性は意図されたもので、その理由は
  `CHANGELOG.md:44-46` が正しく説明している。是正すべきは 43 行の主語の曖昧さだけである。

## 完了条件の確認

- 本 Unit が所有するアプリケーションソース 4 本は `source-manifest.json` に列挙し、いずれもワークスペース根から実在する。
- `traceability.json` の 15 件はすべて `target` に実在するワークスペース相対パスを持つ（OK 11、Gap 3、Deferred 1。Gap / Deferred には `note` を付した）。
- Step 1・3・5・7 は既存実装に対する改変を行っていない。本作業の作成物は記録 3 ファイルと `code-generation-plan.md` のチェックボックス更新のみである。
  Step 11 も記録のみで、アプリケーションソースを 1 行も変更していない。
- 検証で見つかった乖離は上記 16 点としてすべて記録した（計画時 5 件、追加 9 件、レビュー所見 2 件）。
- **レビュー所見 R-01 の原因を `.claude/hooks/aidlc-reviewer-scope.ts` の `judgeLexicalPath`
  （313-322 行）のアンカー欠如として特定し、乖離 15 に記録した。** 本 Unit の成果物の欠陥では
  なく、引き取り先はフレームワーク側である。
- **レビュー所見 R-02 について、`produces` を持つ contribution が 4 本中 1 本であることを実測し、
  乖離 16 に記録した。** `ddd/CHANGELOG.md` は U9 所有のため、**引き取り先は U9** である。
