# エンティティモデル — U5 Rust コードセンサー（u5-rust-code-sensors）

## Sources

- `inception/units-generation/unit-of-work.md`（U5 = RustCodeSensorSuite + GoldenCaseSuite（Rust センサー分）。kind: library。構文木と層判定は U2、正規モデルの Command 集合は U1 に委ねる）
- `inception/units-generation/unit-of-work-story-map.md`（U5 の要件: FR7、FR7.1〜FR7.13、FR9.5、NFR1、NFR3。横断: FR7.2 / FR7.3 / FR7.11 は U1 の読み込み器、FR7.4 / FR7.5 / FR7.8 / FR7.9 は U2 の層判定、FR8.7 の fixture 規約は U4）
- `inception/requirements-analysis/requirements.md`（FR7 各規則、FR8.3、FR8.6、FR9.5、NFR1、NFR3）
- `inception/domain-design/components.md`（RustCodeSensorSuite の 3 マニフェストと規則モジュール、依存先 4 コンポーネント）
- `inception/domain-design/decisions.md`（ADR-001 `tools/ddd/lib/rules/`、ADR-002 層ごと 3 マニフェスト、ADR-003 発火経路、ADR-005 層判定、ADR-009 設計側検査との分離）
- `construction/u5-rust-code-sensors/functional-design/functional-design-questions.md`（Q1 Command 対応づけ、Q2 正規モデル欠落時、Q3 可視性、Q4 名前一覧、Q5 完全コンストラクタと replay、Q6 外部クレート）
- U1 の設計 `construction/u1-sensor-foundation/functional-design/entities.md`（SensorFinding / SensorVerdict / SensorRunContext / SourceClaim / StageStatus、DomainModel と ElementIndex）
- U2 の設計 `construction/u2-rust-analysis-foundation/functional-design/entities.md`（CargoWorkspace / CrateLayerAssignment / FileClassification / DependencyPermission / LayerDiagnostic、StructDecl / MethodDecl / UsePath / CallSite / ConstructionSite / OpaqueRegion）
- U4 の設計 `construction/u4-design-sensors/functional-design/entities.md`（SensorManifest、GoldenCase / ExpectedVerdict / ExpectedFinding）
- `ddd/docs/domain-layer-design.md` §6〜§8、`ddd/docs/use-case-layer-design.md` §3・§7、`ddd/docs/interface-adapter-layer-design.md` §3〜§5・§8

本書は U5 が所有する型の定義である。3 群からなる: (1) マニフェストと規則の定義（言語横断の規則定義と Rust 固有の判定器を分ける、FR8.6）、(2) 1 回の検査で組み立てる文脈（申告ソース、層判定、ドメイン型の名前一覧、Command との照合）、(3) Rust 用ゴールデンケース。実行時の共通型（所見・報告・文脈）は U1、構文的事実と層の事実は U2、fixture の共通形は U4 のものをそのまま使い、本書では再定義しない。

## エンティティ定義（正）

