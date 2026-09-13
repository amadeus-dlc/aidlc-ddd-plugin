# 状態公開の共通検査 — ストーリー・要件と作業単位の対応

## Sources

- [stories.md](../user-stories/stories.md): 承認済みのUS1.1〜US1.4と各受入条件。
- [requirements.md](../requirements-analysis/requirements.md): FR1〜FR6と全小項目の21 ID、NFR1〜NFR3。
- [components.md](../domain-design/components.md)、[decisions.md](../domain-design/decisions.md): 要件を実現する構成要素と所有の判断。
- [unit-of-work.md](unit-of-work.md)、[依存関係](unit-of-work-dependency.md): 単位の定義と接続点。

承認済みの四つのストーリーを作業単位へ対応付ける。要件→ストーリーは[ストーリー側の対応表](../user-stories/traceability.json)、ストーリー→構成要素は[ドメイン設計の対応表](../domain-design/traceability.json)、ストーリー→作業単位は本段階の[traceability.json](traceability.json)で追跡する。既存の要件IDと担当は補足表として維持する。

## Story Mapping

Unit IDとDirectoryは各ストーリーの主担当であり、traceability.jsonの対応先と一致する。Collaborationは残りの責務を示し、主担当だけで全受入条件を満たしたとは扱わない。

| Story ID | Unit ID | Directory | 主担当が実現する内容 | Collaboration |
|---|---|---|---|---|
| US1.1 | U2 | u2-language-state-verification | 指定Rust型の同定、名前付き・タプルの根拠抽出、確定根拠と条件付き候補の区別、実行・応答の失敗検出（AC1.1.1〜AC1.1.5） | U1が共通契約の検証と正常・違反・検査不能の判定を提供する。実ソースでの全受入条件はU2が結合検証する |
| US1.2 | U2 | u2-language-state-verification | class・同名コンパニオンの状態抽出、読み取り専用を含む公開状態、対応外形状・対象欠落・解析失敗の扱い（AC1.2.1〜AC1.2.5） | U1が言語共通の契約・判定を提供する。U2はブランドやメソッドだけの誤検出を防ぎ、実ソースで結合検証する |
| US1.3 | U1 | u1-state-exposure-inspection | 要求と根拠の対応、完全性、混在時の優先順位、不正応答の拒否、実行状態と規則結果の区別、正常・適用外の根拠、同じ意味の共通情報の比較（AC1.3.1〜AC1.3.7） | U2が根拠・実行状態を取得し、確定違反と未解決理由を結果上で読み分けられる形で報告する。U1は解析器なしの固定入力、U2は実経路で確認する |
| US1.4 | U2 | u2-language-state-verification | 再実行、期待値比較、自動試験への登録、既存Rust回帰、型・依存の検証、実行条件と範囲の英日記録（AC1.4.1〜AC1.4.6） | U1が共通契約と判定の独立試験、解析器に依存しない境界、契約文書を提供する。U2が実際の両言語抽出から共通判定まで結合する |

## Cross-Unit Acceptance

- US1.1・US1.2の実ソースでの結果は、U2の根拠抽出とU1の検証・判定の両方で成立する。U1の単独試験だけで言語別抽出の成功を主張しない。
- US1.3では、全体が検査不能でも検証済みの確定違反を保持する。U1が意味を決め、U2が対象・位置・根拠と未解決理由を読み分けられる形で渡す・報告する。異なるソースに同一の位置を要求しない（AC1.3.7）。
- US1.4の比較・失敗伝達・記録は固定結果でも独立に試験するが、その試験を実際の両言語抽出から判定までの結合検証の代わりにしない。期待と異なる理由の検査不能も不一致とする（AC1.4.1・AC1.4.3）。

## Story Relationships Within Units

- U1はUS1.3を担当し、未検証の情報を判定へ渡さないよう、要求・応答の検証と規則判定を分けて具体化する。
- U2ではUS1.1とUS1.2の言語別処理の間に直接の依存を置かない。US1.4の比較・記録は独立に試験でき、最終結合には両言語の抽出とU1の共通判定を必要とする。
- これは単位内で実装・試験を成立させる関係であり、単位間の出荷優先順位、日程、クリティカルパスの指定ではない。

## Requirement Mapping

以下は既存の要件対応を維持した補足表である。直接の機械検証対象は上記Story Mappingとtraceability.jsonとする。複数単位にまたがる要件はCollaborationに残りの責務を記し、主担当だけで要件全体を完了したとは扱わない。

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

四つのストーリーすべてに主担当を割り当てた。US1.3はU1、US1.1・US1.2・US1.4はU2を主担当とし、全単位に担当ストーリーがある。構成要素の所有と主担当の対応にも矛盾がない。

補足の機能要件表では主担当はU1が11 ID、U2が10 ID、合計21 IDである。FR1〜FR6を再採番せず、各小項目も一行ずつ残した。すべての単位に担当要件があり、主たる実現先のない要件はない。

構成要素の所有は、StateExposureInspectionがU1、RustStateEvidence・TypeScriptStateEvidence・StateExposureVerificationがU2である。各構成要素を一つの単位だけに割り当てる。共通情報の意味の所有者は、単位へまとめても変えない。

単位内の具体的な実装手順は機能設計と実装計画で定める。この対応表は要件の実現責務を記録し、単位間の実装優先順位を選ばない。全体の受入判定には、主担当の単独試験と、Collaborationに記した結合側の検証の両方を用いる。
