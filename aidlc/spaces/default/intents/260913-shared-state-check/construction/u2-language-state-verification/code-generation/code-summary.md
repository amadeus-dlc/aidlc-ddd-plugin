# U2 言語別抽出と検証実行 — 実装結果

## Sources

- [承認済み計画](code-generation-plan.md)、[テスト手順](unit-test-instructions.md): test-after、十二手順、変更範囲、固定版と実行条件。
- [機能仕様](../functional-design/functional-spec.md)、[規則](../functional-design/rules.md): BR2.1〜BR2.14、指定型、根拠、実行状態とC2の責務。
- [接続契約](../../../inception/contract-design/contract-summary.md): C1/C2のJSON形式、意味、終了コード。
- [実行証跡](../../../../../../../../ddd/docs/developers/evidence/state-exposure-check.json): 実際の入力、期待値、観測、版、環境、コマンド、診断実行。

## Implementation Summary

RustStateEvidence、TypeScriptStateEvidence、StateExposureVerificationを実装し、U1の公開APIへ接続した。解析器固有の構文木・型は言語別処理内に閉じ、最終判定をU2で再実装していない。検査対象ソースは実行しない。

Rustは既存版1を維持し、内部版2に要求識別、対象経路、原文SHA-256、確定性、完全性、UTF-8位置を追加した。名前付き・タプルの可視性、inline moduleの指定、型名前空間の衝突、条件付きフィールドを扱う。対象全体の成立不明と個別Factの未解決を区別し、独立した公開違反を保持する。synが除去するBOM/shebangの位置差は原文へ補正する。

TypeScriptは固定ソースと固定compiler-owned標準ライブラリだけを読めるCompilerHostでProgramを作り、TypeCheckerで対象・型/valueシンボル・ブランドを確認する。classの実体あるフィールドと直接constructor代入、同名コンパニオンの局所const instance、直接returnとok:true/valueを扱う。内側のメソッドのreturnは生成経路に混ぜない。private/readonlyだけでは非公開としない。ブランド生成はTypeCheckerで固定標準ライブラリのSymbolシンボルと呼出し署名を確認した直接呼出しに限定する。初期値内の入れ子assertion/satisfies、Symbol.for、shadow/alias、別変数・関数経由の生成を拒否する。ブランドの型注釈と初期値が矛盾する場合、別名export、継承、spread、計算名、型アサーション、追えない構築・戻り経路は未解決として残す。

実行管理は終了可能な子プロセスを使い、期限・stdout超過・stderr資源超過でkillした後もcloseを待つ。正の安全な整数の期限を受け付け、32bitのtimer上限を超える値は単調時計と分割予約で扱う。正常終了と応答妥当性を分け、空/空白はresponse:null、不正な非空出力は固定JSON互換値でU1へ渡す。非空のJSON nullも空出力と区別する。

C2は23ケースをcaseId順に報告する。14件が実ソース、9件が制御した実行異常である。異常fixtureの開始標識を確認し、準備不備による別の異常終了を一致扱いしない。期待値は独立した固定仕様で、要求識別だけをC1準備から埋める。正常のtarget/checkedEvidenceを含む全フィールドを比較し、根拠だけの差、未知ID、不正定義、実準備不足を検出する。標準出力はJSON一個、終了コード0/1/2/3である。

## Dependencies and Configuration

採用版はBun 1.3.13、TypeScript 6.0.3、@types/bun 1.3.13、Cargo/rustc 1.95.0、syn 3.0.5、sha2 0.10.9、Biome 2.5.12。環境はmacOS 26.5.1、arm64、Rust hostはaarch64-apple-darwinである。

承認済みの`bun add --dev --exact typescript@6.0 @types/bun@1.3.13`は6.0.3を解決したが、宣言値6.0が残ったため、`typescript@6.0.3`を指定し直してpackage.jsonとbun.lockの完全固定を確認した。以後の`bun install --frozen-lockfile`は変更なしで成功。sha2導入時の明示取得後、準備と版1比較のビルドはhost指定・locked/offlineで行った。

限定tsconfigは既存strict/noUnused等を継承し、U1/U2の実装、試験、スクリプトを対象にする。Biomeに新tsconfigを追加した。checkは既存の4処理を保持し、明示準備、通常全試験、Rust内部試験、版1比較、C2、限定型検査を別のステップとして接続した。

## Verification Results

R-01修正後の最新実績は影響範囲85件とC2全23件である。影響しないRust内部・既存Rust・版1比較は、前回の成功実績を保持し、この修正では再実行していない。

| 検証 | 最終結果 |
|---|---|
| R-01修正前の`bun run test:state-exposure` | 110件成功、0失敗、257 assertions。Rust 32件、TypeScript 46件、検証実行32件 |
| R-01修正後のTypeScript/検証実行2ファイル | 85件成功、0失敗、270 assertions。TypeScript 53件、検証実行32件 |
| Rust内部 `cargo test --locked --offline ... state_evidence` | 7件成功、0失敗 |
| `bun run verify:state-exposure --case all` | 23件全件一致、exit0、stdout単一JSON。再実行で全期待値/観測値が一致 |
| 限定strict TypeScript検査 | exit0、U1依存を含む。条件の無効化・除外なし |
| 変更範囲Biome | 25ファイル、エラー・警告なし |
| Rust `cargo fmt --check` | exit0 |
| U1契約/判定の基準と親補修後 | 138件成功、273 assertions |
| 既存Rust三基準ファイルの実装前後 | ともに79件成功、162 assertions |
| 最終版1比較 | 31ケース、不正要求6件、実センサー比較4件が成功。出力再現性一致 |
| 親による既存scaffold配線試験 | 6件成功、67 assertions |
| 静かな状態でのframework-compatibility再確認 | 2件成功、10 assertions |

