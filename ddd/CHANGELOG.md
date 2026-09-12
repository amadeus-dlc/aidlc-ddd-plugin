# Changelog

All notable changes to the `ddd` plugin are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## 未リリース — T-07のパッケージング（2026-09-13）

- ユビキタス言語に基づく命名と技術分類の禁止を共有ナレッジ・設計・生成手順へ追加。
- 集約写像のdomain_packagesを必須化し、用語・モデル参照・配置理由を検査。
- 影響するドメインクレートのモジュールをたどり、空・インライン・path属性を含む宣言と実配置を照合。
- Claude/Codexの通常承認テストを追加。移行方法と限界は [契約](docs/domain-packaging-design.md)へ記載。

## 未リリース — T-02のRust判定（2026-09-13）

- 集約とVO、具象ユースケースとポートを明示型で区別し、getter名の衝突も解消。
- 別ファイル・traitのimplを収集し、変更メソッドの所在を報告。
- replay_methodsによるreplay契約を追加し、名前だけの例外を廃止。
- 型照合の限界をnoteと[判定契約](docs/rust-sensor-contract.md)へ明記。フレームワーク配布コードの変更なし。

## 未リリース — T-01の通常承認接続（2026-09-13）

- 正規モデルを標準の登録ファイル名へ統一し、ラベル付きYAMLを読み込む。
- 追加宣言を既存レビュー成果物の必須セクションへ移し、欠落も承認開始時に拒否する。
- Claude/Codexの統合テストを追加。単独完了の標準側の不足は別途再現・記録。

## 未リリース — 文書整理（2026-09-13）

- 設計規約・実測・残作業を分離し、[文書一覧](docs/README.md)を追加。
- kimi・opencodeを対応対象から除外する方針を反映。コードの配布経路整理はT-04に残る。
- 失敗・再実行・イベント・RMUの説明と、ナレッジの検査範囲を訂正。
- 重複翻訳を案内へ統合し、削除済み参照元の保護手順を廃止。
- 以下の0.1.0欄は当時の実装履歴。特に成果物登録を外した判断は、現在の承認接続を保証しない。[現状評価](docs/current-state-assessment.md)を参照。

## [0.1.0] - 2026-09-11

The first implementation of the DDD plugin: a canonical domain-modeling stage,
four core-stage contributions, nine sensors and eight knowledge documents.

### Added

- **domain-modeling stage** (`stages/inception/ddd-domain-modeling.md`): a
  CONDITIONAL inception stage that owns the canonical `domain-model.yaml` (and
  the derived `domain-model.md`), from event discovery through the aggregate
  candidates and the self-check.
- **contributions**: `domain-design` (consumes the canonical model, produces
  the aggregate mapping), `functional-design`, `infrastructure-design` and
  `code-generation`. The design contributions add the declaration instructions
  and bind the design sensors; `code-generation` carries the naming / placement
  / implementation conventions and binds the three Rust sensors.
- **design sensors**: `ddd-model-completeness`, `ddd-model-presence`,
  `ddd-reference-ids`, `ddd-mapping-declarations`, `ddd-layer-structure`
  (blocking) and `ddd-design-advisories` (advisory).
- **Rust code sensors**: `ddd-rust-domain`, `ddd-rust-use-case`,
  `ddd-rust-interface-adapter` (all blocking) implementing rules (a)–(n) and the
  dependency safety net (g).
- **libraries**: `tools/ddd/lib/schema` (the canonical model loader and index),
  `tools/ddd/lib/workspace` (Cargo workspace layer resolution),
  `tools/ddd/lib/rust` (tree-sitter-rust syntax facts),
  `tools/ddd/lib/rules` (the language-neutral rule definitions and the Rust
  evaluators) and `tools/ddd/lib/runtime` (the sensor runtime contract).
- **knowledge**: eight documents under `knowledge/aidlc-{shared,architect-agent,
  developer-agent,aws-platform-agent}/`.
- **vendored assets**: `web-tree-sitter@0.25.10` (MIT) and the
  `tree-sitter-rust` WASM (The Unlicense, ABI 14), with a NOTICE describing
  provenance.

### Notes

- The plugin composes cleanly (`aidlc-plugin-test --install`, claude): 0 drops,
  the stage on the graph, and an idempotent second compose.
- Only the `domain-design` contribution adds a `produces` artifact
  (`ddd-aggregate-mapping`). The `functional-design`, `infrastructure-design` and
  `code-generation` contributions deliberately bind sensors and instructions
  without adding one, because a contributed artifact is applicable to every unit
  kind and would make a core stage with a kind-pruned `review_artifact` fail its
  schema check.
