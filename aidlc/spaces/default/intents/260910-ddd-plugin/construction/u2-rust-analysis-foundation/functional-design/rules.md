# 業務ルール — U2 Rust 解析基盤（u2-rust-analysis-foundation）

## Sources

- `inception/units-generation/unit-of-work.md`（U2 の境界: 規則の判定はしない。構文木の事実と層の事実を返す）
- `inception/units-generation/unit-of-work-story-map.md`（U2 の要件: FR8.4、FR8.6、FR9、FR9.1〜FR9.4、FR9.6、NFR2。先に固める要件は FR9.1〜FR9.4 と FR8.4）
- `inception/requirements-analysis/requirements.md`（各規則の出典）
- `inception/domain-design/components.md`（WorkspaceLayerResolver / RustSyntaxAnalyzer の振る舞い）と `decisions.md`（ADR-001、ADR-005）
- `inception/domain-design/domain-design-questions.md`（Q5、Q6）
- `construction/u2-rust-analysis-foundation/functional-design/functional-design-questions.md`（Q1〜Q4）
- `construction/u2-rust-analysis-foundation/functional-design/entities.md`（型の定義）

U2 の規則は「事実をどう決めるか」の規則である。違反判定 (a)〜(n) と依存方向違反（FR9.5）は U5 が所有し、U2 は判定材料（事実と診断と許可表）を返す。ただし層判定の過程で確定する機械的な問題（層不明・食い違い・bin と lib の同居・メンバー外ファイル）は U2 が `LayerDiagnostic` として返し、U5 がそのまま blocking 所見に変換する。

## ルール定義（正）

