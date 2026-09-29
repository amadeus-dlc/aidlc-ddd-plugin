# DDDプラグインのドメイン層設計

[English](domain-layer-design.md) | 日本語

更新: 2026-09-28。2026-09-08〜10の議論を整理した現行の設計規約。実装状況は[現状評価](current-state-assessment.ja.md)、修正の完了条件は[残作業](completion-tasks.ja.md)を参照する。本書の規約を、すべて機械検査済みという意味では使わない。

## 1. 目的と適用範囲

AI-DLCに、Domain PrimitiveとAlways Valid Domain Modelを設計・実装する手順、ナレッジ、センサーを追加する。初版の検査言語はRust、完成に向けた検証対象はClaude CodeとCodex。kimi・opencodeは対象外。

層分割、getterの利用制限、物理クレート分割はこのプラグインの規約であり、DDD一般の必須条件としては扱わない。

## 2. ddd-domain-modelingステージ

正式名は `ddd-domain-modeling`。requirements-analysisやuser-storiesを任意入力とし、domain-designより前に集約境界までの正規モデルを作る。入力がなければ対話で語彙を引き出す。既存プロジェクトへの単独適用も設計対象とする。通常承認の接続は実装したが、単独完了の標準側ガードには不足がある。

導出は、ストーリー → 過去形の業務イベント → コマンド → 集約候補 → 不変条件の順に行う。分析上のイベントは保存方式に関係なく使える。分析で挙げたイベントをすべて保存する必要はない。

| 所有者 | 責務 |
|---|---|
| ddd-domain-modeling | 語彙、集約境界、不変条件、状態、コマンド、イベント、エラー、生成規則 |
| domain-design | モジュール・型・ポート・リポジトリへの写像と保存方式 |
| functional-design | Unitごとの手順、再実行、回復、公開範囲 |

完了条件は、(i)各集約に不変条件、(ii)各コマンドに状態遷移または遷移なしの明示、(iii)各コマンドにDomain Error、(iv)参照IDの解決、(v)YAMLとMarkdownの対応、(vi)人間による意味のレビューである。(iii)はローダーの `schema.command-no-error` で実装済み。通常承認への接続は実装した。単独完了の制約は[成果物契約](../users/artifact-contract.ja.md)を参照。

## 3. 正規モデル

Bounded Contextに集約を置き、集約はEntity・Value Object・Domain Primitive、不変条件、コマンド、イベント、エラー、状態遷移、FactoryRuleを持つ。複数集約の調整はProcess Managerとして表せる。

Domain Primitiveは、業務上の意味と不変条件を持つ小さな不変型である。Always Validの対象はそれだけでなく、集約を含むモデル全体の生成・変更操作に及ぶ。

現行モデルのDomain Errorは所属コマンドと失敗条件を記録する。[合意した共通設計](language-independent-design.ja.md)では、生成操作も含めてメソッド固有の閉じたエラー集合へ契約を拡張する。各メソッドの戻り値のエラー型・variantと宣言の照合、全エラー経路や未処理の検査は、現在のセンサーでは実装していない。

## 4. 所有権と参照ID

正式な定義は正規モデルだけが所有し、下流は再定義せず参照・写像する。IDの例は `bc.billing`、`aggregate.invoice`、`primitive.invoice-number`、`invariant.invoice.total-positive`。

ID必須化には、手順の指示、登録済み成果物、参照センサーの三つが必要である。`adds.sensors` だけを付けても、対象成果物が未登録なら通常承認の検査は成立しない。

## 5. 成果物とIDのライフサイクル

`ddd-domain-model-yaml.md` のラベル付きYAMLブロック1つを正規データ、`ddd-domain-model.md` を人間向けの説明とする。Markdownには全要素IDと不変条件本文を記載する。現行センサーはその字面を検査し、説明全体の意味的一致はレビューで確認する。

論理名 `ddd-domain-model` / `ddd-domain-model-yaml` は、AI-DLC 2.8.2ではそれぞれ `ddd-domain-model.md` / `ddd-domain-model-yaml.md` に解決される。生成・参照・検査をこの名前へ統一した。旧成果物からの移行は[成果物契約](../users/artifact-contract.ja.md)に従う。

