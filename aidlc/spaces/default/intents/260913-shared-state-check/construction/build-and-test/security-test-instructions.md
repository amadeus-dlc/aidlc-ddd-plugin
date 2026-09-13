# 入力境界と安全性の確認範囲

## Sources

- [U1計画](../u1-state-exposure-inspection/code-generation/code-generation-plan.md)、[U1手順](../u1-state-exposure-inspection/code-generation/unit-test-instructions.md)、[U1結果](../u1-state-exposure-inspection/code-generation/code-summary.md)。
- [U2計画](../u2-language-state-verification/code-generation/code-generation-plan.md)、[U2手順](../u2-language-state-verification/code-generation/unit-test-instructions.md)、[U2結果](../u2-language-state-verification/code-generation/code-summary.md)。
- [要件](../../inception/requirements-analysis/requirements.md)、[ストーリー](../../inception/user-stories/stories.md)。

## Applicability

認証・認可、Web/API、業務データの永続化、クラウド配備の要件はないため、これらに対する追加のSAST/DASTや認証試験はN/Aとする。新しいセキュリティ製品や数値基準を追加しない。脆弱性データベース照合を実施したとは主張しない。

## Applicable Boundary Checks

共通入力の非JSON値・不正Unicode・整数・循環・パス、版と要求識別、native応答の位置・本文対応、CompilerHostの固定入力境界、未対応構文やブランド偽装、実行期限・出力上限を既存Unit/結合試験で確認する。検査対象ソースを実行せず、子プロセスのargvと入力を分離する。固定依存版と入力ハッシュを確認する。各コマンドはUnit実行一覧と統合し、重複回数を成果件数へ加算しない。
