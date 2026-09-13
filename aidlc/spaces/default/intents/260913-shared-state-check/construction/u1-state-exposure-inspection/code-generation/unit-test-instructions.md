# U1 状態公開の共通検査 — テスト実行手順

## Scope and Setup

作業ディレクトリはddd。既存のBunとbun:test、プロジェクト設定を使う。依存追加・共通設定の変更はU1の作業に含めない。既存のテストソースと設定は確認済みだが、この実装開始前の実行確認は計画承認後に行う。

テストの順序は計画中のTesting Contractに従うtest-afterである。まず該当する実装を作り、続けて試験を書いて実行する。Bunと設定の実行可否は最初の試験実行前に確認する。以下の新規テストファイルは実装と並行して段階的に作成するため、作成前のコマンド成功を主張しない。

## Unit Commands

値・要求・契約検証の試験:

```sh
bun test tests/state-exposure-contract.test.ts
```

規則判定と公開入口の結合試験:

```sh
bun test tests/state-exposure-inspection.test.ts
```

U1全体の専用試験:

```sh
bun test tests/state-exposure-contract.test.ts tests/state-exposure-inspection.test.ts
```

静的な形式・規約の確認（ファイル作成後）:

```sh
./node_modules/.bin/biome check --error-on-warnings tools/ddd/lib/state-exposure tests/state-exposure-contract.test.ts tests/state-exposure-inspection.test.ts
```

構文・束ねの確認（公開入口作成後。静的型検査ではない）:

```sh
bun build tools/ddd/lib/state-exposure/index.ts --target bun --format esm --outfile /tmp/aidlc-u1-01a09a8b-smoke.mjs
```

## Coverage and Cases

- StateExposureInspectionの主要な振る舞いを5〜8件以上の試験群で扱い、Standardの指針に加えて必要な境界ケースをデータ駆動で網羅する。単なる件数を満たすための重複試験は作らない。
- 正常、違反、対象未解決、一覧partial、Fact未解決、未解決と確定違反の混在を、それぞれの返却値全体で確認する。
- 要求のキー順同値、設定・本文・対象・版の変更、重複・不正パス・安全整数・Unicode・CRLF等の境界、循環と共有参照を区別する。
- 実行外枠のキー欠落・非JSON値はinput-rejected、response:null・不正なJSON値はcompleted/unresolvedという違いを検証する。
- 正常でもtargetとcheckedEvidenceを比較する。根拠だけの変更や返却後の入力変更が、誤った一致や過去結果の変更にならないことを確認する。
- JSON往復と公開入口の結合を、実際の関数を通して検証する。U2の解析器を起動しない。
- 七ACと十BRをtraceability.jsonで実装または試験ファイルへ結び付ける。新規の数値カバレッジ下限は設定せず、既存の品質条件を弱めない。

## Fixtures and Isolation

固定入力と期待結果は、このUnitの試験ファイルまたはtests/fixtures/state-exposure-inspection/に置く。期待値を検査結果からコピーして作らない。要求識別の期待値を算出する場合も、判定・根拠・理由の期待は別に定義する。外部解析器や本番センサーのモックで共通判定そのものを置き換えない。

各テストは共有する可変状態を持たず、時刻・ランダム値・localeへ判定を依存させない。取得した結果・エラー件数・実行コマンドをcode-summary.mdへ記録する。Rust全体の回帰やU2の型検査は、それぞれの検証経路の実績として別途記録する。
