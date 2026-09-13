## Developer Code Scan Results

対象は[Issue #38](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/38)の状態公開の一規則である。`plugin-dev`、Standard深度、Brownfieldの初回部分調査として、現行Rust経路、syn試作、共通契約の設計、関連する検証基盤を確認した。パッケージ探索・importや型別名の解決・成果物移行・本番センサー切替・配布は調査の実装設計対象に含めない。

調査前の情報は、`store_generation=none`、スナップショット範囲`ddd/`、`source_fingerprint=git:efdfe097f4aadb7b338b5d4636ca10739a614cd7`である。これは調査依頼で渡されたスナップショット識別であり、この記録の発行者が再生成した値ではない。登録リポジトリ配列がないワークスペース直下のリポジトリを対象とする。

### Scan Coverage

- **Analyzed deeply**:
  - `ddd/package.json`
  - `ddd/bun.lock`
  - `ddd/biome.json`
  - `ddd/tsconfig.json`
  - `ddd/experiments/rust-syn/Cargo.toml`
  - `ddd/experiments/rust-syn/Cargo.lock`
  - `ddd/experiments/rust-syn/src/main.rs`
  - `ddd/experiments/rust-syn/src/analysis.rs`
  - `ddd/experiments/rust-syn/cases.json`
  - `ddd/scripts/verify-rust-syn.ts`
  - `ddd/tools/ddd-sensor-rust-domain.ts`
  - `ddd/tools/ddd/lib/shared/findings.ts`
  - `ddd/tools/ddd/lib/runtime/runtime.ts`
  - `ddd/tools/ddd/lib/rust/analyzer.ts`
  - `ddd/tools/ddd/lib/rules/types.ts`
  - `ddd/tools/ddd/lib/rules/definitions.ts`
  - `ddd/tools/ddd/lib/rules/context.ts`
  - `ddd/tools/ddd/lib/rules/evaluate.ts`
  - `ddd/tools/ddd/lib/rules/rust/evaluators.ts`
  - `ddd/tests/u2-rust-analysis-foundation.test.ts`
  - `ddd/tests/u5-rust-code-sensors.test.ts`
  - `ddd/tests/u5-golden.test.ts`
  - `ddd/tests/README.ja.md`
  - `ddd/docs/developers/inspection-contract-design.ja.md`
  - `ddd/docs/developers/rust-syn-spike.ja.md`
- **Skimmed only**:
  - `ddd/docs/developers/` — 言語共通設計の関連箇所、試作の保存済み証跡の環境・比較結果を確認した。英日全体の整合性監査は行っていない。
  - `ddd/tests/golden/` — 既存ランナーとRust代表例の構成・呼出関係を確認した。全ケース・全センサーの意味は検証していない。
  - `ddd/tools/ddd/lib/` — 上記の深読対象以外は、import先と文字列検索による存在確認にとどめた。Cargo解決、正規モデルローダー、パッケージ配置の内部設計は未調査。
  - `ddd/src/` — TypeScript Compiler API導入の検索のみ。
  - `ddd/scripts/` — 上記の試作検証スクリプト以外は、パッケージ設定から呼出先を確認したのみ。

浅い範囲のうち、個別に深読したファイルは前者に列挙した。`ddd/`全体、リポジトリ全体、第三者フレームワークのソースを深読したとは扱わない。

### Packages Found

| パッケージ／構成要素 | 種別 | 言語 | 現在の責務 |
|---|---|---|---|
| `ddd-plugin-dev` 0.1.0 | 非公開の開発パッケージ | TypeScript、Bun | プラグインの検証・ビルド・テストコマンド。ESMで、宣言済み開発依存はBiomeのみ |
| `ddd-rust-syn-spike` 0.0.0 | 公開しない試作CLI | Rust、edition 2021 | 与えられたソース文字列をsynで解析し、JSONの構文情報・公開フィールド候補・未解決理由を出す |
| `ddd-rust-domain` | 本番センサー入口 | TypeScript | 現行Rust解析器を初期化し、`a/b/c/d/g/domain-packaging`を実行する |
| 状態公開に関係する規則処理 | 内部ライブラリ | TypeScript | コンテキスト構築、Rust規則の評価、所見の整列、既存センサー判定の生成 |

この対象はHTTPサービスや永続化アプリケーションではない。読み取った範囲にHTTPエンドポイント・データベースモデル・データ移行はない。

### Build System

- **Type**: プラグイン側はBun。Rust試作のみ独立したCargoビルドで、ワークスペースの通常センサービルドへは接続されていない。
- **Config Files**: `ddd/package.json`、`ddd/bun.lock`、`ddd/tsconfig.json`、`ddd/biome.json`、`ddd/experiments/rust-syn/Cargo.toml`、同`Cargo.lock`。
- **Build Dependencies**:
  - `experiment:rust-syn` → `scripts/verify-rust-syn.ts` → `cargo build --locked --release` → 試作実行ファイル。
  - 試作CLI → `syn`、`proc-macro2`、`quote`、`serde`、`serde_json`。
  - 比較検証スクリプト → 試作CLI、既存tree-sitter解析器、Rustのゴールデンランナー、必要なケースの`rustc`。
  - `build:claude/build:codex/validate`は`.codex/tools/`の既存フレームワークコマンドを呼ぶ。設定の呼出先のみ確認し、その実装は読んでいない。

`check`はBiome、プラグイン妥当性検証、`bun test tests/`の順である。`experiment:rust-syn`は独立した明示実行コマンドであり、現在の`check`や`test:sandbox`からは呼ばれない（`ddd/package.json:12`、`:16`、`:17`）。Issue #38の検証を自動実行へ登録する際は、新規検証に必要なRustツールチェーンとTypeScript依存を明示し、通常センサーがその場でビルドする構成へ混ぜない。

`tsconfig.json`はstrict、noEmit、ESNext、bundler解決、Bun型を指定するが、当該パッケージには`tsc`実行スクリプトや`typescript`依存がない。これは対象アプリケーションの解析用Programの設定とは別の、プラグイン開発用設定である。

### APIs Discovered

| API | 場所 | 入出力・呼出関係 |
|---|---|---|
| 試作CLI（1入口） | `experiments/rust-syn/src/main.rs:21` | 標準入力の`protocol_version: 1`と非空`files[{path,source}]`を受理。未知フィールド・不正JSON・8 MiB超過等を拒否。解析結果を単一JSONとして出力。不正リクエストは終了2、解析不能を含む報告出力成功は終了0 |
| `analyze(file, source)` | `experiments/rust-syn/src/analysis.rs:264` | `syn::parse_file`とVisitorで全ファイルの構文を収集。`field_inspection.state`、候補、types等のfacts、unresolved、`semantic_analysis: unsupported`を返す |
| `initAnalyzer/parse/structs`等 | `tools/ddd/lib/rust/analyzer.ts:177`、`:649`、`:675` | 現行のtree-sitter WASMを使う。AST本体をWeakMap内に保持し、構文情報をTypeScript型として渡す。内容ハッシュの構文キャッシュがある |
| `evaluateSensor` | `tools/ddd/lib/rules/evaluate.ts:20` | Cargo・モデル・ソースクレームからコンテキストを組み立て、各Rust規則を呼び、所見とnoteを返す |
| 規則`a` | `tools/ddd/lib/rules/rust/evaluators.ts:42` | 対象ファイル内のstructの各フィールドを調べ、可視性がprivate以外なら所見を生成する。モデル不要。名前付きの特定ドメイン型を引数に取る契約ではない |
| `runSensor` | `tools/ddd/lib/runtime/runtime.ts:68` | 既存の`--stage/--output-path`コンテキストを解決し、`SensorVerdict`を単一JSONで出力。通常は終了0、資産欠落は127。例外・予算超過は`pass:false` |
| 所見の共有語彙 | `tools/ddd/lib/shared/findings.ts:31`、`:56` | 必須欄と行の検証、ファイル・行・規則・メッセージ順の整列、決定的な`finding_id`の付与 |

現行の処理順は、`ddd-sensor-rust-domain` → tree-sitter初期化 → `runSensor` → `evaluateSensor` → `assembleContext` → `ruleA` → 所見集約である。syn試作はこの経路から独立しており、検証スクリプトが両者を別々に起動して比較する。

Issue #38の最小経路へ再利用できるものは、synのフィールド抽出、行位置、未対応理由、既存の所見出力慣習、Bunの一時プロジェクト検証方法である。既存の`InspectionContext`を共通契約に転用すると`AnalyzerRuntime`、`SyntaxTree`、`CargoWorkspace`、`RustProgram`が漏れる（`rules/types.ts:71`）。`definitions.ts:31`も`facts: ["structs"]`でRust構文に結び付いているため、「定義が既に完全に言語共通」というコメントの記述を設計上の証拠にはしない。

### Frameworks & Libraries

| 技術 | 確認した版 | 用途・限定 |
|---|---|---|
| Bun | 今回実行1.3.13 | TypeScript実行、Bunテスト、TOML、子プロセス |
| Biome | 2.5.12（manifest／lock固定） | TypeScript・JSONの静的検査と整形 |
| syn | 3.0.5（Cargo.tomlで完全固定） | full/parsing/printing/visitを有効にした構文解析。型推論・名前解決の実装ではない |
| proc-macro2 / quote | lockで1.0.107 / 1.0.47 | ソース位置とトークン表記 |
| serde / serde_json | lockで1.0.229 / 1.0.151 | CLIの入力検証・JSON出力 |
| tree-sitter-rust / web-tree-sitter | vendored資産。今回版は未確認 | 現行Rustセンサー用。依存本体の深読は対象外 |
| TypeScript Compiler API | 当該パッケージでは未導入 | `ddd`の関連ソース検索で`createProgram/getTypeChecker`実装は見つからず、manifest／lockにもtypescript依存なし。採用版を定めて記録する作業は残る |

既存試作の保存済み環境記録はrustc/cargo 1.95.0、darwin-arm64である。今回Rustバイナリを再ビルドした結果ではない。

### Test Coverage

- **Test Directories**: `ddd/tests/`、`ddd/tests/golden/`、試作用入力`ddd/experiments/rust-syn/cases.json`。
- **Test Frameworks**: `bun:test`、試作比較スクリプトの`node:assert`、一部入力の`rustc`コンパイル対照。
- **Coverage Config**: 読み取ったプラグイン設定に行カバレッジ閾値はない。`test:coverage`はセンサー・規則・ケースの対応表検証であり、行や意味の網羅率ではない。

今回新たに実行した結果:

```text
作業ディレクトリ: ddd/
bun test tests/u2-rust-analysis-foundation.test.ts tests/u5-rust-code-sensors.test.ts
Bun 1.3.13
25 pass / 0 fail / 0 skip
107 expect() calls、2ファイル、約514 ms
```

この25件は既存Rustの解析・層判定・センサーの回帰確認であり、共通契約・syn接続・TypeScript解析の受入試験ではない。全体テスト、配布物検査、インストーラ検証は今回再実行していない。

保存済みの試作検証は31入力、実センサー比較4入力、不正リクエスト6入力である（`rust-syn-spike.ja.md`、`verify-rust-syn.ts:80`、`:216`）。入力・スクリプトと期待値を読んだが、その検証コマンド自体は今回は再実行していない。公開タプル2入力の見落としを意図した現行比較値として保持しており、試作検証の成功は現行センサーが正しいことを意味しない。

Issue #38で不足している検証は、指定した型ごとの両言語の正常・違反・未解決、完全性と不在の関係、未知版・不正応答・結果欠落・入力設定識別の不一致、再実行コマンドの終了判定である。既存`JSON.parse(...) as Result`と版・件数のassert（`verify-rust-syn.ts:76`）は比較試験用であり、境界で受け取った任意の応答を検証する本番共通契約ではない。

### Code Quality Indicators

- **Linting**: `ddd/biome.json`にrecommended検査と2スペース・二重引用符の整形設定がある。fixturesとvendored解析器は除外される。今回Biome、rustfmt、Clippyは再実行していない。
- **CI/CD**: `ddd/package.json`の既存検証コマンドまで確認した。今回の読取境界外にあるリポジトリルートのCI設定は未調査。新規CI基盤の構築はIssue #38の対象外。
- **Documentation**: 試作の英日文書、共通契約の英日文書、テストREADMEがある。日本語側は現行・試作・計画を区別している。英日全行比較はしていない。
- **責務分離**: 試作CLIの入力処理とRust Visitorが別ファイルで、既存センサーも入口・実行・規則の層に分かれている。一方、既存共通コンテキストはRustへ強く依存している。
- **限定した評価**: 命名とテスト配置は追跡しやすい。既存解析器759行・Rust規則437行には複数規則の処理が集まる。今回それらを全面分割することは提案しない。

### Technical Debt Signals

1. **公開タプルを現行rule aが見落とす**。`analyzer.ts:405`は`field_declaration`のみ抽出し、試作は`node.fields.iter()`で名前付き／タプルを扱う（`analysis.rs:119`）。`cases.json`の`public-tuple/restricted-tuple`と保存済み実比較が差を記録している。Issue #38の共通経路で検出するが、本番センサーの置換は後続のままとする。
2. **既存のnoteは共通契約の未解決状態を代替しない**。不透明な領域や未解決参照はnoteへ流れる一方、通常の`runSensor`は所見件数だけで`pass`を計算する（`context.ts:148`、`evaluate.ts:67`、`runtime.ts:145`）。既存承認ディスパッチャーの扱いは未調査であり、実運用の承認可否をこの読取りだけで断定しない。新経路では実行状態と規則結果を独立させる必要がある。
3. **試作の結果は型指定・入力識別・集合の完全性を持たない**。`main.rs:9`の入力は版とfilesのみ。`analysis.rs:278`はファイル内に未解決理由が一つでもあれば全体をunresolvedにする。指定型が見つからない場合、同名が複数ある場合、別入力の結果が来た場合を新契約で判断できるようにする必要がある。既存候補の型名だけで一意性を仮定しない。
4. **候補と確定違反を混同しやすい**。syn試作は偽のcfg配下のpubフィールドも候補に残し、そのファイルを未解決にする（`analysis.rs:222`、`cases.json`の`conditional-field`）。その候補を無条件で確定違反へ変換してはならない。対応範囲の証明がないものは未解決にし、独立して確定した違反を保持する共通原則を設計へ渡す。
5. **構文解析成功はコンパイル適合性の証拠ではない**。試作にunknown-type、wrong-return-type、edition差の対照入力がある。局所的なフィールドの可視性を示す根拠と、プロジェクト全体・型・editionの受理は分ける。Issue #38へCargo全体探索や意味解析を取り込まない。
6. **TypeScript表現の判定境界が未実装**。合意済みの正常形はclassの`#`とコンパニオンのクロージャである（`language-independent-design.ja.md:69`）。Compiler API型の公開メンバー一覧だけでは、返却オブジェクトに余分な状態がある場合などを自動的に隠蔽済みとは証明できない。対応する直接宣言・生成形状を限定し、`private`、readonlyな公開状態、計算名・spread・継承・型アサーションなどの非対応入力を黙って正常にしない。これらすべての一般解析を要求するものではなく、対応形状外の理由を明示する境界が必要である。

## Handoff Summary

- **Intent-relevant finding**: synから名前付き／タプルの状態情報を取得する材料は既にあるが、指定型に結び付いた最小の情報契約と両言語共通の評価器は未実装である。現行`ruleA`は構文情報へ直結し（`ddd/tools/ddd/lib/rules/rust/evaluators.ts:42`）、試作はファイル単位の結果にとどまる（`ddd/experiments/rust-syn/src/analysis.rs:264`）。TypeScript解析器の追加と、結果・入力識別・完全性の検証を、小さな独立経路として設計できる。
- **Risks / follow-up**:
  - 共通契約を状態公開の一規則へ限定する。パッケージ・全操作・エラー集合・移行の汎用基盤を先に完成させる依存を作らない。
  - 要求した型、ソースと設定の識別、解析器版、根拠、resolved/absent/unresolved、complete/partial、実行状態、規則結果を同じ最小経路で扱う。不在や不完全な空結果から合格を作らない。
  - TypeScriptの具体的API版、固定入力の形式、対応するclass／コンパニオン形状、未対応入力の境界を次段階で定義する。import解決や一般の可変参照解析へ広げない。
  - 既存Rustセンサーは比較・回帰対象として維持する。今回、第三者フレームワーク・本番センサーの契約・利用者成果物の移行を変更しない。
  - 今回の確かな実行証拠は25件の既存テストのみ。過去のsyn検証と今後の共通経路受入試験を明確に区別する。

作成した成果物は本ファイルのみである。既存のユーザー編集、ワークフロー状態、共有CodeKB、監査・承認記録は変更していない。
