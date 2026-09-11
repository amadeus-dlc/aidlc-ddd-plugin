# 業務ルール — U6 domain-modeling ステージ（u6-domain-modeling-stage）

## Sources

- `inception/units-generation/unit-of-work.md`（U6 の境界: Aggregate 境界までを所有し、モジュール・デプロイ単位・ユースケース手順は所有しない。独自エージェントを作らない。compose 後の drops ログが空であることは U9 が確認）
- `inception/units-generation/unit-of-work-story-map.md`（U6 の要件: FR1、FR1.1〜FR1.9。先に固める要件は FR1.1〜FR1.4）
- `inception/requirements-analysis/requirements.md`（各規則の出典。FR2.3〜FR2.5、FR2.7、FR6.5、FR10.3、CON6、CON12）
- `inception/domain-design/components.md`（DomainModelingStage）と `decisions.md`（ADR-004、ADR-006、ADR-007、ADR-010）
- `construction/u6-domain-modeling-stage/functional-design/functional-design-questions.md`（Q1〜Q4）
- `construction/u6-domain-modeling-stage/functional-design/entities.md`（型の定義）
- U1 の設計 `construction/u1-sensor-foundation/functional-design/rules.md`（BR1 ID 文法、BR2 系譜、BR3 構造、BR4 冪等性、BR5 Process Manager）
- U4 の設計 `construction/u4-design-sensors/functional-design/rules.md`（BR2 model-completeness の rule_id、Q2 md 側の約束）
- U8 の設計 `construction/u8-knowledge-pack/functional-design/functional-spec.md`（ナレッジ 8 本のパスと consumers）
- `ddd/docs/domain-layer-design.md` §2〜§5・§9、コアの `stage-definition.md` / `stage-protocol.md`

U6 の規則は「ステージ定義をどう書くか」と「ステージが実行されたときリードが従う手順の制約」の 2 群である。実行時の検査は U4 の `ddd-model-completeness` が、正規モデルの構造は U1 が担い、本 Unit はそれらを手順から参照する。

## ルール定義（正）

