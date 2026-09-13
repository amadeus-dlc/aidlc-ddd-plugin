# ビルドとテスト — 実行記録

## Sources

- [U1計画](../u1-state-exposure-inspection/code-generation/code-generation-plan.md)、[U1手順](../u1-state-exposure-inspection/code-generation/unit-test-instructions.md)、[U1結果](../u1-state-exposure-inspection/code-generation/code-summary.md)。
- [U2計画](../u2-language-state-verification/code-generation/code-generation-plan.md)、[U2手順](../u2-language-state-verification/code-generation/unit-test-instructions.md)、[U2結果](../u2-language-state-verification/code-generation/code-summary.md)。
- [要件](../../inception/requirements-analysis/requirements.md)、[ストーリー](../../inception/user-stories/stories.md)。

## Execution Context

2026-09-13 UTC、macOS 26.5.1 arm64、Bun1.3.13、Rust/Cargo1.95.0、TypeScript6.0.3、Biome2.5.12。作業ディレクトリddd。検証中はアプリと成果物の編集を止め、固定ロックを使用した。開始前後68ファイル一致は[source-comparison.json](evidence/source-comparison.json)に記録した。

## Commands and Results

| 記録 | 内容 | 結果 | 根拠 |
|---|---|---|---|
| 01 | frozen-lockfile依存確認 | 終了0、0.020秒 | [log](evidence/01-dependency.log) |
| 02 | Claude/Codex build:all | 両方COMPLETE、終了0 | [log](evidence/02-build.log) |
| 03 | 全体check | 1123 pass、3 skip、0 fail、4224 assertions、1126 tests。全pipeline終了0 | [log](evidence/03-full-check.log) |
| 04/05/06 | U1個別/集合試験 | 112件、26件、集合138件、各0fail | [集合log](evidence/06-u1-state-exposure-inspection.log) |
| 07/08 | U1形式/束ね | 9ファイル形式成功、7モジュール20.48KB、終了0 | [形式](evidence/07-u1-state-exposure-inspection.log)、[束ね](evidence/08-u1-state-exposure-inspection.log) |
| 09/10 | 明示準備/native試験 | check内の同一コマンドで成功。native7件 | [log](evidence/03-full-check.log) |
| 11/12 | U2個別/集合試験 | Rust32、TypeScript53、検証32、集合117件、各0fail | [個別log](evidence/11-u2-language-state-verification.log)、[集合log](evidence/12-u2-language-state-verification.log) |
| 13 | 明示all C2 | 23件全一致、終了0、既定allとのcases一致 | [log](evidence/13-u2-language-state-verification.log)、[比較](evidence/reproducibility.json) |
| 14/15 | strict型検査/U2形式 | 終了0、形式23ファイル修正なし | [型](evidence/14-u2-language-state-verification.log)、[形式](evidence/15-u2-language-state-verification.log) |

[全コマンド記録](evidence/command-results.json)に開始時刻と所要時間を残した。記録11は承認手順の三行のshブロックであり、各Bunの32/53/32 pass・0failをログで確認した。全体checkとUnit集合は同じ試験を含むため、これらを合算した総件数を作らない。

## Existing Rust and Native Comparison

既存三ファイルは15＋10＋54＝79件が全体check内で成功。[集計](evidence/rust-regression-counts.json)は同じログのファイル境界とpass行から取得した。native内部7件も成功。版1比較は31ケース、不正要求6件、実センサー比較4件で成功し、deterministic_output=true。[版1JSON](evidence/rust-v1-comparison.json)へ原出力を抽出した。

新しいネイティブ試験実行ファイルがmainへ入る前にdyld内で待機していることをsampleで確認した。OS保護や試験の上限は変更していない。版1一時コピーのwarmupは139145ms、最初のbatch8ms、warm中央値2ms。これは観測値であり性能目標ではない。

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

## Failures, Skips and Warnings

今回の実行でコマンド失敗、未達成・未検証の適用目標はない。ループバックなし。実装途中の全体check失敗を消して今回成功したことにしておらず、U2の履歴へ保持している。

- `standard isolated completion must reject missing DDD artifacts`：既存のopt-in上流不足確認。DDD_VERIFY_FRAMEWORK_SINGLE未指定のためskip。
- Claude/Codexの`install from the real GitHub main archive`：既存のopt-in外部インストール確認。DDD_VERIFY_REMOTE_INSTALL未指定のため2件skip。
- compose-hook-absent：buildが同梱hookを注入するという案内。plugin validateはVALID、両buildはCOMPLETE、形式検査は107ファイルでエラー・警告なし。

## Coverage and Decision

数値の行カバレッジは設定・測定していない。承認済みTesting Contractはその下限を要求していない。主要ケースと境界、47 IDの対応を[集約対応表](cross-unit-traceability.md)で確認した。性能/可用性/認証等の非適用項目を、実行済みの保証に数えない。結果はローカルの開発用検証経路に限定する。

## Traceability Record Correction

Build and Testの最終直接ID確認で、元のUnit表にFR/NFR24件が記載されていないことを検出した。承認済みの上流対応と実在する実装・試験を根拠にU2対応表へ明示的なOK行を追加した。元の30 AC/BR行、計画、手順、アプリコード、試験は保持した。補完後のUnit形式検査はpass、欠落・孤立・不正targetは0件、最終直接対応は47/47 IDである。

仮のstage-level配置に対する専用検査はUnitを導出できず適用不能だったため、仮ファイルを撤回してU2形式へ統合した。この診断試行は成功に数えず、適切な形式での再検査結果を採用した。記録補完はこの段階の文書整備であり、ビルド・テスト対象68ファイルのハッシュ一致を変えない。