`element_id` は不変、`name` は表示名とする。名称変更でIDを変えない。分割・統合・削除では `lineage` に後継・置換・廃止を記録し、廃止IDを再利用しない。

読み込みは手書きローダーが担う。JSON Schemaは契約資料であり、実行時の検証器ではない。

## 6. ドメインコードの規約

- フィールドは非公開とし、読み取り専用の公開フィールドも許さない。
- 不変条件を満たす完全コンストラクタで生成する。空生成からの段階的初期化や復元時の検査迂回を禁止する。
- 単なるsetterを禁止する。状態の変更は宣言済みの業務コマンド、または宣言済みのreplayメソッドに限定する。
- VOとDomain Primitiveは両言語で不変とする。RustのEntity・Aggregateで状態を変更するメソッドは `&mut self` を取る。TypeScriptのドメインメソッドはすべて不変で、状態を書き換えず新しいインスタンスを返す。
- Domain Serviceは状態と永続化責務を持たず、ドメインの判断を担う。
- getterの定義は許すが、ドメイン層・ユースケース層からの呼出しは制限する。I/O変換を担うインターフェイスアダプタ層では使える。業務判断を返すメソッドはgetterと区別する。
- 業務エラーを返すコマンドは、呼出し前の状態を保持し、途中変更を残さない。
- `RefCell` 等で未宣言の業務変更を隠さない。キャッシュ等との区別はレビューで行う。

1コマンド1イベントとする。1つのコマンドが2件以上のイベントを生むことはない。モデルでは、コマンドが自身の1件のイベントを `event` で指定する。状態を変更しないコマンドは `event` を書かない。イベントを返すのは状態が遷移したときだけである。拒否時はメソッド固有のエラー型を返して状態を変更せず、安全に吸収した重複はイベントを生まない。これらの原則は2026-09-28にユーザーが確定した（T-03-03）。1コマンドに複数イベントを許し、TypeScriptでその場の変更を許したT-03-02の契約を置き換える。

Rust: 状態を変更するメソッドは `&mut self` を取る。1つの `&mut self` メソッドが業務判断と状態遷移を行い、イベントを返す。状態を変えずにイベントだけを返す `&self` のメソッド（判断専用）は生成しない。

| 永続化方式 | Rust | TypeScript |
|---|---|---|
| ステートソーシング | `Result<(), XxxError>`。重複は状態を変えずに `Ok(())` を返す | 新しいインスタンスを返す `Result<Invoice, XxxError>` |
| イベントソーシング | `Result<XxxEvent, XxxError>` | `Result<{ next: Invoice; event: XxxEvent }, XxxError>` |
| イベントソーシングで `idempotency.strategy: command-id-memory` のコマンド | `Result<CommandOutcome<XxxEvent>, XxxError>`。`enum CommandOutcome<E> { Applied(E), AlreadyApplied }` | `Result<CommandOutcome<Invoice, XxxEvent>, XxxError>`。`CommandOutcome<T, E> = { readonly kind: "applied"; readonly next: T; readonly event: E } \| { readonly kind: "already-applied" }` |

TypeScriptのドメインメソッドは不変で、状態を書き換えず新しいインスタンスを返す。ユースケースはコマンドが返した新しいインスタンスを保存する。`CommandOutcome` はinfrastructureの言語拡張クレート・パッケージに置く（[言語非依存設計](language-independent-design.ja.md)を参照）。already appliedを返すのは `command-id-memory` のコマンドに限り、モデルのretentionの範囲で記憶しているコマンドIDに対して返す。拒否したコマンドのIDは記憶しない。`strategy: none` のコマンドでは、再実行を自身のエラーで拒否するか、状態遷移なしで終えるかを `re_execution_basis` に記す。コマンドの保存では期待バージョンを確認し、その1件のイベントを追記する。

