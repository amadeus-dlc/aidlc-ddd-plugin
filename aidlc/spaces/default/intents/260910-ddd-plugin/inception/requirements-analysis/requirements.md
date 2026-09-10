# 要件定義 — DDD プラグイン（AI-DLC v2）

## Sources

- [desc] Initial description: "DDDプラグインを開発してください。\nddd/docs/domain-layer-design.md\nddd/docs/use-case-layer-design.md\nddd/docs/interface-adapter-layer-design.md"
- [scope] Workflow-selected scope: `plugin-dev`.
- [intent] `ideation/intent-capture/intent-statement.md`（問題定義、対象顧客、成功指標 SM1〜SM4、スコープ信号）と `intent-capture-questions.md` の Q1〜Q8
- [RA-Q1]〜[RA-Q7] 本ステージの確認済み回答（`requirements-analysis-questions.md`）
- [DL] `ddd/docs/domain-layer-design.md`（確定済み設計、§番号で参照）
- [UC] `ddd/docs/use-case-layer-design.md`（確定済み設計、§番号で参照）
- [IA] `ddd/docs/interface-adapter-layer-design.md`（確定済み設計、§番号で参照）
- [KB-AW] コード知識ベース `aidlc/spaces/default/codekb/aidlc-workflows/`: `business-overview.md`（エンジンの提供価値と本件の位置づけ）、`architecture.md`（プラグイン拡張機構と観測された制約 C1〜C8、インタラクション図 T1〜T3）、`code-structure.md`（プラグインの内部構成、命名規約、`domain-design` の構造）
- [KB-DDD] コード知識ベース `aidlc/spaces/default/codekb/ddd/`: `business-overview.md`（機能未実装の現状）、`architecture.md`（宣言と実装のギャップ、機構上の制約）、`code-structure.md`（足場だけのディレクトリ、コード規約）
- [assumption] 未確認の前提。§5 に一覧し、後続ステージで確認する。

設計書 [DL][UC][IA] は確定済みであり、本書はその内容を再記述しない。本書の役割は、(1) 設計書の内容を追跡可能な要件IDに割り当てること、(2) 設計書が触れていない実装上の決定（[RA-Q1]〜[RA-Q7]）を要件として固定すること、(3) スコープ境界と前提を明示することである。

---

## 1. インテント分析

### 1.1 達成したいこと

| ID | ゴール | 出典 |
|---|---|---|
| G1 | AI-DLC のワークフローに DDD の設計工程を組み込み、Domain Primitive／Always Valid Domain Model が成果物として残るようにする（ガイド） | [intent] SM1、[DL] §1 |
| G2 | 設計成果物と生成コードの両方について、DDD／クリーンアーキテクチャの規約違反を機械的に検出し、違反を含んだまま先へ進めないようにする（ガードレール） | [intent] SM2・SM3、[DL] §8 |
| G3 | OSS として公開し、AI-DLC v2 利用者一般が自分のプロジェクトへ導入できるプラグインにする | [intent] Q2 |

### 1.2 依頼の性質

- **種別**: 新規機能の開発。ただしリポジトリ `ddd` はビルド・検証の足場が整った brownfield であり、プラグインの貢献面は5面すべて未実装である [KB-DDD business-overview]。
- **範囲**: ドメイン層・ユースケース層・インターフェイスアダプタ層の3層すべて [intent] Q8。
- **明確さ**: 設計書3本が「未決定事項なし」で確定しており、要件の大半は設計書に根拠を持つ。残っていたのは、プラグイン機構の制約（C1〜C8 [KB-AW architecture]）に起因する実装上の決定7点で、本ステージで確定した [RA-Q1]〜[RA-Q7]。
- **深さ**: Standard（`plugin-dev` スコープの既定）。

### 1.3 成功指標との対応

| 指標 | 内容 | 本書での対応 |
|---|---|---|
| SM1 | DDD の設計工程がワークフローの一部として実行され、設計モデルが成果物として残る | FR1、FR2 |
| SM2 | 規約違反が機械的に検出され、違反を含んだまま先へ進めない | FR6、FR7、FR8、NFR1 |
| SM3 | 生成された Rust コードが Always Valid Domain Model の規約に違反しない | FR7、FR9、FR10 |
| SM4 | 実プロジェクトに適用して DDD 設計の手戻りが減る | 測定方法は未定義 [assumption]、§5 A7 |

---

## 2. 機能要件

各表の「判定」列が、その要件の合否基準である。

### FR1. `domain-modeling` ステージ

