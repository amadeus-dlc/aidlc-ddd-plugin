# ddd テスト

[English](README.md) | 日本語

プラグインルート（`ddd/`）で `bun install && bun test` で実行します。ユニットとゴールデンの suite はフレームワークのサブモジュール無しで通ります。既存のハーネスアダプタの 2 suite は `aidlc-workflows` の dist fixture を必要とします。

## suite 一覧

- `u1-sensor-foundation.test.ts` — スキーマライブラリとセンサーランタイム: 要素 ID の文法と段数、`loadDomainModel`（未知キー・重複・必須参照・フェイルクローズ）、`checkCompleteness`、verdict の組み立て（`(file, line, rule_id)` 整列と `finding_id` 採番）、`runSensor`（JSON 1 行・フェイルクローズ・資産欠落で終了 127）。
- `u2-rust-analysis-foundation.test.ts` — Cargo workspace の層判定（members・targets・依存・層の決定表・許可表）と Rust 解析器（structs / impls / fns / uses / calls / constructions、解析エラー、content-hash キャッシュ）。
- `u4-design-sensors.test.ts` — 設計センサー 6 本を子プロセスで `--stage` / `--output-path` から起動し、各センサーの clean と violation を 1 件ずつ検証。
- `u4-golden.test.ts` — `tests/golden/design/cases.ts` 上のゴールデンランナー、網羅性（宣言 rule ごとに violation ケース）、決定性（3 回でバイト一致）。
- `u5-rust-code-sensors.test.ts` — Rust センサー 3 本を一時 Cargo workspace に対して子プロセスで起動: clean ドメイン、a/b/d/g、SKIP note、h、i、m、n。
- `u5-golden.test.ts` — rust ゴールデン suite（`tests/golden/rust/cases.ts`、各ケースが workspace と record を持つ）、網羅性、決定性。
- `install.test.ts` — インストーラの純関数: 安定 semver 選択、ソースセレクタ、canonical payload ダイジェスト、tarball 展開（安全でないパス検査つき）、ローカル取得、マニフェスト検証。
- `framework-compatibility.test.ts` / `codex-dispatch-bridge.test.ts` — 既存のハーネスアダプタ suite（Codex dispatch bridge、installed-harness patch）。`aidlc-workflows/dist/codex/aidlc` から fixture をコピーするため、dist 未生成の環境では失敗します。`.codex/hooks/` に復元した codex adapter を検証します。

## fixture

- `tests/fixtures/u1/` — U1 ローダー用の正しい／不正な正規モデル。
- `tests/golden/runner.ts` — 共有ゴールデンランナー。ケースを一時 record ディレクトリへ materialize し（rust は workspace も）、実センサースクリプトを子プロセスで起動して verdict の `pass` と `(rule_id, file)` の所見集合全体を比較します。
- `tests/golden/design/cases.ts` / `tests/golden/rust/cases.ts` — ケース表。設計ケースは宣言済みの全設計規則、rust ケースは規則 a〜n をカバーします。

## `bun test` 以外の検証

- `bun run test:dist`（`scripts/verify-dist.ts`）— 設計と Rust の全ゴールデンケースを、**ビルド済み** `dist/<harness>/tools`（ソースではなく投影済み成果物）で実行します。引数でハーネスを絞れます。
- `bun run test:sandbox` — 4 ハーネスをビルドし、各ハーネスを `aidlc-plugin-test --install`（drops 0・グラフ搭載・2 回目 compose が冪等）で compose し、続けて dist 検証を実行します。
- `bun run validate` — プラグインソースに `aidlc-plugin-validate.ts` を実行。

注: コードセンサーは書き込みで発火するため、センサースクリプトを直接 import するテストは `process.exit` を呼んでしまいます。suite はスクリプトを spawn します（これは実際のディスパッチャ契約でもあります）。
