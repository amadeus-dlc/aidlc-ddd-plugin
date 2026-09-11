# 業務ルール — U5 Rust コードセンサー（u5-rust-code-sensors）

## Sources

- `inception/units-generation/unit-of-work.md`（U5 の境界: 構文木の取得と層判定は U2、Command 集合は U1 の読み込み器。申告パスがワークスペース外なら検査せず所見にする。fixture 規約は U4）
- `inception/units-generation/unit-of-work-story-map.md`（U5 の要件: FR7、FR7.1〜FR7.13、FR9.5、NFR1、NFR3。先に固める要件は FR9.5 と FR7.1〜FR7.4）
- `inception/requirements-analysis/requirements.md`（各規則の出典。FR7.12 構文解析のみ、FR7.13 所見の 4 項目、FR8.3 発火経路、FR8.6 言語別検査器の分離）
- `inception/domain-design/components.md`（RustCodeSensorSuite の振る舞い）と `decisions.md`（ADR-001、ADR-002、ADR-003、ADR-005、ADR-009）
- `construction/u5-rust-code-sensors/functional-design/functional-design-questions.md`（Q1〜Q6）
- `construction/u5-rust-code-sensors/functional-design/entities.md`（型の定義）
- U1 の設計 `construction/u1-sensor-foundation/functional-design/rules.md`（BR7 実行契約、BR8 申告ソースの解決、BR9 所見の形式）
- U2 の設計 `construction/u2-rust-analysis-foundation/functional-design/rules.md`（BR2〜BR5 層判定と許可表、BR6.6〜BR6.8 不透明領域・本体の形・構築箇所）
- U4 の設計 `construction/u4-design-sensors/functional-design/rules.md`（BR1 マニフェストの形、BR8 ゴールデンケース）
- `ddd/docs/domain-layer-design.md` §6〜§8、`ddd/docs/use-case-layer-design.md` §3・§7、`ddd/docs/interface-adapter-layer-design.md` §3〜§5・§8

U5 の規則は「3 本のマニフェストがどのファイルを対象に、規則 (a)〜(n) と依存方向をどの構文的事実から判定するか」と「Rust 用ゴールデンケースの規約」である。所見の形式・フェイルクローズ・決定性は U1 の実行契約（U1 BR7〜BR9）に、層と構文の事実は U2 に従う。すべての判定は字面と構文の形だけで行い、型推論・名前解決・実行を行わない（FR7.12）。

## ルール定義（正）