| ID | 要件 | 判定 | 出典 |
|---|---|---|---|
| FR1.1 | inception フェーズの新設ステージ `domain-modeling` を `stages/inception/domain-modeling.md` として提供し、frontmatter に `plugin: ddd` を持つ | compose 後の `stage-graph.json` に `domain-modeling` が載る | [DL] §2・§10 |
| FR1.2 | グラフ上の位置は自ステージの `requires_stage` で `requirements-analysis` の後に置く。`domain-design` 側の順序強制は FR3.1 と FR6.4 で行う | `requires_stage` に `requirements-analysis` が含まれ、compose の drops ログに `requires_stage` 関連の drop がない | [RA-Q1]、[KB-AW architecture] C1 |
| FR1.3 | `lead_agent` はコアの `aidlc-architect-agent`、`mode: inline`。プラグイン独自エージェントは追加しない | frontmatter が上記のとおりで、`agents/` ディレクトリを `plugin.json` で宣言しない | [RA-Q3]、[RA-Q2] |
| FR1.4 | `scopes:` は enterprise / feature / mvp / classic / workshop / refactor の6つ | `scope-grid.json` で上記6スコープのみ EXECUTE になる | [RA-Q4] |
| FR1.5 | `user-stories` などの requirements-analysis 系成果物を推奨入力（`consumes` の `required: false`）とし、`--stage domain-modeling --single` で単独実行できる。入力がない場合は対話でドメインの語彙を引き出す | 入力なしで単独実行したとき、質問ファイルが生成されて対話が始まる | [DL] §2 |
| FR1.6 | 手順として、ユーザーストーリー（または対話）からドメインイベントを逆算し、集約候補を導出するトップダウンの導出経路を採用する | ステージ本文にイベント逆算→集約候補の手順が Step として存在する | [DL] §2 |
| FR1.7 | 成果物は `domain-model.md`（レビュー用）と `domain-model.yaml`（機械検証用）の2本。`produces` の論理名は `ddd-` 接頭辞付き（例: `ddd-domain-model`、`ddd-domain-model-yaml`） | 両ファイルが生成され、compile が論理名を拒否しない | [DL] §5、[KB-AW code-structure] |
| FR1.8 | 完了条件は機械条件 (i)〜(v) と人間承認 (vi): (i) 全 Aggregate に不変条件が1つ以上、(ii) 全 Command が状態遷移または「遷移なし」の明示を持つ、(iii) 全 Command に Domain Error が定義されている、(iv) 全参照IDが解決できる、(v) md と yaml が整合する | (i)〜(v) はセンサー（FR6.5）で検査され、いずれかが失敗するとゲートが開かない | [DL] §2 |
| FR1.9 | `domain-modeling` は Aggregate 境界まで（ドメイン上の境界・不変条件・状態・Command／Event）を所有する。コンポーネント依存グラフ・外部依存・デプロイ単位は `domain-design`、Unit 投影・業務ルール・ユースケース手順は `functional-design` が所有する | ステージ本文とナレッジに責務分担が明記され、`domain-model.yaml` にモジュール・デプロイ単位のキーが存在しない | [DL] §2 |

### FR2. 正規モデル（Always Valid Domain Model）のスキーマ

| ID | 要件 | 判定 | 出典 |
|---|---|---|---|
| FR2.1 | `domain-model.yaml` は Bounded Context → Aggregate → { Entity / Value Object / Domain Primitive, Invariant, Command / Event, Domain Error, State Transition, Factory／Constructor Rule } の包含構造を持つ | スキーマ定義（JSON Schema または同等）が存在し、サンプルがそれに適合する | [DL] §3 |
| FR2.2 | Domain Error は Command の失敗条件として必須。失敗条件のない Command はスキーマ違反 | 失敗条件のない Command を含む yaml がセンサー (FR6.5) で拒否される | [DL] §3 |
| FR2.3 | 全要素は安定ID（`bc.*`、`aggregate.*`、`entity.*`、`primitive.*`、`invariant.*`、`transition.*` など）を持ち、`element_id`（不変の参照キー）と `name`（表示名）を分離する | rename で `element_id` が変わらないことをゴールデンケースで確認できる | [DL] §4・§5 |
| FR2.4 | split／merge／削除では後継・置換・廃止の関係を記録する。廃止IDの再利用と循環する置換関係は違反 | 廃止IDの再利用・循環置換を含む fixture がセンサー (FR6.1) で拒否される | [DL] §5 |
| FR2.5 | Command は冪等性戦略を属性として宣言する: (i) 不要（同値更新の許容で吸収できる遷移型）、(ii) コマンドID記憶（保持方針: 直前1件／複数・時間窓）。本質的に非冪等な操作では (ii) 以上が必須 | 属性がスキーマに存在し、未宣言の非冪等操作がセンサー (FR6.3) で拒否される | [UC] §5-5、[RA-Q6] |
| FR2.6 | Process Manager を正規モデルの要素として持つ。必須化はアクターモデル選択時（FR3.3）のみ | スキーマに Process Manager 要素があり、クラスベース宣言では未定義でも違反にならない | [UC] §6 |
| FR2.7 | `domain-model.yaml` を正とし、`domain-model.md` はそれと整合していなければならない | 要素の欠落・不変条件の食い違いがセンサー (FR6.2) で検出される | [DL] §5・§8 |

### FR3. `domain-design` への contribution