```yaml
rules:
  # ---------- BR1: Cargo workspace の走査（FR9.1、NFR2） ----------
  - id: BR1.1
    statement: workspace の事実は Cargo.toml の読み取りだけから作り、cargo コマンド・ビルドスクリプト・ネットワークを使わない
    category: constraint
    applies_to: CargoWorkspace
    trigger: 走査時
    logic: 読むのはルートの Cargo.toml と各メンバーの Cargo.toml のみ。Cargo.lock、target/、環境変数は読まない
    violation: レビューで検出（NFR2、NFR9）
    source: FR9.1、NFR2、ADR-005
  - id: BR1.2
    statement: メンバークレートは [workspace].members の glob を展開し exclude を除いた集合とし、[workspace] が無ければルートの [package] を唯一のメンバーとする
    category: calculation
    applies_to: CargoWorkspace
    trigger: 走査時
    logic: IF ルート Cargo.toml が読めない THEN diagnostics に workspace.unreadable; IF members が 1 件も解決できない THEN workspace.no-members。path 依存でメンバー外を指すクレートはメンバーに加えない（そのファイルは unowned になる）
    violation: 診断を返す（blocking）
    source: FR9.1
  - id: BR1.3
    statement: ターゲットは明示宣言（[lib] / [[bin]] / [[test]] / [[example]] / [[bench]] / build）と Cargo の自動検出規約（src/lib.rs、src/main.rs、src/bin/*.rs と src/bin/*/main.rs、tests/*.rs、examples/*.rs、benches/*.rs、build.rs）の和集合とする
    category: calculation
    applies_to: CrateManifest
    trigger: 走査時
    logic: autobins / autotests 等が false のときは自動検出を止める。同じ src_path を持つ重複は 1 件にまとめる
    violation: なし
    source: FR9.1、ADR-005
  - id: BR1.4
    statement: 内部依存は [dependencies] / [dev-dependencies] / [build-dependencies] のうち path 指定がメンバーのディレクトリを指すか、名前がメンバー名と一致するものとする
    category: calculation
    applies_to: CrateManifest
    trigger: 走査時
    logic: workspace = true の依存はルートの [workspace.dependencies] で解決する。外部レジストリ依存は内部依存に含めない
    violation: なし
    source: FR9.5 の材料

  # ---------- BR2: 層の判定（FR9.2〜FR9.4、FR9.6、Q2、Q4） ----------
  - id: BR2.1
    statement: 接尾辞規約は、クレート名が -domain / -use-case / -interface-adapter / -infrastructure のいずれかで終わることとする
    category: calculation
    applies_to: CrateLayerAssignment
    trigger: 判定時
    logic: 末尾一致で判定する。複数に一致することはない
    violation: なし
    source: FR9.2
  - id: BR2.2
    statement: 配置規約は、クレートディレクトリの祖先に packages/<layer>/ または modules/<layer>/ があることとする（<layer> は domain / use-case / interface-adapter / infrastructure）
    category: calculation
    applies_to: CrateLayerAssignment
    trigger: 判定時
    logic: 祖先セグメントを workspace ルートから順に見て最初に一致した <layer> を採る。packages/command/use-case/ のように CQRS 側のセグメントを挟んでもよい（BR3.2）
    violation: なし
    source: FR9.3
  - id: BR2.3
    statement: 接尾辞と配置の両方が当てはまり一致すれば both、片方だけならその規約、どちらも無ければ unknown、両方が当てはまり食い違えば conflict とする
    category: constraint
    applies_to: CrateLayerAssignment
    trigger: 判定時
    logic: IF どちらにも当てはまらない AND composition root でも rmu でもない THEN layer = unknown、diagnostics に layer.unknown（blocking）; IF 両方が当てはまり異なる層を示す THEN layer = unknown、diagnostics に layer.conflict（blocking、両方の根拠を message に書く）
    violation: 診断を返す
    source: FR9.4、Q2
  - id: BR2.4
    statement: composition root は (a) bin ターゲットだけを持つクレート、(b) 接尾辞 -composition-root、(c) 配置 packages|modules/composition-root/ のいずれかとし、層規則の対象外にする
    category: calculation
    applies_to: CrateLayerAssignment
    trigger: 判定時
    logic: IF (a) OR (b) OR (c) THEN is_composition_root = true、layer = composition-root、layer_source = marker。(b)(c) は lib だけのクレート（テスト用の結線など）でも composition root にできる
    violation: なし
    source: FR9.6、ADR-005、domain-design Q5
  - id: BR2.5
    statement: bin ターゲットと lib ターゲットを同時に持つクレートは違反とし、composition root は bin 専用クレートに分ける
    category: constraint
    applies_to: CrateLayerAssignment
    trigger: 判定時
    logic: IF targets に bin と lib の両方がある THEN diagnostics に layer.mixed-targets（blocking）。layer は接尾辞・配置で判定できればその層、できなければ unknown。(b)(c) の印があっても同居は違反
    violation: 診断を返す
    source: Q4
  - id: BR2.6
    statement: 接尾辞・配置の判定は composition root と rmu の印より後に評価しない。印があるクレートは印を優先し、層接尾辞が無くても unknown にしない
    category: policy
    applies_to: CrateLayerAssignment
    trigger: 判定時
    logic: 評価順は BR2.5（同居）→ BR2.4（composition root）→ BR3.1〜BR3.2（rmu を含む CQRS 側）→ BR2.1〜BR2.3（層）。rmu の印があるクレートは layer = rmu、layer_source = marker
    violation: なし
    source: ADR-005、interface-adapter-layer-design §4（RMU は独立ブリッジ）

  # ---------- BR3: CQRS 側の判定（ADR-005、domain-design Q6） ----------
  - id: BR3.1
    statement: 名前規約は、クレート名のセグメントに -command- / -query- を含むか、-rmu で終わる（または -rmu- を含む）こととする
    category: calculation
    applies_to: CrateLayerAssignment
    trigger: 判定時
    logic: ハイフン区切りのセグメント列で照合する。複数の印が同時にあれば cqrs.conflict（blocking）
    violation: 診断を返す
    source: ADR-005
  - id: BR3.2
    statement: 配置規約は、祖先に packages|modules/command/、packages|modules/query/、packages|modules/rmu/ があることとする
    category: calculation
    applies_to: CrateLayerAssignment
    trigger: 判定時
    logic: BR2.2 と同じ走査で判定する
    violation: なし
    source: ADR-005
  - id: BR3.3
    statement: 名前と配置の両方が当てはまり食い違えば cqrs.conflict、どちらも無ければ none（非 CQRS）とする
    category: constraint
    applies_to: CrateLayerAssignment
    trigger: 判定時
    logic: Q2 と同じ方針を CQRS 側にも適用する。conflict のとき cqrs_side = none にせず、診断だけを返し cqrs_side は判定不能として command / query のどちらにも数えない（U5 は診断を blocking 所見にする）
    violation: 診断を返す
    source: Q2 の準用
  - id: BR3.4
    statement: クエリ側にドメイン層クレートがあってはならない
    category: constraint
    applies_to: CrateLayerAssignment
    trigger: 判定時
    logic: IF cqrs_side = query AND layer = domain THEN diagnostics に cqrs.query-domain（blocking）
    violation: 診断を返す
    source: interface-adapter-layer-design §2（クエリ側はドメイン層なし）
  - id: BR3.5
    statement: rmu の印を持つクレートは layer = rmu とし、層接尾辞を要求しない
    category: policy
    applies_to: CrateLayerAssignment
    trigger: 判定時
    logic: IF cqrs_side = rmu THEN layer = rmu（接尾辞があっても rmu を優先し、食い違いにしない）
    violation: なし
    source: interface-adapter-layer-design §4、domain-design Q6（例 billing-rmu）

  # ---------- BR4: ファイルの分類（Q3） ----------
  - id: BR4.1
    statement: ファイルの所属クレートは、クレートディレクトリがファイルパスの祖先であるメンバーのうち最も深いものとする
    category: calculation
    applies_to: FileClassification
    trigger: 分類時
    logic: IF 該当するメンバーが無い THEN role = unowned、effective_layer = unknown、diagnostics に layer.unowned（blocking）
    violation: 診断を返す
    source: FR9.1、Q3
  - id: BR4.2
    statement: クレート内の tests/、examples/、benches/ 配下と build.rs は auxiliary とし、層規則の対象外にする
    category: policy
    applies_to: FileClassification
    trigger: 分類時
    logic: IF パスがクレートディレクトリ直下の tests/ examples/ benches/ の配下 OR build.rs THEN role = auxiliary、effective_layer = auxiliary。U5 はこれらを検査せず note に記録する
    violation: なし
    source: Q3
  - id: BR4.3
    statement: composition root クレートのファイル、および bin 専用クレートの src/main.rs と src/bin/ 配下は composition-root とする
    category: calculation
    applies_to: FileClassification
    trigger: 分類時
    logic: IF 所属クレートの is_composition_root THEN role = composition-root、effective_layer = composition-root
    violation: なし
    source: FR9.6、BR2.4
  - id: BR4.4
    statement: それ以外のファイルは crate-source とし、実効層と CQRS 側は所属クレートの判定結果を継承する
    category: calculation
    applies_to: FileClassification
    trigger: 分類時
    logic: effective_layer = CrateLayerAssignment.layer、cqrs_side = CrateLayerAssignment.cqrs_side
    violation: なし
    source: FR9.1

  # ---------- BR5: 依存方向の許可表（FR9.5 の材料） ----------
  - id: BR5.1
    statement: 層間の許可は interface-adapter → use-case / domain / infrastructure、use-case → domain / infrastructure、domain → infrastructure、rmu → domain / interface-adapter / infrastructure、composition-root → すべて、infrastructure → なし、とする
    category: policy
    applies_to: DependencyPermission
    trigger: 表の生成時
    logic: 表にない組み合わせは allowed = false。同一層内の依存は allowed = true
    violation: なし（判定は U5）
    source: FR9.5、domain-layer-design §7-5、interface-adapter-layer-design §3〜§4
  - id: BR5.2
    statement: command 側と query 側の相互依存は許可しない。rmu 発の依存だけが両側に届く
    category: policy
    applies_to: DependencyPermission
    trigger: 表の生成時
    logic: cross_side_allowed = (from の cqrs_side = rmu)。cqrs_side = none 同士、または片方が none の依存は側の制約を受けない
    violation: なし（判定は U5 の (k)）
    source: interface-adapter-layer-design §3
  - id: BR5.3
    statement: 許可表は判定 API isAllowed(from, to) として公開し、U2 自身は依存違反の所見を作らない
    category: policy
    applies_to: DependencyPermission
    trigger: 常時
    logic: 入力は 2 つの CrateLayerAssignment（または FileClassification）。出力は boolean と理由コード
    violation: なし
    source: FR9.5（U5 に割り当て）、FR8.6

  # ---------- BR6: 構文解析（FR8.4、FR7.12、NFR2） ----------
  - id: BR6.1
    statement: 構文解析は同梱の tree-sitter-rust（WASM）を同梱の web-tree-sitter ランタイムで bun から実行し、cargo・Node.js・ネットワークを使わない
    category: constraint
    applies_to: AnalyzerRuntime
    trigger: 初期化時
    logic: 読み込み元は tools/ddd/wasm/tree-sitter-rust.wasm と tools/ddd/lib/rust/vendor/ のみ。node_modules を参照しない
    violation: レビューで検出（NFR2）
    source: FR8.4、RA-Q7、ADR-001
  - id: BR6.2
    statement: 同梱資産が見つからないときは state = unavailable とし、呼び出し元に「ツール未導入」を伝える
    category: policy
    applies_to: AnalyzerRuntime
    trigger: 初期化時
    logic: 例外ではなく明示的な結果で返す。U1 の実行契約（終了コード 127）に写像するのは呼び出し元のセンサー
    violation: なし
    source: FR8.5、U1 BR7.4
  - id: BR6.3
    statement: 同じバイト列は常に同じ構文的事実を生む
    category: constraint
    applies_to: SyntaxTree
    trigger: 解析時
    logic: 事実の一覧は Span の順に整列して返す。時刻・環境・ファイルシステムの列挙順に依存しない。同一実行内は content_hash でキャッシュする
    violation: NFR1 の判定に失敗する
    source: NFR1、FR7.12
  - id: BR6.4
    statement: 型推論・名前解決・マクロ展開を行わない。事実は字面と位置だけで表す
    category: constraint
    applies_to: SyntaxTree
    trigger: 解析時
    logic: use パスは解決前の文字列、型は字面。Self と impl 対象型の一致だけは字面比較で補助情報として付ける（is_by_value_self_type）
    violation: FR7.12 違反
    source: FR7.12、FR8.6
  - id: BR6.5
    statement: 解析エラーは例外にせず、has_parse_error = true と reason = parse-error の OpaqueRegion で返す
    category: policy
    applies_to: SyntaxTree
    trigger: 解析時
    logic: tree-sitter の ERROR / MISSING ノードの範囲を OpaqueRegion にする。エラー範囲外の事実は通常どおり返す
    violation: なし
    source: Q1、NFR8
  - id: BR6.6
    statement: 中身を判定できないマクロ領域は OpaqueRegion として返し、組み込み属性と derive は不透明にしない
    category: policy
    applies_to: OpaqueRegion
    trigger: 解析時
    logic: item 位置の macro_rules 呼び出し → macro-item; 式位置の呼び出し（println! 等の標準マクロも含む）→ macro-expression（ただし規則の材料になる呼び出しやフィールド代入を含み得るため位置だけを記録する）; 組み込み以外の属性マクロ（#[derive] / #[cfg] / #[test] / #[allow] / #[inline] 以外）→ attribute-macro。derive のトレイト名は StructDecl.derives に載せる
    violation: なし
    source: Q1（advisory の所見 analyzer.macro-opaque の材料）
  - id: BR6.7
    statement: メソッド本体の形は returns-field-only / assigns-field / other / opaque の 4 値に分類する
    category: calculation
    applies_to: MethodDecl
    trigger: 解析時
    logic: returns-field-only = 本体が単一の式で self.<field>、&self.<field>、self.<field>.clone()、self.<field>.as_ref() のいずれか（getter の構文的定義。名前は見ない）; assigns-field = 本体に self.<field> = <expr> または self.<field>.<mutating call> を含む; opaque = 本体が OpaqueRegion に含まれる; それ以外は other
    violation: なし
    source: FR7.4（U5 の (d) の材料）、FR7.2（(b) の材料）、domain-layer-design §6
  - id: BR6.8
    statement: 構築箇所は struct-literal / associated-call / default-call / update-syntax の 4 種で返す
    category: calculation
    applies_to: ConstructionSite
    trigger: 解析時
    logic: Type { .. } → struct-literal; Type::<fn>(..) で <fn> が new / from_* / try_* / restore / reconstitute 等（名前は判定せず callee_text に載せる）→ associated-call; Default::default() / Type::default() → default-call; Type { field, ..expr } → update-syntax
    violation: なし
    source: FR7.3（(c) の材料）、FR7.11（(n) の材料）

  # ---------- BR7: 言語別検査器の分離（FR8.6） ----------
  - id: BR7.1
    statement: 規則モジュール（U5）が消費する事実の型は言語非依存の名前で公開し、tree-sitter のノード型を境界の外に出さない
    category: policy
    applies_to: SyntaxTree
    trigger: 常時
    logic: 公開するのは entities.md の StructDecl 以下の型のみ。tree-sitter の Node / Tree は tools/ddd/lib/rust/ の内部に閉じる
    violation: レビューで検出
    source: FR8.6、ADR-001
  - id: BR7.2
    statement: 解析器の配置は tools/ddd/lib/<lang>/ とし、第 2 言語は同じ事実の型を返す別ディレクトリとして追加する
    category: policy
    applies_to: AnalyzerRuntime
    trigger: 常時
    logic: Rust 固有の判断（receiver の &mut self、derive）は rust/ の内部で事実に写像してから返す
    violation: なし
    source: FR8.6
```

