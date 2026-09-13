# U2 言語別抽出と検証実行 — 処理規則

## Sources

- [作業単位](../../../inception/units-generation/unit-of-work.md)、[対応表](../../../inception/units-generation/unit-of-work-story-map.md): U2の主担当と所有範囲。
- [要件](../../../inception/requirements-analysis/requirements.md)、[ストーリー](../../../inception/user-stories/stories.md): US1.1・US1.2・US1.4の16受入条件。
- [構成要素](../../../inception/domain-design/components.md)、[契約](../../../inception/contract-design/contract-summary.md): U1との接続とC2。
- [言語共通の設計](../../../../../../../../ddd/docs/developers/language-independent-design.ja.md): 合意済みのコンパニオン例。
- [確認記録](functional-design-questions.md): 対応形状と検証手順の確認。

## Rules Catalogue

```yaml
unit: u2-language-state-verification
rules:
- id: BR2.1
  statement: 同じ入力・設定・版で要求と抽出を対応付ける
  category: validation
  applies_to: 全抽出
  trigger: 検証開始
  logic: IF ケースが妥当 THEN ソースと有効設定・実ツール版を固定してU1へ要求を準備させ、同じ値だけを抽出へ使う。
  violation_behaviour: 不正ケースはC2のusage-error、実際の準備不足はexecution-error。
  source: FR1.1; FR4.2; NFR1
- id: BR2.2
  statement: 指定した宣言を一意に同定する
  category: validation
  applies_to: 両言語の対象
  trigger: 抽出開始
  logic: IF 指定ファイルと宣言経路の対象が一意で、その成立を確認できる THEN その対象だけを調べる。
  violation_behaviour: 欠落・曖昧・未確認はtarget-unresolved。別の型で代用しない。
  source: FR1.2; FR2; FR3
- id: BR2.3
  statement: Rustの名前付き・タプルの可視性を根拠にする
  category: calculation
  applies_to: Rustの構造体
  trigger: 対象同定後
  logic: IF 成立を確認したフィールドが非公開 THEN resolved/false。IF pubまたは制限付き公開 THEN resolved/true。名前とタプル位置を区別する。
  violation_behaviour: 構文候補だけでは確定値を作らない。
  source: FR2.1
- id: BR2.4
  statement: Rustの成立不明な範囲を未解決にする
  category: constraint
  applies_to: 条件付き構文、未展開マクロ、構文不正
  trigger: Rustの抽出
  logic: IF 型の成立・同定が不明 THEN 対象を未解決にする。IF 一部フィールドの成立だけが不明 THEN そのFactを未解決とし、未知の追加メンバーがあり得ればpartialにする。
  violation_behaviour: 独立に確定したフィールドは保持。型全体が不確実ならフィールドを確定違反にしない。
  source: FR2.2; FR5
- id: BR2.5
  statement: TypeScriptの静的なインスタンス状態を区別する
  category: calculation
  applies_to: class表現
  trigger: 対象同定後
  logic: IF 対応形状の非公開フィールド THEN resolved/false。IF 直接公開されたデータメンバー THEN readonlyでもresolved/true。確認済み操作メソッドは根拠付きabsent。
  violation_behaviour: 型検査だけのprivateを実行時の非公開と同一視しない。未確認形状はunresolved。
  source: FR3.1; FR3.3
- id: BR2.6
  statement: コンパニオンのインスタンスとブランドを確認する
  category: validation
  applies_to: 型と同名コンパニオン
  trigger: 生成経路の照合
  logic: IF 同一ファイルの局所インスタンスと非公開ブランド、保持状態のクロージャ、生成関数の成功経路を追跡できる THEN 返されるインスタンスのメンバーを抽出する。
  violation_behaviour: 名前だけのブランド判定、外部ファクトリ、追えない戻り経路で正常を作らない。
  source: FR3.2; FR4.1
- id: BR2.7
  statement: 未対応のTypeScript形状を完全扱いしない
  category: constraint
  applies_to: 必要情報へ影響する継承・spread・計算名・型アサーション等
  trigger: TypeScriptの抽出
  logic: IF 必要範囲を証明できない形状がある THEN 影響する対象・Fact・一覧に未解決理由を残す。確認済みブランドの計算名だけは独立に扱う。
  violation_behaviour: 未知の候補を確定違反にしない。型アサーションや空リストで検査を通さない。
  source: FR3.3; FR5
- id: BR2.8
  statement: 実行を実際に終了できる境界で管理する
  category: policy
  applies_to: 解析器実行
  trigger: 起動と待機
  logic: IF 起動不能 THEN unavailable。IF 起動後の異常終了・期限・出力上限超過 THEN failed。IF プロセスまたはワーカーが正常終了 THEN 応答の有無・個数・形式にかかわらずcompletedとし、応答検証を後段で行う。応答なしはresponse:null、不正な非null応答はC1が拒否できるJSON互換値へ対応付ける。
  violation_behaviour: 暗黙の再試行・旧センサーへの代替・途中出力の採用をしない。
  source: FR5.1; FR6.2; C2
- id: BR2.9
  statement: ネイティブ情報を検証してC1へ接続する
  category: validation
  applies_to: 言語別応答
  trigger: 抽出後
  logic: IF 版・要求・本文・対象・形状を検証できる THEN C1の共通証跡へ変換する。IF 応答を検証できない THEN 有効な証跡を捏造しない。最終の規則判定は常にU1へ委ねる。
  violation_behaviour: 終了コード0や空の所見だけで合格にしない。
  source: FR4.2; FR4.3; FR5
- id: BR2.10
  statement: 同じソースに結び付く共通位置を渡す
  category: calculation
  applies_to: 対象・メンバー・理由の位置
  trigger: 共通値への変換
  logic: IF 根拠位置が確定 THEN 同じ本文から相対パス・共通行・UTF-8バイト範囲へ変換する。
  violation_behaviour: 不明位置は理由のsubjectで示し、確定所見に架空の位置を付けない。
  source: FR5.2; NFR1
- id: BR2.11
  statement: 正常の根拠も含めて期待値と比較する
  category: calculation
  applies_to: 個別ケース結果
  trigger: U1の結果取得後
  logic: IF 比較する THEN target・checkedEvidence・理由・所見を含む全フィールドをC1の整列後の値で比較する。期待値をactualから生成しない。
  violation_behaviour: 根拠だけの差や、期待と異なる理由のunresolvedをmismatchにする。
  source: FR6.1; FR6.2; NFR1
- id: BR2.12
  statement: 検証全体の成否と規則結果を分ける
  category: policy
  applies_to: VerificationReport
  trigger: 報告
  logic: IF 使用法不正 THEN exit2。ELSE IF 実準備・実行失敗で検証不能 THEN exit3。ELSE IF 比較不一致 THEN exit1。ELSE
    全ケース一致かつ必要経路実行済みならexit0。
  violation_behaviour: 意図した異常の一致と、実ツール不足・未実行を混同しない。
  source: FR6.2; C2
- id: BR2.13
  statement: 回帰・自動検証・実行案内を維持する
  category: constraint
  applies_to: 検証の入口と成果
  trigger: 実装の統合
  logic: IF 新経路を追加 THEN 既存Rust基準と影響するsyn比較を確認し、必要ツール・準備・採用版・対応形状・コマンド・成否を英日で残す。
  violation_behaviour: 既存期待値を弱めず、未実行の環境を検証済みとしない。
  source: FR6; NFR2
- id: BR2.14
  statement: 独立試験と実際の抽出を通す試験を分ける
  category: constraint
  applies_to: 試験構成
  trigger: 検証計画
  logic: IF 固定の共通結果で比較・記録を試す THEN 両言語の実ソース検査の代替に数えない。実経路の正常・違反・未解決ケースと、共通型の独立性を別に確認する。
  violation_behaviour: ASTや解析器の型をU1へ漏らさず、未実行を合格に数えない。
  source: FR4.2; FR6.1; NFR3
```

