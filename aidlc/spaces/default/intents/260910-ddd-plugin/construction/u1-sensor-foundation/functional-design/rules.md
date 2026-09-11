# 業務ルール — U1 センサー基盤（u1-sensor-foundation）

## Sources

- `inception/units-generation/unit-of-work.md`（U1 の責務と境界: 規則そのものは持たず、Rust 構文と Cargo には触れない）
- `inception/units-generation/unit-of-work-story-map.md`（U1 の要件: FR2、FR2.1〜FR2.7、FR8、FR8.5、NFR8、NFR9。先に固める要件は FR8.5 と FR2.1〜FR2.3）
- `inception/requirements-analysis/requirements.md`（各規則の出典）
- `inception/domain-design/components.md`（SensorRuntime / DomainModelSchema の振る舞い）と `decisions.md`（ADR-001、ADR-003、ADR-004）
- `construction/u1-sensor-foundation/functional-design/functional-design-questions.md`（Q1〜Q4）
- `construction/u1-sensor-foundation/functional-design/entities.md`（型の定義）
- エンジンのディスパッチャ `.claude/tools/aidlc-sensor.ts`（終了コードと標準出力 JSON の解釈）

U1 の「業務ルール」は、正規モデルの構造規則（下流のセンサーと成果物が共有する検査の土台）と、センサー実行スクリプトが従う実行契約の 2 群である。規則の検査主体が U1（読み込み器・検証器・ランタイム）である点に注意。個別の DDD 規則 (a)〜(n) の判定は U4・U5 が所有し、U1 は判定材料と報告の形式だけを提供する。

## ルール定義（正）

