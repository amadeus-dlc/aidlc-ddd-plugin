# Domain Design — 確認事項

## Sources

- `inception/requirements-analysis/requirements.md`（FR1〜FR11、NFR1〜NFR10、制約 CON1〜CON12、未解決事項 OQ1〜OQ7）
- コード知識ベース `aidlc/spaces/default/codekb/aidlc-workflows/`（`architecture.md`、`component-inventory.md`、`api-documentation.md`）と `aidlc/spaces/default/codekb/ddd/`（`architecture.md`、`component-inventory.md`）
- エンジン実装の確認結果: `plugins/<name>/tools/` は再帰的に `<harness>/tools/` へコピーされる（`tests/`・`__tests__/`・`fixtures/` と `*.test.ts` は除外）。`fire_on: gate` のセンサーは「ステージが宣言する成果物ごとに1回」発火し、`--output-path <成果物>` を受け取る（Rust ソースの `--file-path` ではない）。

以下は、コンポーネント境界と所有権を決めるために残っている判断だけを聞くものです。要件で確定済みの内容（対象ハーネス、リード、スコープ、層判定規約、実行時依存）は再確認しません。

---

## Q1. センサーをどの単位でマニフェスト（`sensors/aidlc-<id>.md`）に分割しますか？

文脈: 重大度（blocking / advisory）はマニフェスト単位でしか宣言できません。要件は違反ごとの独立検査・独立報告（FR7.12、FR7.13）を求めていますが、これはマニフェスト内部で満たせます。マニフェストが増えるほどゲートでの起動回数と保守対象が増え、減るほど所見の出どころが分かりにくくなります。

- A. 1ルール（(a)〜(n) と設計検査の各項目）につき1マニフェスト。約20本
- B. 層ごと（domain / use-case / interface-adapter）と設計成果物ごとにまとめ、重大度が異なる検査だけ別マニフェストにする。約8本
- C. バインド先ステージごとに1マニフェスト（domain-modeling / domain-design / functional-design / infrastructure-design / code-generation）、重大度別に分割。約7本
- D. 全ルールを1マニフェストにまとめ、内部で全検査を走らせる
- X. Other (please specify)

[Answer]: B. 層ごと・設計成果物ごと（約8本） (Recommended)

---

## Q2. センサー間で共有するコード（Rust 構文解析、層判定、verdict 出力、スキーマ）をどこに置きますか？

文脈: プラグインが投影する実行コードは `tools/` 配下だけで、`src/` は投影されません。`tools/` は再帰的にコピーされるためサブディレクトリも届きますが、コピー先の `<harness>/tools/` は他プラグインやコアと共有の名前空間です。tree-sitter-rust の WASM も同じ経路で届ける必要があります（OQ3）。

- A. `tools/ddd/lib/`（共有ライブラリ）と `tools/ddd/wasm/`（WASM 同梱）に置き、各センサースクリプト `tools/ddd-sensor-<id>.ts` から相対 import する
- B. `src/` を開発時のソースとし、ビルドで各センサースクリプトを単一ファイルにバンドルして `tools/` へ出力する（投影物は自己完結）
- C. 共有せず、各センサースクリプトに必要なコードを複製する
- D. 共有ライブラリを別 npm パッケージとして公開し、各ツールが依存する
- X. Other (please specify)

[Answer]: A. tools/ddd/lib/ と tools/ddd/wasm/ (Recommended)

---

## Q3. Rust コードセンサーは、何を契機に発火し、どのソースファイルを検査対象にしますか？

文脈: ゲート発火のセンサーが受け取るのはステージの成果物パス（記録ディレクトリ内の Markdown/JSON）であり、Rust ソースのパスではありません。`code-generation` は Unit ごとに `source-manifest.json`（生成したソースの申告一覧）を残します。`fire_on: write` で `*.rs` に反応させる方式は advisory 止まりで、SM2 を満たせません。

- A. `code-generation` のゲートで、`code-summary` 成果物を契機に発火し、同じ Unit の `source-manifest.json` が申告する Rust ファイルを検査対象にする。層判定のために Cargo workspace 全体のメタデータは読む
- B. `code-generation` のゲートで発火し、ワークスペース内の全 `*.rs` を毎回走査する（申告一覧は使わない）
- C. `build-and-test` のゲートで発火し、ワークスペース全体を走査する（生成の1ステージ後に止める）
- D. A と C の両方（生成直後に Unit 単位、ビルド後に全体）
- X. Other (please specify)

[Answer]: A. code-generation ゲート + 申告されたソース (Recommended)

---

## Q4. `domain-design` にバインドする「正規モデル存在検査」（FR6.4）は、`domain-modeling` が実行対象かどうかをどう判定しますか？

文脈: この検査は blocking で、`domain-modeling` が SKIP のスコープ（express、poc、bugfix など）では `domain-design` を誤って止めてはいけません（OQ4）。センサーは `--output-path` から記録ディレクトリを辿れます。

- A. 記録ディレクトリの `aidlc-state.md` にある Stage Progress の行（`- [ ] domain-modeling — EXECUTE` / `SKIP`）を読み、EXECUTE のときだけ検査する
- B. ハーネスの `tools/data/scope-grid.json` と `aidlc-state.md` の Scope を突き合わせて判定する
- C. 記録ディレクトリに `inception/domain-modeling/` があるかどうかで判定する
- D. 常に blocking で検査し、SKIP のスコープでは人間の override に任せる
- X. Other (please specify)

[Answer]: A. aidlc-state.md の Stage Progress 行を読む (Recommended)

---

## Q5. composition root（DI 結線）のクレートをどう識別し、層規則から除外しますか？（OQ1）

