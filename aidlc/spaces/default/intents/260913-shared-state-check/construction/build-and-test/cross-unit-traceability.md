# 全Unitの最終対応表

## Sources

- [要件](../../inception/requirements-analysis/requirements.md)、[ストーリー](../../inception/user-stories/stories.md)、[要件→ストーリー対応](../../inception/user-stories/traceability.json)。
- [U1対応表](../u1-state-exposure-inspection/code-generation/traceability.json)、[補完後U2対応表](../u2-language-state-verification/code-generation/traceability.json)。
- [機械照合結果](evidence/cross-unit-coverage.json)、[形式検査](evidence/traceability-sensor.json)、[検証結果](test-results.md)。

## Verification Method and Verdict

24要件ID（21 FR＋3 NFR）と23 AC、計47 IDを列挙し、全IDがUnit表の明示的なOK行と実在ファイルへ対応することを確認した。未到達IDは0。

元のUnit表は割当AC/BRを記録しており、FR/NFR24件の直接エントリが無かった。承認済みuser-storiesのOK対応から対象Story内の全ACを展開し、UnitのOK行と実在パスを確認したうえで、今回U2の対応表へ24件を追加した。元の16 AC・14 BRを保持し、計画・テスト手順・コード・試験を変更していない。追加後のUnit対応表はtraceabilityセンサーでpass、全ての不備0件となった。

判定：47 IDすべてOK。23 ACは元の直接対応、24 FR/NFRは今回直接対応を補完した。補完根拠の全AC・Unit・targetは機械照合JSONへ保持する。

## Per-ID Coverage