```yaml
entities:
  # ---------- (1) マニフェストと規則 ----------
  - name: RustSensorManifest
    description: Rust コードセンサーのマニフェスト 3 本。形は U4 の SensorManifest と同じで、検査対象の層だけが異なる
    attributes:
      - { name: id, type: string, required: true, unique: true, allowed: [ddd-rust-domain, ddd-rust-use-case, ddd-rust-interface-adapter], constraints: "ファイル名は sensors/aidlc-<id>.md" }
      - { name: kind, type: enum, allowed: [deterministic], required: true }
      - { name: command, type: string, required: true, constraints: "bun {{HARNESS_DIR}}/tools/ddd-sensor-rust-<layer>.ts（U4 BR1.1 と同じ形）" }
      - { name: default_severity, type: enum, allowed: [blocking], required: true, constraints: "3 本すべて blocking（ADR-002）" }
      - { name: fire_on, type: enum, allowed: [gate], required: true }
      - { name: matches, type: string, required: true, default: "**/code-summary.md", constraints: "code-generation の成果物だけに一致させ Unit ごとに 1 回発火する（ADR-003）" }
      - { name: description, type: string, required: true }
      - { name: category, type: string, required: true, default: "code-shape" }
      - { name: timeout_seconds, type: integer, required: true, default: 10 }
      - { name: input_schema, type: string, required: true, constraints: "U4 と同じディスパッチャ引数の記述" }
      - { name: output_schema, type: string, required: true, constraints: "U4 と同じ compact JSON verdict の記述" }
      - { name: target_layers, type: list<enum>, allowed: [domain, use-case, interface-adapter, rmu], required: true, constraints: "domain → [domain]、use-case → [use-case]、interface-adapter → [interface-adapter, rmu]" }
      - { name: includes_query_side, type: boolean, required: true, constraints: "true は interface-adapter だけ。実効層に関わらず cqrs_side = query のファイルを対象に加える（規則 (l) のため。rules.md BR1.2）" }
      - { name: rules, type: list<string>, required: true, constraints: "このマニフェストが評価する RuleDefinition の rule_id。functional-spec.md §1 に列挙" }
    relationships:
      - { target: RuleDefinition, cardinality: "1..*", direction: evaluates }

  - name: RuleDefinition
    description: 言語横断の規則定義。tools/ddd/lib/rules/ に置き、どの言語の判定器からも同じ定義を参照する（FR8.6）
    attributes:
      - { name: rule_id, type: string, required: true, unique: true, constraints: "設計書の記号 a / b / c / d / g / h / i / k / l / m / n（依存方向違反 FR9.5 は安全網として g で報告する）、層診断の転記は layer.<code>（U2 の LayerDiagnostic.code）、正規モデルの読み込み失敗は model.invalid" }
      - { name: name, type: string, required: true, constraints: "例: public-field、undeclared-mutation、incomplete-construction、getter-call、dip-violation、execute-aggregate-arg、use-case-chaining、cross-side-reference、query-side-domain-reference、repository-naming、restoration-bypass。g の name は dip-violation で、層間の依存方向違反と外部 I/O 依存を含む" }
      - { name: statement, type: string, required: true, constraints: "違反の一文定義（所見の message の雛形）" }
      - { name: target_layers, type: list<enum>, allowed: [domain, use-case, interface-adapter, rmu], required: true, constraints: "判定対象ファイルの実効層。d は domain と use-case の両方" }
      - { name: requires_model, type: boolean, required: true, constraints: "正規モデル（Command 集合）が無いと判定できない部分を持つか。b は true、c と n は部分的（rules.md BR6）" }
      - { name: facts, type: list<enum>, allowed: [structs, impls, fns, uses, calls, constructions, cargo-dependencies, layer-assignment, domain-symbols, command-index], required: true, constraints: "判定に使う U2 / U1 の事実の種類" }
      - { name: source, type: string, required: true, constraints: "出典の要件 ID（FR7.1 など）" }

  - name: RustRuleEvaluator
    description: Rust 固有の判定器。tools/ddd/lib/rules/rust/ に置き、RuleDefinition 1 件につき 1 つ。入力は U2 の構文的事実と InspectionContext、出力は所見
    attributes:
      - { name: rule_id, type: string, required: true, unique: true, references: RuleDefinition }
      - { name: language, type: enum, allowed: [rust], required: true, constraints: "第 2 言語は lib/rules/<lang>/ に同じ rule_id の判定器を追加する" }
      - { name: per_file, type: boolean, required: true, constraints: "true = 申告ファイルごとに評価、false = 文脈全体（Cargo 依存など）で 1 回評価" }
    relationships:
      - { target: RuleDefinition, cardinality: "1", direction: implements }

  # ---------- (2) 1 回の検査の文脈 ----------
  - name: InspectionContext
    description: 1 回のセンサー実行で組み立てる検査文脈。3 マニフェストで同じ手順で作り、対象層だけが異なる
    attributes:
      - { name: run, type: SensorRunContext, required: true, constraints: "U1 が解決した文脈（unit 必須）" }
      - { name: workspace, type: CargoWorkspace, required: true, constraints: "U2 scanWorkspace の結果。ルートは run.workspace_root（repo 付き申告は repo ルート）" }
      - { name: assignments, type: list<CrateLayerAssignment>, required: true, constraints: "U2 assignLayers の結果" }
      - { name: targets, type: list<InspectionTarget>, required: true, constraints: "申告ソースのうち .rs で、実効層がマニフェストの target_layers に含まれるもの。includes_query_side = true のマニフェストでは cqrs_side = query のファイル（実効層が use-case でも）も含む（rules.md BR1.2）" }
      - { name: skipped, type: list<InspectionTarget>, required: true, default: "[]", constraints: "auxiliary、composition-root、他マニフェストの層、範囲外のファイル。note に件数と理由を残す" }
      - { name: symbols, type: DomainSymbolTable, required: true }
      - { name: model, type: ModelAvailability, required: true }
      - { name: denylist, type: list<ExternalCrateRule>, required: true, constraints: "Q6 の固定一覧" }
      - { name: opaque, type: list<OpaqueRegion>, required: true, default: "[]", constraints: "対象ファイルの不透明領域。note に転記する（rules.md BR7）" }
    relationships:
      - { target: InspectionTarget, cardinality: "0..*", direction: contains }
      - { target: DomainSymbolTable, cardinality: "1", direction: uses }
      - { target: ModelAvailability, cardinality: "1", direction: uses }

  - name: InspectionTarget
    description: 検査対象の申告ファイル 1 つ。U1 の SourceClaim を U2 で分類し、構文木を付けたもの
    attributes:
      - { name: claim, type: SourceClaim, required: true }
      - { name: classification, type: FileClassification, required: true }
      - { name: tree, type: SyntaxTree, required: false, constraints: "解析した場合のみ。skipped のファイルは解析しない" }
      - { name: crate_name, type: string, required: false, references: CrateLayerAssignment }

  - name: ModelAvailability
    description: 正規モデルの利用可否（Q2）。domain-modeling の実行状態と読み込み結果から決める
    attributes:
      - { name: status, type: enum, allowed: [available, skipped, absent, invalid], required: true, constraints: "available = 読み込み成功、skipped = domain-modeling が SKIP、absent = Stage Progress に行が無い、invalid = EXECUTE だが読み込み失敗" }
      - { name: index, type: ElementIndex, required: false, constraints: "status = available のときだけ。U1 の索引" }
      - { name: note, type: string, required: false, constraints: "skipped / absent のとき、省略した規則の一覧を含む注記" }

  - name: DomainSymbolTable
    description: ワークスペース内のドメイン層クレートすべてから作る名前一覧（Q4）。名前照合に基づく規則 (d)(h)(l)(n) と、(b)(c) の型の特定に使う
    attributes:
      - { name: crates, type: list<string>, required: true, constraints: "解析したドメイン層クレート名（U2 の layer = domain）" }
      - { name: types, type: list<DomainTypeSymbol>, required: true, default: "[]" }
      - { name: getter_names, type: set<string>, required: true, default: "[]", constraints: "全ドメイン型の getters の和集合（(d) の照合用）" }
      - { name: type_names, type: set<string>, required: true, default: "[]", constraints: "全ドメイン型の名前の和集合（(h)(l)(n) の照合用）" }
      - { name: file_count, type: integer, required: true, min: 0, constraints: "解析したファイル数（NFR3 の計測用）" }
    relationships:
      - { target: DomainTypeSymbol, cardinality: "0..*", direction: contains }

  - name: DomainTypeSymbol
    description: ドメイン層クレートに宣言された struct / enum 1 つの要約。U2 の StructDecl と ImplBlock から導く
    attributes:
      - { name: type_name, type: string, required: true, constraints: "同名の型が複数クレートにあれば両方を保持する（name + crate で一意）" }
      - { name: crate_name, type: string, required: true }
      - { name: file, type: string, required: true }
      - { name: kind, type: enum, allowed: [struct, enum], required: true }
      - { name: aggregate_slug, type: string, required: true, constraints: "type_name を PascalCase → 小文字ケバブに変換した値（Q1）。例: InvoiceLine → invoice-line" }
      - { name: getters, type: list<string>, required: true, default: "[]", constraints: "固有 impl のメソッドで body_shape = returns-field-only のもの（名前は問わない）" }
      - { name: constructors, type: list<string>, required: true, default: "[]", constraints: "固有 impl の関連関数（receiver = none）で戻り型の字面が Self / Result<Self, ..> / Option<Self> / 型名のもの（Q5）" }
      - { name: mutators, type: list<MutatorSymbol>, required: true, default: "[]", constraints: "固有 impl の receiver = mut-self のメソッド" }
      - { name: has_default, type: boolean, required: true, constraints: "derives に Default がある、または impl Default for <型> がある" }
      - { name: non_private_fields, type: list<FieldDecl>, required: true, default: "[]", constraints: "visibility ≠ private のフィールド（Q3）" }

  - name: MutatorSymbol
    description: &mut self メソッド 1 つと、その分類（Q1、Q5）
    attributes:
      - { name: method_name, type: string, required: true }
      - { name: command_slug, type: string, required: true, constraints: "method_name を snake_case → ケバブに変換した値。例: add_item → add-item" }
      - { name: classification, type: enum, allowed: [declared-command, replay-exempt, post-init, undeclared, unknown], required: true, constraints: "declared-command = index.commandsOf(aggregate.<aggregate_slug>) の中に名前セグメント = command_slug の Command がある、replay-exempt = apply / apply_event / replay / on_event、post-init = init / setup / initialize / reset / configure、undeclared = 集約が索引に無い（集約ルートでない型）か Command が一致しない、unknown = 正規モデル利用不可（Q2）" }
      - { name: span, type: Span, required: true }

  - name: ExternalCrateRule
    description: ワークスペース外の I/O クレート一覧の 1 行（Q6）。ドメイン層・ユースケース層からの依存を (g) の違反にする
    attributes:
      - { name: pattern, type: string, required: true, unique: true, constraints: "クレート名の完全一致、または末尾 * の前方一致（aws-sdk-*）" }
      - { name: category, type: enum, allowed: [database, cache, message-broker, http-client, rpc, web-framework, cloud-sdk], required: true }
      - { name: initial_list, type: boolean, required: true, default: true, constraints: "初版の固定一覧に含まれるか。ゴールデンケースで見直す" }

  - name: DependencyEdge
    description: 依存方向の検査（FR9.5、規則 g / k）で評価する 1 辺
    attributes:
      - { name: from_crate, type: string, required: true, references: CrateLayerAssignment }
      - { name: to_crate, type: string, required: true, constraints: "メンバークレート名（use の先頭セグメントをアンダースコア → ハイフン正規化して照合）または外部クレート名" }
      - { name: evidence, type: enum, allowed: [use-path, cargo-dependency], required: true }
      - { name: file, type: string, required: true, constraints: "use-path は申告ファイル、cargo-dependency は from_crate の Cargo.toml" }
      - { name: line, type: integer, required: false, min: 1 }
      - { name: verdict, type: enum, allowed: [ok, layer-forbidden, cross-side, external-io], required: true, constraints: "ok / layer-forbidden / cross-side は U2 isAllowed の理由コード、external-io は denylist 一致。layer-forbidden と external-io は規則 g、cross-side は規則 k の所見になる" }

  # ---------- (3) Rust 用ゴールデンケース ----------
  - name: RustGoldenCase
    description: U4 の GoldenCase に workspace/ を加えたもの（U4 Q1）。suite = rust
    attributes:
      - { name: base, type: GoldenCase, required: true, constraints: "suite = rust、sensor_id は 3 マニフェストのいずれか" }
      - { name: workspace_dir, type: string, required: true, constraints: "<case>/workspace/。Cargo.toml と最小の Rust クレート群。cargo は実行しない" }
      - { name: source_manifest, type: string, required: true, constraints: "<case>/record/construction/<unit>/code-generation/source-manifest.json。workspace/ 内のファイルを申告する" }
      - { name: model_present, type: boolean, required: true, constraints: "record/ に domain-model.yaml と EXECUTE の Stage Progress 行を含めるか（Q2 のケースは false）" }
```

