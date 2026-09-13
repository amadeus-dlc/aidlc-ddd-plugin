# 状態公開の共通検査 — 要件と作業単位の対応

## Sources

- [requirements.md](../requirements-analysis/requirements.md): FR1〜FR6と全小項目の21 ID、NFR1〜NFR3。
- [components.md](../domain-design/components.md)、[decisions.md](../domain-design/decisions.md): 要件を実現する構成要素と所有の判断。
- [unit-of-work.md](unit-of-work.md)、[依存関係](unit-of-work-dependency.md): 単位の定義と接続点。

User Storiesは選択した範囲で作成していない。ファイル名は規定どおりとし、本文では架空のストーリーを追加せず、承認済みの機能要件IDを用いる。

## Requirement Mapping

Unit ID欄は[traceability.json](traceability.json)の主たる実現先である。複数単位にまたがる場合は、同じ行のCollaborationに残りの責務を記す。主担当だけで要件全体の実装を完了したという意味ではない。

| Requirement ID | Unit ID | Directory | 主担当が実現する内容 | Collaboration |
|---|---|---|---|---|
| FR1 | U1 | u1-state-exposure-inspection | 指定入力・対象に対する共通検査の契約 | U2が入力を確定し、指定型の情報を抽出する |
| FR1.1 | U1 | u1-state-exposure-inspection | 入力・設定・対象の要求と応答の対応確認 | U2が実際に解析した入力と設定を対応付ける |
| FR1.2 | U1 | u1-state-exposure-inspection | 欠落・曖昧・結果不足を検査不能とする | U2が言語ごとの対象同定と不足を報告する |
| FR2 | U2 | u2-language-state-verification | Rust＋synによる根拠抽出と変換 | U1が共通判定を行う |
| FR2.1 | U2 | u2-language-state-verification | 名前付き・タプルの公開・非公開を抽出する | U1が検証済みの根拠から違反を判定する |
| FR2.2 | U2 | u2-language-state-verification | 構文エラー・条件付き構文の未解決と確定根拠を区別する | U1が検査不能と確定違反を保持する |
| FR3 | U2 | u2-language-state-verification | Compiler APIによる根拠抽出と変換 | U1が共通判定を行う |
| FR3.1 | U2 | u2-language-state-verification | classの非公開状態と公開状態を扱う | U1が共通規則で判定する |
| FR3.2 | U2 | u2-language-state-verification | コンパニオン・クロージャ・ブランドの対応形状を扱う | U1が共通規則で判定する |
| FR3.3 | U2 | u2-language-state-verification | 単一ファイルの対応外形状と必要情報不足を報告する | U1が必要情報の不足を正常にしない |
| FR4 | U1 | u1-state-exposure-inspection | 一規則の共通情報契約と検証 | U2が両言語から共通形式へ変換する |
| FR4.1 | U1 | u1-state-exposure-inspection | 情報の確実性と完全性を区別する | U2が抽出範囲と限界を正しく伝える |
| FR4.2 | U1 | u1-state-exposure-inspection | 入力対応と根拠を保持する言語非依存の境界 | U2が解析器固有型を閉じ、型検査でも境界を確かめる |
| FR4.3 | U1 | u1-state-exposure-inspection | 未知版・不正・欠落・不一致を拒否する | U2がネイティブ応答を検証し、不足を正常な空結果へ補完しない |
| FR5 | U1 | u1-state-exposure-inspection | 正常・違反・検査不能の根拠付き判定 | U2が実行状態を渡し、結果を改変せず報告する |
| FR5.1 | U1 | u1-state-exposure-inspection | 実行不能・失敗と規則結果を区別する | U2が起動・実行・応答の失敗を観測する |
| FR5.2 | U1 | u1-state-exposure-inspection | 所見・未解決理由と対象・位置の対応 | U2がソースの位置を取得し、確認可能な形で報告する |
| FR5.3 | U1 | u1-state-exposure-inspection | 適用外の証明と情報不足を区別する | U2が対象欠落や解析未対応を適用外にしない |
| FR6 | U2 | u2-language-state-verification | 再実行可能な検証経路と自動検証への登録 | U1の単独試験と共通検査を含めて確認する |
| FR6.1 | U2 | u2-language-state-verification | 両言語の代表例と異常経路を自動検証する | U1が契約・判定の境界条件を単独試験する |
| FR6.2 | U2 | u2-language-state-verification | ツール・API版・対応形状・コマンド・実行証跡の英日文書 | U1が共通契約と単独検証の英日文書を担当する |

## Quality Mapping

| Requirement ID | 担当 | 単位をまたぐ確認 |
|---|---|---|
| NFR1 | U1、U2 | U1の決定的な判定と、U2の入力・設定・ツール版の固定を合わせて再現性を確かめる |
| NFR2 | U1、U2 | U1の独立した追加と、U2の既存Rust回帰・結合検証で本番経路を維持する |
| NFR3 | U1、U2 | U1で解析器なしの試験境界を作り、U2で実際の変換と型検査を確認する |

## Coverage Verification

主担当はU1が11 ID、U2が10 ID、合計21 IDである。FR1〜FR6を再採番せず、各小項目も一行ずつ残した。すべての単位に担当要件があり、主たる実現先のない要件はない。

構成要素の所有は、StateExposureInspectionがU1、RustStateEvidence・TypeScriptStateEvidence・StateExposureVerificationがU2である。各構成要素を一つの単位だけに割り当てる。共通情報の意味の所有者は、単位へまとめても変えない。

単位内の具体的な実装手順は機能設計と実装計画で定める。この対応表は要件の実現責務を記録し、単位間の実装優先順位を選ばない。全体の受入判定には、主担当の単独試験と、Collaborationに記した結合側の検証の両方を用いる。
