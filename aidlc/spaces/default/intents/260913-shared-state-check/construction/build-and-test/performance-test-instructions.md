# 性能検証の適用範囲

## Sources

- [U1計画](../u1-state-exposure-inspection/code-generation/code-generation-plan.md)、[U1手順](../u1-state-exposure-inspection/code-generation/unit-test-instructions.md)、[U1結果](../u1-state-exposure-inspection/code-generation/code-summary.md)。
- [U2計画](../u2-language-state-verification/code-generation/code-generation-plan.md)、[U2手順](../u2-language-state-verification/code-generation/unit-test-instructions.md)、[U2結果](../u2-language-state-verification/code-generation/code-summary.md)。
- [要件](../../inception/requirements-analysis/requirements.md)、[ストーリー](../../inception/user-stories/stories.md)。

## Applicability

性能の数値目標、サービス可用性、負荷・容量要件は要件で明示的に設定していない。Standardのこの作業では追加の負荷試験はN/Aであり、成功した負荷試験があるとは記載しない。後続の性能検証ステージも予定していない。

## Existing Execution Budgets

C2の期限・出力上限とnative入力8MiBは、性能SLOではなく入力・実行契約として既存試験で確認する。関連するUnit手順を重複せず実行する。版1比較の測定値やmacOS初回起動待ちは観測値として保存し、他OSや一般の解析性能を保証しない。
