# Functional Design — 確認事項（U5 Rust コードセンサー / u5-rust-code-sensors）

## Sources

- `inception/units-generation/unit-of-work.md`（U5 の責務: 規則モジュール (a)〜(n) と層依存方向（FR9.5）の検査、層ごとの 3 マニフェスト、`code-summary` を契機に `source-manifest.json` の申告ソースだけを検査する発火経路、規則ごとのゴールデンケース。構文木の取得と層判定は U2、正規モデルの Command 集合は U1 に委ねる）
- `inception/units-generation/unit-of-work-story-map.md`（U5 に割り当てた要件: FR7、FR7.1〜FR7.13、FR9.5、NFR1、NFR3。先に固める要件は FR9.5 と FR7.1〜FR7.4）
- `inception/requirements-analysis/requirements.md`（FR7 各規則、FR8.3 発火経路、FR9.5 依存方向、NFR1 確定性、NFR3 性能、未解決事項 OQ7）
- `inception/domain-design/components.md`（RustCodeSensorSuite の振る舞いと依存先 RustSyntaxAnalyzer / WorkspaceLayerResolver / SensorRuntime / DomainModelSchema）
- `inception/domain-design/decisions.md`（ADR-002 層ごと 3 マニフェスト、ADR-003 `code-generation` ゲート＋申告ソース、ADR-005 層判定、ADR-009 設計側検査との分離）
- U1 の設計（`construction/u1-sensor-foundation/functional-design/`）: `runSensor` / `readSourceClaims` / `index.commandsOf` / `index.resolve`、所見の形式、フェイルクローズ
- U2 の設計（`construction/u2-rust-analysis-foundation/functional-design/`）: 構文的事実（StructDecl / MethodDecl の `body_shape` / UsePath / CallSite / ConstructionSite）、`FileClassification`、`isAllowed`、`OpaqueRegion`（Q1: advisory の `analyzer.macro-opaque`）
- U4 の設計（`construction/u4-design-sensors/functional-design/`）: マニフェストの形（BR1.1〜BR1.4）、ゴールデンケース規約（BR8.1〜BR8.6、`expected.json`）
- `ddd/docs/domain-layer-design.md` §6〜§8、`ddd/docs/use-case-layer-design.md` §3・§7、`ddd/docs/interface-adapter-layer-design.md` §3〜§5・§8
- 確定済みで再確認しない事項: 3 マニフェストはすべて blocking で `code-generation` のゲート、`matches` は `**/code-summary.md`（ADR-002、ADR-003）。層・CQRS 側・composition root の判定と依存方向の許可表は U2（ADR-005）。マクロ不透明箇所は advisory（U2 Q1）。`tests/` `examples/` `benches/` `build.rs` は検査対象外（U2 Q3）。fixture は U4 の規約に従う（U4 Q1）。判定は構文解析のみで型推論を行わない（FR7.12）。

設計書と上流の設計で決まっていない、規則の判定材料そのものに関わる点だけを聞きます。いずれも所見の出方（何を違反として止めるか）に直結します。

---

## Q1. 規則 (b)「正規モデルに Command として宣言のない状態変更メソッド」は、メソッドと Command をどう対応づけますか？

文脈: 正規モデルの Command は `command.<集約名>.<名前>`（小文字ケバブ）の ID を持ちます（U1 Q1）。Rust 側は `impl Invoice { pub fn issue(&mut self, ..) }` のように型名（PascalCase）とメソッド名（snake_case）です。センサーは型推論をしないので、字面の規約で対応づける必要があります。

- A. 名前の正規化で対応づける: impl 対象型名を PascalCase → ケバブに変換して集約名（`aggregate.<名前>` の名前セグメント）と照合し、`&mut self` メソッド名を snake_case → ケバブに変換して Command の名前セグメントと照合する。一致しない `&mut self` メソッドが (b) の違反。集約ルート以外の型（Entity / VO）の `&mut self` メソッドは「集約名が一致しない」ため常に違反（VO は不変、Entity の変更は集約ルートの Command 経由）
- B. 属性またはドキュメントコメントで明示させる: `/// ddd:command command.invoice.issue` のような注記を必須にし、注記のない `&mut self` メソッドを違反にする（名前の自由度は上がるが、注記漏れがそのまま違反になる）
- C. 集約ルート型の `&mut self` メソッドはすべて許可し、集約ルート以外の型の `&mut self` メソッドだけを違反にする（正規モデルとの照合はしない）
- X. Other (please specify)

