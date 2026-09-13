# U1 状態公開の共通検査 — 実装記録

## Sources

- [承認済み計画](code-generation-plan.md)と[実行手順](unit-test-instructions.md): 9ステップと専用検証の範囲。
- [機能仕様](../functional-design/functional-spec.md)、[規則](../functional-design/rules.md)、[値モデル](../functional-design/entities.md): BR1.1〜BR1.10。
- [C1契約](../../../inception/contract-design/contract-summary.md): 公開型、入力識別、正常証跡、実行外枠と応答の分類。
- [ストーリー](../../../inception/user-stories/stories.md): AC1.3.1〜AC1.3.7。

## Implementation

承認済みの Testing Contract `sha256:8d7f1a7f51e8e641623b1e21dc4fed305238daeae0eb70f0d7e8c9b1a833a386` に従い、test-after で実装した。値・要求を実装して試験し、実行外枠・応答検証・判定を実装して試験し、公開入口を接続して結合試験を追加した。

アプリケーション側に12ファイルを新規作成した。詳細な一覧は [source-manifest.json](source-manifest.json) に記載した。

- `contract.ts`: C1の共通型、版、規則ID、閉じた理由コード。公開した理由コード一覧は凍結している。
- `canonical.ts`: JSON互換性とUnicode・安全整数の確認、循環と共有参照の区別、複製、Unicodeスカラー値順の比較、正規化JSONとSHA-256。深い入力の検証・複製・正規化は反復走査で行う。
- `request.ts`: 相対POSIXパス、対象と言語表現、ソース・ツールの一意性、本文を変えないUTF-8スナップショット、要求識別の組立てと再検証。
- `locations.ts`: 位置と理由の検証・整列。承認計画が許容する同一ディレクトリの補助ファイルとして分離した。
- `evidence.ts`: 実行外枠、応答版・要求対応、対象・Fact・完全性の実行時検証。既知フィールドだけを複製し、タグと矛盾するフィールドを拒否する。
- `inspection.ts`: 検証済み証跡からの共通判定。未解決時にも確定違反を残し、正常時にも対象と根拠を保持する。
- `index.ts`: 二つの公開関数と共通型の明示export。解析器・ファイル・プロセスへの依存は持たない。
- 契約試験・判定／結合試験・固定値ヘルパー、および英日文書を追加した。

`response` キー欠落と非JSON値は `input-rejected / invalid-request`、`response:null` とJSON互換の不正応答は `evaluated / completed / unresolved` とする。応答不正は `checkedEvidence:null` と空の所見を返し、部分救出しない。妥当な部分証跡は、確定違反と未解決理由の両方を返す。`pass` も対象・完全性・非公開／不在の位置を保持する。

元の入力や可変配列は変更せず、返却値と共有しない。要求識別には設定の全キーを含める。所見・メンバー・根拠・理由はC1の順序に整列し、重複した根拠と理由は保持する。`localeCompare` は使っていない。

## Verification

環境は Darwin 25.5.0 arm64、Bun 1.3.13、Biome 2.5.12。以下はこの担当が実際に実行したコマンドと結果である。特記のない検証コマンドの作業ディレクトリは `ddd/`。

