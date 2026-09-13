# 状態公開の共通検査 — 作業単位の確認

承認済みの四つの構成要素を、実装と試験の完了を確認できる単位へまとめる。対象は[Issue #38](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/38)であり、一問ずつ確認する。

## Sources

- [components.md](../domain-design/components.md): 四つの責務、所有者、呼出しと契約宣言への依存。
- [decisions.md](../domain-design/decisions.md): 共通契約と判定の一括所有、言語別処理の分離、既存Rust経路との関係。
- [requirements.md](../requirements-analysis/requirements.md): FR1〜FR6、NFR1〜NFR3と完了条件。

## Already Confirmed

- StateExposureInspection、RustStateEvidence、TypeScriptStateEvidence、StateExposureVerificationの四つの論理的な境界を維持する。
- 情報契約・検証・規則判定はStateExposureInspectionが所有する。言語別抽出は共通判定から分離する。
- 対象は状態公開の一規則と固定プロジェクト入力に限定する。入力不足や不正応答を正常へ変換せず、検査不能と確定違反を両方保持する。
- 既存Rustの本番入口・出力契約を維持する。パッケージ探索、一般の型解決、成果物・設定移行、本番切替、配布、Webフレームワーク統合は追加しない。
- プラグイン内部の実装と開発用検証を同じリポジトリの`ddd/`へ統合する。独立したネットワークサービスを新設する要件はない。
- ディレクトリ名は検査領域の言葉に結び付け、ドメインを技術上の型分類へ分けない。

## Proposed Decomposition Plan

分割の基準は、共通規則を単独で検証できる境界と、実際の解析器からコマンドまでを結合して検証する境界である。

| Unit ID | Directory | Kind | 所有する構成要素 | 完了を確認する範囲 | 相対規模 |
|---|---|---|---|---|---|
| U1 | u1-state-exposure-inspection | library | StateExposureInspection | 共通契約、要求と応答の検証、純粋な規則判定、解析器なしの契約・判定試験 | M |
| U2 | u2-language-state-verification | library | RustStateEvidence、TypeScriptStateEvidence、StateExposureVerification | 両言語の抽出と変換、固定ケースの結合試験、検証コマンドと自動検証への登録、既存Rust回帰、実行案内 | L |

両単位ともプラグイン内部へ組み込む`library`とする。U2の検証用コマンドは開発・試験の入口であり、独立してデプロイする製品サービスではない。ライブラリの内部実装と検証用入口を一つの単位で完結させる。

- **依存**: U1は他の単位へ依存しない。U2はU1が所有する共通契約と判定を使う。逆方向の依存や循環は作らない。
- **接続点**: 共通の検査要求、状態公開の証跡、実行状態を含む判定結果。形式の版と不正・不足・不一致の扱いは次のContract Designで確定する。
- **範囲の所有**: 各単位は自分の実装に対する試験と英日文書を含む。U1が共通契約・判定の文書、U2が解析器・検証コマンド・実行証跡の文書を担当し、共通契約をU2で再定義しない。具体的なソース所有パスは作業単位の成果物で明記する。
- **規模の境界**: U2の相対規模Lは、二言語と結合検証を含むためである。対応形状は要件の代表例に限定し、型解決や本番統合を含めて拡大しない。
- **並行性**: U2内の言語別抽出は内部作業を分担できるが、単位としての完了は共通契約に結合して確認する。独立した二単位として同時に完了できるという計画ではない。

この計画は依存関係を定めるもので、出荷優先順位・日程・クリティカルパスを選ぶものではない。U1の完了だけでIssue #38全体を完了したとは扱わず、両言語を通したU2の検証までが必要である。

別案として、構成要素ごとの四単位なら言語別抽出を独立にレビューできるが、作業単位間の受け渡しが増える。一単位なら受け渡しは減るが、共通判定だけの完了を区切りにくい。今回の限定範囲には、上の二単位を推奨する。

## Q1: 分割計画の承認

上記の二つの`library`単位、責務の割当て、U2からU1への依存で、分割計画を承認するか。単位の種別は、後続の設計成果物の適用範囲にも使う。

- A. Approve Plan — 二単位の計画を承認する（推奨）。
- B. Revise Plan — 単位数、責務の割当て、または種別を見直す。
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Q1はApprove Planとして承認された。論理的な構成要素を変更せず、実装・試験を完了できる二単位にまとめる。
- U1は`u1-state-exposure-inspection`、種別は`library`、相対規模はMとする。StateExposureInspectionを所有し、共通契約・要求と応答の検証・規則判定と、解析器を起動しない試験を担当する。
- U2は`u2-language-state-verification`、種別は`library`、相対規模はLとする。RustStateEvidence、TypeScriptStateEvidence、StateExposureVerificationを所有し、言語別抽出・共通形式への変換・検証コマンド・自動検証への登録・既存Rust回帰を担当する。
- 両単位を既存プラグイン内部へ組み込む。U2のコマンドは開発用検証の入口であり、独立してデプロイする製品サービスや、新しい配布方式を追加しない。
- U1は他単位への依存なし、U2はU1に依存する。接続点は共通の検査要求・証跡・判定結果とし、U2で意味を再定義しない。具体的な形式・版・失敗時の契約は次のContract Designで定める。
- 各単位に対応する試験と英日文書を含める。U1が共通契約と判定の案内、U2が解析器・検証コマンド・実行証跡の案内を担当する。作業単位の成果物には、ソース・試験・文書・開発設定の所有範囲を明記する。
- 要件はFR1〜FR6と全小項目を含む21 IDを維持し、単位ID・ディレクトリへ対応付ける。複数単位にまたがる要件は両者の担当範囲を記し、NFR1〜NFR3の再現性・回帰維持・独立した試験境界も割り当てる。
- 単位間の依存と内部で分担できる範囲を記録する。出荷優先順位・日程・クリティカルパスは選ばない。U1単独の完了でIssue #38全体を完了したとは扱わない。
- 対応形状を承認済みの代表例に限定する。パッケージ探索、一般の型解決、成果物・設定移行、本番センサー切替、ネイティブ配布、Webフレームワーク統合を完了条件へ追加しない。
- unit-of-work.mdへ単位の定義と責務、unit-of-work-dependency.mdへ循環のない依存とYAML、unit-of-work-story-map.mdとtraceability.jsonへ要件との対応を記録する。User Storiesは作成していないため、要件IDを使う。

上記をもとに、作業単位の四成果物を作成してよいか確認する。

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
