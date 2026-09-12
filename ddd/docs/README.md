# DDDプラグインの文書

更新: 2026-09-13。設計規約、実装の実測、残作業を分けて管理する。

| 読みたい内容 | 文書 |
|---|---|
| 何を提供し、どう検証するか | [プラグインREADME](../README.md) |
| 業務語彙によるドメインのパッケージング | [パッケージング契約](domain-packaging-design.md) |
| Rustの型照合・replay・未検査範囲 | [Rustセンサー契約](rust-sensor-contract.md) |
| 成果物名・宣言形式・単独完了の制約 | [成果物契約](artifact-contract.md) |
| 完成までに何を直すか | [残作業と完了条件](completion-tasks.md) |
| どこまで確認したか | [2026-09-13の現状評価](current-state-assessment.md) |
| ドメイン層の規約と境界契約 | [ドメイン層設計](domain-layer-design.md) |
| 再実行・整合性・回復 | [ユースケース層設計](use-case-layer-design.md) |
| CQRS・永続化・RMU | [IA層設計](interface-adapter-layer-design.md) |
| 方針と過去の判断の扱い | [判断記録](decisions.md) |
| AI-DLCとの互換性と未検証事項 | [互換性](framework-compatibility.md) |
| 旧Codex実機検証の来歴 | [過去の検証記録](codex-host-verification.md) |

## 文書の読み分け

設計3文書は、生成するアプリケーションとプラグインが目指す規約を定義する。コードがその規約を満たすかは、実装と実測で判断する。規約の存在を検査完了と読み替えない。

現状評価は調査時点の証拠を保持し、修正後に過去の失敗を成功へ書き換えない。残作業表は現在の進行を管理する。新たな検証結果は日時と対象を添えて更新する。

現行文書は日本語の本文へ一本化した。`.ja.md` は旧リンクを維持する案内ページであり、別仕様を持たない。削除済み参照サブモジュールの保護手順は廃止し、旧Codexの証跡は履歴としてのみ残す。