| ID | 要件 | 判定 | 出典 |
|---|---|---|---|
| FR3.1 | `contributions/inception/domain-design.md` で `adds.consumes` に正規モデル（`ddd-domain-model-yaml`）を追加し、正規モデルが無い場合は `domain-design` の入力欠落として扱う | compose 後の `domain-design` ノードの `consumes` に正規モデルが含まれる | [RA-Q1] |
| FR3.2 | `domain-design` は正規モデルを型・モジュール・ポート・リポジトリ境界へ写像し、写像先は正規モデルの参照IDを必須で記載する。Entity／Aggregate／不変条件を独自に再定義しない | 参照IDのない写像がセンサー (FR6.1) で拒否される | [DL] §4 |
| FR3.3 | 集約（または Bounded Context）ごとに独立した2軸を宣言する: プログラミングモデル（アクターモデル／クラスベース）と永続化方式（ステートソーシング／イベントソーシング） | 2軸の宣言スキーマが存在し、未宣言の集約がセンサーで検出される | [UC] §6、[DL] §7-2、[RA-Q6] |
| FR3.4 | `fragments` で「参照IDを記載せよ」「2軸を宣言せよ」の手順を挿入する。anchor は実装済みの4種（`after-step:<n>` / `before-step:<n>` / `end-of-steps` / `in:<Compartment>`）のみ使う | compose の drops ログに unknown anchor がない | [DL] §4、[KB-AW architecture] C5 |
| FR3.5 | `adds.sensors` で参照ID検査（FR6.1）と正規モデル存在検査（FR6.4）を `domain-design` にバインドする | compose 後の `domain-design` ノードの `sensors` に両IDが含まれる | [DL] §4、[RA-Q1] |

### FR4. `functional-design` への contribution（ユースケース層）

| ID | 要件 | 判定 | 出典 |
|---|---|---|---|
| FR4.1 | 各ユースケース定義に6項目を必須宣言させる: 対象集約（参照ID）、使用するコマンド（参照ID）、再実行可能性の根拠、失敗時の回復方針、複数集約に跨がる場合のプロセスマネージャー参照または再実行戦略、読み取りモデルの公開範囲 | 6項目のいずれかを欠くユースケース定義がセンサーで検出される | [UC] §8 |
| FR4.2 | `fragments` で、ユースケース層の規約5点セット（DIP、execute の引数は集約IDと VO のみ、ユースケース間呼出禁止、業務判断はドメインに置く、I/O はポート経由のみ）と「ユースケースは進行役」の原則、トランザクション境界（集約＝強整合、ユースケース＝弱整合）、再実行可能性の設計手順を挿入する | 挿入された手順が compose 後の `functional-design` 本文に現れる | [UC] §1〜§5 |
| FR4.3 | `adds.sensors` で (g) DIP 違反、(h) execute の引数違反、(i) ユースケース間呼出、(d) getter 呼出、(j) 冪等性戦略未宣言 をバインドする | compose 後の `functional-design` ノードの `sensors` に5IDが含まれる | [UC] §7 |
| FR4.4 | 複数集約の更新は検出するが進行を止めず、レビュー対象として報告する | 複数集約更新を含む fixture で verdict が advisory（pass 扱い＋所見）になる | [UC] §7 |

### FR5. `infrastructure-design` への contribution（インターフェイスアダプタ層）

| ID | 要件 | 判定 | 出典 |
|---|---|---|---|
| FR5.1 | 非 CQRS／CQRS の層構造を宣言させる。CQRS ではコマンド側（ドメイン層＋コマンド用ユースケース層＋コマンド用 IA 層）、クエリ側（クエリ用ユースケース層＋クエリ用 IA 層、ドメイン層なし）、RMU（独立ブリッジ）を区別する | 宣言スキーマが存在し、サンプルが適合する | [IA] §2〜§4 |
| FR5.2 | ポート・リポジトリ規約を手順として挿入する: Repository／外部システムクライアント／ES 基盤ポートの分類、`集約名＋Repository` 命名、I/O 単位は集約単体または集約の集合、動詞は `find_by_id` / `store`（upsert）/ `delete_by_id`、媒体名の禁止、in-memory 実装から始める、クエリ側は DAO＋DTO | 挿入された手順が compose 後の `infrastructure-design` 本文に現れる | [IA] §5、[UC] §5-1 |
| FR5.3 | 永続化基盤の選定（CQRS/ES は CDC 対応 KVS、ステートソーシングは RDB 可）と RMU 設計（順序は基盤保証、冪等性はシーケンス番号の条件付き書き込み）の手順を挿入する | 同上 | [IA] §6・§7 |
| FR5.4 | `adds.sensors` で (k) コマンド側⇄クエリ側の相互参照（RMU は例外）、(l) クエリ側でのドメイン型・リポジトリ参照、(m) リポジトリ命名違反、(n) 復元経路の検査迂回 をバインドする | compose 後の `infrastructure-design` ノードの `sensors` に4IDが含まれる | [IA] §8 |
| FR5.5 | リポジトリのスコープ違反と `store` が upsert かどうかは、検出してもレビュー対象として報告し、進行を止めない | 該当 fixture で verdict が advisory になる | [IA] §8 |

