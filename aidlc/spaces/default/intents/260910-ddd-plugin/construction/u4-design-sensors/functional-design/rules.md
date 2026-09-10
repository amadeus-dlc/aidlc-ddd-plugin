# 業務ルール — U4 設計センサー（u4-design-sensors）

## Sources

- `inception/units-generation/unit-of-work.md`（U4 の境界: Rust コードは読まない。マニフェストをどのステージに束ねるかは U6・U7 が宣言する）
- `inception/units-generation/unit-of-work-story-map.md`（U4 の要件: FR4.4、FR5.4、FR5.5、FR6、FR6.1〜FR6.6、FR8.1、FR8.2、FR8.7、NFR4）
- `inception/requirements-analysis/requirements.md`（各規則の出典。FR1.8 の機械完了条件 (i)〜(v)、FR2.4、FR3.2〜FR3.3、FR4.1、FR5.1〜FR5.2）
- `inception/domain-design/components.md`（DesignSensorSuite の 6 マニフェストの検査内容）と `decisions.md`（ADR-002、ADR-004、ADR-008、ADR-009）
- `construction/u4-design-sensors/functional-design/functional-design-questions.md`（Q1〜Q3）
- `construction/u4-design-sensors/functional-design/entities.md`（型の定義）
- U1 の設計 `construction/u1-sensor-foundation/functional-design/rules.md`（BR1〜BR9。読み込み時違反・完全性検査・実行契約）
- エンジンのゲート発火（`.claude/tools/aidlc-state.ts`）: 存在する宣言済み成果物ごとに、`matches` に一致するマニフェストを起動する

U4 の規則は「6 本のマニフェストがそれぞれ何を、どの成果物を契機に、どの重大度で検査するか」と「ゴールデンケースの規約」である。所見の形式・フェイルクローズ・決定性は U1 の実行契約（U1 BR7〜BR9）に従う。

## ルール定義（正）