```yaml
rules:
  # ---------- BR1: マニフェストと発火（FR8.3、ADR-002、ADR-003） ----------
  - id: BR1.1
    statement: マニフェストは sensors/aidlc-ddd-rust-domain.md / aidlc-ddd-rust-use-case.md / aidlc-ddd-rust-interface-adapter.md の 3 本とし、形は U4 BR1.1 に従う（id、kind deterministic、command は bun {{HARNESS_DIR}}/tools/ddd-sensor-rust-<layer>.ts）
    category: constraint
    applies_to: RustSensorManifest
    trigger: マニフェスト作成時
    logic: default_severity はすべて blocking、fire_on は gate、matches は **/code-summary.md、timeout_seconds は 10（軟らかい予算 9000 ms を U1 に渡す）
    violation: aidlc-plugin-validate と compose が拒否する
    source: FR8.1、FR8.2、FR8.3、ADR-002、ADR-003
  - id: BR1.2
    statement: 各マニフェストは実効層がその対象層のファイルだけを検査する。domain → domain、use-case → use-case、interface-adapter → interface-adapter と rmu。例外として ddd-rust-interface-adapter は、実効層に関わらず cqrs_side = query のファイル（クエリ側ユースケース層を含む）も対象に加える
    category: policy
    applies_to: RustSensorManifest
    trigger: 検査文脈の組み立て時
    logic: targets = { 実効層 ∈ target_layers } ∪ { includes_query_side AND cqrs_side = query }。対象外のファイルは skipped に入れ、note に「<件数> files outside <layer>」と記す。composition-root と auxiliary は 3 本とも検査しない（U2 BR4.2、BR4.3）。クエリ側ユースケース層のファイルは ddd-rust-use-case（(g)(h)(i)(d)）と ddd-rust-interface-adapter（(l)）の両方の対象になる
    violation: なし
    source: ADR-002、U2 Q3、FR7.9
  - id: BR1.3
    statement: U2 の層診断（layer.unknown / layer.conflict / layer.mixed-targets / layer.unowned / cqrs.conflict / cqrs.query-domain / workspace.*）は ddd-rust-domain だけが所見に転記し、他の 2 本は転記しない
    category: policy
    applies_to: RustSensorManifest
    trigger: 検査文脈の組み立て時
    logic: rule_id は layer.<code>、file は診断の file、severity は blocking。3 本で重複報告しないための固定の担当
    violation: なし
    source: FR9.4、U2 BR2.3、BR2.5、BR3.3、BR3.4、BR4.1
  - id: BR1.4
    statement: センサーは対象コードも cargo も実行せず、ネットワークにアクセスしない
    category: constraint
    applies_to: RustSensorManifest
    trigger: 常時
    logic: 読むのは申告ファイル、Cargo.toml、正規モデル、状態ファイルのみ。U1 BR7.6 と U2 BR1.1 に従う
    violation: レビューで検出（NFR2、NFR9）
    source: NFR2、NFR9

  # ---------- BR2: 検査対象の決定（ADR-003、U1 BR8、U2 BR4） ----------
  - id: BR2.1
    statement: 検査対象は同じ Unit の source-manifest.json が申告する .rs ファイルだけとする
    category: constraint
    applies_to: InspectionTarget
    trigger: 検査文脈の組み立て時
    logic: U1 readSourceClaims(ctx, { extensions: [".rs"] }) で解決する。ディレクトリ申告は .rs で展開する。範囲外・欠落の所見（runtime.claim-out-of-scope / runtime.claim-missing）は U1 の返す所見をそのまま報告する
    violation: 所見（U1 の規則）
    source: FR8.3、ADR-003、U1 BR8.4、BR8.5
  - id: BR2.2
    statement: 申告が 1 件も無い、または .rs が 1 件も無いときは pass:true、note "no rust sources claimed" で終える
    category: policy
    applies_to: InspectionContext
    trigger: 検査文脈の組み立て時
    logic: Rust 以外の Unit（spec / packaging）でも code-summary を契機に発火するため、空の申告を違反にしない
    violation: なし
    source: ADR-003
  - id: BR2.3
    statement: workspace は申告ファイルの祖先で最も近い [workspace] を持つ Cargo.toml（無ければ最も近い [package] の Cargo.toml）を根に U2 scanWorkspace で走査し、全申告ファイルが同じ根に属さなければ blocking 所見にする
    category: calculation
    applies_to: InspectionContext
    trigger: 検査文脈の組み立て時
    logic: IF 根が見つからない THEN 所見 layer.unowned（file は当該申告）; IF 複数の根に分かれる THEN 所見 workspace.multiple-roots（file は 2 つ目以降の申告）。根は run.workspace_root（repo 付き申告は repo ルート）の配下でなければならない
    violation: 所見（blocking）
    source: FR9.1、ADR-003、ADR-005
  - id: BR2.4
    statement: 各申告ファイルは U2 classifyFile で分類し、role = crate-source のものだけを層ごとに振り分ける
    category: calculation
    applies_to: InspectionTarget
    trigger: 検査文脈の組み立て時
    logic: auxiliary と composition-root は skipped（note "<n> auxiliary files skipped" / "<n> composition-root files skipped"）。unowned は BR1.3 で所見にし検査しない。tree は対象ファイルだけ U2 parse で作る
    violation: なし
    source: U2 BR4.1〜BR4.4、U2 Q3

  # ---------- BR3: ドメイン型の名前一覧と Command 照合（Q1、Q4、Q5） ----------
  - id: BR3.1
    statement: ドメイン型の名前一覧は、ワークスペース内の layer = domain の全クレートの .rs（auxiliary を除く）を解析して作る。判定対象は申告ファイルだけである
    category: calculation
    applies_to: DomainSymbolTable
    trigger: 検査文脈の組み立て時
    logic: 各クレートの src/ 配下（lib / bin ターゲットの src_path の祖先）を再帰的に列挙し、U2 parse で StructDecl と ImplBlock を取り出す。列挙順はパスの昇順（決定性）。同一実行内では U2 のキャッシュで再解析しない
    violation: なし
    source: Q4、FR7.4、FR7.6、FR7.9、FR7.11
  - id: BR3.2
    statement: ドメイン型ごとに aggregate_slug（PascalCase → 小文字ケバブ）、getters（body_shape = returns-field-only の固有 impl メソッド）、constructors（receiver なしで戻り型が Self / Result<Self, ..> / Option<Self> / 型名の関連関数）、mutators（receiver = mut-self）、has_default、non_private_fields を要約する
    category: calculation
    applies_to: DomainTypeSymbol
    trigger: 一覧の作成時
    logic: PascalCase → ケバブは大文字の直前にハイフンを置いて小文字化（InvoiceLine → invoice-line、HTTPClient → h-t-t-p-client のような連続大文字は「大文字の連続の末尾以外はハイフンを置かない」規則で http-client）。トレイト impl のメソッドは getters / constructors / mutators に含めない（Default だけ has_default に反映）
    violation: なし
    source: Q1、Q5、U2 BR6.7
  - id: BR3.3
    statement: &mut self メソッドは replay-exempt → post-init → declared-command / undeclared の順に分類し、正規モデルが利用できないときは unknown とする
    category: calculation
    applies_to: MutatorSymbol
    trigger: 一覧の作成時
    logic: IF method_name ∈ {apply, apply_event, replay, on_event} THEN replay-exempt; ELSE IF method_name ∈ {init, setup, initialize, reset, configure} THEN post-init; ELSE IF model.status ≠ available THEN unknown; ELSE IF index.resolve("aggregate.<aggregate_slug>", aggregate) が unresolved THEN undeclared（集約ルートでない型の &mut self）; ELSE IF index.commandsOf("aggregate.<aggregate_slug>") に element_id の名前セグメント = command_slug の Command がある THEN declared-command ELSE undeclared
    violation: なし
    source: Q1、Q2、Q5、FR7.2、FR7.3
  - id: BR3.4
    statement: 正規モデルの利用可否は U1 readStageStatus(domain-modeling) と loadDomainModel で決める
    category: calculation
    applies_to: ModelAvailability
    trigger: 検査文脈の組み立て時
    logic: IF execution ∈ {SKIP, absent} THEN status = skipped / absent、note "domain-modeling is <SKIP|absent>; model-dependent checks (b, c-model, n-model) skipped"; ELSE loadDomainModel(<record>/inception/domain-modeling/domain-model.yaml)。IF 読み込み失敗 THEN status = invalid かつ所見 model.invalid（U1 の所見を転記、blocking）; ELSE available
    violation: invalid のとき所見（blocking）
    source: Q2、ADR-004、FR6.4 の準用

  # ---------- BR4: ドメイン層の規則（ddd-rust-domain: a / b / c / d） ----------
  - id: BR4.1
    statement: (a) ドメイン層クレートの struct / enum が private 以外の可視性のフィールドを持てば違反
    category: validation
    applies_to: RustRuleEvaluator
    trigger: ddd-rust-domain の評価（申告ファイルごと）
    logic: 対象は申告ファイルの StructDecl（kind = struct）。IF fields のいずれかの visibility ≠ private THEN 所見 a（file、フィールドの行、message "public field <型>.<フィールド> in domain layer"）。enum のバリアントは対象外。struct 自体の可視性は問わない
    violation: 所見（blocking）
    source: FR7.1、Q3、domain-layer-design §6
  - id: BR4.2
    statement: (b) 申告ファイルの固有 impl にある &mut self メソッドのうち classification = undeclared のものは違反。post-init は (c) で扱い、replay-exempt と declared-command は違反にしない
    category: validation
    applies_to: RustRuleEvaluator
    trigger: ddd-rust-domain の評価（申告ファイルごと）
    logic: 対象型は申告ファイルで impl されているドメイン型。IF classification = undeclared THEN 所見 b（message "mutating method <型>::<メソッド> is not declared as command.<aggregate_slug>.<command_slug>"）; IF classification = unknown THEN 所見にせず note に従う（BR3.4）。&self で内部可変性（RefCell / Cell / Mutex）を使う偽装は初版では検査しない（ナレッジ interior-mutability で扱う）
    violation: 所見（blocking）
    source: FR7.2、Q1、Q2、Q5
  - id: BR4.3
    statement: (c) 不完全な生成経路は次の 4 形を独立に違反にする: (c-literal) 型の固有 impl の外にあるドメイン型の struct リテラルまたは update 構文、(c-default) ドメイン型の derive(Default) / impl Default / Default 呼び出し、(c-post-init) classification = post-init の &mut self メソッド、(c-model) 正規モデルの FactoryRule が preconditions に挙げる不変条件を満たす検査を持たない復元経路（初版は判定しない）
    category: validation
    applies_to: RustRuleEvaluator
    trigger: ddd-rust-domain の評価（申告ファイルごと）
    logic: c-literal: ConstructionSite（struct-literal / update-syntax）の type_text が symbols.type_names に含まれ、その位置が同じ型の固有 impl の Span の外 THEN 所見 c。c-default: StructDecl.derives に Default、または ImplBlock の trait_text = Default、または ConstructionSite（default-call）の type_text がドメイン型 THEN 所見 c。c-post-init: MutatorSymbol.classification = post-init THEN 所見 c。c-model は初版では所見にせず、functional-spec.md §8 の未決事項に残す。message には 4 形のどれかを書く
    violation: 所見（blocking）
    source: FR7.3、Q5、domain-layer-design §6
  - id: BR4.4
    statement: (d) ドメイン層・ユースケース層の申告ファイルで、レシーバが self 以外のメソッド呼び出しの名前が symbols.getter_names に含まれれば違反
    category: validation
    applies_to: RustRuleEvaluator
    trigger: ddd-rust-domain と ddd-rust-use-case の評価（申告ファイルごと）
    logic: 対象は CallSite（kind = method-call）。IF receiver_text ∈ {self, &self, &mut self, Self} THEN 対象外; IF callee_text ∈ getter_names THEN 所見 d（message "getter <メソッド> called from <層> layer (Tell, Don't Ask)"）。interface-adapter / rmu / composition-root からの呼び出しは対象外（FR7.4 の判定は呼び出し元の層）
    violation: 所見（blocking）
    source: FR7.4、Q4、domain-layer-design §6・§7-1
  - id: BR4.5
    statement: ドメイン層クレートの依存方向違反は規則 (g)（安全網）として ddd-rust-domain が判定する
    category: validation
    applies_to: RustRuleEvaluator
    trigger: ddd-rust-domain の評価（文脈全体で 1 回）
    logic: 申告ファイルの所属クレートごとに DependencyEdge を作る（BR6.1）。IF verdict ∈ {layer-forbidden, external-io} THEN 所見 g（message には "dependency direction" と辺の根拠を書く）。FR9.5 が定めるとおり、許可表にない依存方向はすべて (g) で報告し、別の rule_id は設けない
    violation: 所見（blocking）
    source: FR9.5、FR7.5、Q6

  # ---------- BR5: ユースケース層の規則（ddd-rust-use-case: g / h / i / d） ----------
  - id: BR5.1
    statement: (g) ユースケース層クレートの依存辺のうち verdict が layer-forbidden または external-io のものは違反
    category: validation
    applies_to: RustRuleEvaluator
    trigger: ddd-rust-use-case の評価（文脈全体で 1 回）
    logic: DependencyEdge（BR6.1）を評価する。layer-forbidden は interface-adapter / rmu / composition-root への依存、external-io は denylist 一致。message には辺の根拠（use パスまたは Cargo.toml の依存名）を書く。同じ (from, to) が use と Cargo の両方にあれば use の所見だけを報告する
    violation: 所見（blocking）
    source: FR7.5、FR9.5、Q6、use-case-layer-design §3・§7
  - id: BR5.2
    statement: (h) ユースケース層の execute の引数に、ドメイン型（symbols.type_names）を値・参照・Box / Arc 包みで受け取る宣言があれば違反
    category: validation
    applies_to: RustRuleEvaluator
    trigger: ddd-rust-use-case の評価（申告ファイルごと）
    logic: 対象は MethodDecl と FnDecl のうち name = execute。各 ParamDecl の type_text から参照記号・ライフタイム・Box< / Arc< / Rc< / Option< の外皮を剥いだ字面（ジェネリック引数の最外）が type_names に含まれる THEN 所見 h（message "execute receives aggregate <型> directly; pass ids and value objects"）。ID 型（名前が Id で終わる）と Domain Primitive はドメイン型でも許可するため、type_names のうち名前が Id で終わる型は (h) の照合から除く
    violation: 所見（blocking）
    source: FR7.6、Q4、use-case-layer-design §3
  - id: BR5.3
    statement: (i) ユースケース層の申告ファイルで、レシーバが self 以外の execute 呼び出し、または名前が UseCase / Interactor で終わる型への関連関数呼び出しからの execute 呼び出しがあれば違反
    category: validation
    applies_to: RustRuleEvaluator
    trigger: ddd-rust-use-case の評価（申告ファイルごと）
    logic: 対象は CallSite。IF kind = method-call AND callee_text = execute AND receiver_text ∉ {self, ..} THEN 所見 i; IF kind = path-call AND callee_text が <Type>::execute の形 THEN 所見 i。message "use case calls another use case (<呼び出し>)"
    violation: 所見（blocking）
    source: FR7.7、use-case-layer-design §3
  - id: BR5.4
    statement: (d) ユースケース層からの getter 呼び出しは BR4.4 と同じ判定を ddd-rust-use-case が行う
    category: validation
    applies_to: RustRuleEvaluator
    trigger: ddd-rust-use-case の評価（申告ファイルごと）
    logic: BR4.4 に同じ
    violation: 所見（blocking）
    source: FR7.4

  # ---------- BR6: 依存辺と IA 層の規則（ddd-rust-interface-adapter: k / l / m / n） ----------
  - id: BR6.1
    statement: 依存辺は (1) 申告ファイルの UsePath の first_segment がメンバークレート名（アンダースコア → ハイフン正規化）または denylist に一致するもの、(2) 所属クレートの Cargo.toml の internal_dependencies と外部依存、から作り、U2 isAllowed と denylist で verdict を付ける
    category: calculation
    applies_to: DependencyEdge
    trigger: 各マニフェストの評価
    logic: crate / self / super / std / core / alloc は辺にしない。to がメンバークレートなら verdict = isAllowed(from, to).reason（ok / layer-forbidden / cross-side）; to が denylist に一致し from の layer ∈ {domain, use-case} なら external-io; それ以外の外部クレートは ok。辺は (file, line, to_crate) で整列する
    violation: なし（判定は BR4.5、BR5.1、BR6.2）
    source: FR9.5、Q6、U2 BR5.1〜BR5.3
  - id: BR6.2
    statement: (k) コマンド側クレートとクエリ側クレートの間の依存辺（verdict = cross-side）は違反。rmu クレートからの辺は違反にしない
    category: validation
    applies_to: RustRuleEvaluator
    trigger: ddd-rust-interface-adapter の評価（文脈全体で 1 回）
    logic: 対象は申告ファイルの所属クレートが interface-adapter / rmu / use-case / domain のいずれでも、cqrs_side が command または query の辺。IF verdict = cross-side THEN 所見 k（message "<from> (command side) references <to> (query side)" またはその逆）。U2 BR5.2 により rmu 発は cross-side にならない。IA 層・rmu クレートの layer-forbidden（IA → rmu など）は規則 g（安全網、FR9.5）として本マニフェストが報告する
    violation: 所見（blocking）
    source: FR7.8、interface-adapter-layer-design §3
  - id: BR6.3
    statement: (l) クエリ側クレートの申告ファイルが、symbols.type_names に含まれる型名を use パスの末尾セグメントまたは引数・フィールドの型の字面に持てば違反。リポジトリポート（名前が Repository で終わる trait / 型）への参照も違反
    category: validation
    applies_to: RustRuleEvaluator
    trigger: ddd-rust-interface-adapter の評価（申告ファイルごと）
    logic: 対象は cqrs_side = query のファイル（BR1.2 の includes_query_side により、実効層が use-case でも interface-adapter でも本マニフェストの対象）。IF UsePath の末尾セグメント ∈ type_names OR ∈ {名前が Repository で終わる} THEN 所見 l; IF FieldDecl / ParamDecl の type_text の最外がそれらに一致 THEN 所見 l。message "query side references domain type / repository port <名前>"
    violation: 所見（blocking）
    source: FR7.9、Q4、interface-adapter-layer-design §4
  - id: BR6.4
    statement: (m) IA 層の申告ファイルに宣言された、名前が Repository で終わる trait / struct / type は、<集約名の PascalCase>Repository（trait）または <任意の接頭辞><集約名>Repository（実装）でなければならず、媒体語を含んではならない
    category: validation
    applies_to: RustRuleEvaluator
    trigger: ddd-rust-interface-adapter の評価（申告ファイルごと）
    logic: 集約名の集合は model.status = available なら索引の aggregate.* の名前セグメントを PascalCase にしたもの、利用不可なら symbols.type_names（ドメイン型名）で代用する。trait <X>Repository: IF <X> ∉ 集約名集合 THEN 所見 m（message "repository port <名前> is not <Aggregate>Repository"）。struct / type <P><X>Repository（実装）: IF 末尾が集約名 + Repository にならない THEN 所見 m; IF 名前に媒体語（DynamoDb / Dynamo / Postgres / Mysql / Sqlite / Redis / Mongo / S3 / Jdbc / Sql / Http / Grpc / Kafka / InMemory。大文字小文字を無視。U4 BR6.4 と同じ一覧）を含む AND それが trait THEN 所見 m。実装 struct の媒体語（InMemoryInvoiceRepository）は許す
    violation: 所見（blocking）
    source: FR7.10、interface-adapter-layer-design §5
  - id: BR6.5
    statement: (n) IA 層・rmu の申告ファイルで、ドメイン型（symbols.type_names）を struct リテラル・update 構文・Default 呼び出しで構築する、または constructors に無い関連関数で構築する箇所は違反。replay 経路（apply / apply_event / replay / on_event の呼び出し）は対象外
    category: validation
    applies_to: RustRuleEvaluator
    trigger: ddd-rust-interface-adapter の評価（申告ファイルごと）
    logic: 対象は ConstructionSite の type_text ∈ type_names。IF kind ∈ {struct-literal, update-syntax, default-call} THEN 所見 n; IF kind = associated-call AND callee_text ∉ 当該型の constructors THEN 所見 n（message "adapter constructs <型> via <経路> instead of a full constructor"）。同じ型名が複数クレートにある場合は constructors の和集合で照合する。正規モデルが利用不可でも本判定は名前一覧だけで行える（Q2 の n-model は「宣言された復元経路との照合」で初版は判定しない）
    violation: 所見（blocking）
    source: FR7.11、Q4、Q5、interface-adapter-layer-design §8

  # ---------- BR7: 報告の形と不透明領域（FR7.12、FR7.13、U2 Q1） ----------
  - id: BR7.1
    statement: 所見は rule_id（a〜n の 1 文字、layer.<code>、model.invalid、runtime.*）、file（workspace 相対）、line、message の 4 項目を持つ
    category: validation
    applies_to: RustRuleEvaluator
    trigger: 所見の追加時
    logic: message は RuleDefinition.statement を雛形に、型・メソッド・クレート名を埋める一文。severity はマニフェストの blocking を U1 が転記する
    violation: U1 BR9.1（runtime-error）
    source: FR7.13、NFR8
  - id: BR7.2
    statement: 判定は U2 の構文的事実と Cargo.toml の事実、正規モデルの索引だけから行い、型推論・名前解決・マクロ展開・実行結果を使わない
    category: constraint
    applies_to: RustRuleEvaluator
    trigger: 常時
    logic: 判定器の入力は entities.md の InspectionContext だけ。tree-sitter の Node を直接扱わない（U2 BR7.1）
    violation: FR7.12 違反（レビューで検出）
    source: FR7.12、NFR1、U2 BR6.4
  - id: BR7.3
    statement: 不透明領域（OpaqueRegion）は所見にせず、verdict の note に「analyzer.macro-opaque: <file>:<line> (<macro>)」を列挙する
    category: policy
    applies_to: InspectionContext
    trigger: 報告の組み立て時
    logic: 3 マニフェストはすべて blocking であり、advisory の所見を混在させられない（ADR-002、U1 BR9.3）。U2 Q1 の「advisory として報告する」は note への転記で満たす。解析エラー（parse-error）も同様に note に載せ、エラー範囲外の事実で判定を続ける
    violation: なし
    source: U2 Q1、ADR-002、U1 BR9.3、NFR8
  - id: BR7.4
    statement: 同じ (file, line, rule_id) の所見は 1 件にまとめる
    category: calculation
    applies_to: RustRuleEvaluator
    trigger: 報告の組み立て時
    logic: 例えば use パスと Cargo 依存の両方から出た (g) は use 側だけを残す（BR5.1）。整列と採番は U1 BR7.7 / BR9.2
    violation: なし
    source: NFR1、FR7.13

  # ---------- BR8: 決定性と性能（NFR1、NFR3） ----------
  - id: BR8.1
    statement: 同一の申告ソース・workspace・正規モデルに対して、3 回実行して JSON が一致しなければならない
    category: constraint
    applies_to: InspectionContext
    trigger: 常時
    logic: ファイル列挙はパスの昇順、辺と所見は (file, line, rule_id) で整列、時刻・乱数・環境変数を含めない。名前一覧の作成順も昇順
    violation: NFR1 の判定に失敗する
    source: NFR1、U1 BR7.7、U2 BR6.3
  - id: BR8.2
    statement: 200 ファイル規模の workspace で 1 マニフェストの実行は 10 秒以内を目安とし、予算超過時は U1 の軟らかい予算で pass:false（budget-exceeded）にする
    category: policy
    applies_to: InspectionContext
    trigger: 評価ループの各ファイル境界
    logic: 名前一覧の作成（BR3.1）は申告数に依らずドメイン層全体を読むため、ドメイン層クレートの解析結果を同一実行内でキャッシュし（U2 BR6.3）、3 マニフェストが同じゲートで走っても各自 1 回だけ解析する。目標値は仮置き（要件 A6）であり、ゴールデンケースの計測で見直す
    violation: pass:false（budget-exceeded）
    source: NFR3、U1 BR7.8
  - id: BR8.3
    statement: 名前一覧の作成対象は layer = domain のクレートに限り、use-case / interface-adapter / rmu / composition-root のクレートは申告ファイル以外を解析しない
    category: constraint
    applies_to: DomainSymbolTable
    trigger: 検査文脈の組み立て時
    logic: (h)(l)(n) の照合はドメイン型名だけで足りる。ユースケース型名の一覧は作らない（(i) は execute の呼び出し形だけで判定する）
    violation: なし
    source: Q4、NFR3

  # ---------- BR9: 言語別検査器の分離（FR8.6、NFR7） ----------
  - id: BR9.1
    statement: RuleDefinition は tools/ddd/lib/rules/ に言語非依存で置き、Rust の判定器は tools/ddd/lib/rules/rust/ に置く。マニフェストのスクリプトは対象層の rule_id 一覧を渡すだけにする
    category: policy
    applies_to: RuleDefinition
    trigger: 常時
    logic: 定義側は rule_id / statement / target_layers / requires_model / facts / source を持ち、判定ロジックを持たない。判定器は U2 の事実の型（言語非依存の名前）だけを入力にする
    violation: レビューで検出（NFR7）
    source: FR8.6、NFR7、ADR-001
  - id: BR9.2
    statement: 固定リスト（replay 除外名、後付け初期化名、媒体語、I/O クレート一覧）は判定器の内部定数にせず、lib/rules/ の定義側に 1 か所で置く
    category: policy
    applies_to: RuleDefinition
    trigger: 常時
    logic: U4 BR6.4 の媒体語一覧と同じ値を共有する（設計側とコード側で意味を揃える、ADR-009）
    violation: レビューで検出
    source: Q5、Q6、ADR-009

  # ---------- BR10: Rust 用ゴールデンケース（FR8.7、NFR4、U4 BR8） ----------
  - id: BR10.1
    statement: fixture は tests/golden/rust/<sensor-id>/<case-name>/ に U4 BR8.1 の構成で置き、record/ には aidlc-state.md・code-summary.md・source-manifest.json を、workspace/ には Cargo.toml と最小のクレート群を置く
    category: constraint
    applies_to: RustGoldenCase
    trigger: fixture 作成時
    logic: source-manifest.json の writes は workspace/ 内の .rs を repo 無しで申告し、ランナーは record/ と workspace/ を同じ一時ディレクトリ配下にコピーして workspace_root を揃える。expected.json は U4 BR8.2 の形（stage = code-generation、output_path = construction/<unit>/code-generation/code-summary.md）
    violation: テストランナーが構成違反として失敗する
    source: FR8.7、U4 Q1、U4 BR8.1、BR8.2
  - id: BR10.2
    statement: rule_id ごとに violation ケース 1 件以上と、規則の例外を通す clean ケースを用意する
    category: constraint
    applies_to: RustGoldenCase
    trigger: fixture 作成時
    logic: 必須の clean ケース: (c) の ES replay 経路（apply_event）、(d) の IA 層からの getter 呼び出し、(k) の rmu からの両側依存、(m) の InMemory 実装名、(h) の Id 型引数、(b) の宣言済み Command、(a) の private フィールド＋業務判断メソッド。必須の violation ケース: a / b / c-literal / c-default / c-post-init / d（domain）/ d（use-case）/ g（use-case → IA の layer-forbidden）/ g（domain → use-case の layer-forbidden）/ g（external-io）/ h / i / k / l / m / n / layer.unknown / layer.conflict / layer.mixed-targets
    violation: 網羅性テストが失敗する
    source: FR8.7、FR7.3、FR7.4、NFR4
  - id: BR10.3
    statement: 正規モデルが無いケース（model_present = false）を各マニフェストに 1 件以上置き、正規モデル依存の規則が note 付きで省略され他の規則は判定されることを固定する
    category: constraint
    applies_to: RustGoldenCase
    trigger: fixture 作成時
    logic: expected.json の note_contains に "model-dependent checks" を書く。正規モデルが EXECUTE なのに読めないケース（model.invalid）も 1 件置く
    violation: テスト失敗
    source: Q2、ADR-004
  - id: BR10.4
    statement: ランナーは U4 のランナーを tests/golden/rust/ に対して使い、実運用と同じ引数で子プロセス起動し、決定性は代表ケースを 3 回実行して検証する。性能の計測ケース（200 ファイル規模）を 1 件置き、所要時間を記録する
    category: constraint
    applies_to: RustGoldenCase
    trigger: テスト実行時
    logic: U4 BR8.4、BR8.5 に同じ。性能ケースは失敗条件を持たず計測値を標準エラーに出す（NFR3 の目安の見直し材料）
    violation: テスト失敗
    source: FR8.5、NFR1、NFR3、U4 BR8.4、BR8.5
```