### FR6. センサー群（設計成果物）

| ID | 要件 | 判定 | 出典 |
|---|---|---|---|
| FR6.1 | (e) 未定義ID・廃止IDへの参照、循環する置換関係を、`domain-model.yaml` と下流成果物（domain-design、functional-design）の間で検出する | 違反あり／なしのゴールデンケースで期待どおりの verdict | [DL] §5・§8 |
| FR6.2 | (f) `domain-model.md` と `domain-model.yaml` の不整合を、yaml を正として検出する | 同上 | [DL] §8 |
| FR6.3 | (j) 非冪等操作なのに冪等性戦略が未宣言、または (ii) 以上が必須なのに (i) が宣言されている Command を検出する | 同上 | [UC] §7、[RA-Q6] |
| FR6.4 | `domain-design` のゲートで、正規モデル `domain-model.yaml` が存在し全参照IDが解決できることを blocking で検査する。ただし `domain-modeling` が EXECUTE でないスコープ（FR1.4 以外）では pass にする | `domain-modeling` が SKIP のワークフローで `domain-design` のゲートが開くこと、EXECUTE のワークフローで yaml 欠落時に閉じることを両方確認できる | [RA-Q1]、§7 OQ4 |
| FR6.5 | `domain-modeling` の機械完了条件 (i)〜(v)（FR1.8）を検査する | 各条件を1つずつ破る fixture が拒否される | [DL] §2 |
| FR6.6 | 意味判断が必要な指摘（例: 「この集約境界では不変条件を守れない」）は進行を止めず、レビュー対象として報告する | 該当 fixture で verdict が advisory になる | [DL] §8 |

### FR7. センサー群（Rust コード）

初版の対象言語は Rust のみ。各違反は独立に検査し、独立に報告する [DL] §8。

| ID | 要件（違反の種類） | 判定 | 出典 |
|---|---|---|---|
| FR7.1 | (a) ドメイン型（Entity／VO／Domain Primitive／Domain Service／Aggregate）の公開フィールド。`pub` フィールドは `readonly` 相当でも違反 | 違反あり／なしのゴールデンケースで期待どおりの verdict | [DL] §6・§8 |
| FR7.2 | (b) setter・任意代入メソッド。正規モデルに Command として宣言のない状態変更メソッドとして検出する | 同上 | [DL] §6・§8 |
| FR7.3 | (c) 不完全な生成経路: 空コンストラクタ＋段階的初期化、`init()`／`setup()` 型の後付け初期化、不変条件を検査しない復元経路。ES の replay／`apply_event` は対象外 | 同上（replay 経路を含む fixture が pass する） | [DL] §6・§8 |
| FR7.4 | (d) ドメイン層・ユースケース層からの getter 呼び出し。getter は「フィールドを返すだけのメソッド」を名前に関係なく指し、判定は呼び出し元の層（FR9）で行う | 同上（IA 層からの呼び出しを含む fixture が pass する） | [DL] §6・§7-1・§8 |
| FR7.5 | (g) DIP 違反: ユースケース層のコードがアダプタ層・インフラの具象型を直接 import／参照している | 同上 | [UC] §7 |
| FR7.6 | (h) `execute` の引数に集約インスタンスを直接受け取っている | 同上 | [UC] §7 |
| FR7.7 | (i) ユースケースから別のユースケースを呼び出している | 同上 | [UC] §7 |
| FR7.8 | (k) コマンド側サブプロジェクトとクエリ側サブプロジェクトの相互参照。RMU は両方に依存してよい | 同上 | [IA] §3・§8 |
| FR7.9 | (l) クエリ側サブプロジェクトが集約・ドメイン型・リポジトリポートを import／参照している | 同上 | [IA] §4・§8 |
| FR7.10 | (m) リポジトリ命名違反: `集約名＋Repository` 以外、または媒体名（`DynamoDb` など）をポート名に含む | 同上 | [IA] §5・§8 |
| FR7.11 | (n) アダプタが完全コンストラクタを経由せずにドメイン型を構築している（(c) の IA 層側） | 同上 | [IA] §8 |
| FR7.12 | 判定は構文解析ベースで行い、実行時の意味判断（型推論結果や実行結果）を混入させない | 同一ソースに対して常に同一の verdict を返す（NFR1） | [DL] §8 |
| FR7.13 | 各違反の報告は、規則ID（(a)〜(n)）、ファイルパス、行番号、違反の一文説明を含む | 詳細ファイルに上記4項目が揃う | [KB-AW architecture] T3 |

### FR8. センサー実行基盤

