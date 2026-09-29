# DDDプラグインのユースケース層設計

[English](use-case-layer-design.md) | 日本語

更新: 2026-09-28。[ドメイン層設計 §7](domain-layer-design.ja.md)と共通の失敗・保存契約を使う。以下は設計規約であり、センサーによる完全な保証を意味しない。

## 1. 提供形態

functional-designをcontributionで拡張し、宣言・ナレッジ・センサーを追加する。宣言は登録済みレビュー成果物functional-specの必須セクションへ組み込む。[成果物契約](../users/artifact-contract.ja.md)を参照。

## 2. 責務

ユースケースは取得・業務操作・保存・回復の進行を管理する。業務判断はドメインに委ねる。整合性、冪等性、順序、失敗と補償、観測方法を明示する。

## 3. 規約

1. 外部I/Oはポートを通し、具象アダプタとの結線はcomposition rootで行う。ドメイン型への依存は許す。
2. コマンド側の `execute` には集約IDとVOを渡す。集約はポート経由で取得する。
3. 別ユースケースを直接呼ばない。共通の業務判断はドメインへ、複数処理の調整は明示したフローへ置く。外部ポートの `execute` 呼出しは禁止対象ではない。
4. getterで値を取り出して業務判断しない。判断を返すドメインメソッドを呼ぶ。ただし、取得した値を業務上の条件分岐・計算に使わず、リポジトリの引数として受け渡すことは許す。
5. DBや外部システムのクライアントを直接使用しない。

クエリ側はDAOでDTOを取得する構成とし、コマンド側の集約取得・保存規約をそのまま適用しない。

## 4. 整合性と途中失敗