保存済みイベントから集約を再構築するreplayメソッド（`replay_methods`）は、イベントを状態へ適用するだけで業務判断を行わず、コマンドとは区別する。ただし破損・未知のスキーマを無条件に受け入れるという意味ではない。検出時は復元を中断して報告・隔離する。`apply` 等の名前だけを正当な復元経路の証拠にしない。

## 7. 外側の層との境界契約

### 7-1. getterの利用

DB保存、DTOへの変換などのためにインターフェイスアダプタ層から利用できる。ユースケース層でも、取得した値を業務判断に使わず、リポジトリの引数として受け渡す場合は利用できる。業務判断はドメイン側の操作として表す。この例外をドメイン層からのgetter呼出しに広げない。

### 7-2. 永続化方式

集約ごとに `programming_model: actor | class` と `persistence_method: state-sourcing | event-sourcing` を写像へ宣言する。方式別の詳細検査は未完成であり、宣言だけでコード形状が保証されたとは扱わない。

### 7-3. 一意性

事前照会で「存在しない」と分かっても保存成功は保証されない。一意性は保存先の制約・条件付き書込み・予約モデル等で裁定する。別インデックスを用いる場合は、集約保存との途中失敗・解放・再試行も設計する。値の形式はDomain Primitiveの生成時に検証する。

### 7-4. エラーと公開

リポジトリはDB固有エラーを公開せず、`RepositoryError<Id>` 等の共通契約へ変換する。業務上必要な一意性競合等はバリアントで表し、通信障害と区別する。

| 失敗の範囲 | 保証 |
|---|---|
| 単一のドメイン操作 | 業務エラー時は操作前の状態を保持する |
| 単一集約の保存 | 保存前の作業状態を確定状態として公開しない。保存失敗が確定したら破棄・再読込する |
| 保存結果が不明な通信障害 | 未保存と決めつけず、要求ID・保存結果の照合で回復する |
| 複数集約のフロー | 途中コミットが残り得る。全体の自動ロールバックは約束せず、再試行・補償・中間状態を設計する |

保存成功前にイベントを外部公開しない。保存と公開の間の障害に備える方式も宣言する。複数集約の回復契約は[ユースケース層設計](use-case-layer-design.ja.md)で扱う。

### 7-5. 物理構造と依存方向

ドメイン内部のパッケージ名はユビキタス言語に結び付ける。aggregate/、impl/、vo/、entities/等の技術分類で分けず、業務概念と責務でまとめる。domain-designが用語・モデル参照・配置理由を宣言し、コード生成時に実配置と照合する。詳細は [パッケージング契約](../users/domain-packaging-design.ja.md)を参照。

層をクレート等で分離する。許可方向は `interface-adapter → use-case / domain / infrastructure`、`use-case → domain / infrastructure`、`domain → infrastructure`。infrastructureは言語拡張用の層で、DB/RPCクライアントは置かず、他層への依存も許さない。

composition rootは結線のため、この表の外に置く。層は名前・配置から判定する。Cargo依存宣言と検査で規約を維持するが、クレートを分けただけで任意の禁止方向がコンパイルエラーになるわけではない。

## 8. センサーの保証範囲

| 規則 | 現在の検査 | 限界・残作業 |
|---|---|---|
| a | structの公開フィールド | Rust構文として検出できる範囲 |
| b | モデルに宣言されない `&mut self` メソッドと、`&self`・`self`・`mut self` で実装された宣言済みコマンド（型が集約に一意に結び付き、モデルがある場合） | 別ファイル・traitも照合。replayは明示宣言との一致で許可。戻り値の形は判定しない。TypeScriptの規則bは異なり、ドメイン型の非staticなインスタンスメソッドによる状態の書き込みをすべて所見にする |
| c / n | 生成箇所、Default、後付け初期化、復元呼出し | FactoryRuleの前提条件の意味は検証しない |
| d | 明示型で特定した受信側のgetter | 推論が必要な受信側は未検査の注記 |
| e | ID解決と廃止・置換関係 | 通常承認へ接続済み。単独完了の制約あり |
| f | Markdown内のID・不変条件本文 | 意味的な一致は人間のレビュー |

