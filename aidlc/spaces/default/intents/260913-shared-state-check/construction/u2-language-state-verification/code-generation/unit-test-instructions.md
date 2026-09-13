# U2 言語別抽出と検証実行 — テスト実行手順

## Scope and Setup

作業ディレクトリはddd。承認済み計画の依存を導入し、Rustの依存は明示的に取得しておく。既存Bunの設定を使い、各実装部分の後に試験を書いて実行する。新規コマンドとファイルは実装後に存在するものであり、現時点の実行成功は主張しない。

## Unit Commands

準備済み依存からRustバイナリを作り、固定参照先へ配置する（fetchは行わない）:
```sh
bun run prepare:state-exposure
```

Rust内部のU2用試験:
```sh
cargo test --locked --offline --manifest-path experiments/rust-syn/Cargo.toml state_evidence
```

U2の構成要素別試験:
```sh
bun test tests/state-exposure-rust.test.ts
bun test tests/state-exposure-typescript.test.ts
bun test tests/state-exposure-verification.test.ts
```

U2専用試験の全体:
```sh
bun test tests/state-exposure-rust.test.ts tests/state-exposure-typescript.test.ts tests/state-exposure-verification.test.ts
```

実際の両言語抽出とU1を結合するC2検証:
```sh
bun run verify:state-exposure --case all
```

今回の共通検査経路だけを対象にする型検査（U1の依存を含む）:
```sh
./node_modules/.bin/tsc --noEmit --project tsconfig.state-exposure.json
```

変更範囲の形式検査:
```sh
./node_modules/.bin/biome check --error-on-warnings tools/ddd/lib/rust/state-evidence tools/ddd/lib/typescript/state-evidence tools/ddd/lib/state-exposure-verification scripts/prepare-state-exposure.ts scripts/verify-state-exposure.ts tests/state-exposure-rust.test.ts tests/state-exposure-typescript.test.ts tests/state-exposure-verification.test.ts package.json tsconfig.state-exposure.json
```

## Cases and Expectations

- Rustは名前付き・タプルの非公開、pub、制限付き公開、対象欠落・曖昧、構文・条件付きの未解決、確定公開と未解決の混在を別ケースにする。
- TypeScriptはclassとコンパニオンの正常・違反・未解決を分ける。局所instanceを成功値で包む合意済み例を含め、内側のメソッドのreturnを生成関数と混同しない。
- 未対応の継承・spread・計算名・型アサーション・戻り経路は、期待した理由と範囲で拒否されることを確認する。ブランドの計算名はシンボル同一性を確認する。
- 正常終了で空出力・不正出力・複数応答を返す実行はcompletedのままC1のunresolvedになる。異常終了・期限・出力上限超過のfailedとは分ける。
- 比較・記録の単独試験には制御された固定結果を使えるが、実際の両言語を通すケースを置き換えない。実ツール不足でシナリオが走らない場合は成功にしない。
- 正常のtarget・checkedEvidence、根拠だけの差、期待と異なる理由の検査不能、JSON往復と再実行の一致を確認する。
- 16 ACと14 BRを単一代表パスで追跡する。三構成要素の主要な振る舞いと必要な境界ケースを満たし、既存品質条件を弱めない。

## Fixtures and Records

固定ソースと期待値はtests/fixtures/state-exposure-languages/に置く。期待値をactualから生成しない。検査対象のソースを実行して状態を調べない。テスト用実行プログラムやワーカーは制御した固定資産とし、利用者のソースと混同しない。

採用したTypeScriptの実際の版、Bunの版、Rustの版、準備・実行コマンド、ケースの成否と未実行をcode-summary.mdと証跡へ記録する。Rustの実バイナリとCompiler APIを使った経路が実行されていない場合に、固定値だけの試験結果で完了扱いしない。
