# 結合検証の手順

## Sources

- [U1計画](../u1-state-exposure-inspection/code-generation/code-generation-plan.md)、[U1手順](../u1-state-exposure-inspection/code-generation/unit-test-instructions.md)、[U1結果](../u1-state-exposure-inspection/code-generation/code-summary.md)。
- [U2計画](../u2-language-state-verification/code-generation/code-generation-plan.md)、[U2手順](../u2-language-state-verification/code-generation/unit-test-instructions.md)、[U2結果](../u2-language-state-verification/code-generation/code-summary.md)。
- [要件](../../inception/requirements-analysis/requirements.md)、[ストーリー](../../inception/user-stories/stories.md)。

## Scope and Commands

Standardの境界検証として、U1公開API、Rust版2からC1、TypeScript Program/TypeCheckerからC1、C2のケース選択・比較・終了コードを扱う。依存準備と個別コマンドはbuild-instructions.mdと承認済みUnit手順に従う。

```sh
bun run verify:state-exposure --case all
```

このコマンドはU2手順と同一のため一回だけ実行する。通常check内の既定all実行との比較で、runId等の付帯情報を除いた23ケースのexpected/actual、対象・根拠・理由・順序の一致を確認する。

## Expectations and Coverage

実ソース14件と制御異常9件を区別する。正常・違反・未解決、根拠だけの不一致、未知ID・不正引数、実ツール不足、制御fixtureの未開始、期限・出力上限を確認する。これらのCLI境界試験はstate-exposure-verification.test.tsへ実装済みであり、個別コマンドと全体checkの両方で実行される。C2がexit0でも実行されなかったケースを成功と数えない。

承認済みTesting ContractはStandard、test-after、既存試験維持であり、新たな数値カバレッジ下限を追加しない。U1と三つのU2構成要素について主要ケース五〜八件以上と必要な境界を既存試験で確認する。

## Traceability

23 ACと全FR/NFRを列挙し、code-generationの各Unitの対応表、上流のストーリー対応、実在する試験・実装へ照合する。直接エントリの欠落と、上流対応を通した実装の裏付けを区別してcross-unit-traceability.mdへ記載し、欠落を隠さない。