| 段階 | 実行コマンド | 結果 |
| --- | --- | --- |
| 開始前 | `bun --version` | 1.3.13 |
| 開始前 | `./node_modules/.bin/biome --version` | 2.5.12 |
| Step 1 | `bun test tests/u2-rust-analysis-foundation.test.ts tests/u5-rust-code-sensors.test.ts tests/u5-golden.test.ts` | 79 pass、0 fail、162 assertions、終了0 |
| Step 3 初回 | `bun test tests/state-exposure-contract.test.ts`（初回のみリポジトリルートから探索実行） | 52 pass、2 fail、165 assertions、終了1 |
| Step 3 原因確認 | `bun test tests/state-exposure-contract.test.ts -t 'prepares the exact'` | 0 pass、1 fail、53 filtered、1 assertion、終了1 |
| Step 3 修正後 | `bun test tests/state-exposure-contract.test.ts` | 54 pass、0 fail、166 assertions、終了0 |
| Step 5 | `bun test tests/state-exposure-contract.test.ts tests/state-exposure-inspection.test.ts` | 128 pass、0 fail、247 assertions |
| Step 7 | `bun test tests/state-exposure-inspection.test.ts` | 26 pass、0 fail、42 assertions |
| Step 8 初回 | `./node_modules/.bin/biome check --error-on-warnings tools/ddd/lib/state-exposure tests/state-exposure-contract.test.ts tests/state-exposure-inspection.test.ts` | 9ファイル、書式・import順の14 errors、終了1 |
| Step 8 整形 | `./node_modules/.bin/biome check --write tools/ddd/lib/state-exposure tests/state-exposure-contract.test.ts tests/state-exposure-inspection.test.ts` | 9ファイルを整形、終了0 |
| Step 8 最終 | `./node_modules/.bin/biome check --error-on-warnings tools/ddd/lib/state-exposure tests/state-exposure-contract.test.ts tests/state-exposure-inspection.test.ts` | 9ファイル、修正・エラー・警告なし、終了0 |
| Step 8 最終 | `bun test tests/state-exposure-contract.test.ts tests/state-exposure-inspection.test.ts` | 138 pass、0 fail、273 assertions、終了0 |
| Step 8 | `bun build tools/ddd/lib/state-exposure/index.ts --target bun --format esm --outfile /tmp/aidlc-u1-01a09a8b-smoke.mjs` | 7モジュール、20.48 KB、終了0 |
| Step 8 回帰 | `bun test tests/u2-rust-analysis-foundation.test.ts tests/u5-rust-code-sensors.test.ts tests/u5-golden.test.ts` | 79 pass、0 fail、162 assertions、終了0 |
| Step 9 | `bun /tmp/aidlc-u1-documentation-example.ts` | 文書例のimport先だけ絶対パスにした一時ファイルを実行。`evaluated / completed / pass` と対象証跡を確認、終了0 |

初回に失敗した2件は固定入力の期待バイト数の誤りだった。`struct Model { value: i32 }` と末尾LFは28バイト、混合改行の固定文字列は15バイトである。本文を数え直して期待定数を27→28、14→15に修正した。実装や既存試験を緩めた修正ではない。

138件には、安全整数・不正Unicode・深さ12,000のJSON・共有参照と循環・数値風キーと非BMP文字の正規化順・CRLF等のスナップショット・要求の整列と識別・応答欠落とnull・未知版・識別不一致・不正Fact・完全性・位置境界・全体不採用・確定違反と未解決の混在・起動不能と失敗を含む。正常の根拠だけの差、JSON往復、入力変更からの独立性、Rust／TypeScript由来の共通値による四つの判定条件も確認した。

既存基準は今回の実行前後とも79件であり、調査記録の25件を最終件数として流用していない。英日文書のローカルリンク先も存在確認した。`git diff --check` は対象を限定して終了0だが、新規未追跡ファイルの形式保証にはBiomeの結果を用いる。

親担当による独立検証として、`bun /tmp/aidlc-u1-independent-probe.ts` の7項目成功の報告を受領した。Pythonで別計算した正規化要求識別とUTF-8スナップショット、正常証跡差・変更独立性、missing／null、不正応答、混在、共有／循環／Date、深いJSONを確認したもの。この担当が実行した試験件数には加算していない。

## Scope and Handoff

U1の変更対象に既存ファイルの修正・削除はない。開始前から存在する `ddd/package.json` 等の編集を維持し、共通設定、ロックファイル、既存Rust本番経路、フレームワーク実装、U2の実装には変更を加えていない。`mise trust` は実行済みで、未信頼設定なしだった。

静的型検査は未実施であり、Bun buildをその代わりの成功実績として扱わない。Compiler API等の依存を導入するU2が、U1とU2を併せて型検査する。Rust／TypeScriptの実ソース抽出、検証CLIと実ツール版の確認もU2の責務である。U1の共通値試験だけでIssue #38全体の完了とはしない。

U1の受入条件に関する既知の未解決事項はない。次は親担当による成果物レビューへ渡し、所見があればその対象を修正する。ライフサイクル報告、承認、単位完了の記録は親担当が行う。

## Traceability

[traceability.json](traceability.json) に七受入条件と十規則を既存の実装・試験パスへ対応付けた。新規カバレッジ数値下限は追加していない。

親担当が実際のtraceabilityセンサーを実行した際、targetの複数パスの連結が単一パスとして扱われ、17件が拒否された。各項目を代表する単一の実装パスへ修正し、再実行で欠落・孤立・不正な対応先がすべて0件となった。実装・試験の内容や受入条件は変更していない。