```yaml
rules:
  # ---------- BR1: frontmatter（FR1.1〜FR1.4、ADR-007、Q1、Q3） ----------
  - id: BR1.1
    statement: ステージ定義は stages/inception/domain-modeling.md に置き、frontmatter は entities.md の StageDefinition の値をそのまま書く
    category: constraint
    applies_to: StageDefinition
    trigger: ステージ定義の作成時
    logic: slug = domain-modeling、plugin = ddd、phase = inception、execution = CONDITIONAL、lead_agent = aidlc-architect-agent、support_agents = [aidlc-product-agent]、mode = inline、summary_confirmation = required、reviewer = aidlc-architecture-reviewer-agent、review_artifact = ddd-domain-model、review_class = advisory、reviewer_max_iterations = 1
    violation: compose がステージを拒否する、または drops ログに落ちる（FR1.1 の判定）
    source: FR1.1、FR1.3、ADR-007、domain-design Q8
  - id: BR1.2
    statement: requires_stage は [requirements-analysis, user-stories] とし、adds.requires_stage や when: 述語には依存しない
    category: constraint
    applies_to: StageDefinition
    trigger: ステージ定義の作成時
    logic: requirements-analysis を含む（FR1.2）。user-stories を足すのはユーザーストーリーがあれば必ず読める位置に置くため（Q1）。domain-design 側の順序強制は U7 の adds.consumes と U4 の model-presence が担う
    violation: compose の drops ログに requires_stage 関連の drop が出る
    source: FR1.2、Q1、CON2、CON8
  - id: BR1.3
    statement: scopes は enterprise / feature / mvp / classic / workshop / refactor の 6 つだけを列挙する
    category: constraint
    applies_to: StageDefinition
    trigger: ステージ定義の作成時
    logic: 列挙にないスコープでは SKIP になり、model-presence（U4）は SKIP を読んで pass にする（ADR-004）
    violation: scope-grid.json で 6 スコープ以外が EXECUTE になる
    source: FR1.4、RA-Q4
  - id: BR1.4
    statement: produces は ddd-domain-model と ddd-domain-model-yaml の 2 つだけとし、sensors は ddd-model-completeness だけとする
    category: constraint
    applies_to: StageDefinition
    trigger: ステージ定義の作成時
    logic: 論理名は ddd- 接頭辞（CON12）。traceability 等のコア名は使わない。sensors の ID は U4 のマニフェスト ID と一致させる
    violation: compile が論理名を拒否する、またはセンサーが束ねられない
    source: FR1.7、FR11.2、U4 BR1.2
  - id: BR1.5
    statement: consumes は requirements、stories、architecture、component-inventory をすべて required: false で列挙し、後者 2 つは conditional_on: brownfield とする
    category: constraint
    applies_to: ConsumeEntry
    trigger: ステージ定義の作成時
    logic: 必須入力を持たないことで --stage domain-modeling --single の単独実行を可能にする（FR1.5）。brownfield の逆解析成果物は照合材料（Q3）
    violation: 入力なしの単独実行で入力欠落として止まる
    source: FR1.5、Q3

  # ---------- BR2: 実行モードと入力（FR1.5、Q3） ----------
  - id: BR2.1
    statement: 手順は with-input（ストーリー・要件がある）、standalone（入力なし）、rerun（domain-model.yaml が既にある）の 3 モードを Step 1 で判定し、以降のステップに mode_applicability で分岐を書く
    category: policy
    applies_to: StageStep
    trigger: Step 1
    logic: stories.md があれば with-input、無ければ requirements.md だけでも with-input、どちらも無ければ standalone。<record>/inception/domain-modeling/domain-model.yaml があれば rerun を重ねて適用する
    violation: なし
    source: FR1.5、FR2.3
  - id: BR2.2
    statement: standalone ではドメインの語彙を引き出す質問（vocabulary トピック: 業務の主体、扱う「もの」、起きる出来事、守るべき約束）を質問ファイルの先頭に置き、その回答から DerivationTrace を作る
    category: policy
    applies_to: QuestionTopic
    trigger: Step 2（standalone）
    logic: 語彙の質問は自由記述を許す（X. Other を主経路にする）。回答を D<n> として DerivationTrace.story_ref に使う
    violation: 入力なしで質問ファイルが生成されない（FR1.5 の判定に失敗）
    source: FR1.5、domain-layer-design §2
  - id: BR2.3
    statement: brownfield では architecture.md と component-inventory.md を「既存コードにどんな主体があるか」の照合材料としてだけ読み、集約候補の導出はイベント逆算を正とする
    category: policy
    applies_to: StageStep
    trigger: Step 3（brownfield）
    logic: 既存コードにあって候補に無い主体は open-questions 節に列挙し、質問で確認する。既存コードの型をそのまま Aggregate にしない
    violation: なし
    source: Q3、ADR-010（#2 大きめの集約から始めない）

  # ---------- BR3: イベント逆算の導出手順（FR1.6、ADR-010） ----------
  - id: BR3.1
    statement: 集約候補は、ストーリー（または対話）から過去形のドメインイベントを列挙し、各イベントを起こす Command と主体を特定し、同じ状態を変えるイベント群を 1 つの候補に集める順で導く
    category: policy
    applies_to: DerivationTrace
    trigger: Step 3
    logic: イベント → Command → 集約候補 の順を崩さない。先に型や既存テーブルから集約を起こさない（ADR-010 #2）。CQRS/ES ではイベントがそのまま実装に写り、ステートソーシングでは分析だけに使う（domain-layer-design §2）
    violation: レビュー（advisory）と人間承認で検出
    source: FR1.6、domain-layer-design §2、ADR-010
  - id: BR3.2
    statement: 集約候補ごとに不変条件の仮説を 1 つ以上書き、不変条件を持てない候補は他の候補に統合するか Value Object / Entity に格下げする
    category: constraint
    applies_to: AggregateCandidate
    trigger: Step 3〜4
    logic: 機械完了条件 (i)（全 Aggregate に不変条件が 1 つ以上）を形式的に満たすのではなく、不変条件の所在で境界を決める（集約＝FSM）。統合・格下げは質問で確認する
    violation: model-completeness.i（U4）で止まる
    source: FR1.8 (i)、domain-layer-design §3・§9
  - id: BR3.3
    statement: 複数の集約に跨がる流れは Process Manager の候補として質問し、正規モデルに書くかどうかを人間が決める（必須化はしない）
    category: policy
    applies_to: QuestionTopic
    trigger: Step 4
    logic: 跨がる流れを見つけたら、まず集約境界の引き直し（中間状態のモデル化）を提案し、それでも跨がるなら ProcessManager（aggregates 2 件以上、steps、compensations）を候補にする。アクターモデル時の必須化は domain-design（U4 の mapping-declarations）が担う
    violation: なし
    source: FR2.6、use-case-layer-design §4、U1 BR5.1
  - id: BR3.4
    statement: 各 Command には effect（transition / accumulation）、state_effect（transitions / none）、Domain Error 1 件以上、idempotency を質問で確定させる
    category: constraint
    applies_to: QuestionTopic
    trigger: Step 4
    logic: 加算・追加系は accumulation とし、そのとき strategy は command-id-memory（U1 BR4.2）。遷移なしの Command は state_effect = none を明示する（機械完了条件 (ii)）。失敗条件が思いつかない Command は「業務操作か」を問い直す
    violation: schema.command-no-error / completeness.ii / idempotency.j（U1、U4）で止まる
    source: FR1.8 (ii)(iii)、FR2.2、FR2.5

  # ---------- BR4: ID と系譜（FR2.3、FR2.4、Q2） ----------
  - id: BR4.1
    statement: element_id は U1 BR1.1〜BR1.3 の文法に従い、名前セグメントは英語の小文字ケバブとする。表示名（name）には元の言語の用語を残す
    category: validation
    applies_to: IdProposal
    trigger: Step 4
    logic: ステージが proposed_slug を提示する。display_name に非 ASCII を含むときは needs_confirmation = true とし、id-slugs トピックで人間に承認・修正を求める（Q2）。ASCII の用語は確認を省略してよい
    violation: schema.id-grammar（U1）で止まる
    source: FR2.3、Q2、U1 Q1
  - id: BR4.2
    statement: rerun では既存の domain-model.yaml の element_id を維持し、rename は name だけを変え、split / merge / 廃止は lineage に記録する
    category: constraint
    applies_to: AggregateCandidate
    trigger: Step 1（rerun）〜 Step 5
    logic: Step 1 で既存 yaml を U1 の形式で読み、候補の status が merged / split / rejected になったものは ElementLineage（relation、successors / replaced_by、deprecated_at）を書く。廃止 ID を再利用しない
    violation: lineage.* / schema.id-reused（U1）で止まる
    source: FR2.4、domain-layer-design §5、U1 BR2
  - id: BR4.3
    statement: 質問ファイルには DerivationTrace と AggregateCandidate（id_proposal を含む）を表として残し、承認後に yaml へ写す
    category: policy
    applies_to: QuestionTopic
    trigger: Step 3〜5
    logic: 導出の筋（どのストーリーからどのイベント、どの候補へ）は質問ファイルの derivation 表が正で、md の derivation 節はその転記
    violation: なし
    source: FR1.6、stage-protocol §3（質問ファイルが正）

  # ---------- BR5: 成果物（FR1.7、FR2.7、FR1.9、U4 Q2） ----------
  - id: BR5.1
    statement: domain-model.yaml は U1 の DomainModel の形（schema_version 1、bounded_contexts、lineage）で書き、これを正とする
    category: constraint
    applies_to: DomainModelDocument
    trigger: Step 5
    logic: 包含は yaml の入れ子、参照は ElementId 文字列。U1 の BR3.9 が拒否する未知キー（module、crate、deployment、use_case など）を書かない
    violation: schema.* / schema.unknown-key（U1）で止まる
    source: FR1.7、FR2.1、FR2.7、FR1.9
  - id: BR5.2
    statement: domain-model.md は yaml から派生させ、要素の見出しまたは表に element_id を書き、Invariant の statement を全文で転記する
    category: constraint
    applies_to: DocumentSection
    trigger: Step 5
    logic: 見出しは「<name>（<element_id>）」。aggregate 節の各表の行に element_id を書く。yaml に無い ID を md に書かない（廃止 ID も書かない）。transitions がある Aggregate には stateDiagram-v2 とテキスト代替を置く
    violation: model-completeness.f-missing / f-unknown / f-invariant（U4）で止まる
    source: FR1.8 (v)、FR6.2、U4 Q2、U4 BR2.4
  - id: BR5.3
    statement: 成果物にはモジュール構成、クレート名、デプロイ単位、永続化方式、プログラミングモデル、ユースケースの手順を書かない
    category: constraint
    applies_to: DomainModelDocument
    trigger: Step 5
    logic: それらは domain-design（写像と 2 軸宣言）と functional-design（ユースケース）が所有する。md の overview 節に責務分担の一文を置く
    violation: schema.unknown-key（yaml）、レビュー（md）
    source: FR1.9、domain-layer-design §2
  - id: BR5.4
    statement: 成果物と質問ファイルは会話言語で書き、ステージ定義の本文は英語で書く
    category: policy
    applies_to: StageBody
    trigger: 常時
    logic: Q4。preserved token（[Answer]:、element_id、YAML キー、mermaid キーワード）はそのまま
    violation: なし
    source: Q4、org.md Mandated（会話言語）

  # ---------- BR6: 完了条件（FR1.8、FR6.5、ADR-007） ----------
  - id: BR6.1
    statement: 成果物を書いた後、レビュー前に (i)〜(v) の自己点検表を手順に含め、md の末尾に点検結果を残す
    category: policy
    applies_to: StageStep
    trigger: Step 6
    logic: (i) 全 Aggregate に invariants 1 件以上、(ii) 全 Command に state_effect と transitions の整合、(iii) 全 Command に domain_errors 1 件以上、(iv) 全参照 ID が本文に存在、(v) md の ID と statement が yaml と一致。人間が読める点検表であり、機械検査は U4 のセンサーが行う
    violation: なし（センサーが止める）
    source: FR1.8、FR6.5
  - id: BR6.2
    statement: 機械完了条件 (i)〜(v) は ddd-model-completeness（blocking、fire_on gate）が検査し、失敗時はステージ本文の Sensors 節が「どの rule_id が何を意味し、yaml / md のどこを直すか」を案内する
    category: policy
    applies_to: StageBody
    trigger: ゲート前
    logic: rule_id は U4 の model-completeness.schema / .i / .ii / .iv / .f-* 。override はエンジンの監査付き経路のみ（CON9）
    violation: なし
    source: FR1.8、FR6.5、U4 BR2
  - id: BR6.3
    statement: レビューはコアの architecture-reviewer を advisory で 1 回だけ実行し、所見は人間承認 (vi) の材料にする
    category: policy
    applies_to: StageDefinition
    trigger: ゲート前
    logic: review_class = advisory、reviewer_max_iterations = 1。修正ループは回さない
    violation: なし
    source: FR1.8 (vi)、ADR-007、domain-design Q8

  # ---------- BR7: ナレッジと運用（FR10.3、ADR-006、CON6） ----------
  - id: BR7.1
    statement: Step 1 でリードが読むナレッジは U8 の ddd-always-valid-model.md と ddd-aggregate-and-invariants.md（architect 配下）と ddd-layer-boundaries.md（shared）とし、手順本文はそれらを名指しで参照する
    category: policy
    applies_to: StageStep
    trigger: Step 1
    logic: ナレッジは compose が inline_context_paths に載せるため明示の読み込みは不要だが、手順は「参照すべき節」を示す。コアの ddd-patterns.md との矛盾 4 件（ADR-010）はナレッジ側の一覧に従う
    violation: なし
    source: FR10.3、ADR-006、ADR-010
  - id: BR7.2
    statement: ステージ本文はコードを書かない。例示は yaml の断片（≤15 行）と ID の例に限る
    category: constraint
    applies_to: StageBody
    trigger: 常時
    logic: 正規モデルは設計成果物であり、コード生成は code-generation の責務
    violation: レビューで検出
    source: functional-design ステージの制約、domain-layer-design §2
```

## ルール要約

| ID | 分類 | 要点 | 出典 |
|---|---|---|---|
| BR1.1〜BR1.5 | frontmatter | 確定値、requires_stage、scopes 6 つ、produces / sensors、consumes は任意 | FR1.1〜FR1.5、FR1.7、Q1、Q3 |
| BR2.1〜BR2.3 | モード | with-input / standalone / rerun、語彙の質問、brownfield は照合材料 | FR1.5、Q3 |
| BR3.1〜BR3.4 | 導出 | イベント逆算の順、不変条件で境界、Process Manager 候補、Command の属性 | FR1.6、FR1.8、FR2.5、FR2.6 |
| BR4.1〜BR4.3 | ID | 英語スラッグと確認、rerun の系譜、導出の記録 | FR2.3、FR2.4、Q2 |
| BR5.1〜BR5.4 | 成果物 | yaml が正、md の約束、所有権の境界、言語 | FR1.7、FR1.9、FR2.7、Q4 |
| BR6.1〜BR6.3 | 完了 | 自己点検、センサーの案内、advisory レビュー | FR1.8、FR6.5、ADR-007 |
| BR7.1〜BR7.2 | ナレッジ・制約 | 読むナレッジ、コードを書かない | FR10.3、ADR-006 |
