# リバースエンジニアリングの調査時点

## Analysis Record

- 統合文書作成時刻: 2026-09-13T07:38:17Z
- アクティブな空間: `default`
- intent: `shared-state-check`
- 記録ディレクトリ: `aidlc/spaces/default/intents/260913-shared-state-check/`
- 対象リポジトリ: ワークスペース直下の未登録リポジトリ。engineの保存先識別は`base`
- 調査深度: Standard
- 調査の種類: 初回の部分調査、既存ストアなし
- 確認時のGit HEAD: `65011b0b43e3c76f1d5d50521c16a8047960e23a`
- 調査前のソース照合値: `git:efdfe097f4aadb7b338b5d4636ca10739a614cd7`
- 調査前のストア世代: `none`
- 調査前のスナップショット範囲: `ddd/`

Git HEADは履歴の位置を示し、調査前のソース照合値とは別の値である。ソース照合値は依頼で渡されたものを変更せず、公開時の比較に使用する。下記fingerprintは詳細調査した25ファイルを対象としてengineのmintコマンドで発行した。

## Coverage Notes

開発者の[現試行の調査記録](../../intents/260913-shared-state-check/inception/reverse-engineering/developer-scan.md)を統合した。詳細調査対象は個別ファイルで記録し、広いディレクトリを深読済みとはしない。浅い範囲に含まれる個別ファイルでも、下記analyzedに挙げたものだけは詳細調査済みである。

試作の保存済み結果と今回新たに実行した25件の回帰テストは[品質評価](code-quality-assessment.md)で区別した。TypeScript解析器・共通検査経路は未実装である。第三者フレームワーク、ルートCI、全プラグインの網羅的な設計調査は行っていない。

## Scope of Analysis

```yaml
scope_version: 1
kind: partial
intent: shared-state-check
fingerprint: 1b22af58575b819905c4ede73cbad9e69b087eb8
analyzed:
  paths:
    - ddd/package.json
    - ddd/bun.lock
    - ddd/biome.json
    - ddd/tsconfig.json
    - ddd/experiments/rust-syn/Cargo.toml
    - ddd/experiments/rust-syn/Cargo.lock
    - ddd/experiments/rust-syn/src/main.rs
    - ddd/experiments/rust-syn/src/analysis.rs
    - ddd/experiments/rust-syn/cases.json
    - ddd/scripts/verify-rust-syn.ts
    - ddd/tools/ddd-sensor-rust-domain.ts
    - ddd/tools/ddd/lib/shared/findings.ts
    - ddd/tools/ddd/lib/runtime/runtime.ts
    - ddd/tools/ddd/lib/rust/analyzer.ts
    - ddd/tools/ddd/lib/rules/types.ts
    - ddd/tools/ddd/lib/rules/definitions.ts
    - ddd/tools/ddd/lib/rules/context.ts
    - ddd/tools/ddd/lib/rules/evaluate.ts
    - ddd/tools/ddd/lib/rules/rust/evaluators.ts
    - ddd/tests/u2-rust-analysis-foundation.test.ts
    - ddd/tests/u5-rust-code-sensors.test.ts
    - ddd/tests/u5-golden.test.ts
    - ddd/tests/README.ja.md
    - ddd/docs/developers/inspection-contract-design.ja.md
    - ddd/docs/developers/rust-syn-spike.ja.md
  components:
    - 開発コマンド設定
    - 本番Rustセンサー実行
    - Rust構文抽出
    - 規則評価
    - 所見出力
    - syn解析試作
    - 試作比較検証
    - Rust回帰検証
shallow:
  paths:
    - ddd/docs/developers/
    - ddd/tests/golden/
    - ddd/tools/ddd/lib/
    - ddd/src/
    - ddd/scripts/
```