```yaml
rules:
  # ---------- BR1: マニフェストの形（FR8.1、FR8.2、ADR-002） ----------
  - id: BR1.1
    statement: マニフェストは sensors/aidlc-ddd-<name>.md に置き、id は ddd-<name>、kind は deterministic、command は bun {{HARNESS_DIR}}/tools/ddd-sensor-<name>.ts とする
    category: constraint
    applies_to: SensorManifest
    trigger: マニフェスト作成時
    logic: 必須フィールド id / kind / command / default_severity / description に加え、fire_on / matches / category / timeout_seconds / input_schema / output_schema を書く。id とファイル名の stem を一致させる
    violation: aidlc-plugin-validate と compose が拒否する（FR8.1 の判定）
    source: FR8.1、参照プラグイン test-pro
  - id: BR1.2
    statement: 6 本の重大度と契機は固定する。blocking 5 本（model-completeness、model-presence、reference-ids、mapping-declarations、layer-structure）と advisory 1 本（design-advisories）、すべて fire_on gate
    category: constraint
    applies_to: SensorManifest
    trigger: マニフェスト作成時
    logic: blocking と advisory を同じマニフェストに混ぜない。advisory の所見も pass:false で報告し、止めないのはマニフェストの重大度が決める（U1 BR9.3）
    violation: FR8.2 の判定（分類と宣言の不一致）
    source: FR8.2、ADR-002、CON4
  - id: BR1.3
    statement: matches は契機となる成果物だけに一致させ、旧成果物ツリー路（**/{aidlc-docs,intents}/**）を使わない
    category: constraint
    applies_to: SensorManifest
    trigger: マニフェスト作成時
    logic: model-completeness → **/domain-modeling/domain-model.yaml; model-presence → **/domain-design/components.md（Q3）; reference-ids → **/domain-design/ddd-aggregate-mapping.md と **/functional-design/ddd-use-case-declarations.md; mapping-declarations → 同じ 2 つ; layer-structure → **/infrastructure-design/ddd-layer-structure.md; design-advisories → **/functional-design/ddd-use-case-declarations.md と **/infrastructure-design/ddd-layer-structure.md
    violation: 誤った成果物で起動し、U1 の記録解決が失敗する
    source: FR8.3 の注記（旧ツリー路を踏襲しない）、Q3、ADR-008
  - id: BR1.4
    statement: timeout_seconds は 10 とし、スクリプトは U1 の軟らかい予算（budget_ms = 9000）を渡す
    category: policy
    applies_to: SensorManifest
    trigger: マニフェスト作成時
    logic: 硬い timeout より 1 秒早く打ち切って pass:false を返す（U1 BR7.8）
    violation: なし
    source: NFR3（仮置き）、U1 BR7.8
  - id: BR1.5
    statement: 各スクリプトは U1 の runSensor で起動し、記録ディレクトリ・状態ファイル・正規モデルの読み込みを U1 の API に委ね、成果物の解析だけを自前で持つ
    category: policy
    applies_to: DesignCheck
    trigger: 常時
    logic: 所見の severity はマニフェストの重大度を転記する。Rust ソースと Cargo.toml は読まない
    violation: レビューで検出
    source: ADR-001、unit-of-work.md の U4 の境界

  # ---------- BR2: model-completeness（FR6.5、FR1.8、FR6.2、Q2） ----------
  - id: BR2.1
    statement: 契機の domain-model.yaml を U1 の loadDomainModel で読み、読み込み時違反（U1 BR1〜BR5 の failure）はそのまま blocking 所見にする
    category: validation
    applies_to: DesignCheck
    trigger: domain-modeling のゲート
    logic: failure の各所見を rule_id model-completeness.schema として転記し、以降の検査は行わない
    violation: 所見（blocking）
    source: FR6.5、FR1.8 (iv)
  - id: BR2.2
    statement: 機械完了条件 (i)〜(iii) は U1 の checkCompleteness の所見をそのまま転記する
    category: validation
    applies_to: DesignCheck
    trigger: 読み込み成功後
    logic: completeness.i → model-completeness.i（Aggregate に不変条件が無い）; completeness.ii → model-completeness.ii（Command の state_effect と transitions の不整合）; (iii) は読み込み時に保証されるため常に 0 件（model-completeness.iii は予約）
    violation: 所見（blocking）
    source: FR1.8 (i)〜(iii)、FR6.5
  - id: BR2.3
    statement: 機械完了条件 (iv) は U1 の参照解決結果で判定する
    category: validation
    applies_to: DesignCheck
    trigger: 読み込み成功後
    logic: index の unresolved 参照が 1 件でもあれば model-completeness.iv（参照 ID、理由 undefined / deprecated / kind-mismatch を message に書く）
    violation: 所見（blocking）
    source: FR1.8 (iv)、FR2.3
  - id: BR2.4
    statement: 機械完了条件 (v) と規則 (f) は、同じディレクトリの domain-model.md を Q2 の約束で突き合わせて判定する
    category: validation
    applies_to: DesignCheck
    trigger: 読み込み成功後
    logic: md を読み、<kind>.<segments> 形式の字面（コードスパン内も含む）と各行を MarkdownMention として抽出する。IF yaml の element_id が md に 1 回も現れない THEN model-completeness.f-missing（その ID）; IF md の ID が yaml に無い（廃止 ID を含む） THEN model-completeness.f-unknown; IF Invariant の statement 全文（前後の空白を正規化）が md の行に現れない THEN model-completeness.f-invariant。md が無ければ model-completeness.f-absent
    violation: 所見（blocking）
    source: FR1.8 (v)、FR6.2、Q2
  - id: BR2.5
    statement: 意味判断が必要な指摘（集約境界の妥当性など）は本マニフェストでは扱わない
    category: policy
    applies_to: SensorManifest
    trigger: 常時
    logic: 人間承認 (vi) に委ねる。所見にしない
    violation: なし
    source: FR1.8 (vi)、FR6.6

  # ---------- BR3: model-presence（FR6.4、ADR-004、Q3） ----------
  - id: BR3.1
    statement: 契機は domain-design の components.md とし、その中身は読まない
    category: policy
    applies_to: DesignCheck
    trigger: domain-design のゲート
    logic: output_path から記録ディレクトリを解決するためだけに使う
    violation: なし
    source: Q3
  - id: BR3.2
    statement: U1 の readStageStatus で domain-modeling の状態を読み、EXECUTE のときだけ検査し、SKIP または absent のときは note 付きで pass にする
    category: policy
    applies_to: DesignCheck
    trigger: domain-design のゲート
    logic: IF execution ∈ {SKIP, absent} THEN pass:true、note "domain-modeling is <SKIP|absent>; presence check skipped"; ELSE 手順 BR3.3
    violation: なし
    source: FR6.4、ADR-004
  - id: BR3.3
    statement: EXECUTE のとき、<record>/inception/domain-modeling/domain-model.yaml が存在し、U1 で読み込め、全参照が解決できなければ blocking 所見にする
    category: validation
    applies_to: DesignCheck
    trigger: domain-design のゲート
    logic: IF ファイルが無い THEN model-presence.missing; IF 読み込み失敗 THEN model-presence.invalid（U1 の所見を転記）; IF unresolved 参照あり THEN model-presence.unresolved
    violation: 所見（blocking）
    source: FR6.4、FR3.1

  # ---------- BR4: reference-ids（FR6.1、規則 (e)、FR3.2） ----------
  - id: BR4.1
    statement: 契機の宣言成果物（ddd-aggregate-mapping または ddd-use-case-declarations）の fenced yaml を読み、model_ref の正規モデルを U1 で読み込む
    category: validation
    applies_to: DesignCheck
    trigger: domain-design / functional-design のゲート
    logic: IF fenced yaml が無い OR schema_version ≠ 1 OR model_ref が無い THEN reference-ids.document（blocking）; IF 正規モデルが読めない THEN reference-ids.model（U1 の所見を転記）
    violation: 所見（blocking）
    source: ADR-008、FR6.1
  - id: BR4.2
    statement: 宣言に現れる ID をすべて U1 の index.resolve で解決し、未定義・廃止・種別違反を blocking 所見にする
    category: validation
    applies_to: DesignCheck
    trigger: 読み込み成功後
    logic: 対象フィールドは aggregate_ref / reference_ids / target_aggregates / commands / process_manager_ref。IF undefined THEN reference-ids.undefined; IF deprecated THEN reference-ids.deprecated; IF kind-mismatch（例: target_aggregates に command.*）THEN reference-ids.kind; IF malformed THEN reference-ids.malformed。所見の file は宣言成果物、line は yaml 内の行
    violation: 所見（blocking）
    source: FR6.1、FR2.3、FR2.4
  - id: BR4.3
    statement: 循環する置換関係は正規モデルの読み込み時に U1 が検出し、本マニフェストはその所見を reference-ids.cycle として転記する
    category: validation
    applies_to: DesignCheck
    trigger: 読み込み時
    logic: U1 BR2.3 の lineage.cycle を転記する
    violation: 所見（blocking）
    source: FR6.1、FR2.4
  - id: BR4.4
    statement: 各 AggregateMapping は reference_ids を 1 件以上持たなければならない
    category: validation
    applies_to: AggregateMapping
    trigger: domain-design のゲート
    logic: IF reference_ids が空 THEN reference-ids.missing（aggregate_ref を message に書く）
    violation: 所見（blocking）
    source: FR3.2

  # ---------- BR5: mapping-declarations（FR3.3、FR4.1、FR6.3、FR2.6） ----------
  - id: BR5.1
    statement: domain-design では、正規モデルの全 Aggregate に AggregateMapping があり、2 軸（programming_model、persistence_method）が宣言されていなければならない
    category: validation
    applies_to: AggregateMapping
    trigger: domain-design のゲート
    logic: IF Aggregate に対応する mapping が無い THEN mapping-declarations.aggregate-unmapped; IF 2 軸のいずれかが無い／列挙外 THEN mapping-declarations.axes; IF mapping の aggregate_ref が重複 THEN mapping-declarations.duplicate
    violation: 所見（blocking）
    source: FR3.3
  - id: BR5.2
    statement: functional-design では、各 UseCaseDeclaration が必須 6 項目を満たしていなければならない
    category: validation
    applies_to: UseCaseDeclaration
    trigger: functional-design のゲート
    logic: IF target_aggregates / commands が空 OR re_execution_basis / read_model_exposure が空 OR recovery_policy が列挙外 THEN mapping-declarations.use-case-item（欠けた項目名を message に書く）; IF target_aggregates が 2 件以上 AND multi_aggregate_strategy が無い THEN mapping-declarations.multi-aggregate-strategy
    violation: 所見（blocking）
    source: FR4.1
  - id: BR5.3
    statement: アクターモデルを宣言した Aggregate だけを対象にするユースケースで、複数集約に跨がるものは Process Manager を参照しなければならない
    category: validation
    applies_to: UseCaseDeclaration
    trigger: functional-design のゲート
    logic: IF target_aggregates が 2 件以上 AND すべての対象の programming_model = actor（ddd-aggregate-mapping を読む）AND multi_aggregate_strategy.kind ≠ process-manager THEN mapping-declarations.process-manager-required; IF kind = process-manager AND process_manager_ref が正規モデルに無い THEN reference-ids の対象（BR4.2）
    violation: 所見（blocking）
    source: FR2.6（必須化はアクターモデル選択時のみ）、use-case-layer-design §6
  - id: BR5.4
    statement: 規則 (j)（非冪等操作なのに冪等性戦略が未宣言）は U1 の checkCompleteness の idempotency.j を mapping-declarations.j として転記する
    category: validation
    applies_to: DesignCheck
    trigger: domain-design と functional-design のゲート
    logic: 正規モデルを読み込み、effect = accumulation かつ strategy = none の Command を所見にする（file は正規モデル）
    violation: 所見（blocking）
    source: FR6.3、FR4.3 (j)

  # ---------- BR6: layer-structure（FR5.4、ADR-009、設計側の (k)(l)(m)(n)） ----------
  - id: BR6.1
    statement: 契機の ddd-layer-structure の fenced yaml を読み、各 LayerStructureDeclaration の必須項目が揃っていなければ blocking 所見にする
    category: validation
    applies_to: LayerStructureDeclaration
    trigger: infrastructure-design のゲート
    logic: IF crate_dependencies / ports / repositories / restoration_paths / persistence_backend のいずれかが無い THEN layer-structure.item; IF cqrs = true AND query_side_crates が空 THEN layer-structure.cqrs-sides; IF crate_dependencies に現れないクレートが command_side_crates ∪ query_side_crates ∪ rmu_crates にある THEN layer-structure.dependencies-incomplete
    violation: 所見（blocking）
    source: ADR-009、FR5.1
  - id: BR6.2
    statement: (k) コマンド側クレートとクエリ側クレートの相互依存宣言を違反にする。rmu_crates は両側に依存してよい
    category: validation
    applies_to: CrateDependencyDeclaration
    trigger: infrastructure-design のゲート
    logic: IF crate ∈ command_side AND depends_on ∩ query_side ≠ ∅ THEN layer-structure.k; IF crate ∈ query_side AND depends_on ∩ command_side ≠ ∅ THEN layer-structure.k; rmu は対象外
    violation: 所見（blocking）
    source: FR5.4 (k)、ADR-009
  - id: BR6.3
    statement: (l) クエリ側クレートの依存先に、ドメイン層クレート（名前が -domain で終わる、またはコマンド側で domain と宣言されたもの）またはリポジトリポート（ports の kind = repository の所有クレート）が含まれる宣言を違反にする
    category: validation
    applies_to: CrateDependencyDeclaration
    trigger: infrastructure-design のゲート
    logic: IF crate ∈ query_side AND depends_on に上記が含まれる THEN layer-structure.l
    violation: 所見（blocking）
    source: FR5.4 (l)、ADR-009
  - id: BR6.4
    statement: (m) リポジトリ名は <Aggregate 名の PascalCase>Repository でなければならず、媒体名を含んではならない
    category: validation
    applies_to: RepositoryDeclaration
    trigger: infrastructure-design のゲート
    logic: aggregate_ref の名前セグメントを PascalCase にして + "Repository" と比較する。IF 不一致 THEN layer-structure.m-name; IF name に媒体語（DynamoDb / Dynamo / Postgres / Mysql / Sqlite / Redis / Mongo / S3 / Jdbc / Sql / Http / Grpc / Kafka / InMemory。大文字小文字を無視）を含む THEN layer-structure.m-media
    violation: 所見（blocking）
    source: FR5.4 (m)、FR5.2
  - id: BR6.5
    statement: (n) このコンテキストの全 Aggregate について restoration_paths に via = full-constructor の宣言がなければ違反にする
    category: validation
    applies_to: RestorationPathDeclaration
    trigger: infrastructure-design のゲート
    logic: 対象 Aggregate は ddd-aggregate-mapping で crate がこのコンテキストのクレートに属するもの（mapping が無ければ正規モデルの bc 配下の全 Aggregate）。IF 宣言が無い OR via ≠ full-constructor THEN layer-structure.n
    violation: 所見（blocking）
    source: FR5.4 (n)、ADR-009
  - id: BR6.6
    statement: 本マニフェストは宣言だけを読み、Rust コードも Cargo.toml も読まない
    category: constraint
    applies_to: SensorManifest
    trigger: 常時
    logic: コード側の (k)(l)(m)(n) は U5 が code-generation のゲートで検査する
    violation: レビューで検出
    source: ADR-009

  # ---------- BR7: design-advisories（FR4.4、FR5.5、FR6.6） ----------
  - id: BR7.1
    statement: 複数集約を更新するユースケース（target_aggregates が 2 件以上）は advisory 所見にする
    category: policy
    applies_to: UseCaseDeclaration
    trigger: functional-design のゲート
    logic: design-advisories.multi-aggregate。multi_aggregate_strategy の内容を message に含める（宣言の有無は BR5.2 が blocking で扱う）
    violation: 所見（advisory）
    source: FR4.4
  - id: BR7.2
    statement: リポジトリのスコープ違反の疑い（io_unit = partial、または aggregate_ref がコンテキスト外）は advisory 所見にする
    category: policy
    applies_to: RepositoryDeclaration
    trigger: infrastructure-design のゲート
    logic: design-advisories.repository-scope
    violation: 所見（advisory）
    source: FR5.5
  - id: BR7.3
    statement: store が upsert と宣言されていないリポジトリ（verbs に store が無い、または store_semantics ≠ upsert）は advisory 所見にする
    category: policy
    applies_to: RepositoryDeclaration
    trigger: infrastructure-design のゲート
    logic: design-advisories.store-upsert
    violation: 所見（advisory）
    source: FR5.5、use-case-layer-design §5-1
  - id: BR7.4
    statement: advisory の所見は進行を止めず、承認ゲートでレビュー対象として提示される
    category: policy
    applies_to: SensorManifest
    trigger: 常時
    logic: default_severity: advisory。エンジンは SENSOR_FAILED（advisory）を記録し、ゲートは開く
    violation: なし
    source: FR6.6、FR8.2

  # ---------- BR8: ゴールデンケース（FR8.7、NFR4、NFR1、Q1） ----------
  - id: BR8.1
    statement: fixture は tests/golden/<suite>/<sensor-id>/<case-name>/ に 1 ケース 1 ディレクトリで置き、record/ と expected.json を持つ
    category: constraint
    applies_to: GoldenCase
    trigger: fixture 作成時
    logic: record/ は aidlc-state.md と契機の成果物（と必要な正規モデル・宣言成果物）を含む最小の記録ディレクトリ。Rust センサーは workspace/ を並置する。case-name は violation-<規則> / clean-<説明>
    violation: テストランナーが構成違反として失敗する
    source: FR8.7、Q1
  - id: BR8.2
    statement: expected.json は起動引数（stage、output_path）と期待結果（pass、findings（rule_id、file、line?）、任意の note_contains）を持ち、message は照合しない
    category: constraint
    applies_to: ExpectedVerdict
    trigger: fixture 作成時
    logic: stage と output_path は必須で、output_path は record/ からの相対パス。violation ケースは findings 1 件以上、clean ケースは 0 件。findings の順序は問わない（集合として比較）。note_contains があれば note の部分一致を検証する。ランナーは expected.json 以外の設定ファイルを読まない
    violation: テスト失敗
    source: FR8.7、NFR4
  - id: BR8.3
    statement: 6 本のマニフェストのそれぞれに clean ケース 1 件以上と、rule_id ごとに violation ケース 1 件以上を用意する
    category: constraint
    applies_to: GoldenCase
    trigger: fixture 作成時
    logic: rule_id の一覧は rules.md の BR2〜BR7 の各 rule_id。model-presence は SKIP / absent の note ケースも持つ（ADR-004）
    violation: 網羅性テストが失敗する
    source: FR8.7、FR6.4、NFR4
  - id: BR8.4
    statement: テストランナーはセンサースクリプトを実運用と同じ引数（--stage、--output-path）で子プロセスとして起動し、標準出力の JSON を検証する
    category: constraint
    applies_to: GoldenCase
    trigger: テスト実行時
    logic: 関数を直接呼ばず、command と同じ入口を通す（FR8.5 の契約をテストで固定する）。終了コードは 0 を期待する
    violation: テスト失敗
    source: FR8.5、FR8.7
  - id: BR8.5
    statement: 決定性テストは同じ fixture を 3 回実行し、JSON が一致することを検証する
    category: constraint
    applies_to: GoldenCase
    trigger: テスト実行時
    logic: 各 suite から少なくとも 1 ケース
    violation: NFR1 の判定に失敗する
    source: NFR1
  - id: BR8.6
    statement: fixture は tools/ に置かず、投影されない
    category: constraint
    applies_to: GoldenCase
    trigger: 常時
    logic: tests/ は投影時に除外される（domain-design Sources のエンジン確認結果）
    violation: 投影物の肥大化
    source: GoldenCaseSuite の振る舞い、CON10
```

