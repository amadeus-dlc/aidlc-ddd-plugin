# RustとTypeScriptに共通のDDD設計

[English](language-independent-design.md) | 日本語 | [開発者向け文書](README.ja.md)

状態: 2026-09-13にユーザーが確定した合意仕様。以下の比較でRustの既存動作として示した部分を除き、実装は未完了です。設計議論の結論を、両言語に共通する実装の目標として記録します。

DDDプラグイン全体を改善します。Rustを最初の実装・リリース対象とし、同じバックエンドの責務をTypeScriptでも扱います。両言語に同じドメイン規約、境界規約、検査契約を適用し、Rustの現状も照合して不足を修正します。構文や解析方法などの言語固有部分は、それぞれの実装で扱います。用語は[プロジェクト用語集](../../../CONTEXT.ja.md)を参照してください。

## 1. 実行ホストとレイヤー別パッケージを分ける

両言語で次の構造を使います。

```text
apps/
  web/                           # Next.jsなどのフレームワークアプリ
workers/
  billing-events/                # Workerの実行ホスト
packages/
  command/
    billing-domain/
    billing-use-case/
    billing-interface-adapter/
  query/
    billing-use-case/
    billing-interface-adapter/
  infrastructure/
    language-extensions/
  rmu/
    billing-rmu/
```

`command/` と `query/` は分類ディレクトリです。`packages/` 配下の末端を、それぞれ独立したパッケージにします。RustではCargoのcrate、TypeScriptでは `package.json` の単位です。パッケージの識別子は分類をまたいでも一意にします。この配置例は、command側とquery側に同一のパッケージ名を付ける指定ではありません。ドメイン内部の名前はユビキタス言語に結び付け、aggregate/・impl/・vo/・entities/などの技術分類を業務パッケージの根拠にしません。

実行ホストはフレームワークとの接続、依存関係の組み立て、処理の委譲を担当します。業務判断や永続化の実装は、対応するパッケージに置きます。フレームワーク固有の配置規約とエントリーポイントを維持し、ドメインモデルのコード表現をホストに強制しません。ホストも依存方向と責務の検査対象です。

依存は `apps/*`・`workers/*` から `packages/*` へ向け、逆方向を禁止します。パッケージ間には既存のレイヤー規約を適用します。インターフェイスアダプタはuse-case・domain・infrastructure、use-caseはdomain・infrastructure、domainはinfrastructureへ依存できます。infrastructureは言語拡張用で、他レイヤーへ依存しません。DBや外部HTTPの実装はインターフェイスアダプタに置きます。command/queryの分離と、Read Model Updaterによる橋渡しの既存規約を維持します。機械識別子は `rmu` です。