```yaml
rules:
  # ---------- BR1: 安定 ID の文法と参照解決（FR2.3） ----------
  - id: BR1.1
    statement: element_id は「種別接頭辞 + 1 個以上の小文字ケバブのセグメント」を . で連結した文字列でなければならない
    category: validation
    applies_to: ElementId
    trigger: domain-model.yaml の読み込み時
    logic: IF value が ^(bc|aggregate|entity|vo|primitive|invariant|command|event|error|transition|factory|pm)(\.[a-z][a-z0-9-]*)+$ に一致しない THEN 構造違反（規則 ID schema.id-grammar）
    violation: 読み込みを失敗にし、違反 ID と位置を所見にする
    source: FR2.3、Q1
  - id: BR1.2
    statement: element_id は文書内で一意でなければならず、系譜に記録された廃止 ID は再利用できない
    category: constraint
    applies_to: DomainModel
    trigger: 読み込み時の索引構築
    logic: IF 同じ value が本文に 2 回以上現れる OR 本文の value が lineage の split / merged / deprecated の element_id と一致する THEN 違反（schema.id-duplicate / schema.id-reused）
    violation: 読み込みを失敗にする
    source: FR2.3、FR2.4
  - id: BR1.3
    statement: 種別ごとに名前セグメントの個数と意味を固定する
    category: validation
    applies_to: ElementId
    trigger: 読み込み時
    logic: IF kind ∈ {bc, aggregate, entity, vo, primitive, pm} THEN セグメントは 1 個（名前）; IF kind ∈ {invariant, command, event, transition, factory} THEN 2 個（集約名, 名前）; IF kind = error THEN 3 個（集約名, コマンド名, 名前）; それ以外は違反（schema.id-arity）
    violation: 読み込みを失敗にする
    source: Q1、ddd/docs/domain-layer-design.md §4
  - id: BR1.4
    statement: ID に含まれる集約名（およびコマンド名）は、その要素を所有する Aggregate（Command）の名前セグメントと一致しなければならない
    category: constraint
    applies_to: Invariant, Command, DomainEvent, DomainError, StateTransition, FactoryRule
    trigger: 読み込み時
    logic: IF invariant.<x>.<n> の <x> ≠ 所有 Aggregate の aggregate.<x> THEN 違反（schema.id-owner-mismatch）; error.<x>.<c>.<n> では <c> ≠ 所有 Command の command.<x>.<c> でも違反
    violation: 読み込みを失敗にする
    source: Q1
  - id: BR1.5
    statement: 参照属性の ID は、期待する種別の現行要素に解決できなければならない
    category: validation
    applies_to: 参照属性を持つ全要素（aggregate / bounded_context / root_element / command / produced_by / target_element / transitions / events / aggregates / steps.command / element）
    trigger: 索引構築後の参照解決
    logic: IF 参照先が索引に無い THEN 未定義参照（schema.ref-undefined）; IF 参照先が廃止 ID THEN 廃止参照（schema.ref-deprecated）; IF 参照先の kind が期待と異なる THEN 種別違反（schema.ref-kind）
    violation: 検証報告に所見を積み、resolve の結果を unresolved(reason) で返す。下流センサー (e) はこの結果を blocking 所見に変換する
    source: FR2.3、FR6.1、機械完了条件 (iv)

  # ---------- BR2: ID の系譜（FR2.4） ----------
  - id: BR2.1
    statement: 系譜の relation は renamed / split / merged / deprecated のいずれかで、relation ごとの必須属性を満たす
    category: validation
    applies_to: ElementLineage
    trigger: 読み込み時
    logic: IF renamed THEN previous_name 必須; IF split THEN successors が 2 件以上かつ deprecated_at 必須; IF merged THEN replaced_by と deprecated_at 必須; IF deprecated THEN deprecated_at 必須; 満たさなければ違反（lineage.shape）
    violation: 読み込みを失敗にする
    source: FR2.4
  - id: BR2.2
    statement: split / merged / deprecated の対象 ID は本文の現行要素として存在してはならず、renamed の対象 ID は存在しなければならない
    category: constraint
    applies_to: ElementLineage
    trigger: 索引構築後
    logic: IF relation ∈ {split, merged, deprecated} AND element_id が索引にある THEN 違反（lineage.still-live）; IF relation = renamed AND element_id が索引に無い THEN 違反（lineage.renamed-missing）
    violation: 読み込みを失敗にする
    source: FR2.4、ddd/docs/domain-layer-design.md §5
  - id: BR2.3
    statement: replaced_by と successors がなす置換関係は非循環でなければならない
    category: constraint
    applies_to: ElementLineage
    trigger: 索引構築後
    logic: 置換グラフ（element_id → replaced_by / successors）を深さ優先で辿り、IF 訪問中の ID に再到達 THEN 循環違反（lineage.cycle）
    violation: 読み込みを失敗にする。循環に含まれる ID 列を所見にする
    source: FR2.4
  - id: BR2.4
    statement: replaced_by / successors の各 ID は現行要素か、系譜内で更に置換された ID のいずれかでなければならない
    category: constraint
    applies_to: ElementLineage
    trigger: 索引構築後
    logic: IF 後継 ID が索引にも系譜にも無い THEN 違反（lineage.successor-unknown）
    violation: 読み込みを失敗にする
    source: FR2.4

  # ---------- BR3: 構造の完全性（FR2.1、FR2.2、機械完了条件 (i)〜(iii)） ----------
  - id: BR3.1
    statement: 文書は DomainModel → BoundedContext → Aggregate → 要素群 の包含構造を持ち、schema_version は 1 でなければならない
    category: validation
    applies_to: DomainModel
    trigger: 読み込み時
    logic: IF schema_version ≠ 1 OR bounded_contexts が空 OR いずれかの BoundedContext の aggregates が空 THEN 違反（schema.structure）
    violation: 読み込みを失敗にする
    source: FR2.1
  - id: BR3.2
    statement: すべての Aggregate は 1 件以上の Invariant を持つ
    category: constraint
    applies_to: Aggregate
    trigger: 完全性検査（U4 の model-completeness (i) が呼ぶ API）
    logic: IF invariants の件数（element 限定のものを含む）= 0 THEN 違反（completeness.i）
    violation: 完全性報告に所見を積む（読み込み自体は成功させる。ゲートで止めるかは U4 が決める）
    source: FR1.8 (i)、FR6.5
  - id: BR3.3
    statement: すべての Command は state_effect を宣言し、transitions と整合していなければならない
    category: constraint
    applies_to: Command
    trigger: 完全性検査
    logic: IF state_effect = transitions AND transitions が空 THEN 違反（completeness.ii）; IF state_effect = none AND transitions が空でない THEN 違反（completeness.ii）; IF transitions の各 ID の command ≠ 自分 THEN 違反（schema.transition-owner）
    violation: 完全性報告に所見を積む
    source: FR1.8 (ii)、FR6.5
  - id: BR3.4
    statement: すべての Command は 1 件以上の DomainError を持つ
    category: constraint
    applies_to: Command
    trigger: 読み込み時（スキーマ違反として扱う）
    logic: IF domain_errors が空 THEN 違反（schema.command-no-error）
    violation: 読み込みを失敗にする（FR2.2 は「スキーマ違反」と定めている）
    source: FR2.2、FR1.8 (iii)
  - id: BR3.5
    statement: Aggregate の root_element は kind = entity で、その Aggregate の elements に含まれる
    category: constraint
    applies_to: Aggregate
    trigger: 索引構築後
    logic: IF root_element が elements に無い OR その kind ≠ entity THEN 違反（schema.root-element）
    violation: 読み込みを失敗にする
    source: FR2.1
  - id: BR3.6
    statement: StateTransition の from_state / to_state は所有 Aggregate の states に含まれる（from_state は特別値 initial を許す）
    category: constraint
    applies_to: StateTransition
    trigger: 索引構築後
    logic: IF transitions が 1 件以上 AND states が空 THEN 違反（schema.states-missing）; IF from_state ∉ states ∪ {initial} OR to_state ∉ states THEN 違反（schema.state-unknown）
    violation: 読み込みを失敗にする
    source: FR2.1、集約＝FSM 原則（ddd/docs/domain-layer-design.md §9）
  - id: BR3.7
    statement: DomainEvent の produced_by は同じ Aggregate の Command であり、Command.events と相互に整合する
    category: constraint
    applies_to: DomainEvent, Command
    trigger: 索引構築後
    logic: IF produced_by の aggregate ≠ event の aggregate THEN 違反（schema.event-owner）; IF command.events に含まれる event の produced_by ≠ command THEN 違反（schema.event-link）
    violation: 読み込みを失敗にする
    source: FR2.1
  - id: BR3.8
    statement: DomainElement の kind と element_id の接頭辞は一致し、domain-primitive は包む値をちょうど 1 つ持つ
    category: validation
    applies_to: DomainElement
    trigger: 読み込み時
    logic: IF kind = entity AND 接頭辞 ≠ entity（vo と value-object、primitive と domain-primitive も同様）THEN 違反（schema.kind-prefix）; IF kind = domain-primitive AND attributes の件数 ≠ 1 THEN 違反（schema.primitive-shape）
    violation: 読み込みを失敗にする
    source: FR2.1、FR2.3
  - id: BR3.9
    statement: 正規モデルはモジュール・デプロイ単位・ユースケース手順のキーを持たない
    category: constraint
    applies_to: DomainModel
    trigger: 読み込み時
    logic: IF スキーマに無いキー（module、crate、deployment、use_case など未知キー）が現れる THEN 違反（schema.unknown-key）
    violation: 読み込みを失敗にする。未知キーの許容は行わない（所有権の境界 FR1.9 を機械的に守る）
    source: FR1.9、FR2.1

  # ---------- BR4: 冪等性戦略（FR2.5） ----------
  - id: BR4.1
    statement: すべての Command は effect と idempotency.strategy を宣言する
    category: validation
    applies_to: Command
    trigger: 読み込み時
    logic: IF effect が無い OR idempotency が無い OR strategy ∉ {none, command-id-memory} THEN 違反（schema.idempotency-missing）
    violation: 読み込みを失敗にする
    source: FR2.5、Q3
  - id: BR4.2
    statement: effect = accumulation の Command は strategy = command-id-memory でなければならない
    category: constraint
    applies_to: Command
    trigger: 完全性検査（U4 の (j) 検査が呼ぶ API）
    logic: IF effect = accumulation AND strategy = none THEN 違反（idempotency.j）
    violation: 完全性報告に所見を積む（ゲートで止めるかは U4 の mapping-declarations が決める）
    source: FR2.5、FR6.3、Q3
  - id: BR4.3
    statement: strategy = command-id-memory は保持方針を完全に宣言する
    category: validation
    applies_to: IdempotencyPolicy
    trigger: 読み込み時
    logic: IF retention が無い THEN 違反; IF retention = multiple AND retention_count が無い THEN 違反; IF retention = time-window AND retention_window が無い THEN 違反（schema.retention）
    violation: 読み込みを失敗にする
    source: FR2.5、ddd/docs/use-case-layer-design.md §5-4・§5-5

  # ---------- BR5: Process Manager（FR2.6） ----------
  - id: BR5.1
    statement: Process Manager は任意の要素であり、未定義でも読み込みは成功する。必須化はアクターモデル宣言時に U4 が行う
    category: policy
    applies_to: BoundedContext
    trigger: 読み込み時
    logic: IF process_managers が無い THEN 空として扱い、違反にしない
    violation: なし
    source: FR2.6
  - id: BR5.2
    statement: Process Manager は 2 件以上の Aggregate を対象とし、各ステップの Command は対象 Aggregate のものでなければならない
    category: constraint
    applies_to: ProcessManager
    trigger: 索引構築後
    logic: IF aggregates の件数 < 2 THEN 違反（schema.pm-aggregates）; IF steps または compensations の command の aggregate ∉ aggregates THEN 違反（schema.pm-step-owner）; IF steps.on_failure が compensations の名前に無い THEN 違反（schema.pm-compensation）
    violation: 読み込みを失敗にする
    source: FR2.6、ddd/docs/use-case-layer-design.md §4

  # ---------- BR6: yaml を正とする（FR2.7） ----------
  - id: BR6.1
    statement: 読み込み器は domain-model.yaml だけを読み、domain-model.md は読まない。md との整合検査（(f)）は U4 が、U1 が返す要素索引を使って行う
    category: policy
    applies_to: DomainModel
    trigger: 常時
    logic: 読み込み器の入力は yaml のパスのみ。ElementIndex は id・kind・name・所有関係・不変条件の statement を公開する
    violation: なし（設計上の境界）
    source: FR2.7、FR6.2
  - id: BR6.2
    statement: 読み込みに失敗した場合、部分的な索引を返さない
    category: constraint
    applies_to: DomainModel
    trigger: 読み込み時
    logic: IF いずれかの読み込み時違反（BR1〜BR5 の「読み込みを失敗にする」規則）がある THEN 結果は failure(所見一覧) で、索引は生成しない
    violation: 呼び出し元のセンサーは所見をそのまま報告する
    source: FR2.7、NFR1

  # ---------- BR7: センサー実行契約（FR8.5、FR8） ----------
  - id: BR7.1
    statement: スクリプトは --stage <slug> と --output-path <path>（code 系センサーでは --file-path <path>）を受け取り、未知の引数は無視する
    category: validation
    applies_to: SensorRunContext
    trigger: スクリプト起動時
    logic: IF --stage が無い OR パス引数が無い THEN 引数違反として pass:false、reason に不足を書く（終了コードは 0）
    violation: pass:false の報告
    source: FR8.5、ディスパッチャの scriptArgs
  - id: BR7.2
    statement: スクリプトは標準出力に SensorVerdict の JSON をちょうど 1 行書き、終了コード 0 で終わる
    category: constraint
    applies_to: SensorVerdict
    trigger: 実行終了時
    logic: 標準出力には verdict 以外を書かない（ログは標準エラー）。pass は boolean、findings_count は整数
    violation: ディスパッチャは bad-output として advisory の pass 扱いにするため、規約違反は違反の見逃しになる
    source: FR8.5、ディスパッチャの分岐 c/d/f
  - id: BR7.3
    statement: 違反の報告は必ず「終了コード 0 + pass:false」で行い、非 0 終了コードで違反を表してはならない
    category: constraint
    applies_to: SensorRuntime
    trigger: 実行終了時
    logic: 非 0 終了コード（127 を除く）はディスパッチャが advisory の script-error として pass 扱いにする。blocking を実効させるには pass:false が唯一の経路
    violation: 違反の見逃し（SM2 の失敗）
    source: FR8.5、CON4
  - id: BR7.4
    statement: 終了コード 127 は「同梱ランタイム資産が見つからない」場合にだけ使う
    category: policy
    applies_to: SensorRuntime
    trigger: 起動時の資産確認
    logic: IF 同梱物（U2 の WASM など呼び出し元が要求した資産）が無い THEN 127 で終了（tool-unavailable として記録される）
    violation: なし
    source: FR8.5、ディスパッチャの分岐 b
  - id: BR7.5
    statement: 予期しない例外は握りつぶさず、pass:false と reason（例外の要約）で報告する（フェイルクローズ）
    category: policy
    applies_to: SensorRuntime
    trigger: 評価中の例外
    logic: IF 評価コールバックが例外を投げる THEN findings は空、pass:false、reason に "runtime-error: <要約>" を書き、終了コード 0
    violation: なし。blocking センサーではゲートが閉じ、監査付き override で先へ進める（CON9）
    source: NFR8、構築フェーズ規約（黙って失敗しない）
  - id: BR7.6
    statement: ランタイムはネットワークにアクセスせず、対象コードや外部コマンドを実行しない
    category: constraint
    applies_to: SensorRuntime
    trigger: 常時
    logic: 使用するのはファイル読み取り・パス解決・JSON/YAML の解析のみ。子プロセスの生成・HTTP・環境変数からの認証情報参照を行わない
    violation: レビューで検出（NFR9 の判定）
    source: NFR2、NFR9
  - id: BR7.7
    statement: 同一入力に対する出力は決定的でなければならない
    category: constraint
    applies_to: SensorVerdict
    trigger: 報告の組み立て時
    logic: findings は (file, line, rule_id, message) で整列し、finding_id はその順序の連番。時刻・乱数・環境依存の値を JSON に含めない
    violation: NFR1 の判定（3 回実行で一致）に失敗する
    source: NFR1、FR7.12
  - id: BR7.8
    statement: 呼び出し元が budget_ms を渡したとき、予算超過時点で評価を打ち切り pass:false と reason "budget-exceeded" を報告する
    category: policy
    applies_to: SensorRunContext
    trigger: 評価ループの各ファイル境界
    logic: IF 経過時間 > budget_ms THEN 残りの対象を検査せずに打ち切る。ディスパッチャの硬い timeout（SIGTERM → BUDGET_OVERRIDE）より先に報告するための軟らかい予算
    violation: なし
    source: NFR3、ディスパッチャの分岐 a

  # ---------- BR8: 記録ディレクトリと申告ソースの解決（ADR-003、ADR-004） ----------
  - id: BR8.1
    statement: record_dir は output_path の祖先のうち aidlc-state.md を含む最も近いディレクトリ、workspace_root はその祖先のうち aidlc/ を含むディレクトリとする
    category: calculation
    applies_to: SensorRunContext
    trigger: 文脈解決時
    logic: IF どちらも見つからない THEN pass:false、reason "record-dir-unresolved"（読み込み対象が特定できない状態で pass にしない）
    violation: pass:false の報告
    source: FR8.5、ADR-004
  - id: BR8.2
    statement: unit は output_path が record_dir/construction/<unit>/ の配下にあるときだけ設定する
    category: calculation
    applies_to: SensorRunContext
    trigger: 文脈解決時
    logic: パスセグメントで判定する。Unit 名は ^[a-z][a-z0-9-]*$（既存の legacy 名も受け入れる）
    violation: なし
    source: ADR-003
  - id: BR8.3
    statement: StageStatus は aidlc-state.md の Stage Progress 行「- [c] <slug> — EXECUTE|SKIP: ...」から読み、行が無ければ absent とする
    category: calculation
    applies_to: StageStatus
    trigger: 呼び出し元（U4 の model-presence）の要求時
    logic: 行の正規表現は ^- \[(.)\] (slug) — (EXECUTE|SKIP)。状態ファイルが無い／読めない場合も absent。書き込みは行わない
    violation: なし
    source: ADR-004、state-template の Stage Progress
  - id: BR8.4
    statement: 申告ソースは record_dir/construction/<unit>/code-generation/source-manifest.json から読み、エンジンと同じ厳密スキーマ（stage / unit / version=1 / writes[{path, repo?}]）で検証する
    category: validation
    applies_to: SourceClaim
    trigger: code 系センサーの要求時
    logic: IF ファイルが無い OR 未知キー OR version ≠ 1 OR stage ≠ code-generation OR unit ≠ 文脈の unit THEN pass:false、reason "source-manifest-invalid"
    violation: pass:false の報告
    source: ADR-003、code-generation ステージの source-manifest 契約
  - id: BR8.5
    statement: 申告パスは workspace_root（repo 付きは repo のルート）に対して解決し、その外を指すパスは検査せず所見にする
    category: constraint
    applies_to: SourceClaim
    trigger: 解決時
    logic: IF 解決後の絶対パスが root の配下でない THEN finding（rule_id runtime.claim-out-of-scope、severity blocking）; ディレクトリ申告は呼び出し元の拡張子フィルタで展開する
    violation: 所見として報告
    source: ADR-003（セキュリティ・コンプライアンス）
  - id: BR8.6
    statement: ランタイムは記録ディレクトリにもワークスペースにも書き込まない
    category: constraint
    applies_to: SensorRuntime
    trigger: 常時
    logic: 詳細ファイルはディスパッチャが書く。ランタイムの出力先は標準出力（verdict）と標準エラー（ログ）のみ
    violation: レビューで検出
    source: ADR-004、NFR9

  # ---------- BR9: 所見の形式（FR7.13、NFR8） ----------
  - id: BR9.1
    statement: 所見は rule_id・file・message を必ず持ち、行を特定できるときは line を持つ
    category: validation
    applies_to: SensorFinding
    trigger: 所見の追加時
    logic: IF rule_id / file / message のいずれかが空 THEN ランタイムが例外を投げる（センサー実装の欠陥として BR7.5 で報告）
    violation: pass:false（runtime-error）
    source: FR7.13、NFR8
  - id: BR9.2
    statement: finding_id は <sensor_id>:<rule_id>:<連番> とし、整列後に採番する
    category: calculation
    applies_to: SensorFinding
    trigger: 報告の組み立て時
    logic: 連番は 1 起点、整列は BR7.7 の順序
    violation: なし
    source: NFR1、NFR8
  - id: BR9.3
    statement: pass は所見が 0 件のときだけ true。advisory の所見も pass:false で報告し、止めるかどうかはマニフェストの default_severity が決める
    category: policy
    applies_to: SensorVerdict
    trigger: 報告の組み立て時
    logic: pass = (findings_count = 0)。severity はマニフェストの重大度を所見に転記する（混在させない）
    violation: なし
    source: FR8.2、CON4、FR6.6
```

