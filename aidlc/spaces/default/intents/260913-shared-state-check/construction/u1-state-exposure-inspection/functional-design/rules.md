# U1 共通検査 — 処理規則

## Sources

- [作業単位](../../../inception/units-generation/unit-of-work.md)、[ストーリー対応](../../../inception/units-generation/unit-of-work-story-map.md): U1の主担当とU2との協力範囲。
- [要件](../../../inception/requirements-analysis/requirements.md)、[ストーリー](../../../inception/user-stories/stories.md): US1.3の七受入条件と品質条件。
- [構成要素](../../../inception/domain-design/components.md): StateExposureInspectionの所有と独立性。
- [契約](../../../inception/contract-design/contract-summary.md): C1の値、公開入口、検証と失敗規約。
- [機能設計の確認](functional-design-questions.md): 今回の具体化についての確認記録。

## Rules Catalogue

```yaml
unit: u1-state-exposure-inspection
rules:
- id: BR1.1
  statement: 入力をJSON互換の値として検証する
  category: validation
  applies_to: 全公開入口の入力
  trigger: 入口の呼出し
  logic: IF 必須キー、型、タグ別の形状、安全な整数、Unicode、JSON互換性が不正 THEN 入力を補完せず拒否する。循環は現在の祖先経路で検出し、循環ではない共有参照は内容を複製できる。
  violation_behaviour: 入力・外枠はinput-rejected。応答内部はBR1.4で扱う。
  source: FR4.3; C1; AC1.3.4
- id: BR1.2
  statement: 要求の入力条件と識別を固定する
  category: calculation
  applies_to: InspectionInputとInspectionRequest
  trigger: 要求準備または受信要求の検証
  logic: IF 入力が妥当 THEN 本文のUTF-8ハッシュ、行開始位置、整列済みソース・ツール、対象、すべての設定からC1の正規化規約で識別を作る。受信要求では構造と識別を再検証する。
  violation_behaviour: 不正要求はinput-rejected。別要求の応答はBR1.4で拒否。
  source: FR1.1; FR4.2; NFR1; AC1.3.1; AC1.3.4
- id: BR1.3
  statement: 実行状態の外枠と応答なしを区別する
  category: validation
  applies_to: ExtractionExecution
  trigger: 要求の検証後
  logic: IF statusがcompleted THEN responseキーは必須で、nullだけを応答なしとする。IF キー欠落または非JSON値 THEN
    外枠の入力エラーとする。IF unavailableまたはfailed THEN 理由を一件以上要求し、responseを認めない。
  violation_behaviour: 外枠不正はinput-rejected。妥当な実行不能・失敗はunresolved。
  source: FR5.1; FR4.3; C1-02a; AC1.3.4; AC1.3.5
- id: BR1.4
  statement: 検証できない応答全体を判定へ渡さない
  category: validation
  applies_to: completed.response
  trigger: 実行状態の外枠の検証後
  logic: IF null、版の不明、要求識別の不一致、証跡の形状または不変条件の不正 THEN 応答全体を採用しない。部分的な救出や別の入力の所見の採用をしない。
  violation_behaviour: completed/unresolved、checkedEvidence=null、所見なし、対応する理由あり。
  source: FR4.3; FR5.1; AC1.3.4
- id: BR1.5
  statement: 根拠と位置を同じ要求に対応付ける
  category: validation
  applies_to: StateEvidence、Location、Issue
  trigger: 応答の契約検証
  logic: IF 対象またはメンバーの根拠 THEN 一件以上の位置を要し、target.file、バイト範囲、開始行との整合を検証する。メンバーIDの重複を拒否する。理由の不明位置はnullのまま対象をsubjectで示す。
  violation_behaviour: 応答の不変条件違反はBR1.4。意味上の未解決は検証済みのIssueとして保持。
  source: FR4.2; FR5.2; AC1.3.1; AC1.3.3
- id: BR1.6
  statement: 不在・一覧の完全性・意味の未解決を分ける
  category: constraint
  applies_to: Factとメンバー一覧
  trigger: 証跡の契約検証と判定
  logic: IF absent THEN 保持状態ではない確認済み根拠を要する。IF partial THEN 未列挙の理由を要する。completeでも一つのFactがunresolvedなら必要情報は未解決とする。空一覧だけで不在や正常を証明しない。
  violation_behaviour: 不正な形状はBR1.4。正しい形状の不足・未解決はBR1.7。
  source: FR4.1; FR5.3; AC1.3.2; AC1.3.3; AC1.3.6
- id: BR1.7
  statement: 正常・違反・検査不能の優先順位を守る
  category: policy
  applies_to: 検証済みの要求、実行状態、証跡
  trigger: 規則判定
  logic: IF 対象、一覧、Factに未解決がある THEN 全体はunresolved。ELSE IF 確定公開あり THEN violation。ELSE
    pass。unavailableとfailedは常にunresolved。resolved/trueだけから確定違反を作り、正しい部分証跡内の違反は保持する。
  violation_behaviour: not-applicableへ置き換えず、確定違反と未解決理由を併記する。
  source: FR5; FR5.1; FR5.3; AC1.3.2; AC1.3.3; AC1.3.5; AC1.3.6; AC1.3.7
- id: BR1.8
  statement: 正常を含む検証済みの証跡を結果へ残す
  category: policy
  applies_to: InspectionResult
  trigger: 結果の生成
  logic: IF 有効な要求に対する結果 THEN targetを保持する。IF 証跡全体を検証できた THEN checkedEvidenceに既知フィールドを複製して保持する。passでも対象根拠、完全性、非公開・不在の根拠を省略しない。
  violation_behaviour: 未検証証跡はnullとし、根拠がない状態を正常にしない。
  source: FR5; FR5.2; NFR1; C1-05a; AC1.3.1; AC1.3.3; AC1.3.7
- id: BR1.9
  statement: 比較可能な順序と独立した値を返す
  category: calculation
  applies_to: 結果の所見、証跡、理由
  trigger: 結果の返却前
  logic: IF 結果を返す THEN C1の文字列・数値・nullの比較規約でメンバー、位置、理由を整列する。入力の配列順を意味にせず、根拠を削除・重複排除しない。入力の可変配列・辞書を結果と共有せず、入力自体を変更しない。
  violation_behaviour: 同じ意味の値を同じ順序にし、根拠だけの変更も比較できる。
  source: NFR1; FR5.2; AC1.3.7
- id: BR1.10
  statement: 共通判定を解析器から独立させる
  category: constraint
  applies_to: U1の全処理
  trigger: 依存の設計と検証
  logic: IF U1を呼ぶ THEN 渡された共通値だけで処理する。ファイル読取り、解析器起動、ネットワーク、実ソースの構文解析、言語別の最終判定を追加しない。
  violation_behaviour: U2の解析成功をU1の固定入力試験で代用しない。
  source: FR4.2; NFR3; AC1.3.7
```

## Rules Summary

| 規則 | 目的 |
|---|---|
| BR1.1 | 入力をJSON互換の値として検証する |
| BR1.2 | 要求の入力条件と識別を固定する |
| BR1.3 | 実行状態の外枠と応答なしを区別する |
| BR1.4 | 検証できない応答全体を判定へ渡さない |
| BR1.5 | 根拠と位置を同じ要求に対応付ける |
| BR1.6 | 不在・一覧の完全性・意味の未解決を分ける |
| BR1.7 | 正常・違反・検査不能の優先順位を守る |
| BR1.8 | 正常を含む検証済みの証跡を結果へ残す |
| BR1.9 | 比較可能な順序と独立した値を返す |
| BR1.10 | 共通判定を解析器から独立させる |

## Scope

上記は検査領域の規則であり、解析対象アプリケーションの業務ルールではない。U2が観測した実行状態や抽出済み根拠を検証して使い、ソース構文の成立をU1が推測して補わない。
