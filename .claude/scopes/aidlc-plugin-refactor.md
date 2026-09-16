---
name: plugin-refactor
depth: Standard
keywords: []
change_control: relaxed
---

# plugin-refactor

## Purpose

公開動作・成果物スキーマ・CLI・出力・診断の意味を保ち、内部構造と依存を整理する。

この定義は再利用する作業スコープであり、個別の実装依頼ではない。開始時には対象の Issue または具体的な作業依頼を別途指定する。特定の言語や特定の Issue を適用条件にしない。自動キーワード推論は使わず、必要なスコープを明示して選択する。

## Framework Compatibility

- **aidlc-workflows対応基準**: `2.9.0`
- **基準確認日**: `2026-09-13`
- **確認範囲**: スコープ設定の点検。Unit生成を含まない構成であり、全工程の実行は個別のリファクタリングで確認する。
- **確認コマンド**: `aidlc --version`、`ddd/`から`bun run test:development-scopes`。

対応基準は、このスコープの設計と検証に使った版を表す。最小対応版の指定や、全工程を通した動作保証を表すものではない。

バージョン更新時は、functional-designとcode-generationが既存の作業単位・構成成果物を利用できるか、公開契約の維持と回帰検証の手順が変わっていないかを確認する。変更の影響に応じて`bun run check`とこのスコープの実行経路を検証し、結果を記録してから対応基準と確認日を更新する。版番号だけを先に書き換えない。

## Prerequisites

- 既存プラグインの Issue または同等の合意済み依頼、参照設計、期待結果・除外範囲がある。
- 既存テスト、ビルド、配布物、導入・更新、承認・直接検査の確認経路が利用できる。
- 変更は単一プラグイン内の少数箇所または単一の内部改善単位で、複雑な Unit 間依存や複数チーム調整を伴わない。
- 新しい画面・インフラ・CI 基盤・本番配備は含めない。
- 保持する公開動作、成果物スキーマ、CLI・出力・診断の意味が合意され、変更前後を比較できる。
- 内部の責任分担や依存を整理する目的が合意され、公開境界・契約の変更を必要としない。
- 独立した Unit・構成成果物を新設せず進められる作業で、現行の Issue・設計に作業単位と対象構成が記録されている。

## Workflow

初期化3工程の後に、次の工程を実行する。各工程の EXECUTE / SKIP は scope-grid.json の同名エントリーを正とする。

reverse-engineering → requirements-analysis → functional-design → code-generation → build-and-test

requirements-analysis は合意済み事項を受入条件へ整理し、未決の実装詳細だけを質問する。Ideation、独立した NFR、Operation、新規 CI 基盤の構築は含めない。既存の開発手順は reverse-engineering と build-and-test で確認・適用する。

## Existing Inputs

functional-design が使う unit-of-work・components と、code-generation が使う unit-of-work の生成工程を省略する。現行の Issue・設計に作業単位と対象構成が記録されていることが前提となり、validate-grid はこの点を advisory として返す。必要入力を供給できない場合は、実行前に再構成する。

## Verification

- 公開 API、成果物スキーマ、CLI、出力・診断の意味について、変更前後の比較点を固定する。
- 内部依存の整理と変更順を functional-design に記録し、段階的な変更ごとに互換性と既存の動作を検証する。
- 変更前の既存テストを基準として記録し、変更後に対象の回帰試験と既存チェックを通す。既存の失敗を今回の成功として扱わない。
- ソースの試験に加え、対象 harness 向けビルド、配布物、compose、導入・更新、通常承認、直接検査の経路を変更の影響に応じて確認する。このリポジトリの対象 harness は Claude Code と Codex。
- 既存の安全性、再実行性、解析時間・資源制約を受入条件と build-and-test に残す。独立した NFR・Operation・CI 構築の工程は設けない。
- 追加した試験は既存のチェックへ接続する。検査不能・不完全な入力・必須成果物の欠落を成功と同一視しない。
- 実行用の knowledge / sensors / stages / contributions は英語、一般文書は英日を揃え、aidlc/ の作業記録は日本語とする。
- 第三者フレームワークの既存制約は別課題として記録し、プラグインの試験成功を制約解消の証拠にしない。

## Change Control

change_control: relaxed は、承認後の入力変更を一度記録して伝え、処理を継続する。各工程の承認ゲートと、適用前提を外れた変更の再分類は維持する。

## Escalation

- 公開 API、成果物スキーマ、CLI、出力または診断の意味を意図的に変える場合は plugin-dev を使う。
- 期待結果そのものが未合意、要求追加が必要、破壊的移行が必要な場合は、既存契約を黙って変更せず再合意・再構成する。
- 影響が複数 Unit・サービス・チームへ広がる、比較試験で互換性を示せない、既存の検証経路が使えない場合は適用前提を再評価して recompose する。
- 第三者フレームワークの既存制約は別課題として記録し、プラグインの試験成功を制約解消の証拠にしない。