## ルール要約

| ID | 分類 | 要点 | 出典 |
|---|---|---|---|
| BR1.1〜BR1.4 | マニフェスト | 3 本 blocking、code-summary 契機、層ごとの担当（クエリ側は IA が兼ねる）、層診断は domain が転記、無実行・無通信 | FR8.3、ADR-002、ADR-003 |
| BR2.1〜BR2.4 | 対象 | 申告 .rs のみ、空申告は pass、workspace の根、分類と振り分け | ADR-003、U1 BR8、U2 BR4 |
| BR3.1〜BR3.4 | 名前一覧 | ドメイン層全クレート、型の要約、&mut self の分類、正規モデルの利用可否 | Q1、Q2、Q4、Q5 |
| BR4.1〜BR4.5 | ドメイン層 | (a) 可視性、(b) 未宣言の変更、(c) 4 形、(d) getter、(g) 依存方向 | FR7.1〜FR7.4、FR9.5 |
| BR5.1〜BR5.4 | ユースケース層 | (g) DIP と外部 I/O、(h) execute 引数、(i) 連鎖、(d) getter | FR7.5〜FR7.7、Q6 |
| BR6.1〜BR6.5 | IA 層 | 依存辺、(k) 相互参照、(l) クエリ側、(m) 命名、(n) 復元経路 | FR7.8〜FR7.11 |
| BR7.1〜BR7.4 | 報告 | 4 項目、構文のみ、不透明領域は note、重複統合 | FR7.12、FR7.13、U2 Q1 |
| BR8.1〜BR8.3 | 決定性・性能 | 3 回一致、10 秒目安と予算、一覧はドメイン層だけ | NFR1、NFR3 |
| BR9.1〜BR9.2 | 分離 | 定義と判定器、固定リストは定義側 | FR8.6、NFR7 |
| BR10.1〜BR10.4 | ゴールデンケース | workspace/ 付き構成、網羅、正規モデル無し、ランナー共有と計測 | FR8.7、NFR4 |
