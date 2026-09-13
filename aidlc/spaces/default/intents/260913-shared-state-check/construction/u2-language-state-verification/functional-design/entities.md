# U2 言語別抽出と検証実行 — モデル

## Sources

- [作業単位](../../../inception/units-generation/unit-of-work.md)、[対応表](../../../inception/units-generation/unit-of-work-story-map.md): U2の主担当と所有範囲。
- [要件](../../../inception/requirements-analysis/requirements.md)、[ストーリー](../../../inception/user-stories/stories.md): US1.1・US1.2・US1.4の16受入条件。
- [構成要素](../../../inception/domain-design/components.md)、[契約](../../../inception/contract-design/contract-summary.md): U1との接続とC2。
- [言語共通の設計](../../../../../../../../ddd/docs/developers/language-independent-design.ja.md): 合意済みのコンパニオン例。
- [確認記録](functional-design-questions.md): 対応形状と検証手順の確認。

## Model Catalogue

```yaml
unit: u2-language-state-verification
entities:
- name: VerificationCase
  description: 目的を追跡する固定ケース。
  identifier: caseId
  attributes:
  - name: caseId
    logical_type: 文字列
    required: true
    unique: true
    constraints: 空ではなく、ケース集合内で一意
  - name: label
    logical_type: 文字列
    required: true
  - name: request
    logical_type: C1の入力と、対応する実行シナリオ
    required: true
    constraints: ソース・設定・対象・期待する解析経路を固定する
  - name: expectedResult
    logical_type: C1のInspectionOutcome
    required: true
    constraints: 実際の判定結果を使って期待値を作らない
  constraints:
  - 実ソース経路と共通値だけの試験を分類する。後者を前者の成功に数えない。
  - 意図した異常の入力と、実行環境そのものの準備不足を分ける。
  relationships:
  - to: VerificationRun
    cardinality: 0..*
    direction: has executions
- name: VerificationRun
  description: 一つの固定ケースを一回実行した記録。
  identifier: runId
  attributes:
  - name: runId
    logical_type: 内部の複合識別
    required: true
    unique: true
    constraints: C2の報告全体のrunIdとcaseIdの組から一意に識別する。公開JSONへ項目を追加しない。
  - name: caseId
    logical_type: VerificationCaseへの参照
    required: true
  - name: actualResult
    logical_type: C1のInspectionOutcomeまたは未観測
    required: true
    constraints: 未実行では値を捏造しない
  - name: comparison
    logical_type: 比較状態
    required: true
    allowed_values:
    - pending
    - passed
    - mismatch
    - not-run
  - name: toolVersions
    logical_type: 実際に利用した版の一覧
    required: true
  - name: command
    logical_type: 引数の一覧
    required: true
  - name: environment
    logical_type: 実行環境の記録
    required: true
  constraints:
  - 個別ケースの識別と、C2の報告全体の識別を区別する。
  - 判定内容・根拠・比較結果と実行固有の付帯情報を分ける。
  - 同じケースの再実行は別記録とし、前回の結果で置き換えない。
  relationships:
  - to: VerificationCase
    cardinality: '1'
    direction: executes
value_objects:
- name: FrozenInput
  description: 一回の抽出に使う、読取り済みソース・有効設定・実際のツール版。
  constraints:
  - C1のInspectionInputをU1へ渡して要求を準備する。
  - U1へ渡したのと同じ値を解析器へ渡す。解析中に再読取りしない。
- name: ExtractionTask
  description: 言語、対象、要求識別、固定入力、期限、出力上限。
  constraints:
  - C2の保護値を使う。
  - 結果は一要求だけに対応させる。
- name: RustNativeRequest
  description: 既存試作の内部プロトコルとは別の、指定型検査用の版付き要求。
  attributes:
  - protocol_version
  - request_identity
  - files
  - target
  - settings
  constraints:
  - 指定型経路、本文と設定を明示する。
  - 新経路は内部版2を使い、旧版1の入力・出力を維持する。
- name: RustNativeEvidence
  description: Rust側で取得した指定型、フィールド、確定性、範囲と位置の情報。
  attributes:
  - protocol_version
  - request_identity
  - source_digest
  - target_status
  - target_location
  - members
  - completeness
  - reasons
  constraints:
  - U2で版・要求・本文ダイジェスト・対象・形状を検証する。
  - Rustの構文木は境界外へ出さない。既存の所見件数を共通判定へ流用しない。
- name: TypeScriptLocalEvidence
  description: 指定型と局所的な生成経路、静的メンバー、根拠位置の情報。
  constraints:
  - 構文・シンボル・型の対応を確認する。
  - 解析器固有オブジェクトはこの処理内に閉じ、C1の共通値へ変換する。
- name: ExecutionObservation
  description: 親側で観測した解析器の実行状態。
  allowed_values:
  - completed
  - unavailable
  - failed
  constraints:
  - 起動不能と、起動後の失敗を分ける。
  - 不完全な出力は正常な空結果へ置き換えない。
  - 完了時の応答なしはC1のresponse:nullへ変換する。
- name: VerificationReport
  description: 複数のVerificationRunをまとめるC2の報告値。
  constraints:
  - C2のschemaVersion、runId、command、toolchain、environment、cases、errors、statusを維持する。
  - casesはcaseId順。正常でもtargetとcheckedEvidenceを保持する。
  - runIdはコマンド一回の識別。個別VerificationRunの内部識別と同一視しない。
```

## Ownership and References

VerificationCaseとVerificationRunはStateExposureVerificationが所有する。RustNativeEvidenceはRustStateEvidence、TypeScriptLocalEvidenceはTypeScriptStateEvidenceの内部値である。C1の要求・証跡・結果の意味はU1が所有し、本書で定義し直さない。

## Summary

固定ケース、個別実行、コマンド全体の報告を分ける。検証実行の状態を、規則の正常・違反・検査不能と混ぜない。モデルは開発用検証の記録であり、新しい保存サービスやデータベースの導入を要求しない。
