# DDDプラグインの文書

[English](README.md) | 日本語

更新: 2026-09-13。設計規約、実装の実測、残作業を分けて管理する。

| 読みたい内容 | 文書 |
|---|---|
| 何を提供し、どう検証するか | [プラグインREADME](../README.ja.md) |
| 業務語彙によるドメインのパッケージング | [パッケージング契約](domain-packaging-design.ja.md) |
| センサーごとの正常・異常・境界ケース | [検査契約の対応表](sensor-coverage.ja.md) |
| Rustの型照合・replay・未検査範囲 | [Rustセンサー契約](rust-sensor-contract.ja.md) |
| 成果物名・宣言形式・単独完了の制約 | [成果物契約](artifact-contract.ja.md) |
| 完成までに何を直すか | [残作業と完了条件](completion-tasks.ja.md) |
| どこまで確認したか | [2026-09-13の現状評価](current-state-assessment.ja.md) |
| ドメイン層の規約と境界契約 | [ドメイン層設計](domain-layer-design.ja.md) |
| 再実行・整合性・回復 | [ユースケース層設計](use-case-layer-design.ja.md) |
| CQRS・永続化・RMU | [インターフェイスアダプタ層設計](interface-adapter-layer-design.ja.md) |
| 方針と過去の判断の扱い | [判断記録](decisions.ja.md) |
| AI-DLCとの互換性と未検証事項 | [互換性](framework-compatibility.ja.md) |
| 旧Codex実機検証の来歴 | [過去の検証記録](codex-host-verification.ja.md) |

## 文書の読み分け

設計3文書は、生成するアプリケーションとプラグインが目指す規約を定義する。コードがその規約を満たすかは、実装と実測で判断する。規約の存在を検査完了と読み替えない。

現状評価は調査時点の証拠を保持し、修正後に過去の失敗を成功へ書き換えない。残作業表は現在の進行を管理する。新たな検証結果は日時と対象を添えて更新する。

knowledge、sensors、stages、contributionsは英語のみとする。それ以外のプラグイン文書・利用ガイドは英語の `.md` と日本語の `.ja.md` に同じ内容の本文を用意する。`aidlc/` の記録は日本語を維持する。
