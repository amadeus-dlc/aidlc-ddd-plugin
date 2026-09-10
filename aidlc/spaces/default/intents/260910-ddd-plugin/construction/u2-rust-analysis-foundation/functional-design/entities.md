# エンティティモデル — U2 Rust 解析基盤（u2-rust-analysis-foundation）

## Sources

- `inception/units-generation/unit-of-work.md`（U2 の責務: RustSyntaxAnalyzer と WorkspaceLayerResolver。規則の判定はせず、構文木の事実と層の事実だけを返す。kind は library）
- `inception/units-generation/unit-of-work-story-map.md`（U2 に割り当てた要件: FR8.4、FR8.6、FR9、FR9.1〜FR9.4、FR9.6、NFR2）
- `inception/requirements-analysis/requirements.md`（FR9 層判定、FR8.4 WASM 同梱、FR8.6 言語別検査器の分離、FR7.12 構文解析ベースの判定、NFR2 実行時依存）
- `inception/domain-design/components.md`（RustSyntaxAnalyzer / WorkspaceLayerResolver の振る舞い、CrateLayerAssignment）
- `inception/domain-design/decisions.md`（ADR-001 配置と同梱、ADR-005 層・CQRS 側・composition root の判定規約）
- `inception/domain-design/domain-design-questions.md`（Q5 composition root、Q6 CQRS 側の識別）
- `construction/u2-rust-analysis-foundation/functional-design/functional-design-questions.md`（Q1 マクロ不透明箇所、Q2 食い違い、Q3 補助ターゲット、Q4 bin と lib の同居）
- `ddd/docs/domain-layer-design.md` §7-5、`ddd/docs/interface-adapter-layer-design.md` §2〜§4

本書は U2 が所有する型の定義である。Cargo workspace の事実（WorkspaceLayerResolver 側）と、Rust ソースの構文的事実（RustSyntaxAnalyzer 側）の 2 群からなる。どちらも「事実」であり、違反かどうかの判定（規則 (a)〜(n)、依存方向）は U5 が行う。ただし層の判定そのものに含まれる違反（層不明、食い違い、bin と lib の同居）は U2 が診断として返す。

## エンティティ定義（正）