| ID | 要件 | 判定 | 出典 |
|---|---|---|---|
| FR8.1 | センサーはマニフェスト `sensors/aidlc-<id>.md`（フラット配置、必須フィールド `id` / `kind: deterministic` / `command` / `default_severity` / `description`、`matches:` glob）と `tools/` の実行スクリプトの対で提供する | `aidlc-plugin-validate` と compose が全マニフェストを受理する | [DL] §10、[KB-AW architecture] |
| FR8.2 | 進行を止めるセンサーは `fire_on: gate` ＋ `default_severity: blocking` で宣言する。レビュー行きのものは advisory | 各マニフェストの宣言が FR6／FR7 の分類と一致する | [DL] §8・§10 |
| FR8.3 | Rust コードセンサー（FR7）は `code-generation` ステージのゲートに `adds.sensors` でバインドし、`matches:` は Rust ソース（`**/*.rs`）を対象にする。旧成果物ツリー路（`**/{aidlc-docs,intents}/**`）は踏襲しない | compose 後の `code-generation` ノードの `sensors` に全 Rust センサーIDが含まれる | [DL] §8、[KB-AW architecture] 強化余地、§5 A4 |
| FR8.4 | Rust の構文解析には tree-sitter-rust（WASM）を同梱して bun から呼ぶ。利用者に cargo や追加ツールチェーンを要求しない | bun と同梱物のみの環境でセンサーが動作する | [RA-Q7] |
| FR8.5 | センサーはディスパッチャ契約に従い、終了コードと最終行の compact JSON verdict、失敗時の詳細ファイルを出力する | エンジンのセンサーディスパッチャがゴールデンケース実行で verdict を解釈できる | [KB-AW architecture] T3 |
| FR8.6 | 言語ごとの検査器を追加する形で拡張できる構造にする（言語横断の規則定義と、言語別の解析・判定の分離） | Rust 検査器が他言語を前提にしないモジュール境界を持つ（設計で確認） | [DL] §8 |
| FR8.7 | 各センサーには違反あり／違反なしのゴールデンケース fixture を同梱し、テストで通過を確認する | `bun run check` で全 fixture のテストが緑 | [DL] §8、§5 A1 |

### FR9. 層判定（Rust サブプロジェクト → 層）

| ID | 要件 | 判定 | 出典 |
|---|---|---|---|
| FR9.1 | 層はファイルの所属サブプロジェクト（Cargo workspace のクレート）から機械的に導く。設定ファイルは使わない | 層判定がクレートの所属のみから決まる | [DL] §7-5 |
| FR9.2 | クレート名の接尾辞 `-domain` / `-use-case` / `-interface-adapter` / `-infrastructure` で層を判定する | 接尾辞のみで判定できる fixture が正しく分類される | [RA-Q5] |
| FR9.3 | ディレクトリ配置 `packages/<layer>/` または `modules/<layer>/`（`<layer>` は domain / use-case / interface-adapter / infrastructure）でも層を判定する | 配置のみで判定できる fixture が正しく分類される | [RA-Q5] |
| FR9.4 | 接尾辞・配置のどちらにも当てはまらないクレートは「層不明」として blocking 違反にする | 層不明クレートを含む fixture が拒否される | [RA-Q5] |
| FR9.5 | 許可する依存方向は interface-adapter → use-case・domain、use-case → domain、infrastructure → 任意の層からの依存。これ以外はビルドエラー扱い（センサー (g) が安全網） | 依存方向違反の fixture が (g) で検出される | [DL] §7-5 |
| FR9.6 | composition root（DI 結線）は層規則の対象外とする。その識別規約は設計で確定する | 識別規約が domain-design で確定している（§7 OQ1） | [DL] §7-5 |

### FR10. ナレッジ

| ID | 要件 | 判定 | 出典 |
|---|---|---|---|
| FR10.1 | 言語横断（基盤）ナレッジを提供する: Always Valid Domain Model と Domain Primitive、ADT 原則、ドメインオブジェクト4種分類、集約＝FSM 原則、集約間参照はIDのみ、ドメインサービスは最後の手段、ユビキタス言語命名、upstream-contracts（Conformist／ACL）、ユースケース規約5点セットと進行役原則、CQS の適用範囲、強整合／弱整合の境界、再実行可能性・冪等性、プロセスマネージャー設計、CQRS の層構造と相互依存禁止、ポート設計規約、永続化基盤の選定、RMU 設計、infrastructure 層は言語拡張のみ | 上記トピックがナレッジファイルに存在する | [DL] §9、[UC] §9、[IA] §9 |
| FR10.2 | 言語別（Rust）ナレッジを提供する: field-visibility、tell-dont-ask、factory-naming、interior-mutability（`&self` への偽装禁止）、module-visibility、domain-equality、error-handling（手実装エラー enum）、first-class-collections、スタティックバインディング既定、`event-store-adapter-rs` を参照実装とした ES 実装規約、ポートの trait 配置・実装命名 | 同上 | [DL] §9、[UC] §9、[IA] §9 |
| FR10.3 | ナレッジは `knowledge/<agent-slug>/` に置き、ディレクトリ名は消費するエージェントの slug と完全一致させる。`domain-modeling` と `domain-design` のリード `aidlc-architect-agent` を主配置とし、`functional-design`・`infrastructure-design`・`code-generation` のリード／サポート（`aidlc-developer-agent`、`aidlc-aws-platform-agent` など）にも必要なナレッジが届くよう配置する。エージェント横断のものは `knowledge/aidlc-shared/` を使う | compose 後に各対象ステージの `inline_context_paths` にプラグインのナレッジが現れる | [RA-Q3]、[DL] §10、[KB-DDD architecture] |
| FR10.4 | ファイル名はプラグイン固有（例: `ddd-always-valid-model.md`）とし、既存ファイルを上書きしない。コアの `aidlc-architect-agent/ddd-patterns.md` と内容が矛盾する箇所は、矛盾・適用範囲・採用理由を明示して利用者の判断を求める | 既存ファイル名との衝突がなく、矛盾箇所の一覧が設計成果物に残る | [DL] §9、[KB-AW architecture] C8 |
| FR10.5 | メタ規律を含める: 衝突時の優先順位の明文化、例外には必ず理由を記録、良い例は実在ファイルへの索引、失効ルールは打ち消し線＋失効注記で残す、規則の記述はコード実測に anchored、「実装済みと主張するのは強制できる範囲だけ」 | ナレッジに該当節が存在する | [DL] §9 |
| FR10.6 | 必須条件はナレッジだけに任せず、ステージ手順（fragments）・成果物契約（スキーマ）・センサーにも定義する | FR3〜FR8 の各要件がナレッジと独立に存在する | [DL] §9 |