構文検査の決定性と業務的な正しさは別である。初版では構文として確定できる違反をblocking、意味の判断をレビュー対象とする。不変条件を守る動作は生成コードのテストでも確認する。汎用的な意味証明や内部可変性の全検出は完成条件に含めないが、その限界をナレッジにも明記する。

## 9. ナレッジ

言語横断の設計原則とRust規約を、担当エージェント別および共有ディレクトリへ配布する。ADT、集約間のID参照、Domain Service、業務語彙、状態遷移、外部モデルとの境界を扱う。

プロジェクトの明示方針と衝突した場合は、その箇所と適用範囲を示して解決する。「プラグインだから優先する」という一律の上書き規則は設けない。検査の実装状況を正確に記し、例は実在するケースを指す。対象構造がない正常ケースを、その構造の正しさの実証には使わない。

## 10. AI-DLCへの接続

ステージ・contribution・センサー・ナレッジ・ツールをcomposeする。プラグイン所有のステージと論理成果物は `ddd-` 接頭辞を持つ。

通常承認の検査には、登録済み成果物、実ファイル名、`matches`、`fire_on: gate`、重大度が一致する必要がある。センサー単体やcomposeの成功だけでは承認時検査を保証しない。通常承認はT-01の統合テストで検証し、単独完了の不足は別課題として残す。

## 11. 後続の拡張

共通契約、Rustの改善、成果物の移行を先行し、次の言語としてTypeScriptへ対応する。[共通設計とリリース順序](language-independent-design.ja.md)に従う。センサー生成基盤、永続化方式別の詳細スキーマ、内部可変性の追加解析は別途扱う。ユースケース層とインターフェイスアダプタ層は別文書に設計規約を持ち、未着手扱いにはしない。

## 12. T-03で確定した実装契約

replay経路は[replay_methods](../users/rust-sensor-contract.ja.md)として実装した。6章の戻り値の契約と1コマンド1イベントの原則は、2026-09-28に確定した（T-03-03）。

モデルのローダーは、`schema_version: 2` のまま（版は上げない）1コマンド1イベントを強制する。旧来の `events` の一覧を持つコマンド（`schema.command-events`。単一の `event` キーへの書き換えを案内する）、`produced_by` が別のコマンドを指す `event`（`schema.event-producer`）、コマンドの集約に無い `event`（`schema.event-link`）、モデル内で2件以上のイベントの `produced_by` になっているコマンド（`schema.event-producer`）を拒否する。両方のJSON Schemaも合わせた。

メソッドの形はセンサーが強制する。TypeScriptの規則bは、ドメイン型の非staticなインスタンスメソッドが状態を書き込めば、すべて所見にする。対象は `#` フィールド・`this` のメンバー・クロージャが捕捉した状態への代入と、状態に持つコレクションへのpush・set・add・delete等の変更呼出しである。モデルがコマンドと宣言しているか、写像がreplayと宣言しているか、モデルがあるかどうかを問わない。Rustの規則bは、`&self`・`self`・`mut self` で実装された宣言済みコマンドも報告する。戻り値の形を判定するセンサーはない。TypeScriptのドメイン事実は戻り値型を持たず、Rustの事実は型別名を解決せず、返すバリアントも記録しないため、判定すると誤検知が出るからである。戻り値の形とイベントが1件であることは、レビューと振る舞いテストで確認する。

TypeScriptとRustで共通の振る舞いシナリオは7件である。状態変更、業務エラー時の状態保持、不正値の拒否、永続化後の復元、重複コマンドがalready appliedを返すこと、拒否されたコマンドが状態を保つこと、1コマンドにつき1件のイベントを追記することである。TypeScriptでは、コマンドが元のインスタンスを変えないことを加える。

actor/class混在のフローでは、集約写像で対象集約のいずれかが `actor` であれば、ユースケースに `multi_aggregate_strategy.kind: process-manager` を宣言する。class集約だけが対象なら `process-manager` と `re-execution` のどちらも選べる。[ユースケース層設計](use-case-layer-design.ja.md)と[残作業](completion-tasks.ja.md)を参照する。
