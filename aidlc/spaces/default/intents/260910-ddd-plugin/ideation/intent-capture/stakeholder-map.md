# Stakeholder Map — DDD プラグイン

## Sources

- [desc] Initial description: "DDDプラグインを開発してください。\nddd/docs/domain-layer-design.md\nddd/docs/use-case-layer-design.md\nddd/docs/interface-adapter-layer-design.md"
- [scope] Workflow-selected scope: `plugin-dev`.
- [Q1] [Q2] [Q5] [Q6] `intent-capture-questions.md` の確認済み回答。

---

## Key Stakeholders

| ステークホルダー | 関心事 | Source |
|---|---|---|
| 開発者本人 | プラグインの設計・実装・公開を単独で担う | [Q5] |
| AI-DLC 利用者一般 | OSS 公開の届け先として確認されている。関心事そのものを尋ねた設問はなく、未特定 | [Q2] |

**関心事は未確認**: いずれのステークホルダーについても、関心事そのものを尋ねた設問はない。「開発者本人が単独で担う」は Q5（関係者）の回答、「AI-DLC 利用者一般が届け先である」は Q2（利用者範囲）の回答であり、どちらも役割・範囲の確認であって関心事の確認ではない。 [Q5] [Q2]

## Decision-makers vs. Influencers

| 区分 | 該当 | Source |
|---|---|---|
| 意思決定者 | 開発者本人（単独） | [Q5] |
| 実装者 | 開発者本人（単独） | [Q5] |
| 影響を与える人 | なし（他の関係者はいない） | [Q5] |

承認を要する外部の意思決定者は存在しない。合議の対象でもない。 [Q5]

## Communication Requirements

| 項目 | 内容 | Source |
|---|---|---|
| 報告先 | なし | [Q6] |
| 報告頻度・定例 | なし | [Q6] |

進捗の報告や共有の要件は設定されていない。 [Q6]

## Assumptions & Open Questions

- AI-DLC 利用者一般が「DDD／クリーンアーキテクチャの設計工程と検証を自分のプロジェクトで使えること」に関心を持つ、という想定は、Q1（業務課題）と Q2（利用者範囲）の回答を組み合わせた**推論**である。関心事そのものを尋ねた確認済み回答は存在しない。 [assumption]
- OSS 公開先である AI-DLC 利用者一般について、具体的なペルソナ、想定利用規模、フィードバック経路、公開後の受け入れ体制（Issue 対応、コントリビューション方針など）は未定義。 [assumption]