## ルール要約

| ID | 分類 | 要点 | 出典 |
|---|---|---|---|
| BR1.1〜BR1.5 | マニフェスト | ファイル名と必須フィールド、blocking 5 + advisory 1、matches、timeout、U1 の runSensor | FR8.1、FR8.2、ADR-002 |
| BR2.1〜BR2.5 | model-completeness | 読み込み時違反、(i)〜(iii)、(iv) 参照解決、(v)/(f) md 整合（Q2）、意味判断は扱わない | FR6.5、FR1.8、FR6.2 |
| BR3.1〜BR3.3 | model-presence | components.md を契機（Q3）、EXECUTE のときだけ検査、欠落・不正・未解決 | FR6.4、ADR-004 |
| BR4.1〜BR4.4 | reference-ids | 宣言成果物の形、ID 解決、循環、reference_ids 必須 | FR6.1、FR3.2 |
| BR5.1〜BR5.4 | mapping-declarations | 2 軸と全集約、必須 6 項目、アクターモデル時の PM、(j) | FR3.3、FR4.1、FR6.3、FR2.6 |
| BR6.1〜BR6.6 | layer-structure | 必須項目、(k)(l)(m)(n) を宣言に対して検査、コードは読まない | FR5.4、ADR-009 |
| BR7.1〜BR7.4 | design-advisories | 複数集約更新、リポジトリスコープ、store upsert、止めない | FR4.4、FR5.5、FR6.6 |
| BR8.1〜BR8.6 | ゴールデンケース | 構成規約、expected.json、網羅性、実運用と同じ入口、決定性、投影外 | FR8.7、NFR4、NFR1 |