親の独立確認も、TypeScript 5項目、Rust 6項目、C2 6項目、大きい期限の追加確認で成功した。BOM・shebang・CRLF・Unicodeの原文位置、同名型衝突、非公開ブランド、局所instance、状態の混在、単一JSONと全フィールド一致を別に確認している。

ブランド初期値に文字列からsymbolへのassertionを置いた誤passを親が再現したため、生成元を標準Symbolへ限定し、正常2形状と不正9形状を10試験で確認した。修正後に110件・C2全23件・strict型検査・Biomeを再実行して成功した。

## R-01 Review Correction

[正式レビューiteration 1](../../../.aidlc-reviews/code-generation/units/u2-language-state-verification/e67b77dd1ffcfde3/1.json)のCritical R-01に対応した。constructorの走査がfunction-likeを無条件で飛ばしていたため、即時arrowと同期callbackに隠れた`Object.assign(this, ...)`で一覧をcomplete、結果をpassにしていた。

constructor内の入れ子関数が`this`を含む場合は、その関数の原文位置を`unsupported-syntax`として一覧の理由へ追加し、partial/unresolvedにする。関数を呼んだかどうかや副作用の関数間解析は推測しない。class.tsが既に保持する別メンバーの確定公開所見は、そのまま結果に残る。通常のインスタンス操作メソッドのreturn、およびthisを捕捉しない局所関数のreturnを生成経路へ混ぜない。

直接呼出し、即時arrow、同期callbackの各経路に公開所見の有無を組み合わせた6試験と、捕捉のない局所returnの正常1試験を追加した。全6入力のsemantic diagnosticsは0で、completed、対象resolved、一覧partial、根拠位置付きunsupported-syntax、確定公開所見の保持を確認した。TypeScript/検証実行の85件、C2全23件、strict型検査、Biome25ファイルが成功した。

指定の`/tmp/aidlc-u2-review-repro.ts`も修正前後に実行した。修正前はdirectがunresolved、arrow/callbackがpass、修正後は3件全てsemantic diagnostics 0のままpartial/unresolvedとなった。生のC1結果を含む前後比較は実行証跡JSONのreviewCorrectionsに保存した。計画、Testing Contract、テスト手順、親のU1三パスとscaffoldは変更していない。manifestは59パスを維持し、BR2.7の代表追跡先をclass/companionと今回の構築経路を含むTypeScript試験ファイルへ更新した。正式レビューの記録・状態は変更していない。

## Integration Corrections and Ownership

U1の初回型検査で、request.tsのLanguageと試験期待値のliteral wideningを検出した。親がrequest.ts、state-exposure-contract.test.ts、state-exposure-inspection.test.tsへ型注釈/import整形のみを追加し、138件を再確認した。親は型注釈/import整形だけをメモリ上で逆変換し、3ファイル全てが変更前SHA-256へ戻ることも確認した。判定処理・入力・期待値は変更していない。

既存u3-plugin-scaffold.test.tsのCHECK_STEPSはcheck配線へ完全一致していたため、親が既存編集を保持して新5項目だけを期待列へ追加した。この4パスの親による統合修正もU2のsource-manifestへ含めた。開始前から存在する無関係な編集、U1のその他のファイル、第三者フレームワークは変更/所有していない。コミット・pushはしていない。

## Diagnostic Runs and Limitations

実装中に開始した全体checkは1099 pass、3 skip、6 fail、1 error、1108 tests、4083 assertions、298.59秒で終了した。これは確定ソースの検証成功ではない。失敗を隠さず、実行証跡へ保存した。

- framework-compatibilityは、並行フックが`.aidlc-hooks-health/*.last`を更新したためlive-mutationを検出した。シェル/ファイル操作を止めた単独再確認は2件成功。
- C2結合は修正前prepareが同一バイナリを再コピーし、OS初回起動待ちを再発させたため試験側期限へ到達した。prepareを冪等にし、固定位置の版probeで準備完了を確認するよう修正。C2の既定30秒は維持した。
- 新しく追加した3境界試験は、全体実行が既にロードした修正前モジュールと後から保存した試験が混在して失敗した。R-01修正前の確定ソース専用110件では成功。
- scaffoldは新しいcheckステップの期待列未更新。親の修正後6件成功。

全体checkの再実行はBuild and Testが静かな確定ソースで担当する。今回の記録で全体checkをgreenと主張しない。

macOSの新規実行ファイル確認でdyld起動待ちを観測した。OS保護は変更していない。準備のビルド上限120秒、配置後版probe上限180秒、版1比較の別枠warmup上限180秒を記録した。修正後の固定位置probeは2ms。版1warmupは初回158157ms、最終138244msだった。従来版1試験の10秒上限・出力期待値は維持し、OS cold startupを解析性能の保証としない。

別OS、一般の型解決、Cargo意味解析、macro展開/cfg選択、操作の副作用/可変参照漏出全般、外部Result、本番切替・配布は未検証である。

## Artifacts and Traceability

英日案内、README接続、実測JSON、固定入力/独立期待値を保存した。source-manifest.jsonは今回の全59アプリケーション変更パスを列挙する。traceability.jsonは16 ACと14 BRの30 IDを、各一つの実在する実装/試験ファイルへ対応付ける。計画はチェックマーカーだけを更新し、Testing Contractとテスト手順は維持した。