### FR11. プラグインのパッケージング

| ID | 要件 | 判定 | 出典 |
|---|---|---|---|
| FR11.1 | `.aidlc-plugin/plugin.json` の `aidlc.contributes` は stages / overlays（contributions）/ sensors / knowledge / tools の5面。agents・scopes は宣言しない | 既存マニフェストの宣言を維持し、validate が通る | [KB-DDD business-overview]、[RA-Q3]、[RA-Q4] |
| FR11.2 | 成果物の論理名はフラット名前空間で `ddd-` 接頭辞を付ける。`components` / `decisions` / `traceability` など既存名と無接頭辞名は使わない | compile が論理名を拒否しない | [KB-AW code-structure] |
| FR11.3 | `bun run validate`、`bun run build:claude`、`bun run build:codex`、`bun run check` が成功する | 4コマンドがすべて終了コード0 | [KB-DDD business-overview] |
| FR11.4 | `aidlc-plugin-test --install` の3条件（1回目の compose で drop なし、グラフに stage と scope 割当が載る、2回目の compose がバイト単位で安定）を満たす | `aidlc-plugin-test` が成功する | [KB-AW architecture] T1 |
| FR11.5 | 未実装の機構に依存しない: `adds.requires_stage`、`adds.required_sections`、`when:` 述語、`after-questions` anchor、`memory/` の配布、`dependencies` によるバージョン制御 | compose の drops ログが空 | [KB-AW architecture] C1・C2・C4〜C7 |
| FR11.6 | README に拡張ポイント一覧、対応ハーネス（Claude Code、Codex CLI）、層判定の命名規約（FR9）、センサー一覧（(a)〜(n)）、導入手順を記載する | README に上記5節が存在する | [intent] Q2、[RA-Q2] |

---

## 3. 非機能要件

| ID | 分類 | 要件 | 判定 | 出典 |
|---|---|---|---|---|
| NFR1 | 確定性 | センサーは同一入力に対して常に同一の verdict を返す。判定は構文解析のみに基づき、実行時の意味判断・ネットワーク・時刻に依存しない | 同一 fixture を3回実行して verdict と詳細が一致する | [DL] §8 |
| NFR2 | 実行時依存 | センサーとツールは bun と同梱物（tree-sitter-rust WASM を含む）だけで動作する。cargo、Node.js、ネットワークアクセスを要求しない | ネットワーク遮断・cargo 未導入の環境で全センサーのテストが緑 | [RA-Q7] |
| NFR3 | 性能 | 各センサーはマニフェストの time budget 内で完了する。目安として、200 ファイル規模の Rust workspace で1センサー 10 秒以内 [assumption] | 上記規模の fixture で計測し 10 秒以内 | §5 A6 |
| NFR4 | テスト | Standard テスト戦略に従う。各センサー（FR6、FR7、FR9）に違反あり／なしのゴールデンケース、スキーマ（FR2、FR3.3、FR5.1）に適合／不適合のサンプル、compose 統合テスト（FR11.4）を持つ。既存テスト2本は緑のまま | `bun run check` が緑で、上記のテストが存在する | org.md Testing Posture、[KB-DDD code-quality-assessment] |
| NFR5 | ハーネス互換 | Claude Code と Codex CLI の両方で compose がプラグインのステージ・contribution・センサーを拒否しない。ステージは `mode: inline` のみ、参照するエージェントはコアのもののみ | 両ハーネスで `aidlc-plugin-test --install` が成功する | [RA-Q2]、[KB-AW architecture] C3 |
| NFR6 | 決定性ビルド | ビルド・投影は2回実行してバイト単位で一致する | `aidlc-plugin-test` の2回目が安定 | [KB-AW architecture] |
| NFR7 | 保守性 | biome の lint／format（`--error-on-warnings`）に違反がない。言語横断の規則定義と言語別の検査器が分離されている（FR8.6） | `bun run check` の biome ステップが緑 | [KB-DDD code-structure] |
| NFR8 | 可観測性 | センサー失敗時は詳細ファイルと監査行が残り、違反ごとに規則ID・ファイル・行番号・説明が読める（FR7.13） | 詳細ファイルのフォーマット検査テストが緑 | [KB-AW architecture] T3 |
| NFR9 | セキュリティ | センサーは対象コードを実行しない（解析のみ）。外部への通信・認証情報の参照を行わない | センサーのソースに実行系 API と HTTP クライアントの呼び出しがない（レビューで確認） | 構築フェーズ規約 |
| NFR10 | 公開品質 | OSS として公開できる状態: LICENSE、README（FR11.6）、CHANGELOG または相当の変更履歴、既知の制約（C1〜C8 に起因するもの）の明記 | 上記ファイルが存在する | [intent] Q2 |