```yaml
entities:
  # ---------- WorkspaceLayerResolver: Cargo workspace の事実 ----------
  - name: CargoWorkspace
    description: 走査した Cargo workspace。ルートの Cargo.toml と各メンバーの Cargo.toml だけから作る
    attributes:
      - { name: root_path, type: string, required: true, constraints: "workspace ルートの絶対パス（Cargo.toml を含む）" }
      - { name: members, type: list<CrateManifest>, required: true, constraints: "1 件以上。[workspace] が無いときはルートクレート 1 件" }
      - { name: diagnostics, type: list<LayerDiagnostic>, required: true, default: "[]", constraints: "走査時に見つかった workspace 単位の問題（Cargo.toml が読めない、members の glob が何にも一致しない）" }
    relationships:
      - { target: CrateManifest, cardinality: "1..*", direction: contains }

  - name: CrateManifest
    description: メンバークレート 1 つの Cargo.toml から読んだ事実
    attributes:
      - { name: name, type: string, required: true, unique: true, constraints: "[package].name" }
      - { name: path, type: string, required: true, constraints: "クレートディレクトリの workspace ルートからの相対パス。ルートクレートは ." }
      - { name: targets, type: list<CargoTarget>, required: true, constraints: "1 件以上" }
      - { name: internal_dependencies, type: list<string>, required: true, default: "[]", constraints: "[dependencies] / [dev-dependencies] / [build-dependencies] のうち、他のメンバークレートを指すもの（path 指定または名前一致）のクレート名" }
    relationships:
      - { target: CargoTarget, cardinality: "1..*", direction: contains }
      - { target: CrateManifest, cardinality: "0..*", direction: depends-on }

  - name: CargoTarget
    description: クレートのビルドターゲット。明示宣言と Cargo の自動検出規約の両方から得る
    attributes:
      - { name: kind, type: enum, allowed: [lib, bin, test, example, bench, build-script], required: true }
      - { name: name, type: string, required: true }
      - { name: src_path, type: string, required: true, constraints: "クレートディレクトリからの相対パス（例: src/lib.rs、src/main.rs、src/bin/x.rs、tests/x.rs、build.rs）" }

  - name: CrateLayerAssignment
    description: クレート 1 つの層・CQRS 側・composition root の判定結果（ADR-005 の規約を適用した事実）
    attributes:
      - { name: crate_name, type: string, required: true, unique: true, references: CrateManifest }
      - { name: path, type: string, required: true }
      - { name: layer, type: enum, allowed: [domain, use-case, interface-adapter, infrastructure, rmu, composition-root, unknown], required: true, constraints: "rmu は CQRS の RMU ブリッジ、composition-root は層規則の対象外、unknown は判定不能（違反）" }
      - { name: layer_source, type: enum, allowed: [suffix, directory, both, marker, none], required: true, constraints: "layer をどの規約で決めたか。both = 接尾辞と配置が一致、marker = composition root / rmu の印" }
      - { name: cqrs_side, type: enum, allowed: [command, query, rmu, none], required: true, constraints: "印が無ければ none（非 CQRS）" }
      - { name: cqrs_source, type: enum, allowed: [segment, directory, both, none], required: true }
      - { name: is_composition_root, type: boolean, required: true }
      - { name: targets, type: list<CargoTarget>, required: true }
      - { name: diagnostics, type: list<LayerDiagnostic>, required: true, default: "[]", constraints: "層不明、食い違い、bin と lib の同居、クエリ側のドメイン層など" }
    constraints:
      - layer = unknown のとき diagnostics に layer.unknown または layer.conflict が 1 件以上ある（BR2.3）
      - is_composition_root = true のとき layer = composition-root（BR2.4）
    relationships:
      - { target: CrateManifest, cardinality: "1", direction: describes }
      - { target: LayerDiagnostic, cardinality: "0..*", direction: contains }

  - name: LayerDiagnostic
    description: 層判定で見つかった機械的な問題。U5 がそのまま所見に変換できる形
    attributes:
      - { name: code, type: enum, allowed: [layer.unknown, layer.conflict, layer.mixed-targets, layer.unowned, cqrs.conflict, cqrs.query-domain, workspace.unreadable, workspace.no-members], required: true }
      - { name: severity, type: enum, allowed: [blocking, advisory], required: true, constraints: "初版はすべて blocking（BR2、BR3、BR4）" }
      - { name: crate_name, type: string, required: false }
      - { name: file, type: string, required: true, constraints: "根拠となる Cargo.toml またはファイルの workspace 相対パス" }
      - { name: message, type: string, required: true }

  - name: FileClassification
    description: 申告された 1 ファイルの所属クレート・役割・実効層
    attributes:
      - { name: file, type: string, required: true, unique: true, constraints: "workspace ルートからの相対パス" }
      - { name: crate_name, type: string, required: false, references: CrateManifest, constraints: "所属クレート。無ければ unowned" }
      - { name: target_kind, type: enum, allowed: [lib, bin, test, example, bench, build-script, unknown], required: true }
      - { name: role, type: enum, allowed: [crate-source, composition-root, auxiliary, unowned], required: true, constraints: "auxiliary = tests/ examples/ benches/ build.rs（Q3、検査対象外）" }
      - { name: effective_layer, type: enum, allowed: [domain, use-case, interface-adapter, infrastructure, rmu, composition-root, auxiliary, unknown], required: true }
      - { name: cqrs_side, type: enum, allowed: [command, query, rmu, none], required: true }
    relationships:
      - { target: CrateLayerAssignment, cardinality: "0..1", direction: derived-from }

  - name: DependencyPermission
    description: 層と CQRS 側の依存方向の許可表の 1 行（FR9.5 の表。判定は U5 が行う）
    attributes:
      - { name: from_layer, type: enum, allowed: [domain, use-case, interface-adapter, infrastructure, rmu, composition-root], required: true }
      - { name: to_layer, type: enum, allowed: [domain, use-case, interface-adapter, infrastructure, rmu, composition-root], required: true }
      - { name: allowed, type: boolean, required: true }
      - { name: cross_side_allowed, type: boolean, required: true, constraints: "from の CQRS 側と to の CQRS 側が異なる（command ⇄ query）依存を許すか。rmu 発のみ true" }

  # ---------- RustSyntaxAnalyzer: 構文的事実 ----------
  - name: Span
    description: ソース上の位置。行・桁は 1 起点
    attributes:
      - { name: start_line, type: integer, required: true, min: 1 }
      - { name: start_col, type: integer, required: true, min: 1 }
      - { name: end_line, type: integer, required: true, min: 1 }
      - { name: end_col, type: integer, required: true, min: 1 }

  - name: SyntaxTree
    description: 1 ファイルの構文木と、その解析で見つかった不透明領域
    attributes:
      - { name: file, type: string, required: true, unique: true }
      - { name: content_hash, type: string, required: true, constraints: "入力バイト列の SHA-256。決定性の検証と同一実行内のキャッシュに使う" }
      - { name: has_parse_error, type: boolean, required: true }
      - { name: opaque_regions, type: list<OpaqueRegion>, required: true, default: "[]" }
    relationships:
      - { target: OpaqueRegion, cardinality: "0..*", direction: contains }
      - { target: StructDecl, cardinality: "0..*", direction: yields }
      - { target: ImplBlock, cardinality: "0..*", direction: yields }
      - { target: FnDecl, cardinality: "0..*", direction: yields }
      - { target: UsePath, cardinality: "0..*", direction: yields }
      - { target: CallSite, cardinality: "0..*", direction: yields }
      - { target: ConstructionSite, cardinality: "0..*", direction: yields }

  - name: OpaqueRegion
    description: 構文木だけでは中身を判定できない領域（Q1: advisory の所見 analyzer.macro-opaque の材料）
    attributes:
      - { name: file, type: string, required: true }
      - { name: span, type: Span, required: true }
      - { name: reason, type: enum, allowed: [macro-item, macro-expression, attribute-macro, parse-error], required: true, constraints: "組み込み属性（cfg / test / allow / derive など）は不透明にしない。derive は DeriveList として別に返す" }
      - { name: macro_name, type: string, required: false, constraints: "reason が parse-error 以外のとき必須" }

  - name: StructDecl
    description: struct / enum の宣言とフィールド。規則 (a) と (c) の材料
    attributes:
      - { name: file, type: string, required: true }
      - { name: name, type: string, required: true }
      - { name: kind, type: enum, allowed: [struct, enum], required: true }
      - { name: visibility, type: enum, allowed: [private, pub, pub-crate, pub-super, pub-in], required: true }
      - { name: fields, type: list<FieldDecl>, required: true, default: "[]", constraints: "enum のバリアントは fields に含めない（別途 variants）" }
      - { name: derives, type: list<string>, required: true, default: "[]", constraints: "#[derive(...)] のトレイト名（例: Default、Clone）" }
      - { name: span, type: Span, required: true }

  - name: FieldDecl
    description: struct のフィールド
    attributes:
      - { name: name, type: string, required: true }
      - { name: visibility, type: enum, allowed: [private, pub, pub-crate, pub-super, pub-in], required: true }
      - { name: type_text, type: string, required: true, constraints: "型の字面。解決はしない" }
      - { name: span, type: Span, required: true }

  - name: ImplBlock
    description: impl ブロック。固有 impl とトレイト impl の両方
    attributes:
      - { name: file, type: string, required: true }
      - { name: target_type_text, type: string, required: true }
      - { name: trait_text, type: string, required: false, constraints: "トレイト impl のときだけ" }
      - { name: methods, type: list<MethodDecl>, required: true, default: "[]" }
      - { name: span, type: Span, required: true }

  - name: MethodDecl
    description: impl 内のメソッド。規則 (b)(c)(d)(h) の材料
    attributes:
      - { name: name, type: string, required: true }
      - { name: visibility, type: enum, allowed: [private, pub, pub-crate, pub-super, pub-in], required: true }
      - { name: receiver, type: enum, allowed: [none, self, ref-self, mut-self, other], required: true, constraints: "none は関連関数（コンストラクタ候補）、mut-self は &mut self" }
      - { name: params, type: list<ParamDecl>, required: true, default: "[]", constraints: "receiver を除く" }
      - { name: return_type_text, type: string, required: false }
      - { name: body_shape, type: enum, allowed: [returns-field-only, assigns-field, other, opaque], required: true, constraints: "returns-field-only = 本体が self.<field>（参照・clone を含む）を返すだけ。assigns-field = self.<field> = ... を含む。opaque = 本体がマクロ不透明" }
      - { name: span, type: Span, required: true }

  - name: ParamDecl
    description: 関数・メソッドの引数
    attributes:
      - { name: name, type: string, required: true }
      - { name: type_text, type: string, required: true }
      - { name: is_by_value_self_type, type: boolean, required: false, constraints: "型の字面が Self または impl 対象型と一致するとき true（(h) の材料）" }

  - name: FnDecl
    description: 自由関数（impl 外）
    attributes:
      - { name: file, type: string, required: true }
      - { name: name, type: string, required: true }
      - { name: visibility, type: enum, allowed: [private, pub, pub-crate, pub-super, pub-in], required: true }
      - { name: params, type: list<ParamDecl>, required: true, default: "[]" }
      - { name: return_type_text, type: string, required: false }
      - { name: span, type: Span, required: true }

  - name: UsePath
    description: use 宣言の解決前パス。規則 (g)(k)(l) の材料
    attributes:
      - { name: file, type: string, required: true }
      - { name: path_text, type: string, required: true, constraints: "例: crate::domain::Order、billing_query_dao::OrderDao。glob は末尾 *" }
      - { name: first_segment, type: string, required: true, constraints: "crate / self / super / std / core / alloc / 外部クレート名 / メンバークレート名（ハイフンはアンダースコアに正規化して照合）" }
      - { name: alias, type: string, required: false }
      - { name: span, type: Span, required: true }

  - name: CallSite
    description: メソッド呼び出しとパス呼び出し。規則 (d)(i) の材料
    attributes:
      - { name: file, type: string, required: true }
      - { name: kind, type: enum, allowed: [method-call, path-call], required: true }
      - { name: callee_text, type: string, required: true, constraints: "method-call はメソッド名、path-call はパスの字面" }
      - { name: receiver_text, type: string, required: false, constraints: "method-call のときのレシーバ式の字面" }
      - { name: enclosing_fn, type: string, required: false, constraints: "呼び出しを含む関数・メソッドの名前" }
      - { name: span, type: Span, required: true }

  - name: ConstructionSite
    description: 型の構築箇所。規則 (c)(n) の材料
    attributes:
      - { name: file, type: string, required: true }
      - { name: kind, type: enum, allowed: [struct-literal, associated-call, default-call, update-syntax], required: true, constraints: "struct-literal = Type { .. }、associated-call = Type::new(..) など、default-call = Default::default() / Type::default()、update-syntax = Type { a, ..other }" }
      - { name: type_text, type: string, required: true }
      - { name: callee_text, type: string, required: false, constraints: "associated-call の関数名" }
      - { name: enclosing_fn, type: string, required: false }
      - { name: span, type: Span, required: true }

  - name: AnalyzerRuntime
    description: 同梱 WASM ランタイムの状態。実行ごとに 1 つ
    attributes:
      - { name: grammar_path, type: string, required: true, constraints: "tools/ddd/wasm/tree-sitter-rust.wasm" }
      - { name: runtime_path, type: string, required: true, constraints: "同梱した web-tree-sitter の読み込み元（tools/ddd/lib/rust/vendor/）" }
      - { name: state, type: enum, allowed: [uninitialized, ready, unavailable], required: true }
      - { name: cache, type: map<string, SyntaxTree>, required: true, default: "{}", constraints: "content_hash をキーにした同一実行内のキャッシュ" }
```

## 要約

- **workspace 側**は `CargoWorkspace → CrateManifest → CargoTarget` の事実と、それに規約（ADR-005 と Q2〜Q4）を当てた `CrateLayerAssignment`、申告ファイル単位の `FileClassification`、依存方向の許可表 `DependencyPermission` からなる。層の列挙に `rmu` と `composition-root` を加えたのは、RMU クレート（`billing-rmu` のように層接尾辞を持たない）と composition root を「層不明」から区別するためである。
- **解析器側**は `SyntaxTree` から取り出す構文的事実（`StructDecl` / `FieldDecl` / `ImplBlock` / `MethodDecl` / `FnDecl` / `UsePath` / `CallSite` / `ConstructionSite`）と、判定できない領域 `OpaqueRegion` からなる。事実はすべて字面（text）と位置（`Span`）で表し、型推論や名前解決は行わない（FR7.12）。
- `components.md` からの差分: `CrateLayerAssignment` に `layer_source` / `cqrs_source` / `diagnostics` を追加し、層の列挙に `rmu` / `composition-root` / `unknown` を加えた。`FileClassification`、`LayerDiagnostic`、`DependencyPermission`、構文的事実の各型、`AnalyzerRuntime` は設計上の補助型として追加した。