| ID | Status | 照合方法 | 所有Unit | 明示的なtarget |
|---|---|---|---|---|
| FR1 | OK | 直接対応を補完・検査済み | u2-language-state-verification | [ddd/tools/ddd/lib/state-exposure/request.ts](../../../../../../../ddd/tools/ddd/lib/state-exposure/request.ts) |
| FR1.1 | OK | 直接対応を補完・検査済み | u2-language-state-verification | [ddd/tools/ddd/lib/state-exposure/request.ts](../../../../../../../ddd/tools/ddd/lib/state-exposure/request.ts) |
| FR1.2 | OK | 直接対応を補完・検査済み | u2-language-state-verification | [ddd/tools/ddd/lib/state-exposure/request.ts](../../../../../../../ddd/tools/ddd/lib/state-exposure/request.ts) |
| FR2 | OK | 直接対応を補完・検査済み | u2-language-state-verification | [ddd/tests/state-exposure-rust.test.ts](../../../../../../../ddd/tests/state-exposure-rust.test.ts) |
| FR2.1 | OK | 直接対応を補完・検査済み | u2-language-state-verification | [ddd/tests/state-exposure-rust.test.ts](../../../../../../../ddd/tests/state-exposure-rust.test.ts) |
| FR2.2 | OK | 直接対応を補完・検査済み | u2-language-state-verification | [ddd/tests/state-exposure-rust.test.ts](../../../../../../../ddd/tests/state-exposure-rust.test.ts) |
| FR3 | OK | 直接対応を補完・検査済み | u2-language-state-verification | [ddd/tests/state-exposure-typescript.test.ts](../../../../../../../ddd/tests/state-exposure-typescript.test.ts) |
| FR3.1 | OK | 直接対応を補完・検査済み | u2-language-state-verification | [ddd/tests/state-exposure-typescript.test.ts](../../../../../../../ddd/tests/state-exposure-typescript.test.ts) |
| FR3.2 | OK | 直接対応を補完・検査済み | u2-language-state-verification | [ddd/tests/state-exposure-typescript.test.ts](../../../../../../../ddd/tests/state-exposure-typescript.test.ts) |
| FR3.3 | OK | 直接対応を補完・検査済み | u2-language-state-verification | [ddd/tests/state-exposure-typescript.test.ts](../../../../../../../ddd/tests/state-exposure-typescript.test.ts) |
| FR4 | OK | 直接対応を補完・検査済み | u2-language-state-verification | [ddd/tests/state-exposure-contract.test.ts](../../../../../../../ddd/tests/state-exposure-contract.test.ts) |
| FR4.1 | OK | 直接対応を補完・検査済み | u2-language-state-verification | [ddd/tests/state-exposure-contract.test.ts](../../../../../../../ddd/tests/state-exposure-contract.test.ts) |
| FR4.2 | OK | 直接対応を補完・検査済み | u2-language-state-verification | [ddd/tests/state-exposure-contract.test.ts](../../../../../../../ddd/tests/state-exposure-contract.test.ts) |
| FR4.3 | OK | 直接対応を補完・検査済み | u2-language-state-verification | [ddd/tests/state-exposure-contract.test.ts](../../../../../../../ddd/tests/state-exposure-contract.test.ts) |
| FR5 | OK | 直接対応を補完・検査済み | u2-language-state-verification | [ddd/tests/state-exposure-inspection.test.ts](../../../../../../../ddd/tests/state-exposure-inspection.test.ts) |
| FR5.1 | OK | 直接対応を補完・検査済み | u2-language-state-verification | [ddd/tests/state-exposure-inspection.test.ts](../../../../../../../ddd/tests/state-exposure-inspection.test.ts) |
| FR5.2 | OK | 直接対応を補完・検査済み | u2-language-state-verification | [ddd/tests/state-exposure-inspection.test.ts](../../../../../../../ddd/tests/state-exposure-inspection.test.ts) |
| FR5.3 | OK | 直接対応を補完・検査済み | u2-language-state-verification | [ddd/tests/state-exposure-inspection.test.ts](../../../../../../../ddd/tests/state-exposure-inspection.test.ts) |
| FR6 | OK | 直接対応を補完・検査済み | u2-language-state-verification | [ddd/tests/state-exposure-verification.test.ts](../../../../../../../ddd/tests/state-exposure-verification.test.ts) |
| FR6.1 | OK | 直接対応を補完・検査済み | u2-language-state-verification | [ddd/tests/state-exposure-verification.test.ts](../../../../../../../ddd/tests/state-exposure-verification.test.ts) |
| FR6.2 | OK | 直接対応を補完・検査済み | u2-language-state-verification | [ddd/tests/state-exposure-verification.test.ts](../../../../../../../ddd/tests/state-exposure-verification.test.ts) |
| NFR1 | OK | 直接対応を補完・検査済み | u2-language-state-verification | [ddd/tests/state-exposure-verification.test.ts](../../../../../../../ddd/tests/state-exposure-verification.test.ts) |
| NFR2 | OK | 直接対応を補完・検査済み | u2-language-state-verification | [ddd/scripts/verify-rust-syn.ts](../../../../../../../ddd/scripts/verify-rust-syn.ts) |
| NFR3 | OK | 直接対応を補完・検査済み | u2-language-state-verification | [ddd/tools/ddd/lib/state-exposure/index.ts](../../../../../../../ddd/tools/ddd/lib/state-exposure/index.ts) |
| AC1.1.1 | OK | 元のUnit OK行へ直接 | u2-language-state-verification | [ddd/tests/state-exposure-rust.test.ts](../../../../../../../ddd/tests/state-exposure-rust.test.ts) |
| AC1.1.2 | OK | 元のUnit OK行へ直接 | u2-language-state-verification | [ddd/tests/state-exposure-rust.test.ts](../../../../../../../ddd/tests/state-exposure-rust.test.ts) |
| AC1.1.3 | OK | 元のUnit OK行へ直接 | u2-language-state-verification | [ddd/tests/state-exposure-rust.test.ts](../../../../../../../ddd/tests/state-exposure-rust.test.ts) |
| AC1.1.4 | OK | 元のUnit OK行へ直接 | u2-language-state-verification | [ddd/tests/state-exposure-rust.test.ts](../../../../../../../ddd/tests/state-exposure-rust.test.ts) |
| AC1.1.5 | OK | 元のUnit OK行へ直接 | u2-language-state-verification | [ddd/tests/state-exposure-rust.test.ts](../../../../../../../ddd/tests/state-exposure-rust.test.ts) |
| AC1.2.1 | OK | 元のUnit OK行へ直接 | u2-language-state-verification | [ddd/tests/state-exposure-typescript.test.ts](../../../../../../../ddd/tests/state-exposure-typescript.test.ts) |
| AC1.2.2 | OK | 元のUnit OK行へ直接 | u2-language-state-verification | [ddd/tests/state-exposure-typescript.test.ts](../../../../../../../ddd/tests/state-exposure-typescript.test.ts) |
| AC1.2.3 | OK | 元のUnit OK行へ直接 | u2-language-state-verification | [ddd/tests/state-exposure-typescript.test.ts](../../../../../../../ddd/tests/state-exposure-typescript.test.ts) |
| AC1.2.4 | OK | 元のUnit OK行へ直接 | u2-language-state-verification | [ddd/tests/state-exposure-typescript.test.ts](../../../../../../../ddd/tests/state-exposure-typescript.test.ts) |
| AC1.2.5 | OK | 元のUnit OK行へ直接 | u2-language-state-verification | [ddd/tests/state-exposure-typescript.test.ts](../../../../../../../ddd/tests/state-exposure-typescript.test.ts) |
| AC1.3.1 | OK | 元のUnit OK行へ直接 | u1-state-exposure-inspection | [ddd/tools/ddd/lib/state-exposure/request.ts](../../../../../../../ddd/tools/ddd/lib/state-exposure/request.ts) |
| AC1.3.2 | OK | 元のUnit OK行へ直接 | u1-state-exposure-inspection | [ddd/tools/ddd/lib/state-exposure/inspection.ts](../../../../../../../ddd/tools/ddd/lib/state-exposure/inspection.ts) |
| AC1.3.3 | OK | 元のUnit OK行へ直接 | u1-state-exposure-inspection | [ddd/tools/ddd/lib/state-exposure/inspection.ts](../../../../../../../ddd/tools/ddd/lib/state-exposure/inspection.ts) |
| AC1.3.4 | OK | 元のUnit OK行へ直接 | u1-state-exposure-inspection | [ddd/tools/ddd/lib/state-exposure/canonical.ts](../../../../../../../ddd/tools/ddd/lib/state-exposure/canonical.ts) |
| AC1.3.5 | OK | 元のUnit OK行へ直接 | u1-state-exposure-inspection | [ddd/tools/ddd/lib/state-exposure/evidence.ts](../../../../../../../ddd/tools/ddd/lib/state-exposure/evidence.ts) |
| AC1.3.6 | OK | 元のUnit OK行へ直接 | u1-state-exposure-inspection | [ddd/tools/ddd/lib/state-exposure/evidence.ts](../../../../../../../ddd/tools/ddd/lib/state-exposure/evidence.ts) |
| AC1.3.7 | OK | 元のUnit OK行へ直接 | u1-state-exposure-inspection | [ddd/tools/ddd/lib/state-exposure/index.ts](../../../../../../../ddd/tools/ddd/lib/state-exposure/index.ts) |
| AC1.4.1 | OK | 元のUnit OK行へ直接 | u2-language-state-verification | [ddd/tests/state-exposure-verification.test.ts](../../../../../../../ddd/tests/state-exposure-verification.test.ts) |
| AC1.4.2 | OK | 元のUnit OK行へ直接 | u2-language-state-verification | [ddd/tests/state-exposure-verification.test.ts](../../../../../../../ddd/tests/state-exposure-verification.test.ts) |
| AC1.4.3 | OK | 元のUnit OK行へ直接 | u2-language-state-verification | [ddd/tests/state-exposure-verification.test.ts](../../../../../../../ddd/tests/state-exposure-verification.test.ts) |
| AC1.4.4 | OK | 元のUnit OK行へ直接 | u2-language-state-verification | [ddd/scripts/verify-rust-syn.ts](../../../../../../../ddd/scripts/verify-rust-syn.ts) |
| AC1.4.5 | OK | 元のUnit OK行へ直接 | u2-language-state-verification | [ddd/tests/state-exposure-contract.test.ts](../../../../../../../ddd/tests/state-exposure-contract.test.ts) |
| AC1.4.6 | OK | 元のUnit OK行へ直接 | u2-language-state-verification | [ddd/scripts/verify-state-exposure.ts](../../../../../../../ddd/scripts/verify-state-exposure.ts) |

## Uncovered Elements and Diagnostic Note

最終の直接照合で未到達のFR/NFR/ACは無い。補完前の直接ID不足24件は今回修正済み。対応表は実装の意味の追跡を提供し、試験自体の成功はtest-results.mdと実行ログで別に確認した。

補完の最初の配置はstage-levelのcode-generation/traceability.jsonだったが、単位別の形式検査器がそのパスからUnitを導出できず検査不能となった。この仮ファイルを残さずU2表へ統合して、適切なUnit形式で再検査した。第三者フレームワークや検査条件は変更していない。最初の検査不能をpassと数えていない。