---

## 4. 制約

| ID | 制約 | 出典 |
|---|---|---|
| CON1 | contribution は追加のみ。コアステージの手順・契約の上書き・削除はできない。利用可能な面は `adds.produces` / `adds.consumes` / `adds.sensors` / `adds.scopes` / `fragments` | [KB-AW architecture]、[DL] §10 |
| CON2 | `adds.requires_stage` は未実装（drops ログに落ちる）。順序辺は自ステージの `requires_stage` でしか張れない（C1） | [KB-AW architecture] C1 |
| CON3 | `adds.required_sections` は機械強制されない。章構造を保証するには自前の gate センサーが必要（C2） | [KB-AW architecture] C2 |
| CON4 | blocking が実効を持つのは `fire_on: gate` ＋ `default_severity: blocking` のみ。write 発火の blocking は advisory に降格される | [DL] §10 |
| CON5 | センサーのファイル名は `sensors/aidlc-<id>.md`、フラット走査。`kind` は `deterministic` のみ | [DL] §10 |
| CON6 | `knowledge/<agent-slug>/` はディレクトリ名がエージェント slug と完全一致しないと黙って無視される | [DL] §10、[KB-DDD architecture] |
| CON7 | `mode: inline` 以外や `reviewer:` を持つステージは、Codex では手書きのディスパッチ面がないと compose が拒否する（C3）。コアの14エージェントは両ハーネスに投影済み | [KB-AW architecture] C3 |
| CON8 | `when:` 述語は未評価（C4）。`after-questions` anchor は未実装（C5）。`memory/` は投影されない（C6）。`dependencies` / `aidlc.lock.json` は読まれない（C7） | [KB-AW architecture] |
| CON9 | エンジンは blocking センサーに対する人間の明示オーバーライド（監査付き）を許す。SM2「違反を含んだまま先へ進めない」は、このオーバーライドを除いた範囲で成立する | [DL] §10 |
| CON10 | プラグインの `tools/` は bun で動く TypeScript。ビルド・検証は親リポジトリのエンジンツールに委譲しており、`ddd` は親リポジトリの相対パス配置に結合している（単独 clone では動作しない） | [KB-DDD architecture] |
| CON11 | 初版の対象言語は Rust のみ | [DL] §8 |
| CON12 | 成果物論理名はフラット名前空間で `<plugin>-` 接頭辞必須、`core-*` は予約 | [KB-AW code-structure] |

---

## 5. 前提

| ID | 前提 | 根拠・確認先 |
|---|---|---|
| A1 | 組み込みの Rust センサーも、生成センサーと同じくゴールデンケース fixture（違反あり／なし）で検証する。設計書は生成センサーに対してこれを要求しているが、組み込み分にも同じ基準を適用する | [DL] §8。FR8.7 として要件化 [assumption] |
| A2 | composition root（DI 結線）クレートの識別規約は `domain-design` で確定する。確定するまで FR9.4 の「層不明」判定の例外にはならない | [DL] §7-5、§7 OQ1 [assumption] |
| A3 | CQRS のコマンド側／クエリ側／RMU のサブプロジェクト識別規約（センサー (k)(l) の判定根拠）は設計で確定する | [IA] §3・§4、§7 OQ2 [assumption] |
| A4 | Rust コードセンサーのバインド先は `code-generation` ステージのゲート（`build-and-test` ではない）。生成直後に止めるのが SM3 に最も近いため | [DL] §8 [assumption] |
| A5 | `patches/installed-harnesses.patch` の上流化・適用不要化は本インテントの対象外（既存の構造的負債として別途扱う） | [KB-DDD architecture] [assumption] |
| A6 | NFR3 の性能目標（200 ファイルで 10 秒）は仮置きであり、設計で見直す | [assumption] |
| A7 | SM4「実プロジェクトで DDD 設計の手戻りが減る」の測定方法は未定義のまま。本インテントでは測定基盤を作らない | [intent] Assumptions [assumption] |
| A8 | コアの `ddd-patterns.md` との矛盾の判断者は利用者本人（意思決定者は一人） | [intent] Q5 [assumption] |
| A9 | `domain-modeling` のレビューア（`reviewer:`）を宣言する場合はコアの `aidlc-architecture-reviewer-agent` を advisory で使う。独自レビューアは作らない | [RA-Q2]、CON7 [assumption]、§7 OQ5 |