[Answer]: A. 名前の正規化 (Recommended)

---

## Q2. 正規モデル（`domain-model.yaml`）が存在しないワークフロー（`domain-modeling` が SKIP のスコープ）では、正規モデルに依存する規則 (b)(c)(n) をどう扱いますか？

文脈: Rust コードセンサーは `code-generation` のゲートで発火しますが、`domain-modeling` は enterprise / feature / mvp / classic / workshop / refactor の 6 スコープでしか実行されません（FR1.4）。express / poc / bugfix などでは正規モデルがなく、Command の集合を得られません。設計センサーの model-presence は同じ状況を「SKIP なら note 付きで pass」と扱っています（ADR-004）。

- A. U1 の `readStageStatus(domain-modeling)` を読み、SKIP / absent のときは正規モデル依存の部分だけを省略して note に記録し、(a)(d)(g)〜(m) と依存方向の検査は通常どおり行う。(c) は正規モデルに依存しない部分（struct リテラル・Default・後付け初期化）だけ検査する
- B. 正規モデルが無ければ 3 マニフェストすべてを note 付きで pass にする（Rust センサーは正規モデルがある前提でのみ動く）
- C. 正規モデルが無いこと自体を blocking 違反にする（Rust コードを生成するなら正規モデルを先に作らせる）
- X. Other (please specify)

[Answer]: A. 依存部分だけ省略 (Recommended)

---

## Q3. 規則 (a)「ドメイン型の公開フィールド」は、どの可視性までを違反にしますか？

文脈: 設計書は「`pub` フィールドは `readonly` 相当でも違反」と定めていますが、Rust には `pub(crate)` / `pub(super)` / `pub(in path)` があります。層はクレート単位なので、`pub(crate)` はドメイン層クレート全体からフィールドを直接書き換えられることを意味します。

- A. private 以外（`pub` / `pub(crate)` / `pub(super)` / `pub(in path)`）をすべて違反にする。子モジュール（`mod tests` など）は private フィールドにも触れるため、正当な用途はこれで足りる
- B. `pub` と `pub(crate)` を違反にし、`pub(super)` / `pub(in path)` は密結合な子モジュール向けとして許す
- C. `pub` だけを違反にする（設計書の文言どおり最小限に留め、クレート内の可視性は開発者に委ねる）
- X. Other (please specify)

[Answer]: A. private 以外すべて (Recommended)

---

## Q4. 規則 (d)(h)(l)(n) が必要とする「ドメイン型の名前」と「getter の名前」の集合は、どこから集めますか？

文脈: (d) getter 呼び出しは `x.total()` のような呼び出しの字面しか見えず、`x` の型は分かりません。(h) は `execute` の引数型が集約か、(l) はクエリ側が参照する型がドメイン型か、(n) はアダプタが構築する型がドメイン型かを判定します。いずれも「ドメイン層に宣言された型名（と、その getter 名）」の集合と字面を照合する方式になります。申告ソース（今回生成した Unit のファイル）だけから集めると、以前の Unit で生成したドメイン型が集合に入りません。

- A. ワークスペース内のすべてのドメイン層クレート（U2 の層判定が domain のクレート）の `.rs` を解析して型名と getter 名の集合を作り、判定対象は申告ソースだけにする。名前衝突による誤検出は blocking のまま受け入れる（同名メソッドの呼び出しは規則違反として報告し、必要なら監査付き override で通す）。呼び出しのレシーバが `self` のものは (d) の対象外にする
- B. 申告ソースだけから集合を作る（走査が最小だが、以前の Unit のドメイン型への呼び出しを見逃す）
- C. A と同じ集合を作るが、名前照合に基づく (d)(h)(l)(n) は advisory にする（誤検出でゲートを閉じない代わりに、SM2「違反を含んだまま先へ進めない」を弱める）
- X. Other (please specify)

[Answer]: A. ドメイン層全クレートから (Recommended)

---

## Q5. 規則 (c)(n)「完全コンストラクタ以外の生成経路」で、何を「完全コンストラクタ」とみなし、Event Sourcing の replay 経路をどう除外しますか？

文脈: 型推論なしで「不変条件を検査しているか」は判定できないため、生成経路は構文の形で判定します（U2 の ConstructionSite: struct リテラル / 関連関数呼び出し / Default / update 構文）。また FR7.3 は「ES の replay / `apply_event` は対象外」と定めており、`&mut self` の `apply_event` は (b) でも誤検出になり得ます。

