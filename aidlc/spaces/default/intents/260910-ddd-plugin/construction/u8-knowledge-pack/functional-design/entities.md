# エンティティモデル — U8 ナレッジ（u8-knowledge-pack）

## Sources

- `inception/units-generation/unit-of-work.md`（U8 = DddKnowledgePack。kind: spec。U1・U2・U3 に依存し、U6 と U9 が依存する）
- `inception/units-generation/unit-of-work-story-map.md`（U8 の要件: FR10、FR10.1〜FR10.6。横断: FR10.4 の一覧は ADR-010 が出典）
- `inception/requirements-analysis/requirements.md`（FR10.1 基盤トピック、FR10.2 Rust トピック、FR10.3 配置、FR10.4 命名と矛盾、FR10.5 メタ規律、FR10.6 ナレッジだけに任せない）
- `inception/domain-design/components.md`（DddKnowledgePack の振る舞い: 役割別配置、`ddd-` 接頭辞、矛盾一覧の転記、メタ規律）
- `inception/domain-design/decisions.md`（ADR-006 役割別配置、ADR-010 矛盾 4 件）
- `construction/u8-knowledge-pack/functional-design/functional-design-questions.md`（Q1 英語、Q2 主題ごとに 8 本、Q3 ゴールデンケースを索引）
- コアのナレッジ `.claude/knowledge/`（既存ファイル名との衝突確認の対象）

U8 は Markdown 文書の集合であり、実行時の型を持たない。本書の「エンティティ」は、文書集合の構造（どのファイルが、どの節を、どの出典と強制手段で持つか）を機械的に検証できる形にしたものである。U9 の統合テストと U6 のステージ手順がこの構造を参照する。

## エンティティ定義（正）

