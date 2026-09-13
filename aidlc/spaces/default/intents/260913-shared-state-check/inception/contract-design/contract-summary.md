# 状態公開の共通検査 — 接続契約

## Sources

- [unit-of-work.md](../units-generation/unit-of-work.md): U1・U2の責務、種別、ソース所有。
- [unit-of-work-dependency.md](../units-generation/unit-of-work-dependency.md): U2からU1への依存と共通要求・証跡・結果の接続点。
- [components.md](../domain-design/components.md)、[decisions.md](../domain-design/decisions.md): 情報の所有と、抽出・検証・判定の分離。
- [requirements.md](../requirements-analysis/requirements.md): FR1〜FR6、NFR1〜NFR3。
- [stories.md](../user-stories/stories.md): US1.1〜US1.4と23受入条件。
- [contract-design-questions.md](contract-design-questions.md): Q1のAと、生成前の確認。

対象は[Issue #38](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/38)の固定入力・指定型に対する状態公開の一規則である。本書は実装前の仕様であり、解析器の実装・結合試験・本番切替が完了したことを示さない。

## Contracts

| # | Provider Unit | Consumer | Mechanism | Owner |
|---|---|---|---|---|
| C1 | U1: u1-state-exposure-inspection | U2: u2-language-state-verification | 同一プロセスの関数呼出しと、版付きJSON互換の共通値 | U1 |
| C2 | U2: u2-language-state-verification | External: 開発者・既存の自動検証 | 固定ケースを実行する開発用CLI、JSON報告、終了コード | U2 |

C1の関数は副作用を持たず、解析器・ファイル・プロセスを呼ばない。U2内のRust＋synとの通信はU2が所有する内部境界であり、ネイティブの応答をC1の共通値と同一視しない。TypeScript Compiler APIのオブジェクトもC1へ渡さない。C2は開発用の検証入口であり、HTTP API、独立サービス、配布方式を追加する契約ではない。

## C1 Shared Schema and API

以下のTypeScriptは共通値と関数の形式仕様である。型宣言だけを検証の代わりにせず、後述の不変条件もU1が実行時に検証する。すべての値はJSONへ変換・復元できるデータとし、関数、クラスインスタンス、undefined、BigInt、非有限数、循環参照を含めない。各宣言の実装配置はU1の所有範囲内で機能設計が決める。

```typescript
export type JsonValue =
  | null | boolean | number | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
export type SchemaVersion = "state-exposure/1";
export type Language = "rust" | "typescript";
export type Digest = string;
export type RequestIdentity = string;

export interface Target {
  readonly file: string;
  readonly declarationPath: readonly string[];
  readonly representation: "rust-struct" | "ts-class" | "ts-companion";
}
export interface SourceInput {
  readonly path: string;
  readonly content: string;
}
export interface ToolVersion {
  readonly name: string;
  readonly version: string;
}
export interface InspectionInput {
  readonly language: Language;
  readonly target: Target;
  readonly sources: readonly SourceInput[];
  readonly settings: { readonly [key: string]: JsonValue };
  readonly toolchain: readonly ToolVersion[];
}
export interface SourceSnapshot {
  readonly path: string;
  readonly sha256: Digest;
  readonly byteLength: number;
  readonly lineStarts: readonly number[];
}
export interface InspectionRequest {
  readonly schemaVersion: SchemaVersion;
  readonly ruleId: "state-exposure";
  readonly requestIdentity: RequestIdentity;
  readonly language: Language;
  readonly target: Target;
  readonly sources: readonly SourceSnapshot[];
  readonly settings: { readonly [key: string]: JsonValue };
  readonly toolchain: readonly ToolVersion[];
}
export interface Location {
  readonly file: string;
  readonly line: number;
  readonly byteStart: number;
  readonly byteEnd: number;
}
export type ReasonCode =
  | "invalid-request" | "unknown-version" | "invalid-response"
  | "identity-mismatch" | "target-missing" | "target-ambiguous"
  | "syntax-error" | "unsupported-syntax" | "incomplete-evidence"
  | "tool-unavailable" | "execution-failed" | "timeout"
  | "output-limit" | "resource-limit";
export interface Issue {
  readonly code: ReasonCode;
  readonly message: string;
  readonly subject: string;
  readonly location: Location | null;
}
export type Fact<T> =
  | { readonly status: "resolved"; readonly value: T;
      readonly evidence: readonly Location[] }
  | { readonly status: "absent"; readonly evidence: readonly Location[] }
  | { readonly status: "unresolved"; readonly reasons: readonly Issue[] };
export interface MemberEvidence {
  readonly memberId: string;
  readonly stateExposure: Fact<boolean>;
}
export type StateEvidence =
  | { readonly targetStatus: "resolved";
      readonly targetEvidence: readonly Location[];
      readonly members: {
        readonly completeness: "complete" | "partial";
        readonly items: readonly MemberEvidence[];
        readonly reasons: readonly Issue[];
      } }
  | { readonly targetStatus: "unresolved";
      readonly reasons: readonly Issue[] };
export interface EvidenceResponse {
  readonly schemaVersion: SchemaVersion;
  readonly requestIdentity: RequestIdentity;
  readonly evidence: StateEvidence;
}
export type ExtractionExecution =
  // responseキーは必須。応答なしはnullで表し、キー欠落とは区別する。
  | { readonly status: "completed"; readonly response: unknown }
  | { readonly status: "unavailable"; readonly reasons: readonly Issue[] }
  | { readonly status: "failed"; readonly reasons: readonly Issue[] };
export interface Finding {
  readonly code: "state-exposed";
  readonly memberId: string;
  readonly evidence: readonly Location[];
}
export interface InspectionResult {
  readonly schemaVersion: SchemaVersion;
  readonly requestIdentity: RequestIdentity;
  readonly target: Target;
  readonly executionState: "completed" | "unavailable" | "failed";
  readonly ruleResult: "pass" | "violation" | "unresolved";
  readonly checkedEvidence: StateEvidence | null;
  readonly findings: readonly Finding[];
  readonly unresolvedReasons: readonly Issue[];
}
export type RequestPreparation =
  | { readonly kind: "prepared"; readonly request: InspectionRequest }
  | { readonly kind: "input-rejected"; readonly issues: readonly Issue[] };
export type InspectionOutcome =
  | { readonly kind: "evaluated"; readonly result: InspectionResult }
  | { readonly kind: "input-rejected"; readonly issues: readonly Issue[] };

export declare function prepareInspectionRequest(
  input: unknown
): RequestPreparation;
export declare function inspectStateExposure(
  request: unknown,
  execution: unknown
): InspectionOutcome;
```

### 呼出しと検証の境界

1. U2は明示されたソースの内容・有効な解析設定・実際に使う解析器版からInspectionInputを組み立て、prepareInspectionRequestへ渡す。ファイルの読取りと設定の解釈はU2、入力の検証と識別の組立てはU1が所有する。
2. U2は、その要求を準備した時と同じソース文字列・設定・解析器版で抽出する。抽出の途中でファイルを読み直して別内容へ差し替えない。準備済み要求は抽出の正しさの証明ではない。
3. U2は実行の結果をExtractionExecutionへ変換する。completedではresponseキーを必ず持たせ、応答を取得できなかった場合はnullを渡す。responseの内容は未知の値として受け渡し、U1がEvidenceResponseへ検証する。未知のネイティブ応答を単なる型アサーションで共通応答へ変えない。
4. U1は要求と実行状態の外枠を検証する。この呼出し自体が不正ならinput-rejectedとし、issuesを一件以上返す。対象や実行状態を推測してInspectionResultを作らない。
5. 有効な要求と実行状態の外枠に対して、responseがnull（応答なし）・不正・未知版・識別不一致なら、元の要求に結び付くevaluated / unresolvedを返す。responseキーそのものの欠落は手順4の外枠不正であり、この手順には入らない。completedという観測済みの実行状態を、応答不正だけを理由にfailedへ書き換えない。
6. 形式と不変条件を満たす証跡だけを規則判定へ渡す。検証と規則判定は内部の関数・試験を分ける。U1は渡されたオブジェクトを変更せず、結果を入力の可変配列と共有しない。

input-rejectedは規則への違反ではなく、C1の呼出し契約を成立させられないエラーである。正常なC2のソース検査経路ではこれも検証失敗になる。不正入力を意図的に渡すU1の契約試験は、input-rejectedと理由の一致を検証する。

有効な要求を渡した場合の外枠と応答内容の分類を、次のとおり固定する。外枠の検証を先に行い、responseの内容を検証する前に不足キーを補完しない。

| executionの例 | 呼出し結果 | 理由と保持内容 |
|---|---|---|
| `{"status":"completed"}` | input-rejected | invalid-request、subjectはexecution.response。規則結果や実行状態を作らない |
| `{"status":"completed","response":null}` | evaluated / completed / unresolved | invalid-response、subjectはresponse。応答なしの理由と元の対象を保持し、checkedEvidenceはnull |
| `{"status":"completed","response":42}`や、必須キーがないJSONオブジェクト | evaluated / completed / unresolved | invalid-response、subjectはresponse。未知の非null値を正常な証跡へ補完せず、checkedEvidenceはnull |
| 構造を満たすがschemaVersionが未知のresponse | evaluated / completed / unresolved | unknown-version。checkedEvidenceはnull |
| 構造を満たすがrequestIdentityが異なるresponse | evaluated / completed / unresolved | identity-mismatch。checkedEvidenceはnull |

responseにundefinedを持たせる、関数・循環参照などJSON互換でない値を渡す場合は、外枠のデータ制約を満たさずinput-rejected / invalid-requestとする。上表の「未知の非null値」はJSON互換の値を指す。U2はundefinedの省略をJSON化で隠さず、応答なしをnullへ明示的に対応付ける。

### 版・形状・未知フィールド

- 初版はstate-exposure/1だけを受け付ける。数値1、別名、未知版への暗黙の変換は行わない。
- 必須フィールドとタグごとの形状を検証する。null、空配列、空文字を相互に補完しない。識別子・版・reasonのmessageとsubjectは空にしない。
- タグと矛盾する既知フィールドは拒否する。例えばFactのabsentにvalueを持たせる、unavailableにresponseを持たせる、targetStatusがunresolvedなのにmembersを持たせる応答は不正である。
- 未知の補足フィールドは無視して既知フィールドを取り出す。未知フィールドによって既存の判定が変わる拡張は互換追加ではない。タグ・理由コードの未知値は補足フィールドと違い、受け付けない。
- JSON内のnumberは安全な整数に限定する。設定も含め、丸めが必要な値・非有限数・不正なUnicode文字列を拒否する。言語固有の設定を共通検査が解釈するのではなく、その確定済みの値を識別に含める。

### 要求識別と正規化

DigestとRequestIdentityはsha256:に続く64桁の小文字16進数とする。prepareInspectionRequestは次を行う。

- sourcesは一件以上、pathは重複なし。相対POSIXパスを使い、空要素、先頭の/、末尾の/、バックスラッシュ、`.`・`..`の要素、NULを拒否する。大文字小文字やUnicodeの正規化で別名を同一化せず、ファイルシステム上の探索・symlink解決は行わない。
- target.fileはsourcesの一件と一致する。declarationPathは一個以上の空でない名前を持つ。指定の名前空間内で候補が欠落・曖昧ならU2が未解決として返し、最初の候補を選ばない。
- representationはrustならrust-struct、typescriptならts-classまたはts-companionとする。rust-structは名前付き・タプル構造体の両方を含む。対応する正確なソース形状は機能設計と固定ケースで定める。
- 各ソースの本文を改行・BOM・Unicode正規化せずUTF-8へ符号化してハッシュ化する。sourcesはpathのUnicodeスカラー値順で整列する。byteLengthとlineStartsも同じ本文から計算する。
- lineStartsは0で始まる行開始バイト位置の配列で、厳密な昇順とする。CRLFは一改行、単独CR、LF、U+2028、U+2029も各一改行として数える。末尾が改行ならbyteLengthも最後の行開始位置になる。
- toolchainは一件以上、nameは重複なしでname順に整列する。U2は実際に使った抽出器自身と、その解析ライブラリの版を含める。Rust試作・syn、TypeScript抽出器・Compiler APIについて、版の取得と使用環境の一致をU2で試験する。
- requestIdentityは、それ自身を除くInspectionRequestの既知フィールドを正規化JSONへ変換し、そのUTF-8のSHA-256とする。settingsのすべてのキーと値も対象であり、未知の設定キーを削って識別を同じにしない。
- 正規化JSONはオブジェクトのキーをUnicodeスカラー値順に再帰的に並べ、配列順を保持し、空白を入れない。整数は10進表記、負のゼロは0、文字列は引用符・バックスラッシュ・制御文字をJSONとしてエスケープする。制御文字は短縮形があるものを短縮形とし、その他は小文字の`\u00xx`、その他のUnicode文字はUTF-8のまま、スラッシュはエスケープしない。
- inspectStateExposureは要求の構造・整列・重複・範囲を検証し、同じ規約で識別を再計算する。response.requestIdentityとの完全一致を求める。これは対応確認であり、解析器の出自を認証する署名や、抽出の正確さを証明するハッシュではない。

再現性試験では同じ意味のsettingsのキー順だけを変えても同じ識別になること、本文・対象・設定値・解析器版が変われば異なることを確認する。U2の実行記録のrunIdや時刻は要求識別へ入れない。

### 証跡の意味と位置

- targetStatusがresolvedなら、targetEvidenceを一件以上持つ。対象型の存在を確認できない場合はunresolvedとし、target-missingまたはtarget-ambiguous等の理由を一件以上返す。別型の証跡を代用しない。
- memberIdは、同じ要求内のメンバーを一意に指す空でない識別子とする。名前付き・タプルの位置も区別し、抽出の走査順だけで不安定に変えない。重複したmemberIdは不正応答として拒否する。
- stateExposureのresolved / trueは、保持する状態の直接公開が確認済みであることを表す。readonlyも公開に含む。resolved / falseは、状態を持つが直接公開しないことが確認済みであることを表す。
- absentは、そのメンバーが規則対象の保持状態ではないと確認できた場合に限る。例えば、対応形状で操作メソッドまたはブランドの印と確認できた要素である。名前だけによる判別や、未知の状態をabsentへ置換することは禁止する。
- resolvedとabsentには、それを支えるLocationを一件以上要求する。unresolvedには理由を一件以上要求し、候補をvalueとして併記しない。
- completeは、その対象型の規則に必要なメンバー一覧を列挙し終えたことを表す。itemsが空でもtargetEvidenceを持ち、U2は一覧を完全とできる対応形状を証明する。completeでもメンバーのFactがunresolvedなら全体結果はunresolvedである。
- partialは未列挙の可能性を表し、members.reasonsを一件以上持つ。completeではmembers.reasonsを空とし、列挙済みメンバー固有の未解決はそのFactに残す。一覧の不完全さと、一要素の意味の未解決を混同しない。
- Location.fileは要求のsourcesに存在し、lineは1始まり、byteStart・byteEndは安全な整数で `0 <= byteStart < byteEnd <= byteLength` を満たす。lineはbyteStartが属するlineStartsの区間と一致する。対象とメンバーの証拠はtarget.file内に限る。
- U2は位置を同じソースのUTF-8バイト境界へ変換し、Unicodeと改行形式で検証する。U1は記録された範囲・行との整合を確認するが、ハッシュだけから文字境界や構文の正しさを再証明しない。これらはU2の抽出試験で確認する。
- Issue.locationは確定できる場合だけ設定し、それ以外はnullとする。その場合もsubjectに対象ファイル・宣言・入力フィールド等を示し、messageで不足理由を説明する。確定違反のFinding.evidenceは空やnullにしない。

### 結果と失敗の規約

| 入力の状況 | executionState | ruleResult | checkedEvidence | findings / unresolvedReasons |
|---|---|---|---|---|
| 完全な一覧、すべてのFactが確定、公開なし | completed | pass | 検証済みの対象証跡、completeな一覧、各Factと根拠を保持 | ともに空 |
| 完全な一覧、すべてのFactが確定、公開あり | completed | violation | 検証済みの証跡全体を保持 | 公開の所見あり、未解決理由なし |
| 対象未解決、partial、または一つでもFactが未解決 | completed | unresolved | 正しい形状で検証済みの証跡を保持 | 独立に確定した公開の所見と、未解決理由を保持 |
| responseがnull・不正・未知版・識別不一致 | completed | unresolved | null | 所見は空、応答の拒否理由あり |
| 解析器を起動できない | unavailable | unresolved | null | 所見は空、tool-unavailable等の理由あり |
| 実行失敗・期限切れ・出力制限超過 | failed | unresolved | null | 所見は空、対応する理由あり |

すべてのInspectionResultは、検証済みの要求からtargetを複製して返す。checkedEvidenceは、同じ要求への対応・形式・不変条件をU1が検証したStateEvidenceの既知フィールドだけを複製・整列した値とする。応答の生データ、未検証の付加情報、解析器固有型は含めない。

正常時もcheckedEvidenceを省略しない。targetEvidence、members.completeness、非公開を示すresolved / falseや保持状態の不在を示すabsent、および各根拠位置を結果へ残す。空の所見一覧やrequestIdentityだけを、公開違反がない根拠の代わりにしない。正しい形状のtargetStatusがunresolvedの証跡を保持することと、未検証の応答を採用することは別である。

応答の外枠や型・不変条件が不正な場合、応答全体を判定根拠に採用しない。一部分だけを推測で救出しない。正しい形状の応答が、確認済みの公開メンバーとunresolvedのFactまたはpartialの一覧を含む場合は、それぞれを検証したうえで確定違反を保持する。この二つを区別する。

初版はストリーミングや複数応答の結合を提供しない。クラッシュ・途中出力を部分証跡として採用しない。失敗前に独立して成立した別要求の結果は、その要求の結果として保持できるが、今回の要求へ混ぜない。

Findingはresolved / trueのメンバーからのみ生成する。所見はmemberId順、各evidenceはfile・byteStart・byteEnd順、理由はcode・subject・locationのfile・byteStart・byteEnd・message順で決定的に整列する。checkedEvidenceのmembers.itemsもmemberId順、その中のevidence・reasonsとtargetEvidenceも同じ位置・理由の順で整列する。文字列比較はUnicodeスカラー値順、nullの位置は非nullより前とする。入力配列の走査順を結果の意味にしない。整列は根拠の削除や重複排除を意味しない。

ruleResultがunresolvedの場合、unresolvedReasonsには必ず一件以上の理由がある。passとviolationでは未解決理由を空とする。今回の指定型に対する契約はnot-applicableを持たず、適用外を使う将来の契約では別途、適用外の証明条件と版を定める。

U1は通常の契約違反を例外として投げず、上記の値で返す。想定外の実装例外をU2が捕捉した場合はC2の検証実行の失敗とし、U1が返していないInspectionResultを捏造しない。

## C2 Verification Command

U2は `bun run verify:state-exposure` を既存ddd/package.jsonへ登録し、固定ケースを選ぶ開発用入口とする。以下のYAMLは、このCLIの引数・成否・出力の仕様である。実装済みのコマンド一覧ではない。

```yaml
contract: state-exposure-verification/1
owner: U2
working_directory: ddd
command: [bun, run, "verify:state-exposure"]
options:
  --case:
    value: "all または同梱する一つのcaseId"
    default: all
  --timeout-ms:
    value: "解析器の一実行あたりの正の安全な整数"
    default: 30000
  --max-output-bytes:
    value: "解析器の一応答あたりの正の安全な整数"
    default: 1048576
unknown_or_duplicate_options: reject
stdout: "UTF-8のJSON報告一個と改行。ログを混在させない"
stderr: "準備・実行の診断。ソース本文を無条件に複製しない"
exit_codes:
  0: "選択した全ケースの期待値が一致し、必要な実経路も実行済み"
  1: "実行できたが、規則結果・理由・所見・根拠等が期待と不一致"
  2: "引数不正、未知caseId、固定ケース定義の不正"
  3: "必要ツール不足、準備失敗、想定外の実行失敗で検証を完了できない"
retry: none
fallback_to_legacy_sensor: false
```

既存syn試作の準備手順をU2の実行案内に記載する。必要な実行ファイルや依存が用意できていなければ終了コード3とし、コマンド内で依存ダウンロードや無制限のビルドを暗黙に行わない。明示的な準備コマンドは今回の機能設計で具体化する。

期限と出力上限は保護用の初期値であり、性能SLAではない。U2は実際に終了させられるプロセスまたはワーカーの境界で期限を管理し、Promiseの待機だけを打ち切って処理が動き続ける実装にしない。TypeScript側も同じ保護を成立させる。期限内の完了を保証する仕様ではなく、超過を検証成功にしない仕様である。

実行報告の形式を次に定める。C1のInspectionOutcome等は上記宣言を参照する。

```typescript
export interface VerificationReport {
  readonly schemaVersion: "state-exposure-verification/1";
  readonly runId: string;
  readonly command: readonly string[];
  readonly toolchain: readonly ToolVersion[];
  readonly environment: {
    readonly os: string;
    readonly architecture: string;
    readonly runtimeVersion: string;
  };
  readonly cases: readonly VerificationCaseResult[];
  readonly errors: readonly Issue[];
  readonly status: "passed" | "mismatch" | "usage-error" | "execution-error";
}
export interface VerificationCaseResult {
  readonly caseId: string;
  readonly status: "passed" | "mismatch" | "not-run";
  readonly expected: InspectionOutcome;
  readonly actual: InspectionOutcome | null;
  readonly differences: readonly string[];
}
```

- 固定ケースはcaseId、入力、期待するC1の結果と根拠、実際に呼ぶ抽出経路を持つ。定義不正は解析器を呼ぶ前に拒否する。ケース集合のIDと内容はU2が版管理し、未知のcaseIdで空実行を成功にしない。
- expectedの入力識別は固定入力から同じ規約で算出できるが、実際の判定結果をコピーして期待値にしない。actualとexpectedの意味上の全フィールドを比較する。無関係な順序の違いを理由に弱い部分一致へ変えず、C1の整列後の値で一致を確認する。
- 比較・JSON報告には、正常時もtargetとcheckedEvidenceを含める。同じrequestIdentity・pass・空の所見一覧であっても、対象証跡、完全性、非公開・不在の根拠位置が異なればmismatchとする。C2はcheckedEvidenceを表示用に削ってから比較・報告しない。
- 全体statusと終了コードは対応する。usage-errorは2、execution-errorは3、mismatchは1、passedは0とする。複数の失敗がある場合は使用法の不正を実行前に処理し、実行後はexecution-errorをmismatchより優先する。
- 正常な実行ではcasesをcaseId順に報告する。not-runはactual=null、differencesに未実行理由を残す。全体がpassedならcasesは空ではなく、すべてpassedでdifferencesは空、errorsも空である。
- 意図した異常ケースでは、期待したfailed・unavailable・unresolvedやinput-rejectedとの一致を試験成功とできる。ただし、実際に必要な抽出器がないためにケース全体が走らなかった場合はnot-run / execution-errorであり、期待した異常の検出と混同しない。
- 両言語の実経路を通す固定ケースと、共通情報だけの契約試験を区別して同梱する。共通情報だけの成功を、RustやTypeScriptの抽出成功として報告しない。
- runId・環境・コマンドは実行記録であり、C1の判定の再現性比較とは分ける。toolchainには実際に使えた版だけを記録し、準備不能時に架空の版を記載しない。

## Contract Ownership and Evolution

- C1の仕様・共通型・入力検証・規則結果の意味・正規化・例の所有者はU1。U2は同じ契約を消費し、言語ごとに判定や版を再定義しない。
- C2の固定ケース・検証入口・報告・終了コード・解析器の保護と準備条件はU2が所有する。U2のネイティブ宣言がC1に対応する場合も、意味の一致を契約試験で確認する。
- 既知の意味を変えない診断用フィールドの追加は、利用側が無視できる範囲だけ同一版で許可する。必須項目、状態タグ、理由コード、正規化規約、判定の意味、CLIの成否の意味を変える場合は該当契約の版を変え、提供側と利用側の合意を必要とする。
- 破壊的変更では古い版を自動変換して通さない。対応する版の組合せと移行手順を別の変更として決める。本番センサー・利用者成果物の移行は今回のC1・C2の実装条件にしない。

## Contract Examples

以下はC1の検証済み応答から導かれる例であり、完全なJSON入力ではない。識別とLocation等は、同じ要求に対応する妥当な値を持つ前提である。

| 証跡の例 | 規則結果 | 保持内容 |
|---|---|---|
| complete、privateな保持状態がresolved / false、操作メソッドが根拠付きabsent | pass | targetとcheckedEvidenceに対象証跡・完全性・各Factと位置を保持。公開の所見なし、未解決理由なし |
| complete、公開フィールドがresolved / true | violation | state-exposedと当該メンバーの位置 |
| partial、公開フィールドがresolved / true、一覧にincomplete-evidence | unresolved | 確定したstate-exposedと未確認範囲の理由 |
| complete、あるメンバーのFactがunsupported-syntaxでunresolved | unresolved | 該当メンバーの未解決理由と、別メンバーの確定違反があればその所見 |
| completedだがresponseの要求識別が別入力のもの | unresolved | identity-mismatch。応答内の所見候補は採用しない |
| unavailable、tool-unavailableの理由あり | unresolved | 実行状態unavailableと理由。通常の実経路検証ならC2は成功しない |

## Verification and Traceability

| 契約試験 | 要件・ストーリー | 担当と確認内容 |
|---|---|---|
| C1-01: 入力と識別 | FR1・FR4.2、AC1.3.1・AC1.3.4 | U1がキー順の同値と、本文・対象・設定・版変更の識別差を確認。U2が同じ実入力で抽出することを確認 |
| C1-02: 形状・版・欠落 | FR4.3、AC1.3.4 | U1が未知版、未知タグ、不正形状、欠落、重複、識別不一致を正常へ変換しないことを確認 |
| C1-02a: 外枠と応答なしの区別 | FR4.3・FR5.1、AC1.3.4・AC1.3.5 | U1がresponseキーなしをinput-rejected、response:nullとJSON互換の不正な非null値をcompleted / unresolvedとし、理由・checkedEvidence:nullまで確認。U2は応答なしをnullで渡す |
| C1-03: 完全性と混在 | FR4.1・FR5、AC1.3.2・AC1.3.3・AC1.3.6・AC1.3.7 | U1が四つの判定条件、部分的な空集合、Fact単位の未解決、不在の根拠を固定入力で確認 |
| C1-04: 実行状態 | FR5.1、AC1.1.5・AC1.3.5 | U2が実行状態を観測し、U1が規則結果と分ける。不正な呼出しのinput-rejectedと不正応答のunresolvedも区別 |
| C1-05: 位置と再現性 | FR5.2・NFR1、AC1.3.7・AC1.4.2 | U1が範囲・行・決定的整列、U2がUnicode・CRLF等の位置変換と実入力への対応を検証 |
| C1-05a: 正常時の証跡保持と比較 | FR5の正常行・NFR1、AC1.3.1・AC1.3.7・AC1.4.2 | U1が正常結果にも対象・完全性・非公開／不在の証跡を保持する。同じ要求の妥当な正常応答で根拠位置だけを変え、U2のexpected / actual比較がmismatchを検出する。報告のJSON往復でも証跡を保持する |
| C1-06: JSON往復と独立性 | NFR3、AC1.4.5 | 共通値のJSON変換・復元後も同じ判定。U1を解析器なしで試験し、共通型へ解析器固有型が漏れていないことを確認 |
| C2-01: 両言語の抽出と判定 | FR2・FR3・FR6.1、US1.1・US1.2・AC1.4.1 | U2が実際のRust二形式・TypeScript二形式で正常・違反・検査不能を実行し、U1と結合 |
| C2-02: コマンドの成否 | FR6.2、AC1.4.3 | U2が成功、不一致、未知caseId、不正引数、実ツール不足、期限・出力超過を区別。期待と異なる理由での失敗を拒否 |
| C2-03: 回帰と案内 | NFR2・FR6、AC1.4.4・AC1.4.6 | 既存Rust基準試験と影響するsyn試験を維持し、準備・版・対応範囲・実行成否を英日で記録 |

これは試験義務の対応表であり、現時点の合格実績ではない。実際の対応構文や証跡の正しさはU2の抽出・結合試験で確認し、共通スキーマの形状検査で代用しない。

## Open Questions

| Contract | Question | Blocks |
|---|---|---|
| — | 契約の意味や単位間の所有を左右する未決事項なし | なし |

機能設計へ渡す事項は、Rust条件付き構文とTypeScript二表現の厳密な対応形状、U1の内部関数分割、U2のワーカー・プロセス管理と明示的な準備コマンド、固定ケースの内容である。本書のAPI・形式・失敗規約を満たす形で具体化する。対応形状を証明できない入力はunresolvedとし、範囲を黙って広げない。