集約を強整合の基本境界とする。複数集約を一つのトランザクションに恒常的に束ねる前に、不変条件と集約境界を見直す。再配置できない処理では、中間状態と回復フローを明示する。[設計の背景](https://zenn.dev/j5ik2o/articles/59de072b6728ff)

単一集約の更新を一つのDBトランザクションで保存することは許す。ユースケースというコード上の単位だけで複数集約の原子性を約束しない。

A保存成功後にBが失敗するフローでは、Aのコミットが残る。再試行・補償・手動回復を設計する。Sagaの補償は新たな処理であり、DBロールバックと同じ原子性・分離性を持つとは扱わない。補償の失敗も回復対象になる。

読み取りモデルには処理中・確定・補償中の公開範囲を定める。アクターによる直列処理も、外部I/Oの完了や複数集約の原子性を自動では保証しない。

## 5. 再実行と冪等性

呼出し側の再実行と、失敗ステップのバックオフ付き再試行を区別する。回数・期間・終了条件を定め、同じ要求の二重効果を防ぐ。保存結果が不明な場合は結果を照合する。

### 5-1. storeの契約

ポートの書込み名は `store` を基本とし、同一要求の再保存を安全に扱う。ステートソーシングではupsertを基本にするが、無条件の上書きでよいという意味ではない。期待バージョンや一意制約で競合を検出する。ステートソーシングの集約の `store` は、期待バージョン付きの `upsert` として宣言する。

イベントソーシングでは新規イベントの追記が基本であり、過去のイベントを更新しない。重複要求・追記競合・結果照合を含めて設計する。SQLのinsert使用自体を禁止しない。upsertという名前だけでフロー全体の冪等性が成立するとは扱わない。イベントソーシングの集約の `store` は `insert-only`（追記のみ）として宣言する。一つのコマンドが生むイベントは高々1件であり、`store` は期待バージョンを照合してその1件を追記する。バージョンの競合で拒否した `store` は何も保存しない。

助言 `design-advisories.store-upsert`（ルールIDは変更なし）は、各リポジトリを実装写像にあるその集約の `persistence_method` と照合する。`state-sourcing` は `store` 動詞と `upsert`、`event-sourcing` は `store` 動詞と `insert-only` を期待する。写像が無い、読めない、またはリポジトリの集約を写像していない場合は、storeの意味を判定できないことを助言として報告し、従来のupsertのみの判定には戻さない。

### 5-2. 新規作成

同じ作成要求を識別できるIDと結果の対応を設計する。再実行ごとに別集約IDを生成する場合は、未参照データが残る条件、回収方法、イベントや外部I/Oへの影響を説明する。未参照であることだけを理由に無害とは判定しない。

### 5-3. 状態設定型の操作

同じ要求で既に目的状態に達していれば、変更なしの成功として吸収できる。ただし別要求で状態が変わった後に古い要求が再送される場合は、要求IDや期待バージョンによる判定も必要になる。

### 5-4. 加算・追加型の操作

加算等は同じ値の再設定では吸収できない。適用済みコマンドIDと効果を対応付け、再送を二重適用しない。重複判定と保存が分離して失敗する場合も考慮する。

直前1件のID保持は、別コマンドを挟んだ古い再送が来ない場合に限る。`C1 → C2 → C1の再送` は直列でも発生する。保持件数・期間は再送条件から決め、期間外の要求をどう扱うかも定める。

### 5-5. 現行モデルの表現

Commandは `effect: transition | accumulation` と `idempotency` を持つ。現在の検査は `accumulation` に `strategy: none` を認めず、`command-id-memory` を要求する。処理全体の冪等性を証明する検査ではない。

状態設定型の `none` は、ID記憶以外の方法で安全性を説明する選択であり、無対策でよいという意味ではない。再実行の根拠はユースケース宣言にも記載する。

再送を識別する期間は、モデルの既存の `idempotency.retention`（`last-one`、`retention_count` 付きの `multiple`、`retention_window` 付きの `time-window`）とする。モデルローダーは `command-id-memory` にこれを既に必須としている。ユースケース宣言に新しい項目は追加せず、`re_execution_basis` がこの保持期間を参照する。`strategy: none` のコマンドでは、繰り返しをコマンド自身のエラーで拒否するか、状態遷移のno-opとして扱うかを `re_execution_basis` に記載する。

### 5-6. コマンドの結果と重複成功

一つのコマンドは一つのイベントを生む。モデルではコマンドが省略可能な `event` にイベントを高々1件宣言する。ローダーは、コマンドに書かれた従来の `events` の一覧を案内付きで拒否し（`schema.command-events`）、`produced_by` が宣言元のコマンドと一致しないイベントや、2件以上のイベントを生むコマンドを拒否し（`schema.event-producer`）、集約が宣言していないイベントを拒否する（`schema.event-link`）。コマンドがイベントを返すのは状態遷移したときだけである。拒否はメソッド固有のエラー型で表し、何も変えない。

- Rust: 状態を変えるメソッドは `&mut self` を取る。一つの `&mut self` メソッドが業務判断・状態遷移・イベントの返却を行い、判断だけを行う `&self` のメソッドを適用と分けて設けない。ステートソーシングでは `Result<(), XxxError>`、イベントソーシングでは `Result<XxxEvent, XxxError>` を返す。replayメソッド（`replay_methods`）は業務判断をせず永続化済みイベントを適用するだけであり、コマンドとは区別する。
- TypeScript: ドメインメソッドは不変であり、インスタンスの状態へ書き込まず、新しいインスタンスを返す。ステートソーシングのコマンドは `Result<Invoice, XxxError>`、イベントソーシングのコマンドは `Result<{ next: Invoice; event: XxxEvent }, XxxError>` を返す。ユースケースは、コマンドを呼んだインスタンスではなく、返された新しいインスタンス（`next`）を保存する。
- 値オブジェクトとDomain Primitiveは両言語とも不変とする。

成功が2種類になるのは `idempotency.strategy: command-id-memory` のコマンドだけである。「適用」は状態を変え、その1件のイベントを持つ。「適用済み」は何も変えず、イベントを持たない。適用済みは、モデルの保持期間内で記憶しているコマンドIDに対して返す。拒否したコマンドのIDは記憶しない。

- Rust: `Result<CommandOutcome<XxxEvent>, XxxError>`。`enum CommandOutcome<E> { Applied(E), AlreadyApplied }` はインフラ層のlanguage-extensionsクレート（`packages/infrastructure/language-extensions`）に置く。ステートソーシングでは重複に対して変更なしで `Ok(())` を返す。
- TypeScript: インフラ層の `Result` の成功側を `CommandOutcome<T, E> = { readonly kind: "applied"; readonly next: T; readonly event: E } | { readonly kind: "already-applied" }` とし、`@acme/language-extensions` で `Result` と並べて宣言する。ユースケースは適用なら `next` を保存し、適用済みなら何も保存しない。

`none` のコマンドは、`re_execution_basis` の記載どおり繰り返しを拒否またはno-opとして扱う。

センサーが検査するのは状態の変更であり、戻り値の形ではない。TypeScriptの規則bは、モデル・コマンド・replayの宣言やモデルの有無にかかわらず、ドメインのインスタンスメソッドでの状態の書込みをすべて報告する。Rustの規則bは、宣言済みコマンドを `&self`・`self`・`mut self` で実装した場合も報告する。戻り値の形を判定するセンサーは無い。TypeScriptのドメイン事実は戻り値型を持たず、Rustの事実は別名を解決せず返すバリアントも記録しない。戻り値の形と1件の追記はレビューと動作テストで確認する。

状態機械だけで重複判定できるケースと、要求IDの記憶が必要なケースを分ける。FSMを使うことを理由に、イベントストアの競合制御や重複保存対策を省略しない。

## 6. 二つの宣言軸とProcess Manager

`programming_model: actor | class` と `persistence_method: state-sourcing | event-sourcing` は独立した選択とする。サーガはアクターモデル固有ではない。通常のクラスでも実装でき、採用基盤の対応範囲と技術上の可否を区別する。[Temporal公式Java実装例](https://github.com/temporalio/samples-java/blob/main/core/src/main/java/io/temporal/samples/hello/HelloSaga.java)

現行宣言は複数集約に `process-manager` または `re-execution` を要求する。集約の写像で対象集約のいずれか一つでも `actor` であれば、`multi_aggregate_strategy.kind: process-manager` を必須とする（ブロッキングの `mapping-declarations.process-manager-required`）。actor/class混在のフローもこれに含まれる。対象がすべて `class` の場合は、`process-manager` と `re-execution` のどちらも選べる。functional-designのcontributionはこの設計に従う。

対象集約が2つ以上で `re-execution` を使うユースケースについて、写像が無い、読めない、または対象のいずれかの項目が無い場合は、Process Managerが必要か判断できないため、ブロッキングの `mapping-declarations.execution-model-undetermined` を報告する。単一集約のユースケースと `process-manager` のユースケースは影響を受けず、写像が無くても通る。写像欠落時の従来の注記は出力しなくなった。

[言語共通の設計](language-independent-design.ja.md)では、TypeScriptのコード表現もプロジェクト単位の独立した選択とする。集約ごとのactor/class宣言は、ソース言語のclassキーワードを選ぶ指定ではない。

## 7. 検査とレビュー

gは依存方向と外部I/O、hは集約引数、iはユースケース連鎖、dはgetter、jはモデルの冪等性宣言を検査する。h/iは明示型を照合し、集約とVO、具象ユースケースとポートを区別する。[判定範囲](../users/rust-sensor-contract.ja.md)外の構文は注記する。

途中失敗の回復可能性、保持期間、集約境界、公開範囲はレビューと動作テストで確認する。宣言の存在と動作の安全性を区別する。

## 8. ユースケース宣言

各定義に識別子・名前を付け、次を記載する。

| 項目 | 内容 |
|---|---|
| `target_aggregates` | 対象集約の参照ID |
| `commands` | 使用するコマンドの参照ID |
| `re_execution_basis` | 各ステップの再実行が安全である根拠 |
| `recovery_policy` | `caller-retry` / `step-backoff` / `both` |
| `multi_aggregate_strategy` | 複数集約時のProcess Manager参照、または再実行戦略 |
| `read_model_exposure` | 中間状態をどのビューへ公開するか |

現行の格納先は `functional-spec.md` 内の `## DDD Use-case Declarations`（従来の日本語見出しも受理。[成果物契約](../users/artifact-contract.ja.md)を参照）。独立した宣言ファイルは生成しない。通常承認では文書・セクションの欠落も検出する。

## 9. ナレッジ

責務分離、集約の整合性、要求単位の冪等性、回復・補償、公開範囲を扱う。Rustではポートのtraitと静的ディスパッチを基本とする。特定のサーガ基盤やイベントストアを全プロジェクトへ強制しない。

## 10. 残る設計判断

以前の未決事項は確定した。actor/class混在と写像欠落は§6、適用済みの戻り値は§5-6、再送期間は§5-5（モデルの既存の `idempotency.retention` を使い、ユースケース宣言に項目を追加しない）を参照。今後新属性を追加する場合も、ローダー・契約資料・生成手順・センサー・テストを同時に更新する。