```yaml
entities:
  - name: KnowledgeFile
    description: プラグインが同梱するナレッジ文書 1 本。functional-spec.md §1 の 8 本が実体
    attributes:
      - { name: path, type: string, required: true, unique: true, constraints: "knowledge/<agent_dir>/ddd-<topic>.md" }
      - { name: agent_dir, type: enum, allowed: [aidlc-architect-agent, aidlc-developer-agent, aidlc-aws-platform-agent, aidlc-shared], required: true, constraints: "エージェント slug と完全一致（CON6）" }
      - { name: topic, type: string, required: true, constraints: "小文字ケバブ。ファイル名の ddd- 以降" }
      - { name: language, type: enum, allowed: [en], required: true, constraints: "Q1: 英語" }
      - { name: title, type: string, required: true, constraints: "H1。先頭に DDD Plugin の印を付ける" }
      - { name: consumers, type: list<string>, required: true, constraints: "この文書を読むステージ slug（domain-modeling、domain-design、functional-design、infrastructure-design、code-generation）" }
      - { name: sections, type: list<KnowledgeSection>, required: true, constraints: "1 件以上。先頭は Purpose、末尾は Sources" }
      - { name: sources, type: list<SourceRef>, required: true, constraints: "1 件以上" }
    relationships:
      - { target: KnowledgeSection, cardinality: "1..*", direction: contains }
      - { target: SourceRef, cardinality: "1..*", direction: cites }

  - name: KnowledgeSection
    description: 文書内の H2 節。種別ごとに書式が決まる
    attributes:
      - { name: heading, type: string, required: true }
      - { name: kind, type: enum, allowed: [purpose, principles, rules, rationale, conflicts, example-index, retired, meta, sources], required: true }
      - { name: entries, type: list<RuleEntry>, required: false, default: "[]", constraints: "kind = principles / rules のとき 1 件以上" }
      - { name: conflicts, type: list<ConflictEntry>, required: false, default: "[]", constraints: "kind = conflicts のとき 1 件以上" }
      - { name: examples, type: list<ExampleIndexEntry>, required: false, default: "[]", constraints: "kind = example-index のとき 1 件以上" }
      - { name: retired, type: list<RetiredRule>, required: false, default: "[]" }
    relationships:
      - { target: RuleEntry, cardinality: "0..*", direction: contains }
      - { target: ConflictEntry, cardinality: "0..*", direction: contains }
      - { target: ExampleIndexEntry, cardinality: "0..*", direction: contains }
      - { target: RetiredRule, cardinality: "0..*", direction: contains }

  - name: RuleEntry
    description: 原則または規則 1 件。強制手段の有無を必ず明示する（FR10.5、FR10.6）
    attributes:
      - { name: rule_id, type: string, required: true, unique: true, constraints: "K.<topic>.<n>（例: K.always-valid.3）。文書間で一意" }
      - { name: statement, type: string, required: true, constraints: "1 文。ALWAYS / NEVER / PREFER のいずれかで始める" }
      - { name: applies_to, type: list<string>, required: true, constraints: "層または要素（domain / use-case / interface-adapter / infrastructure / model / process）" }
      - { name: enforcement, type: Enforcement, required: true }
      - { name: rationale, type: string, required: true, constraints: "1〜3 文。なぜそうするか" }
      - { name: source, type: SourceRef, required: true }
      - { name: exceptions, type: list<string>, required: false, default: "[]", constraints: "例外は必ず理由を伴う（FR10.5）" }

  - name: Enforcement
    description: 規則がどこまで機械的に強制されているかの宣言。「実装済みと主張するのは強制できる範囲だけ」（FR10.5）
    attributes:
      - { name: level, type: enum, allowed: [sensor, stage-contract, schema, guidance-only], required: true, constraints: "sensor = センサー所見で止まる／報告される、stage-contract = fragments の手順または成果物契約、schema = 正規モデルのスキーマ、guidance-only = ナレッジのみ" }
      - { name: refs, type: list<string>, required: false, default: "[]", constraints: "level ≠ guidance-only のとき 1 件以上。規則 ID（a〜n、model-completeness.i など）、fragment の anchor、スキーマの属性名" }
      - { name: severity, type: enum, allowed: [blocking, advisory], required: false, constraints: "level = sensor のとき必須" }

  - name: ConflictEntry
    description: コアの ddd-patterns.md との矛盾 1 件（ADR-010 の 4 件の転記。FR10.4）
    attributes:
      - { name: conflict_id, type: string, required: true, unique: true, constraints: "C-1〜C-4（ADR-010 の # に対応）" }
      - { name: core_statement, type: string, required: true, constraints: "コアの記述の英語引用（原文が日本語の設計書なら英訳し、原文の出典を併記）" }
      - { name: core_location, type: string, required: true, constraints: ".claude/knowledge/aidlc-architect-agent/ddd-patterns.md の節名" }
      - { name: plugin_rule, type: string, required: true, constraints: "プラグインの規約（RuleEntry の rule_id を含む）" }
      - { name: scope, type: string, required: true, constraints: "適用範囲（層・工程・センサー）" }
      - { name: rationale, type: string, required: true, constraints: "採用理由" }
      - { name: precedence, type: enum, allowed: [plugin, core], required: true, constraints: "初版はすべて plugin（ADR-010）" }

  - name: ExampleIndexEntry
    description: 良い例の索引 1 件。スニペットではなく実在ファイルを指す（FR10.5、Q3）
    attributes:
      - { name: rule_id, type: string, required: true, references: RuleEntry }
      - { name: fixture_path, type: string, required: true, constraints: "リポジトリ相対。tests/golden/rust/<sensor-id>/clean-*/workspace/... または tests/golden/design/...（U4 の fixture 規約）" }
      - { name: description, type: string, required: true }
      - { name: projection_note, type: string, required: true, constraints: "投影先のハーネスからは参照できない旨と、リポジトリでの参照方法" }

  - name: RetiredRule
    description: 失効した規則。消さずに打ち消し線と失効注記で残す（FR10.5）
    attributes:
      - { name: rule_id, type: string, required: true }
      - { name: statement, type: string, required: true, constraints: "打ち消し線で表示" }
      - { name: retired_at, type: string, required: true, constraints: "日付または版" }
      - { name: reason, type: string, required: true }
      - { name: replaced_by, type: string, required: false, constraints: "後継の rule_id" }

  - name: SourceRef
    description: 出典への参照
    attributes:
      - { name: kind, type: enum, allowed: [design-doc, adr, unit-design, requirement, core-knowledge, external], required: true }
      - { name: locator, type: string, required: true, constraints: "設計書は ddd/docs/<file>.md §n、ADR は ADR-nnn、Unit 設計は construction/<unit>/functional-design/<file>.md、要件は FR/NFR の ID" }
      - { name: note, type: string, required: false }

  - name: PlacementCheck
    description: 配置の機械検証（FR10.3 の判定）。U9 の統合テストが実行する
    attributes:
      - { name: stage, type: string, required: true, constraints: "domain-modeling / domain-design / functional-design / infrastructure-design / code-generation" }
      - { name: expected_files, type: list<string>, required: true, constraints: "そのステージの inline_context_paths に現れるべき KnowledgeFile.path" }
      - { name: observed_files, type: list<string>, required: false }
      - { name: result, type: enum, allowed: [pass, fail, pending], required: true }
```

## 要約

- ナレッジは 8 本の `KnowledgeFile`（Q2）で、各ファイルは種別付きの H2 節（`KnowledgeSection`）からなる。原則と規則は `RuleEntry` として ID を持ち、必ず `Enforcement`（センサー／ステージ契約／スキーマ／ナレッジのみ）を明示する。これが FR10.5 の「実装済みと主張するのは強制できる範囲だけ」と FR10.6 の「ナレッジだけに任せない」を文書構造として担保する。
- コアとの矛盾は `ConflictEntry`（ADR-010 の 4 件）として、コアの記述・位置・プラグインの規約・適用範囲・採用理由・優先順位を持つ。
- 例は `ExampleIndexEntry` としてゴールデンケース fixture を指し、投影先では参照できない旨を必ず注記する（Q3）。失効した規則は `RetiredRule` として残す。
- `PlacementCheck` は compose 後の `inline_context_paths` でナレッジが対象ステージに届いていることを確かめる検証項目で、U9 の統合テストが実行する。
- `components.md` からの差分: 文書集合の構造を `KnowledgeFile` 以下の型として明文化した。振る舞い（配置、接頭辞、矛盾の転記、メタ規律）はすべてこれらの属性と制約に写像している。