## ルール要約

| ID | 分類 | 要点 | 出典 |
|---|---|---|---|
| BR1.1〜BR1.4 | 走査 | Cargo.toml のみ、メンバー解決、ターゲットの自動検出、内部依存 | FR9.1、NFR2 |
| BR2.1〜BR2.6 | 層 | 接尾辞、配置、一致／不明／食い違い、composition root、bin と lib の同居、評価順 | FR9.2〜FR9.4、FR9.6、Q2、Q4 |
| BR3.1〜BR3.5 | CQRS 側 | 名前セグメント、配置、食い違い、クエリ側にドメイン層なし、rmu は独立層 | ADR-005、IA §2〜§4 |
| BR4.1〜BR4.4 | ファイル | 所属クレート、auxiliary、composition-root、継承 | Q3、FR9.6 |
| BR5.1〜BR5.3 | 許可表 | 層間、CQRS 側、判定 API | FR9.5（材料） |
| BR6.1〜BR6.8 | 解析 | 同梱 WASM、資産欠落、決定性、字面のみ、解析エラー、不透明領域、本体の形、構築箇所 | FR8.4、FR7.12、NFR1、NFR2、Q1 |
| BR7.1〜BR7.2 | 分離 | 言語非依存の事実の型、lib/<lang>/ の境界 | FR8.6 |