---

## 6. スコープ外

| ID | 対象外 | 出典 |
|---|---|---|
| OUT1 | 第2言語以降のセンサー実装と、その生成基盤（センサー生成ナレッジ、ひな型、ゴールデンケース生成） | [DL] §11 |
| OUT2 | 永続化方式別の必須設計リストの検査（ES の1コマンド1イベント、replay 経路の区別、ステートソーシングの一意性担保手段など）。2軸の宣言（FR3.3）とセンサー (j) は対象内 | [RA-Q6]、[DL] §11 |
| OUT3 | Kimi Code、Kiro CLI、Kiro IDE、OpenCode、Cursor、GitHub Copilot への動作保証 | [RA-Q2] |
| OUT4 | プラグイン独自エージェント、プラグイン独自スコープ | [RA-Q3]、[RA-Q4] |
| OUT5 | `memory/`（フェーズ規約・チーム規約）のプラグインからの配布 | [KB-AW architecture] C6 |
| OUT6 | API／UI ハンドラ層のセンサー（ナレッジのみ提供） | [IA] §2 |
| OUT7 | 上流（aidlc-workflows）へのパッチ提出、`patches/installed-harnesses.patch` の解消 | §5 A5 |
| OUT8 | SM4 の測定基盤 | §5 A7 |
| OUT9 | 既存プロジェクトのコードを自動修正する機能（センサーは検出と報告のみ） | [DL] §8 |

---

## 7. 未解決事項

後続ステージ（domain-design、units-generation、functional-design）で決着させる。

| ID | 事項 | 決着先 |
|---|---|---|
| OQ1 | composition root クレートの識別規約（接尾辞 `-composition-root` / `-bootstrap` / `-main` など）と、層規則からの除外方法 | domain-design |
| OQ2 | CQRS のコマンド側／クエリ側／RMU サブプロジェクトの識別規約（接尾辞または配置） | domain-design |
| OQ3 | web-tree-sitter ランタイムと tree-sitter-rust WASM の同梱方法（`tools/` 配下への vendoring、`dist/` への投影、`node_modules` 非依存の確認） | domain-design、units-generation |
| OQ4 | FR6.4 の blocking センサーが、`domain-modeling` が SKIP のスコープで `domain-design` を誤って止めないための判定方法（状態ファイルの EXECUTE／SKIP を読むか、`adds.scopes` と組み合わせるか） | domain-design |
| OQ5 | `domain-modeling` に `reviewer:`（コアの architecture-reviewer、advisory）を宣言するか | domain-design |
| OQ6 | コアの `knowledge/aidlc-architect-agent/ddd-patterns.md` の内容との矛盾箇所の洗い出し | domain-design |
| OQ7 | Rust センサーが `tree-sitter` の構文木だけで判定できない箇所（例: (d) の「フィールドを返すだけのメソッド」判定でのマクロ展開）の扱い | functional-design |

---

## 8. トレーサビリティ

| 要件群 | 上流の根拠 | 成功指標 |
|---|---|---|
| FR1、FR2 | [intent] SM1、[DL] §2〜§5、[RA-Q1]〜[RA-Q4] | SM1 |
| FR3 | [DL] §4・§7-2、[UC] §6、[RA-Q1]、[RA-Q6] | SM1、SM2 |
| FR4 | [UC] §1〜§8 | SM2 |
| FR5 | [IA] §1〜§8 | SM2 |
| FR6 | [DL] §8、[UC] §7、[RA-Q1] | SM2 |
| FR7、FR9 | [DL] §6〜§8、[UC] §7、[IA] §8、[RA-Q5] | SM2、SM3 |
| FR8 | [DL] §8・§10、[RA-Q7]、[KB-AW architecture] T3 | SM2、SM3 |
| FR10 | [DL] §9、[UC] §9、[IA] §9、[RA-Q3] | SM1、SM3 |
| FR11 | [KB-AW architecture] T1、[KB-DDD]、[RA-Q2] | G3 |
| NFR1〜NFR10 | [DL] §8、[RA-Q7]、org.md Testing Posture、[intent] Q2 | SM2、SM3、G3 |

## Assumptions & Open Questions

- §5 の A1〜A9 は `[assumption]` として未確認のまま本書に残す。後続ステージで確認されるまで確定要件に昇格させない。
- §7 の OQ1〜OQ7 は決着先のステージで解消する。