文脈: 層判定は「接尾辞かディレクトリ配置、どちらにも該当しなければ層不明で違反」と確定しています（FR9.4）。composition root は interface-adapter と use-case の両方に依存する必要があり、層規則の外に置く前提です（設計書 §7-5）。

- A. Cargo の `[[bin]]` ターゲットを持つクレート（実行可能バイナリ）を composition root とみなして層規則から除外する。名前の規約は求めない
- B. 接尾辞 `-composition-root`、またはディレクトリ `packages/composition-root/`（`modules/` も同様）に置かれたクレートのみを除外する
- C. A と B の両方を認める
- D. 除外しない。composition root も interface-adapter 層として扱い、use-case への依存は許可方向なので違反にならない
- X. Other (please specify)

[Answer]: C. bin ターゲットと名前規約の両方 (Recommended)

---

## Q6. CQRS のコマンド側／クエリ側／RMU のサブプロジェクトをどう識別しますか？（OQ2）

文脈: センサー (k)（相互参照禁止）と (l)（クエリ側でのドメイン型参照禁止）は、クレートがどちらの側かを機械的に知る必要があります。層の識別（`-domain` / `-use-case` / `-interface-adapter`）と組み合わせられる形が望ましいです。

- A. クレート名のセグメント `-command-` / `-query-` / `-rmu`（例: `billing-command-use-case`、`billing-query-interface-adapter`、`billing-rmu`）と、ディレクトリ `packages/command/use-case/`・`packages/query/interface-adapter/`・`packages/rmu/` の両方を認める。どちらの印もないクレートは非 CQRS として扱う
- B. 接頭辞 `cmd-` / `qry-` / `rmu-` のみで判定する
- C. `infrastructure-design` の成果物にクレート→側の宣言表を書かせ、センサーはそれを読む
- D. 初版は非 CQRS 構成のみ対応し、(k)(l) は後続に回す
- X. Other (please specify)

[Answer]: A. セグメントとディレクトリの両方 (Recommended)

---

## Q7. ナレッジをどのエージェント配下に配置しますか？（FR10.3）

文脈: `knowledge/<agent-slug>/` はそのエージェントがリードまたはサポートするステージで読み込まれます。`domain-modeling` と `domain-design` のリードは architect、`functional-design` は architect（サポート developer）、`infrastructure-design` は aws-platform、`code-generation` は developer です。`aidlc-shared/` は全エージェントが読むため、置きすぎると毎ステージのコンテキストが重くなります。

- A. architect に基盤ナレッジと設計規約、developer に Rust コード規約、aws-platform に IA 層（永続化基盤・RMU・ポート規約）、`aidlc-shared/` に層境界と依存方向の原則だけを置く
- B. すべて `aidlc-shared/` に置く（配置ミスのリスクがなく、全ステージで同じ規約が見える）
- C. architect と developer のみに置く（aws-platform には置かず、IA 層の規約は fragments で手順に書く）
- D. architect のみに置く（他のエージェントには fragments で手順として渡す）
- X. Other (please specify)

[Answer]: A. 役割ごとに配置 (Recommended)

---

## Q8. `domain-modeling` ステージにレビューアを宣言しますか？（OQ5）

文脈: 設計書 §2 の完了条件 (vi) は人間のレビュー承認です。コアの `aidlc-architecture-reviewer-agent` は Claude Code と Codex CLI の両方に投影済みなので、宣言してもハーネス依存は増えません。

- A. `reviewer: aidlc-architecture-reviewer-agent` を `review_class: advisory`（1回、所見は人間の承認ゲートへ）で宣言する
- B. レビューアを宣言しない（機械条件 (i)〜(v) のセンサーと人間承認のみ）
- C. `review_class: adversarial`（最大2回の修正ループ）で宣言する
- X. Other (please specify)

[Answer]: A. architecture-reviewer を advisory で宣言 (Recommended)

---

## Consolidated Summary Confirmation

- Q1 マニフェスト分割: 層ごと（domain / use-case / interface-adapter）と設計成果物ごとにまとめ、重大度が異なる検査だけ別マニフェストにする。約8本（B）
- Q2 共有コード: `tools/ddd/lib/` に共有ライブラリ、`tools/ddd/wasm/` に tree-sitter-rust の WASM を置き、各センサースクリプト `tools/ddd-sensor-<id>.ts` から相対 import する（A）
- Q3 Rust センサーの発火: `code-generation` のゲートで `code-summary` を契機に発火し、同じ Unit の `source-manifest.json` が申告する Rust ファイルを検査する。層判定のため Cargo workspace 全体のメタデータは読む（A）
- Q4 正規モデル存在検査: 記録ディレクトリの `aidlc-state.md` の Stage Progress 行を読み、`domain-modeling` が EXECUTE のときだけ検査する（A）
- Q5 composition root: Cargo の `[[bin]]` ターゲットを持つクレート、または接尾辞 `-composition-root` ／ディレクトリ `packages/composition-root/` のクレートを層規則から除外する（C）
- Q6 CQRS 側の識別: クレート名のセグメント `-command-` / `-query-` / `-rmu` と、ディレクトリ `packages/command/...` / `packages/query/...` / `packages/rmu/` の両方を認める。印がないクレートは非 CQRS（A）
- Q7 ナレッジ配置: architect に基盤ナレッジと設計規約、developer に Rust コード規約、aws-platform に IA 層の規約、`aidlc-shared/` に層境界と依存方向の原則だけ（A）
- Q8 レビューア: `domain-modeling` に `reviewer: aidlc-architecture-reviewer-agent` を `review_class: advisory` で宣言する（A）

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