## Rules Summary

| 規則 | 目的 |
|---|---|
| BR2.1 | 同じ入力・設定・版で要求と抽出を対応付ける |
| BR2.2 | 指定した宣言を一意に同定する |
| BR2.3 | Rustの名前付き・タプルの可視性を根拠にする |
| BR2.4 | Rustの成立不明な範囲を未解決にする |
| BR2.5 | TypeScriptの静的なインスタンス状態を区別する |
| BR2.6 | コンパニオンのインスタンスとブランドを確認する |
| BR2.7 | 未対応のTypeScript形状を完全扱いしない |
| BR2.8 | 実行を実際に終了できる境界で管理する |
| BR2.9 | ネイティブ情報を検証してC1へ接続する |
| BR2.10 | 同じソースに結び付く共通位置を渡す |
| BR2.11 | 正常の根拠も含めて期待値と比較する |
| BR2.12 | 検証全体の成否と規則結果を分ける |
| BR2.13 | 回帰・自動検証・実行案内を維持する |
| BR2.14 | 独立試験と実際の抽出を通す試験を分ける |

## Scope

抽出した根拠の成立と範囲はU2が保証し、正常・違反・検査不能の最終判定はU1へ委ねる。実行環境そのものの未準備を、試験で期待した異常検出に見せかけない。