## ルール要約

| ID | 分類 | 要点 | 出典 |
|---|---|---|---|
| BR1.1〜BR1.5 | ID | 文法・一意性・種別ごとの段数・所有者一致・参照解決 | FR2.3、Q1 |
| BR2.1〜BR2.4 | 系譜 | relation ごとの必須属性、廃止 ID は本文に残さない、置換は非循環、後継は既知 | FR2.4、Q2 |
| BR3.1〜BR3.9 | 構造 | 包含構造、不変条件 1 件以上、state_effect の整合、Domain Error 必須、root は entity、状態名の整合、Event の所有、kind と接頭辞、未知キー拒否 | FR2.1、FR2.2、FR1.8、FR1.9 |
| BR4.1〜BR4.3 | 冪等性 | effect と strategy 必須、accumulation は command-id-memory、保持方針の完全宣言 | FR2.5、Q3 |
| BR5.1〜BR5.2 | Process Manager | 任意要素、2 集約以上、ステップと補償の整合 | FR2.6 |
| BR6.1〜BR6.2 | 正の所在 | yaml のみ読む、失敗時は部分索引を返さない | FR2.7 |
| BR7.1〜BR7.8 | 実行契約 | 引数、JSON 1 行と終了コード 0、違反は pass:false、127 は資産欠落、フェイルクローズ、無通信・無実行、決定性、軟らかい予算 | FR8.5、NFR1、NFR2、NFR9 |
| BR8.1〜BR8.6 | 解決 | record_dir と workspace_root、unit、Stage Progress、source-manifest の厳密スキーマ、範囲外パス、書き込み禁止 | ADR-003、ADR-004 |
| BR9.1〜BR9.3 | 所見 | 必須項目、finding_id、pass の定義と severity の転記 | FR7.13、NFR8 |