- A. 「完全コンストラクタ」は、その型の固有 impl に宣言された関連関数（receiver なし）で戻り型の字面が `Self` / `Result<Self, ..>` / `Option<Self>` / 型名そのもの のいずれか、とする（名前は問わない）。型の固有 impl の外にある struct リテラル・update 構文・`Default` 呼び出し、および `derive(Default)` / `impl Default` をドメイン型に対して違反にする。後付け初期化は `&mut self` メソッド名 `init` / `setup` / `initialize` / `reset` / `configure` を違反にする。ES の replay 経路は `&mut self` メソッド名 `apply` / `apply_event` / `replay` / `on_event` を (b)(c) の対象外にする（固定リスト）
- B. A と同じだが、完全コンストラクタを名前で限定する（`new` / `try_new` / `from_*` / `restore` / `reconstitute` だけ）。それ以外の関連関数からの生成も違反
- C. A と同じ判定だが、replay 経路の除外は名前ではなく `ddd-aggregate-mapping` で `persistence_method: event-sourcing` と宣言された集約に限る（記録ディレクトリの宣言成果物を読む）
- X. Other (please specify)

[Answer]: A. 戻り型で判定＋名前で除外 (Recommended)

---

## Q6. 規則 (g) DIP 違反は、ワークスペース外のクレート（`sqlx`、`reqwest`、`aws-sdk-*` など）への依存も対象にしますか？

文脈: (g) は「ユースケース層がアダプタ層・インフラの具象型を直接 import／参照している」ことです。ワークスペース内のクレート同士は U2 の許可表（`isAllowed`）で判定できますが、外部クレートは層を持ちません。DB クライアントや HTTP クライアントをユースケース層・ドメイン層が直接使うのは典型的な DIP 違反ですが、「どのクレートが I/O か」は列挙でしか決められません。

- A. ワークスペース内の依存は許可表で判定し、加えて固定の I/O クレート一覧（`sqlx` / `diesel` / `sea-orm` / `tokio-postgres` / `mysql_async` / `rusqlite` / `redis` / `mongodb` / `reqwest` / `hyper` / `aws-sdk-*` / `aws-config` / `rdkafka` / `lapin` / `tonic` / `axum` / `actix-web` を初版とし、ゴールデンケースで見直す）を、ドメイン層・ユースケース層クレートの `Cargo.toml` の依存と `use` の先頭セグメントの両方で照合し、一致すれば (g) の blocking 違反にする
- B. ワークスペース内の依存だけを判定し、外部クレートは対象外にする（列挙の不完全さを持ち込まない）
- C. A と同じ一覧を使うが、外部クレートへの依存は advisory にする
- X. Other (please specify)

[Answer]: A. 固定一覧で blocking (Recommended)

---

## Consolidated Summary Confirmation

- Q1 Command との対応づけ: impl 対象型名（PascalCase → ケバブ）を集約名と、`&mut self` メソッド名（snake_case → ケバブ）を Command 名と照合する。一致しない `&mut self` メソッドは規則 (b) の違反。集約ルート以外の型の `&mut self` メソッドは常に違反（A）
- Q2 正規モデルが無いワークフロー: `domain-modeling` が SKIP / absent のときは正規モデルに依存する部分（(b)、(c)(n) の Command 照合）だけを note 付きで省略し、それ以外の規則と依存方向は通常どおり検査する（A）
- Q3 公開フィールドの可視性: private 以外（`pub` / `pub(crate)` / `pub(super)` / `pub(in path)`）はすべて規則 (a) の違反（A）
- Q4 ドメイン型名・getter 名の一覧: ワークスペース内のドメイン層クレートすべてを解析して一覧を作り、判定対象は申告ソースだけ。名前衝突の誤検出は blocking のまま受け入れ、レシーバが `self` の呼び出しは getter 規則の対象外（A）
- Q5 完全コンストラクタと replay: 固有 impl の関連関数で戻り型が `Self` / `Result<Self, ..>` / `Option<Self>` / 型名なら完全コンストラクタ（名前は問わない）。impl 外の struct リテラル・update 構文・`Default`・`derive(Default)` は違反。`init` / `setup` / `initialize` / `reset` / `configure` は後付け初期化として違反。`apply` / `apply_event` / `replay` / `on_event` は replay 経路として除外（A）
- Q6 外部クレートの DIP: ワークスペース内は許可表で判定し、加えて固定の I/O クレート一覧を `Cargo.toml` の依存と `use` の先頭で照合して、ドメイン層・ユースケース層で一致すれば blocking 違反（A）

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
