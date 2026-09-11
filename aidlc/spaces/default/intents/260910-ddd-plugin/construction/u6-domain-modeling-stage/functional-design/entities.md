# エンティティモデル — U6 domain-modeling ステージ（u6-domain-modeling-stage）

## Sources

- `inception/units-generation/unit-of-work.md`（U6 = DomainModelingStage。kind: spec。`stages/inception/domain-modeling.md` の frontmatter と手順本文、単独実行と入力なし対話の手順。Aggregate 境界までを所有する）
- `inception/units-generation/unit-of-work-story-map.md`（U6 の要件: FR1、FR1.1〜FR1.9。横断: FR1.7 の YAML スキーマは U1、FR1.8 の検査実体は U4）
- `inception/requirements-analysis/requirements.md`（FR1 各要件、FR2.3〜FR2.5、FR2.7、FR6.5）
- `inception/domain-design/components.md`（DomainModelingStage の振る舞い、依存先 DomainModelSchema / DesignSensorSuite / DddKnowledgePack）
- `inception/domain-design/decisions.md`（ADR-004、ADR-006、ADR-007、ADR-010）
- `construction/u6-domain-modeling-stage/functional-design/functional-design-questions.md`（Q1 グラフ上の位置、Q2 非 ASCII の ID、Q3 brownfield の入力、Q4 言語）
- U1 の設計 `construction/u1-sensor-foundation/functional-design/entities.md`（DomainModel / BoundedContext / Aggregate / DomainElement / Invariant / Command / IdempotencyPolicy / DomainEvent / DomainError / StateTransition / FactoryRule / ProcessManager / ElementLineage、ElementId の文法）
- U4 の設計 `construction/u4-design-sensors/functional-design/rules.md`（BR2 model-completeness、Q2 md 側の約束）
- U8 の設計 `construction/u8-knowledge-pack/functional-design/functional-spec.md`（リードが読むナレッジの一覧）
- コアのステージ定義プロトコル `.claude/aidlc-common/protocols/stage-definition.md`（frontmatter の項目と本文の区画）
- `ddd/docs/domain-layer-design.md` §2〜§5

本書は U6 が所有する「ステージ定義という文書」の構造の定義である。U6 は実行時の振る舞いを持たない spec Unit なので、エンティティは (1) ステージ定義ファイルの frontmatter と本文の構成、(2) ステージが対話で集める事項（質問ファイルの構造）、(3) ステージが生成する成果物 `domain-model.md` の構成、の 3 群からなる。`domain-model.yaml` の構造は U1 の DomainModel をそのまま使い、本書では再定義しない。

## エンティティ定義（正）

