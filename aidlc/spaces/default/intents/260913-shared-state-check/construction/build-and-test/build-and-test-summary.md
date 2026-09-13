# ビルドとテスト — 検証結果

## Sources

- [U1計画](../u1-state-exposure-inspection/code-generation/code-generation-plan.md)、[U1手順](../u1-state-exposure-inspection/code-generation/unit-test-instructions.md)、[U1結果](../u1-state-exposure-inspection/code-generation/code-summary.md)。
- [U2計画](../u2-language-state-verification/code-generation/code-generation-plan.md)、[U2手順](../u2-language-state-verification/code-generation/unit-test-instructions.md)、[U2結果](../u2-language-state-verification/code-generation/code-summary.md)。
- [要件](../../inception/requirements-analysis/requirements.md)、[ストーリー](../../inception/user-stories/stories.md)。

## Result

確定したソースでbuild:allとcheckが成功した。Claude/Codex両ビルド、全体1123件成功・3件スキップ・失敗0件、Rust内部7件、版1比較、新C2、限定strict型検査まで実行した。checkの所要時間は536.529秒であり、ネイティブ実行ファイルのOS初回起動待ちを含む。

承認済みUnit手順も実行した。U1は112＋26の138件、U2は32＋53＋32の117件。個別と集合コマンドの重複実行を件数へ二重加算していない。手順とbuildの17種類のコマンドを15記録で管理し、3つの個別Bunコマンドは一つのshブロックとして記録、prepareとnative試験はcheck内の同一コマンド実績を参照した。全コマンド記録は[evidence/command-results.json](evidence/command-results.json)。

C2の既定allと明示allの23ケースは、期待値・観測値・根拠・順序が一致した。マニフェストで指定された68個の固有ファイルは実行前後でSHA-256一致した。

## Target Inventory

適用するnfr-requirements/nfr-design成果物は存在せず、選択計画で省略されている。両Unitの承認済みTesting Contract（同一ハッシュ）のStandard、test-after、主要ケースと重要境界、既存suite維持を適用した。要件NFR1〜NFR3に加え、計画・実行契約の期限/入力上限を確認した。新しいカバレッジ数値下限を導入していない。

性能SLO、可用性、認証、配備先の数値目標は要件で設定していない。performance/securityの追加試験セットはN/Aと明示し、入力・実行境界の実在する試験結果と区別した。後続の検証ステージへ未検証の目標を先送りしていない。

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| TC-EXISTING | 両計画/Testing Contract scope_floor | 既存suiteとcheck成功 | 1123 pass / 3既存skip / 0 fail、全check終了0 | [全体ログ](evidence/03-full-check.log) | build-and-test | Met |
| TC-VOLUME | 両計画/Testing Contract strategy_volume | 四構成要素の主要ケース五〜八件以上 | 共通138、Rust32、TypeScript53、検証32。正常/異常/境界を含む | [U1](evidence/06-u1-state-exposure-inspection.log)、[U2](evidence/12-u2-language-state-verification.log) | build-and-test | Met |
| TC-BOUNDARY | 両計画/Testing Contract strategy_volume | 実際のU1/U2結合 | C2実ソース14＋制御異常9の23件全一致、CLI境界試験も成功 | [C2](evidence/c2-explicit-all.json)、[U2](evidence/12-u2-language-state-verification.log) | build-and-test | Met |
| NFR1 | requirements.md/結果の再現性 | 同条件の結果・根拠・順序が一致 | 既定allと明示allのcases全23件とtoolchain一致 | [再現性](evidence/reproducibility.json) | build-and-test | Met |
| NFR2 | requirements.md/既存Rust維持 | 既存Rustと版1比較成功 | 既存79件、版1の31ケース/不正6/実センサー4、再現性一致 | [既存件数](evidence/rust-regression-counts.json)、[版1](evidence/rust-v1-comparison.json) | build-and-test | Met |
| NFR3 | requirements.md/共通境界 | 共通単独実行、strict型検査、解析器型依存なし | U1 138件、7モジュール束ね、strict終了0、importは局所とnode:cryptoのみ | [依存確認](evidence/common-boundary.json)、[型検査](evidence/14-u2-language-state-verification.log) | build-and-test | Met |
| C2-LIMITS | U2計画/実行契約 | 既定30000ms/1048576bytes、安全整数、超過時停止 | 正常/期限/出力/資源超過、32bit超期限の試験が成功 | [実行試験](evidence/11-u2-language-state-verification.log) | build-and-test | Met |
| RUST-INPUT-LIMIT | U2計画/Step 3 | 版1の8MiB入力上限を維持 | 不正要求6件を含む版1検証成功 | [版1](evidence/rust-v1-comparison.json) | build-and-test | Met |
| PREPARATION-BUDGETS | U2結果/実行条件 | ビルド120秒、明示版probe/warmup180秒、版1各試験10秒 | 準備・版1成功。版1ビルド42ms、warmup139145ms、最初のbatch8ms | [全体ログ](evidence/03-full-check.log)、[版1](evidence/rust-v1-comparison.json) | build-and-test | Met |
| CROSS-UNIT-COVERAGE | build-and-test/Step 10 | 全FR/NFR/ACの明示的なOK行と実在target | 47/47 ID。補完後のUnit形式検査pass、不備0 | [集約表](cross-unit-traceability.md)、[検査](evidence/traceability-sensor.json) | build-and-test | Met |

## Cross-Unit Coverage

[cross-unit-traceability.md](cross-unit-traceability.md)へ24要件IDと23 ACの47行を集約した。ACは元のUnitのOK行と実在パスへ直接照合した。FR/NFRの24 IDは承認済みの要件→Story→全AC→UnitのOK経路を根拠に、Build and TestでU2のtraceability.jsonへ直接対応を追加した。これにより47 IDすべてをUnitのOK行と実在ファイルへ直接照合できる。

この補完はcode-generation承認後の記録変更であり、U2対応表の元の16 AC・14 BRは保持し、24要件IDだけを追加した。計画・手順・実装・試験は変更していない。適切なUnit形式でtraceabilityセンサーを再実行し、欠落・孤立・不正な対応先は全て0件。判定はpassだった。[検査結果](evidence/traceability-sensor.json)。

## Readiness and Limits

ローカルのbuild-ready/test-readyを確認した。本番切替・配布・別OSは範囲外であり、deployment-readyとはしない。アプリコードをこの段階では修正していない。実装時の失敗はU2の記録に保持し、今回の確定ソースでの成功と区別する。

既存の任意試験3件は未実行：上流フレームワーク2.8.2の既知の不足を確認する1件と、GitHub mainからの実インストール2件。今回の状態公開試験はスキップなし。plugin validate/buildのcompose-hook-absentは同梱hookをbuildで注入するという既存の案内で、エラー0、VALID/COMPLETEだった。独立の脆弱性データベース照合や一般の動的状態解析を実施したとは主張しない。