## 要約

- **マニフェストと規則**: `RustSensorManifest` 3 本（すべて blocking、契機は `**/code-summary.md`、形は U4 の SensorManifest と同じ項目を持つ）が、言語横断の `RuleDefinition`（`tools/ddd/lib/rules/`）と Rust 固有の `RustRuleEvaluator`（`tools/ddd/lib/rules/rust/`）の対で規則 (a)〜(n)・依存方向を評価する。定義と判定器を分けるのは FR8.6（第 2 言語は判定器の追加だけで済む）のため。
- **検査の文脈**: `InspectionContext` は U1 の文脈と申告ソース、U2 の workspace・層判定・構文木を束ね、それに Q2 の `ModelAvailability`（正規モデルの利用可否）、Q4 の `DomainSymbolTable`（ドメイン層全クレートから作る型名・getter 名の一覧）、Q6 の `ExternalCrateRule`（I/O クレートの固定一覧）を加える。Q1 の Command 照合は `DomainTypeSymbol.aggregate_slug` と `MutatorSymbol.command_slug` の名前正規化で表し、U1 の `index.resolve`（集約の存在）と `index.commandsOf`（Command 集合）で突き合わせる。Q5 の完全コンストラクタは `DomainTypeSymbol.constructors`（戻り型で判定）、replay 除外と後付け初期化は `MutatorSymbol.classification` で表す。
- **ゴールデンケース**: U4 の規約に `workspace/` と `source-manifest.json` を足した `RustGoldenCase`。正規モデルの有無（`model_present`）をケースの属性にし、Q2 の分岐を fixture で固定する。
- `components.md` からの差分: RustCodeSensorSuite は entities を持たない宣言だったが、規則モジュールの構造（定義と判定器の分離）と検査文脈を設計上の型として追加した。所見の形式は U1 の `SensorFinding` をそのまま使い、`rule_id` の語彙だけを本書で定める。