```yaml
entities:
  # ---------- (1) ステージ定義ファイル ----------
  - name: StageDefinition
    description: stages/inception/domain-modeling.md の frontmatter。値は確定済み（FR1.1〜FR1.4、ADR-007、Q1、Q3）
    attributes:
      - { name: slug, type: string, required: true, default: domain-modeling, constraints: "ファイル名の stem と一致" }
      - { name: plugin, type: string, required: true, default: ddd }
      - { name: phase, type: enum, allowed: [inception], required: true }
      - { name: execution, type: enum, allowed: [CONDITIONAL], required: true }
      - { name: condition, type: string, required: true, constraints: "Execute when the work introduces or changes domain concepts (aggregates, invariants, commands, events). Skip when no domain concept changes (pure infrastructure or tooling work)" }
      - { name: lead_agent, type: string, required: true, default: aidlc-architect-agent, constraints: "コアのエージェント。独自エージェントは作らない（ADR-007）" }
      - { name: support_agents, type: list<string>, required: true, default: "[aidlc-product-agent]", constraints: "ユビキタス言語とストーリーの読み手として product を支援に置く。inline なので追加のディスパッチ面は生まれない" }
      - { name: mode, type: enum, allowed: [inline], required: true }
      - { name: summary_confirmation, type: enum, allowed: [required], required: true }
      - { name: reviewer, type: string, required: true, default: aidlc-architecture-reviewer-agent }
      - { name: review_artifact, type: string, required: true, default: ddd-domain-model, constraints: "produces の必須 Markdown 成果物（domain-model.md）" }
      - { name: review_class, type: enum, allowed: [advisory], required: true }
      - { name: reviewer_max_iterations, type: integer, required: true, default: 1 }
      - { name: produces, type: list<string>, required: true, default: "[ddd-domain-model, ddd-domain-model-yaml]", constraints: "論理名は ddd- 接頭辞（FR1.7、CON12）。ファイルは domain-model.md と domain-model.yaml" }
      - { name: consumes, type: list<ConsumeEntry>, required: true, constraints: "requirements（required: false）、stories（required: false）、architecture と component-inventory（required: false、conditional_on: brownfield。Q3）。すべて任意なので単独実行できる（FR1.5）" }
      - { name: requires_stage, type: list<string>, required: true, default: "[requirements-analysis, user-stories]", constraints: "Q1。requirements-analysis を含む（FR1.2）。user-stories は SKIP のスコープでも順序辺として機能する" }
      - { name: scopes, type: list<string>, required: true, default: "[enterprise, feature, mvp, classic, workshop, refactor]", constraints: "FR1.4 の 6 つ。plugin-dev / express / poc / bugfix / infra / security-patch では SKIP" }
      - { name: sensors, type: list<string>, required: true, default: "[ddd-model-completeness]", constraints: "U4 の blocking マニフェスト。機械完了条件 (i)〜(v) と (f) を検査する" }
      - { name: inputs, type: string, required: true, constraints: "人間向けの入力説明（英語）" }
      - { name: outputs, type: string, required: true, constraints: "人間向けの出力説明（英語）。記録ディレクトリのルートは書かない（engine-resolved）" }
    relationships:
      - { target: ConsumeEntry, cardinality: "1..*", direction: contains }
      - { target: StageBody, cardinality: "1", direction: contains }

  - name: ConsumeEntry
    description: consumes の 1 行
    attributes:
      - { name: artifact, type: string, required: true, allowed: [requirements, stories, architecture, component-inventory] }
      - { name: required, type: boolean, required: true, default: false }
      - { name: conditional_on, type: enum, allowed: [brownfield], required: false, constraints: "architecture と component-inventory だけ" }

  - name: StageBody
    description: ステージ定義の本文。## Steps（必須）、## Sensors、## Learn の 3 区画（stage-definition.md）。本文は英語（Q4）
    attributes:
      - { name: language, type: enum, allowed: [en], required: true, constraints: "Q4。質問ファイルと成果物は会話言語" }
      - { name: constraints_section, type: string, required: true, constraints: "所有権の境界（FR1.9）と「コードを書かない」制約を冒頭に置く" }
      - { name: steps, type: list<StageStep>, required: true, constraints: "functional-spec.md §2 の 7 ステップ" }
      - { name: sensors_section, type: string, required: true, constraints: "ddd-model-completeness の検査内容と、失敗時に何を直すかの案内" }
      - { name: learn_section, type: string, required: true, constraints: "コアの stage-protocol §13 への委譲" }
    relationships:
      - { target: StageStep, cardinality: "1..*", direction: contains }

  - name: StageStep
    description: 手順 1 ステップ
    attributes:
      - { name: number, type: integer, required: true, min: 1 }
      - { name: title, type: string, required: true }
      - { name: mode_applicability, type: list<enum>, allowed: [with-input, standalone, rerun], required: true, constraints: "with-input = ストーリー等がある、standalone = 入力なし対話（FR1.5）、rerun = 既存の domain-model.yaml がある" }
      - { name: reads, type: list<string>, required: true, default: "[]", constraints: "読む成果物・ナレッジのパス（記録ディレクトリ相対、engine-resolved）" }
      - { name: writes, type: list<string>, required: true, default: "[]" }

  # ---------- (2) 対話で集める事項（domain-modeling-questions.md） ----------
  - name: QuestionTopic
    description: 質問ファイルのトピック。Standard 深度で 5〜8 問、standalone では語彙の引き出しに 2〜3 問を足す
    attributes:
      - { name: topic_id, type: string, required: true, unique: true, allowed: [bounded-contexts, domain-events, aggregate-candidates, invariants, commands-and-errors, states-and-transitions, idempotency-effect, id-slugs, process-managers, vocabulary] }
      - { name: purpose, type: string, required: true }
      - { name: source_material, type: list<string>, required: true, constraints: "stories / requirements / architecture / component-inventory / dialogue" }
      - { name: feeds, type: list<string>, required: true, constraints: "回答が決める domain-model.yaml の要素（BoundedContext、Aggregate、Invariant、Command、DomainError、StateTransition、IdempotencyPolicy、ProcessManager、ElementId）" }
      - { name: mandatory, type: boolean, required: true, constraints: "aggregate-candidates、invariants、commands-and-errors、id-slugs（非 ASCII の用語があるとき）は常に問う" }

  - name: DerivationTrace
    description: イベント逆算の記録（FR1.6）。ストーリー（または対話）→ ドメインイベント → Command → 集約候補 の 1 本の筋
    attributes:
      - { name: story_ref, type: string, required: true, constraints: "US<n>.<m> または対話の発話番号 D<n>" }
      - { name: event_name, type: string, required: true, constraints: "過去形の事実（例: 請求書が発行された / InvoiceIssued）" }
      - { name: command_name, type: string, required: true, constraints: "イベントを起こす操作（命令形）" }
      - { name: actor, type: string, required: true }
      - { name: aggregate_candidate, type: string, required: true, constraints: "イベントが変える状態を持つ主体の候補名" }
      - { name: invariant_hint, type: string, required: false, constraints: "その操作が守るべき条件の仮説" }

  - name: AggregateCandidate
    description: 集約候補 1 つ。質問で確定させ、確定後に Aggregate として yaml に書く
    attributes:
      - { name: name, type: string, required: true, constraints: "ユビキタス言語の用語（元の言語）" }
      - { name: id_proposal, type: IdProposal, required: true }
      - { name: bounded_context, type: string, required: true }
      - { name: events, type: list<string>, required: true, constraints: "この候補に集まった DerivationTrace の event_name" }
      - { name: status, type: enum, allowed: [proposed, confirmed, merged, split, rejected], required: true, constraints: "merged / split は質問の回答で他の候補と統合・分割された（rerun では ElementLineage に記録）" }
      - { name: rationale, type: string, required: true, constraints: "候補にした根拠（不変条件の所在）" }
    relationships:
      - { target: DerivationTrace, cardinality: "1..*", direction: derived-from }
      - { target: IdProposal, cardinality: "1", direction: has }

  - name: IdProposal
    description: 安定 ID の名前セグメントの提案と確定（Q2）。非 ASCII の用語では人間の確認を必須にする
    attributes:
      - { name: element_kind, type: enum, allowed: [bc, aggregate, entity, vo, primitive, invariant, command, event, error, transition, factory, pm], required: true }
      - { name: display_name, type: string, required: true, constraints: "name 属性に入る元の言語の用語" }
      - { name: proposed_slug, type: string, required: true, constraints: "ステージが提案する英語の小文字ケバブ（U1 BR1.1 の文法）" }
      - { name: confirmed_slug, type: string, required: false, constraints: "人間が承認または修正した値。display_name が ASCII のときは proposed_slug と同じで確認を省略できる" }
      - { name: needs_confirmation, type: boolean, required: true, constraints: "display_name に非 ASCII を含むとき true" }

  # ---------- (3) 成果物 domain-model.md の構成 ----------
  - name: DomainModelDocument
    description: domain-model.md の構成。yaml を正とし、md は U4 Q2 の約束（見出しまたは表に element_id、不変条件の statement 全文）を守る
    attributes:
      - { name: language, type: string, required: true, constraints: "会話言語" }
      - { name: sections, type: list<DocumentSection>, required: true, constraints: "functional-spec.md §5 の順" }
      - { name: model_ref, type: string, required: true, default: "domain-model.yaml", constraints: "同じディレクトリの yaml" }
    relationships:
      - { target: DocumentSection, cardinality: "1..*", direction: contains }

  - name: DocumentSection
    description: md の 1 節
    attributes:
      - { name: heading, type: string, required: true, constraints: "要素の節は「<name>（<element_id>）」の形で element_id を見出しに含める" }
      - { name: kind, type: enum, allowed: [sources, overview, bounded-context, aggregate, process-manager, lineage, derivation, open-questions], required: true }
      - { name: tables, type: list<string>, required: true, default: "[]", constraints: "aggregate 節は Elements / Invariants / Commands / Events / Errors / Transitions の表を持ち、各行に element_id を書く。Invariants の Statement 列は yaml の statement 全文" }
      - { name: diagram, type: string, required: false, constraints: "aggregate 節は transitions が 1 件以上あれば mermaid stateDiagram-v2 とテキスト代替を持つ（派生ビュー）" }
```

## 要約

- **ステージ定義**: `StageDefinition` の値は FR1.1〜FR1.4・ADR-007・Q1・Q3 で確定しており、本文（`StageBody`）は英語で、Constraints → Steps（7 ステップ）→ Sensors → Learn の順に置く。`consumes` はすべて任意なので `--stage domain-modeling --single` で単独実行できる（FR1.5）。
- **対話で集める事項**: `QuestionTopic` の 10 トピックのうち集約候補・不変条件・Command と Domain Error・ID スラッグ（非 ASCII 時）は常に問う。`DerivationTrace` はイベント逆算（FR1.6）の記録で、`AggregateCandidate` に集約され、`IdProposal` で安定 ID の名前を確定する（Q2）。
- **成果物**: `domain-model.yaml` は U1 の DomainModel をそのまま書く。`DomainModelDocument` は yaml から派生する人間向けの文書で、見出しと表に element_id を、不変条件の statement を全文で書く（U4 Q2）。モジュール・デプロイ単位・ユースケース手順は書かない（FR1.9）。
- `components.md` からの差分: DomainModelingStage は entities を持たない宣言だったが、ステージ定義・質問・成果物の構造を設計上の型として追加した。
