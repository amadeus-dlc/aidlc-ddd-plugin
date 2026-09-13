# U1 状態公開の共通検査 — 機能設計の確認

## Sources

- [作業単位](../../../inception/units-generation/unit-of-work.md): U1の責務とソース所有。
- [ストーリー対応](../../../inception/units-generation/unit-of-work-story-map.md): US1.3の主担当と他ストーリーへの協力範囲。
- [要件](../../../inception/requirements-analysis/requirements.md): 識別・情報の完全性・判定・再現性・独立性。
- [構成要素](../../../inception/domain-design/components.md): StateExposureInspectionの所有と副作用を持たない境界。
- [契約](../../../inception/contract-design/contract-summary.md): C1の型、正規化、結果と失敗の扱い。正常の根拠保持とresponse欠落の分類を含む修正版。
- [ストーリー](../../../inception/user-stories/stories.md): US1.3のAC1.3.1〜AC1.3.7と共同の受入条件。

## Already Confirmed

U1はJSON互換の値を受け取り、要求・実行の外枠・応答の検証を経て共通判定を行う。解析器やファイルを呼ばない。情報不足を正常にせず、未解決と独立に確定した違反を両方保持する。正常を支える対象・完全性・非公開または不在の証跡も結果へ残す。

今回の主担当ストーリーはUS1.3である。実際のRust／TypeScriptの抽出、検証コマンド、既存Rust回帰はU2が所有し、U1の設計だけでそれらの完了を主張しない。

上流で解決済みの判定方針を再質問する必要はない。以下は、承認済み契約をU1の処理・値モデル・規則・試験境界へ具体化する内容の確認である。

## Consolidated Summary Confirmation

- U1の機能設計は四成果物にまとめる。entities.mdに値の形状と制約、rules.mdに番号付き規則、functional-spec.mdに順序を持つ処理と状態分岐、traceability.jsonに受入条件と規則の対応を記録する。画面を持たないためUI成果物は作成しない。
- U1は独立した可変エンティティを持たない。検査要求、スナップショット、対象、位置、Fact、メンバー証跡、実行状態、所見、理由、判定結果を、U1が意味を所有する値として整理する。架空の集約や永続化を追加しない。
- 処理は入力の形状検証、要求識別の組立て・再検証、実行状態の外枠検証、応答の契約検証、規則判定、結果の複製・整列に分ける。検証後の値だけを判定へ渡し、公開の二つの入口と戻り値はC1の契約を維持する。
- JSON互換性、安全な整数、Unicode、相対パス、対象・ソースの対応、メンバーの重複、位置の範囲と行を検証する。入力の補完や無条件の型変換で、契約違反を見えなくしない。
- 正規化と要求識別は、承認済みのUTF-8、改行、キー順、ソース・ツールの整列、SHA-256規約に従う。入力を読み直す処理や解析器固有の設定解釈はU2へ残す。
- 不正な要求または実行の外枠はinput-rejectedとする。responseキー欠落・非JSON値は外枠の不正、response:nullやJSON互換の不正応答はcompletedのままunresolvedとする。未知版・識別不一致・証跡不正も応答全体を採用しない。
- 必要情報が完全で違反なしならpass、完全で違反ありならviolation、対象・一覧・Factに未解決があればunresolvedとする。正しい応答内で独立に確定した違反は未解決と併存させる。構文候補を確定違反として扱わない。
- targetとcheckedEvidenceを含む結果を、入力から独立した値として返す。正常時も証跡を省略しない。メンバー・根拠位置・理由を決定的に整列し、根拠の削除や重複排除を整列に紛れ込ませない。
- US1.3の七つの受入条件をU1の番号付き規則へ対応付ける。他ストーリーへ提供する共通判定、同じ意味の情報の比較、正常の根拠保持、JSON往復、入力を変更しないことも試験境界として明記する。
- U1単独の固定入力試験で、正常・違反・検査不能・混在、不完全な空集合、版・識別・応答の不正、responseキーなしとnullの差、根拠だけの変更、並び順やUnicode・CRLFを確かめる。実装コードは生成せず、後続の実装と試験へ渡せる設計として記述する。

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
