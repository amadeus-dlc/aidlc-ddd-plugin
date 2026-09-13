# U1 共通検査 — 値モデル

## Sources

- [作業単位](../../../inception/units-generation/unit-of-work.md)、[ストーリー対応](../../../inception/units-generation/unit-of-work-story-map.md): U1の主担当とU2との協力範囲。
- [要件](../../../inception/requirements-analysis/requirements.md)、[ストーリー](../../../inception/user-stories/stories.md): US1.3の七受入条件と品質条件。
- [構成要素](../../../inception/domain-design/components.md): StateExposureInspectionの所有と独立性。
- [契約](../../../inception/contract-design/contract-summary.md): C1の値、公開入口、検証と失敗規約。
- [機能設計の確認](functional-design-questions.md): 今回の具体化についての確認記録。

## Model Catalogue

U1は独立した可変エンティティを持たない。以下は内容で扱う値のモデルであり、検査対象の業務集約を新たに定義したものではない。識別を持つ値も、保存・更新のライフサイクルを追加しない。

```yaml
unit: u1-state-exposure-inspection
owner: StateExposureInspection
entities: []
value_objects:
- name: InspectionInput
  description: 明示された入力内容と解析条件。外部から受け取る値。
  attributes:
  - name: language
    logical_type: 選択値
    required: true
    constraints: rustまたはtypescript
  - name: target
    logical_type: Target
    required: true
    constraints: 対象は一つ
  - name: sources
    logical_type: SourceInputの一覧
    required: true
    constraints: 一件以上、相対パスは一意
  - name: settings
    logical_type: JSON互換の辞書
    required: true
    constraints: 有効な解析設定をU2が確定する
  - name: toolchain
    logical_type: ToolVersionの一覧
    required: true
    constraints: 一件以上、nameは一意
  constraints:
  - ソース内容・設定・実際に使う解析器版をU2が揃える。U1はファイルを読まない。
- name: SourceInput
  description: 入力された一ファイルの内容。
  attributes:
  - name: path
    logical_type: 文字列
    required: true
    constraints: C1の相対POSIXパス規約に従う
  - name: content
    logical_type: Unicode文字列
    required: true
    constraints: 孤立サロゲートなし。改行・BOM・正規化形を変更しない
  constraints:
  - 内容をUTF-8で扱い、ファイルの再読取りをしない。
- name: Target
  description: 一つの指定型の識別。
  attributes:
  - name: file
    logical_type: 文字列
    required: true
    constraints: sourcesの一件と完全一致
  - name: declarationPath
    logical_type: 文字列一覧
    required: true
    constraints: 一個以上の空でない宣言名
  - name: representation
    logical_type: 選択値
    required: true
    constraints: rust-struct、ts-class、ts-companion。languageとの組合せを検証
  constraints:
  - 対象を推測・探索しない。欠落・曖昧の解析結果はU2から受け取る。
- name: ToolVersion
  description: 実行する抽出器と解析ライブラリの版。
  attributes:
  - name: name
    logical_type: 文字列
    required: true
    constraints: 空ではなく、同じ一覧内で一意
  - name: version
    logical_type: 文字列
    required: true
    constraints: 空ではない
  constraints:
  - U2が実際に使用する版との一致を保証する。U1が実行環境を探索しない。
- name: SourceSnapshot
  description: 同じ入力の識別と位置検証に使う派生値。
  attributes:
  - name: path
    logical_type: 文字列
    required: true
    constraints: 入力の相対パスを維持
  - name: sha256
    logical_type: ダイジェスト
    required: true
    constraints: sha256:と64桁の小文字16進数
  - name: byteLength
    logical_type: 安全な整数
    required: true
    constraints: 0以上
  - name: lineStarts
    logical_type: 安全な整数の一覧
    required: true
    constraints: 0で開始し厳密昇順。各値はbyteLength以下
  constraints:
  - UTF-8本文から導出する。CRLFは一改行、単独CR、LF、U+2028、U+2029も各一改行。
  - 末尾改行の後の空行を保持する。ハッシュだけでソース構文の正しさを証明しない。
- name: InspectionRequest
  description: 検査対象と入力条件を固定した要求値。
  attributes:
  - name: schemaVersion
    logical_type: 版
    required: true
    constraints: state-exposure/1
  - name: ruleId
    logical_type: 識別子
    required: true
    constraints: state-exposure
  - name: requestIdentity
    logical_type: ダイジェスト
    required: true
    constraints: それ自身以外の既知フィールドの正規化JSONのUTF-8 SHA-256
  - name: language
    logical_type: 選択値
    required: true
    constraints: rustまたはtypescript
  - name: target
    logical_type: Target
    required: true
    constraints: 一つ
  - name: sources
    logical_type: SourceSnapshotの一覧
    required: true
    constraints: 一件以上。path順、重複なし
  - name: settings
    logical_type: JSON互換の辞書
    required: true
    constraints: すべてのキーと値を識別へ含める
  - name: toolchain
    logical_type: ToolVersionの一覧
    required: true
    constraints: name順、重複なし
  constraints:
  - 独立した可変エンティティではない。内容を変えた要求は識別を再計算する。
  - 公開入口で構造・整列・相互参照・要求識別を再検証する。
- name: Location
  description: スナップショット上の確定した位置。
  attributes:
  - name: file
    logical_type: 文字列
    required: true
    constraints: 要求のsources内に存在
  - name: line
    logical_type: 安全な整数
    required: true
    constraints: 1以上。byteStartが属する行
  - name: byteStart
    logical_type: 安全な整数
    required: true
    constraints: 0以上
  - name: byteEnd
    logical_type: 安全な整数
    required: true
    constraints: byteStartより大きく、該当ソースのbyteLength以下
  constraints:
  - 対象・メンバーの根拠はtarget.file内に限定する。
  - Unicode文字境界や構文との一致はU2の責務。U1は範囲と行の整合を検証する。
- name: Issue
  description: 不足や契約違反の機械可読な理由。
  attributes:
  - name: code
    logical_type: 選択値
    required: true
    constraints: C1のReasonCodeの閉じた集合。未知値を拒否
  - name: message
    logical_type: 文字列
    required: true
    constraints: 空ではない
  - name: subject
    logical_type: 文字列
    required: true
    constraints: 空ではない。対象または入力フィールド等を指す
  - name: location
    logical_type: Locationまたはnull
    required: true
    constraints: 不明な位置を捏造しない。nullでもsubjectとmessageは必要
  constraints:
  - 理由の意味を言語ごとに再定義しない。
- name: Fact
  description: 一メンバーの保持状態の公開についての根拠付き情報。
  attributes:
  - name: status
    logical_type: 選択値
    required: true
    constraints: resolved、absent、unresolved
  - name: variant
    logical_type: タグに従う属性群
    required: true
    constraints: resolvedはvalueとevidence、absentはevidence、unresolvedはreasonsのみ
  constraints:
  - resolvedのvalueは真偽値。trueは直接公開、falseは非公開の保持状態。
  - resolvedとabsentのevidenceはLocationを一件以上。unresolvedのreasonsはIssueを一件以上。
  - absentは保持状態ではないことの確認済み根拠を要する。未知情報の代替にしない。
  - variantは説明上の属性群であり、C1のJSONにvariantキーを追加しない。
- name: MemberEvidence
  description: 同じ要求内で一意なメンバーと、そのFact。
  attributes:
  - name: memberId
    logical_type: 文字列
    required: true
    constraints: 空でなく、同じ一覧内で一意
  - name: stateExposure
    logical_type: Fact
    required: true
    constraints: 保持状態の直接公開についての情報
  constraints:
  - memberIdの構文上の導出はU2の責務。U1は重複を拒否する。
- name: StateEvidence
  description: 指定型についての検証対象となる証跡。
  attributes:
  - name: targetStatus
    logical_type: 選択値
    required: true
    constraints: resolvedまたはunresolved
  - name: variant
    logical_type: タグに従う属性群
    required: true
    constraints: resolvedはtargetEvidenceとmembers、unresolvedはreasonsのみ
  constraints:
  - targetEvidenceはLocationを一件以上。
  - membersはcompleteness、items、reasonsを持つ。itemsはMemberEvidence一覧。
  - completenessはcompleteまたはpartial。completeでは一覧のreasonsは空、partialでは一件以上。
  - completeでもFactがunresolvedなら規則結果はunresolved。
  - targetStatusがunresolvedならreasonsは一件以上。variantは説明用で追加キーではない。
- name: EvidenceResponse
  description: 要求への対応と版を持つ共通応答。
  attributes:
  - name: schemaVersion
    logical_type: 版
    required: true
    constraints: state-exposure/1
  - name: requestIdentity
    logical_type: ダイジェスト
    required: true
    constraints: 検証済み要求と完全一致
  - name: evidence
    logical_type: StateEvidence
    required: true
    constraints: 形式と不変条件を満たす
  constraints:
  - 未知版や対応不一致を含む応答から一部だけ所見を救出しない。
- name: ExtractionExecution
  description: U2が観測した実行状態の外枠。
  attributes:
  - name: status
    logical_type: 選択値
    required: true
    constraints: completed、unavailable、failed
  - name: variant
    logical_type: タグに従う属性群
    required: true
    constraints: completedはresponseキー必須。応答なしはnull。残る二つはreasonsを一件以上
  constraints:
  - キー欠落・非JSON値は外枠の不正。JSON互換のresponseの内容不正とは区別する。
  - unavailableやfailedにresponseを持たせない。variantは説明用で追加キーではない。
- name: Finding
  description: 確定した状態公開違反。
  attributes:
  - name: code
    logical_type: 識別子
    required: true
    constraints: state-exposed
  - name: memberId
    logical_type: 文字列
    required: true
    constraints: 検証済みのresolved/trueのメンバー
  - name: evidence
    logical_type: Locationの一覧
    required: true
    constraints: 一件以上、検証済みの根拠を保持
  constraints:
  - 候補や別入力の根拠から生成しない。
- name: InspectionResult
  description: 検証済み要求に結び付く判定結果。
  attributes:
  - name: schemaVersion
    logical_type: 版
    required: true
    constraints: state-exposure/1
  - name: requestIdentity
    logical_type: ダイジェスト
    required: true
    constraints: 検証済み要求の識別
  - name: target
    logical_type: Target
    required: true
    constraints: 検証済み要求から複製
  - name: executionState
    logical_type: 選択値
    required: true
    constraints: completed、unavailable、failed
  - name: ruleResult
    logical_type: 選択値
    required: true
    constraints: pass、violation、unresolved
  - name: checkedEvidence
    logical_type: StateEvidenceまたはnull
    required: true
    constraints: 正常時も証跡を必須保持。不正応答や実行不能・失敗ではnull
  - name: findings
    logical_type: Findingの一覧
    required: true
    constraints: 決定的に整列
  - name: unresolvedReasons
    logical_type: Issueの一覧
    required: true
    constraints: unresolvedなら一件以上、passとviolationなら空
  constraints:
  - 入力を変更せず、入力の可変配列や辞書を結果と共有しない。
  - passはcomplete・全Fact確定・公開なし。violationは同条件で公開あり。
  - 検証済みの未解決証跡はcheckedEvidenceに保持できる。未検証データとは違う。
- name: RequestPreparation / InspectionOutcome
  description: 公開入口の成否を表す値。
  attributes:
  - name: kind
    logical_type: 選択値
    required: true
    constraints: 準備はpreparedまたはinput-rejected。検査はevaluatedまたはinput-rejected
  - name: payload
    logical_type: タグに従う属性群
    required: true
    constraints: preparedはrequest、evaluatedはresult、input-rejectedはissuesを一件以上
  constraints:
  - payloadは説明用で追加キーではない。入力エラーに架空の要求・規則結果を付けない。
relationships:
- from: InspectionRequest
  to: SourceSnapshot
  kind: composition
  cardinality: 1..*
- from: InspectionRequest
  to: Target
  kind: composition
  cardinality: '1'
- from: EvidenceResponse
  to: StateEvidence
  kind: composition
  cardinality: '1'
- from: StateEvidence
  to: MemberEvidence
  kind: composition
  cardinality: 0..* (resolved branch)
- from: MemberEvidence
  to: Fact
  kind: composition
  cardinality: '1'
- from: InspectionResult
  to: StateEvidence
  kind: composition
  cardinality: 0..1
- from: InspectionResult
  to: Target
  kind: composition
  cardinality: '1'
```

## Model Summary

入力・要求とその派生スナップショット、証跡と根拠位置、実行状態、結果を分ける。すべての共通値の意味はU1が所有し、実ソースの抽出と実行観測はU2が所有する。判定結果から対象・正常の根拠・完全性を追跡できる形を維持する。

## Constraints and Defaults

必須値に暗黙の既定値を与えない。nullを認めるのは契約が明示した場所だけで、未指定の必須キーを空値へ補完しない。安全な整数・Unicode・タグ別属性・JSON互換性の検証は[規則](rules.md)に従う。既知フィールドと矛盾する属性は拒否し、意味を変えない未知の補足フィールドは取り込まずに無視する。