TypeScriptの初回対象は、サーバー側のNode.js runtimeで動くESMです。実際のNext.jsアプリのビルドと実行を受入条件にします。ホストの構造は他のフレームワークやWorkerにも拡張できますが、Cloudflare WorkersやEdge Runtimeの動作保証は初回対象に含めません。Next.jsはESMのimportとローカルパッケージの変換に対応しています。モジュール設定とサーバー／クライアント境界は実際に検証します。[ESMの扱い](https://nextjs.org/docs/messages/import-esm-externals)と[transpilePackages](https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages)も参照してください。

## 2. 依存方向と公開範囲を両方検査する

| 契約 | Rust | TypeScript |
|---|---|---|
| レイヤー境界 | Cargoのcrate | `package.json` 単位のパッケージ |
| 外部公開の範囲 | 外部から到達できるcrateの公開API | `package.json` の `exports` が指定する入口と、そこから公開されるAPI |
| 内部ファイル間の利用 | crate内部の可視性規則に従う | 同じパッケージの別ファイル向けのexportを許可する |
| パッケージ間のアクセス | 公開範囲と依存方向を検査する | 実際の参照先を解決し、公開入口と依存方向を検査する |
| 型だけの参照 | 依存として扱う | `import type` にも同じ規約を適用する |
| 公開範囲の変更 | 公開入口で再公開する名前を明示する | 公開入口で再公開する名前を明示する |

公開APIでも、参照元のレイヤーによっては依存を禁止します。公開範囲と依存方向のセンサーを維持し、相対パス・絶対パス・エイリアスでパッケージ内部へ直接アクセスする迂回も検出します。

公開入口での一括再公開（`pub use ...::*`、`export *`）を禁止し、必要な名前を明示します。ファイル単位のexportには内部利用もあるため、すべてをパッケージの公開APIとは扱いません。個々のexportを設計成果物へ二重に記載する方式は採用しません。TypeScriptの公開入口は `package.json` の `exports` を正とし、公開シンボルはコードから確認します。公開の必要性はレビューします。Node.jsの `exports` だけでは絶対パスによる参照まで防げないため、センサーで境界を検査します。[Node.js公式仕様](https://nodejs.org/api/packages.html#main-entry-point-export)

## 3. 集約の動かし方・永続化・コード表現を独立させる

| 選択軸 | 単位 | Rust | TypeScript |
|---|---|---|---|
| 集約の実行モデル | 集約ごと | `actor / class` | 同じ概念上の選択 |
| 永続化方式 | 集約ごと | `state-sourcing / event-sourcing` | 同じ概念上の選択 |
| ドメインのコード表現 | プロジェクトごと | 言語固有の `struct + impl` | class方式、または構造体＋メソッド＋コンパニオン方式 |

既存の `programming_model: class` は集約のプログラミングモデルを表します。TypeScriptの `class` キーワードを必須にする指定ではありません。Rustでも、このモデルをstruct + implで表現しています。TypeScriptで構造体＋コンパニオン方式を選んだ場合も、アクター方式の集約を実装できる設計にします。宣言・生成・検査で、この3軸を独立して扱います。

TypeScriptの表現設定は、集約・Entity・Domain Primitive・Value Objectに共通で適用します。プロジェクト内で両方式を混在させません。この設定は、実行ホストにあるフレームワークのコード表現を規定しません。

## 4. 合意したTypeScriptの表現を保つ

class方式は、JavaScriptの `#` プライベートフィールドで内部状態を隠します。構造体方式は、型と同名のコンパニオンオブジェクトを組み合わせます。インスタンスメソッドは返すオブジェクトの中、生成などのstatic相当の処理はコンパニオンに置きます。内部状態はクロージャで保持し、型ごとの非公開 `unique symbol` ブランドを付けます。

以下は、メソッド固有のエラーも含めて構造体方式の形を記録した例です。数値の範囲は例示用の業務規則で、すべてのカウンターに課す要件ではありません。ここに記したResult型は、実際には言語拡張用のinfrastructureに置く契約を表します。最終的な設定キーやモデルとコードの写像は、この例では定義しません。

```ts
type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export type CreateCounterError = "invalid-initial-value";
export type IncrementCounterError = "limit-reached";
const counterBrand: unique symbol = Symbol("Counter");

export type Counter = {
  readonly [counterBrand]: true;
  increment(): Result<void, IncrementCounterError>;
};

export const Counter = {
  create(initialValue: number): Result<Counter, CreateCounterError> {
    if (!Number.isSafeInteger(initialValue) || initialValue < 0) {
      return { ok: false, error: "invalid-initial-value" };
    }
    const state = { value: initialValue };
    const instance: Counter = {
      [counterBrand]: true,
      increment() {
        if (state.value === Number.MAX_SAFE_INTEGER) {
          return { ok: false, error: "limit-reached" };
        }
        state.value += 1;
        return { ok: true, value: undefined };
      },
    };
    return { ok: true, value: instance };
  },
};
```

ブランドは、形を合わせただけのオブジェクトの通常の代入を防ぎます。コンパニオンによる生成を通過したという実行時の証明ではないため、型アサーションやコピーなどの迂回も検査します。状態隠蔽とは区別してください。TypeScriptの `private` 修飾子は型検査時の制限ですが、`#` フィールドは実行時にも非公開です。[クラスの可視性](https://www.typescriptlang.org/docs/handbook/2/classes.html#caveats)、[構造的な型の互換性](https://www.typescriptlang.org/docs/handbook/type-compatibility)、[unique symbol](https://www.typescriptlang.org/docs/handbook/symbols#unique-symbol)を参照してください。

## 5. 両言語で不変条件と状態の所有を守る

readonlyを含め、ドメインの状態は非公開にします。Domain PrimitiveとValue Objectは不変とし、生成時に検証します。完全な生成経路を使い、空の状態を作ってからフィールドを埋める初期化や、検証を迂回する復元を禁止します。状態変更を宣言済みの業務操作または明示的なイベント適用に限定する規約と、domain/use-caseからのgetter呼び出し制限も維持します。ただし、ユースケース層で取得した値を業務判断に使わずリポジトリの引数へ受け渡す場合は、getterを利用できます。

ドメインの外部と可変な配列・オブジェクトの参照を共有しません。入力と出力で必要なコピーや不変化を行い、状態の所有を切り分けます。privateなフィールドやクロージャでも、外部に同じ可変参照が残れば状態を変更できます。Rustの所有権・明示的な共有と、TypeScriptの参照に対して、同じ契約を言語固有の方法で検査します。業務エラー時は操作前の状態を維持します。

## 6. エラー契約をメソッドごとに閉じる

想定される業務上の失敗は `Result<成功値, メソッド固有のエラー型>` で返します。DomainErrorはモデル上の総称です。コードでは、そのメソッドのエラーだけを表す閉じた型を使います。例えばissueは `Result<..., IssueInvoiceError>`、cancelは `Result<..., CancelInvoiceError>` を返します。

正規モデルに、エラーの所属する操作と業務上の失敗条件を定義します。`create` などの生成メソッドも対象です。実装写像で言語固有のメソッド・エラー型へ対応付け、センサーで所属・宣言された集合・戻り値のエラー型を照合します。不足、余分なケース、他の操作のエラー混入を検査します。実際のエラー経路の正しさはレビューと振る舞いテストで確認します。型の集合の一致だけで、経路の正しさを証明したことにはしません。

予期しない実行時障害は、想定される業務拒否と区別します。破損履歴や未知スキーマからの復元、リポジトリの競合、通信障害、コミット結果不明については、既存の区別と処理方針を維持します。今回の合意で、すべての例外やpanicを一律禁止するわけではありません。

TypeScriptのResult実装は言語拡張用のinfrastructureに置きます。特定ライブラリは選定せず、neverthrow・Effect・fp-tsとの個別統合は今回のスコープ外です。成功値の具体型、重複成功の表現、複数イベントの戻り値は、既存のT-03で引き続き決めます。

## 7. モジュール配置を選択し、統一する

| 契約 | Rust: T-08で実装済み | TypeScript: 合意した目標 |
|---|---|---|
| 名前付きファイル方式の親 | `invoice.rs` | `invoice.ts` |
| ディレクトリ方式の親 | `invoice/mod.rs` | `invoice/index.ts` |
| 両方式の末端 | `invoice/line.rs` | `invoice/line.ts` |
| 選択単位 | プロジェクト全体 | プロジェクト全体 |
| 混在・設定漏れ | blocking所見 | blocking所見 |
| 公開ルート | Cargoターゲットとcrateの可視性 | パッケージの入口と公開シンボル |

ディレクトリ方式では、子を持つモジュールを入口ファイルに置き、末端は名前付きファイルにします。生成指示とセンサーで選択を一貫して適用します。ファイル配置とAPI公開は別に検査します。index.ts方式を選んでも、任意の内部ファイルへのimportを許可することにはなりません。コード表現・集約の実行モデル・永続化・ファイル配置は別の選択軸です。

現在提供しているRust設定は、`.ddd.toml` の `schema_version = 1` と `[rust] module_layout = "file" | "mod-rs"` です。共通設定の最終スキーマとTypeScriptのキー名は、実装設計で定義します。今回の合意によって、現在のインストーラでTypeScript設定が使えるようになったわけではありません。[現行Rust契約](../users/rust-module-layout.ja.md)も参照してください。

## 8. 検査不能を承認の停止条件にする

必須の検査対象について参照先や型を解決できなければ、承認を止めます。推測した違反や合格として扱わず、解析できず確認不能であることを別の診断で示します。検査範囲と未対応構文も明示します。この契約を両言語へ適用します。現在のRust実装が返す助言的なnoteだけでは、新しい契約を実装済みとはいえません。

通常承認とCIの検査を揃え、単独実行の経路には直接実行の手順を用意します。標準AI-DLC 2.8.2の単独完了ガードの不足は、引き続きT-01で管理します。この合意によって第三者のフレームワーク配布物を修正したり、その不足が解消済みになったりはしません。

### Rustの解析にはRust＋synを使う

Rustの構文解析基盤として、synを使うRust実行ファイルを採用します。Rust構文の走査と言語固有の参照解決はその実装内で行い、TypeScriptのラッパーでRustソースを解析しません。[試作](rust-syn-spike.ja.md)で確認したのは限定範囲の情報抽出とローカルでのネイティブ実行であり、本番センサーの置き換えは未完了です。

synの構文情報に、Cargoのパッケージ・ターゲット・設定の根拠と、スコープを踏まえた明示的な参照解決を組み合わせます。構文解析をコンパイラによる型解析と同一視しません。未対応の型推論、trait解決、マクロ展開、条件付きコンパイルが必要な必須情報は、未解決として承認を止めます。想定したリリース対象に、より深い意味解析が必要なら、その実装の互換性を別途検証します。

[共通検査契約の設計](inspection-contract-design.ja.md)に、共通情報、解決状態・完全性、操作のエラー比較、規則ごとの結果、Rust/TypeScriptの対応検証を定義します。業務IDと実装シンボルIDを分け、別名を解決してもアクセス経路を保持し、結果を解析したソース・設定のスナップショットへ結び付けます。本番のネイティブ配布と全規則の移行はT-10で行います。

### TypeScriptの解析にはCompiler APIを使う

TypeScriptの構文・型解析にはTypeScript Compiler APIを使います。T-09の小さな検証実装から採用し、T-11へ引き継ぎます。対象プロジェクトのコンパイラ設定からProgramを構築し、AST・シンボル・TypeCheckerを使って、別名、再公開、型だけの参照、メソッドの戻り値・エラー型を調べます。実際の参照先は、tsconfigのモジュール解決・プロジェクト参照と、パッケージのexportsを踏まえて特定します。構文の読取りや変換だけで、型に依存する検査を済ませたことにはしません。

Compiler APIのオブジェクトはTypeScript固有の実装内で扱い、共通検査契約には言語非依存の情報と所見を渡します。Rust側の抽出・解決も同じ契約に照らして改善します。必須情報が解決できない場合は承認を止めます。コンパイラの型情報だけで、業務上の不変条件や所有の効果まで証明するものではありません。

対応するコンパイラ・APIのバージョンと、対象プロジェクトとの互換範囲を記録・検証します。[公式APIガイド](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)は現在6.0以前を対象とし、7.1ではAPIが変わると記載しています。具体的なバージョンは実装設計で選び、APIの世代を区別して統合を検証します。

## 9. 成果物を共通の契約へ移行する

業務定義と安定IDは、引き続き正規ドメインモデルが所有します。実装場所、パッケージ・モジュール・型・メソッドの対応、言語固有の情報は実装写像で扱います。宣言と検査の意味を含めて共通化します。crateというフィールド名の変更だけでは足りません。

移行先は共通の成果物形式とし、既存Rust成果物には明示的な移行コマンドを提供します。一意に対応付けられる情報を変換し、生成メソッドのエラー定義など業務上の補完が必要な情報を示します。移行を通すために業務エラーを捏造しません。業務上の同一性・意味と、既存記録の言語を維持します。読込処理、検証、生成指示、テスト入力、文書を合わせて移行します。

スキーマのバージョン、フィールド名、写像の構文、移行コマンドの引数と検証の詳細は、実装設計で決めます。この合意に対応する移行コマンドは、まだ実装していません。

## 10. Rustの現状と共通仕様の差分を確認する

| 論点 | Rustの現状と根拠 | 共通仕様に向けた作業 |
|---|---|---|
| 規則と実行コンテキスト | [規則定義](../../tools/ddd/lib/rules/definitions.ts)と[コンテキスト型](../../tools/ddd/lib/rules/types.ts)にはCargo/Rustの構造が残る。 | 共通要件と、言語固有の抽出・解決・評価を分け、両言語で検証する。 |
| 実装写像 | [宣言](../../tools/ddd/lib/sensors/declaration.ts)と[パッケージ検証](../../tools/ddd/lib/packaging/declarations.ts)にcrate、`::`、ルートの`crate`表記が組み込まれている。 | 写像の意味を共通化して明示移行し、言語固有の場所の情報を保持する。 |
| メソッド固有のエラー | モデル上の宣言・参照を検査するが、[ドメインセンサー](../../tools/ddd-sensor-rust-domain.ts)はResultのエラー型・variant集合とメソッドのエラーを照合しない。 | RustとTypeScriptに、メソッド固有のエラー型・集合の検査を追加する。 |
| エラー所属の整合 | [ローダー](../../tools/ddd/lib/schema/loader.ts)は参照の存在とID上の所属を検査するが、コード読解では `DomainError.command` と包含元コマンドの直接の一致検査が見当たらない。 | 再現ケースを追加して所属検査を補う。発見した実装上の不足として扱い、検証済みの保証とはしない。 |
| 生成時のエラー | [FactoryRule](../../tools/ddd/lib/schema/model.ts)に対象と前提条件はあるが、エラー集合とメソッド写像がない。 | 正規モデルの生成エラーと、コードへの写像・検査を追加する。 |
| 生成と不変条件 | 既存検査は生成の形や宣言された操作を判定する。 | 既存検査を維持し、振る舞いテストを加える。形の認識だけで意味的な正しさを証明しない。 |
| 公開範囲・ホスト・検査不能 | 既存のレイヤー検査とT-08が土台になる。ホスト分離、公開境界、一括再公開、必須の検査不能診断をすべて強制している状態ではない。 | Rustも改善する。infrastructureとホストの検査範囲を点検する。 |
| モジュール配置 | T-08でRustの両形式とblocking検査を実装済み。 | 既存動作を維持し、TypeScriptの対応する規約を追加する。 |

## 11. センサーの判定と実際の動作を両方検証する

共通シナリオを先に定義し、各言語・対応する表現方式で実装します。既存のセンサー、配布物、導入、承認経路の検証も維持します。実アプリの振る舞いテストには、正常な状態変更、業務エラー時の状態保持、不正値の生成拒否、永続化後の復元を含めます。

受入表はRustの2配置と、TypeScriptの2配置×2コード表現を対象にします。逆方向依存、command/query境界、型だけの依存、非公開パスやエイリアスによるアクセス、一括再公開、エラー型の不一致、検査不能、可変参照の漏出も検証します。各シナリオがどの集約実行モデルと永続化方式を検証するか記録します。選択軸の独立性を維持し、未検証の組み合わせを成功扱いにしません。

TypeScriptの初回統合では、サーバー側のNode.js runtime上で実際のESM Next.jsアプリを検証します。ソースの単独検査だけで、統合を保証したことにはしません。意味的なレビューも併用します。有限のテストで、業務の不変条件すべてを証明するものではありません。

## 12. Rustの改善を先にリリースし、TypeScriptを続ける

| 段階 | 成果と受入条件 |
|---|---|
| 共通設計と成立性の確認 | 共通契約、Rust/TypeScriptの比較ケース、共通部分の境界を実際に試す小さなTypeScript実装。 |
| 最初のリリース | 共通アーキテクチャ・成果物形式、Rustの不足修正、明示的な移行機能、整合したナレッジ・ステージ・センサー、Rustの動作検証。T-01/T-03/T-05/T-06の残件も引き継ぎ、実際の状態を報告する。 |
| 次のリリース | TypeScriptの抽出・センサー、両コード表現と配置、合意したエラー・所有の契約、Next.js/Node.jsの統合検証。 |

共通要件は、TypeScriptだけの改善では完了にしません。各変更についてRustへの影響を確認し、仕様・ナレッジ・ステージ指示・センサー・テストを揃えます。順序は[作業計画](completion-tasks.ja.md)で管理します。本書は合意の記録であり、完了は実装と実行の証跡で確認します。
