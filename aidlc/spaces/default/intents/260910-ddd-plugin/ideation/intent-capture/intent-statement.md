# Intent Statement — DDD プラグイン

## Sources

- [desc] Initial description: "DDDプラグインを開発してください。\nddd/docs/domain-layer-design.md\nddd/docs/use-case-layer-design.md\nddd/docs/interface-adapter-layer-design.md"
- [scope] Workflow-selected scope: `plugin-dev`.
- [Q1]〜[Q8] `intent-capture-questions.md` の確認済み回答。

---

## Problem Statement

AI-DLC の標準ワークフローには DDD の設計工程がなく、Domain Primitive／Always Valid Domain Model が作られないまま実装に進んでしまう。加えて、設計ドキュメントに DDD のルールを書いても、生成されるコードがそれに従っているかを機械的に検証する手段がない。この**設計工程の欠落と検証手段の欠落の両方**が解決対象である。 [Q1]

作るものは、DDD／クリーンアーキテクチャを実現するときに機能するガイドとガードレールを提供する AI-DLC v2 プラグインである。 [Q1] [desc]

## Target Customer

OSS として外部に公開し、**AI-DLC 利用者一般**に届ける。 [Q2]

利用者が得るものは、DDD の設計工程がワークフローに組み込まれること（ガイド）と、設計・生成コードの双方が規約に違反していないことを機械的に検証できること（ガードレール）である。 [Q1] [desc]

## Success Metrics

以下の4つすべてを成功の判断基準とする。 [Q3]

| # | 指標 | 判定 |
|---|------|------|
| SM1 | DDD の設計工程がワークフローの一部として実行され、設計モデルが成果物として残る | 設計工程が完了し、その成果物が存在すること [Q3] |
| SM2 | 規約違反が機械的に検出され、違反を含んだまま先へ進めない | 違反を含む入力で承認に進めないこと [Q3] |
| SM3 | 生成されたコードが Always Valid Domain Model の規約に違反しない | 検証が通過すること [Q3] |
| SM4 | 実プロジェクトに適用して、DDD 設計の手戻りが減る | 適用後の観測（測定方法は未定義 [assumption]） |

SM1〜SM3 を実現する具体的な手段（工程の名称、成果物のファイル名、対象言語、検証の仕組み）は、確定済みの設計ドキュメントに記述されており、後続ステージで詳細化する。 [Q8]

## Initiative Trigger

**AI-DLC v2 のプラグイン機構が使えるようになり、実現可能になったから。** [Q4]

## Initial Scope Signal

- **Workflow-selected scope**: `plugin-dev`（workflow-selected） [scope]
- **User-confirmed product boundary**: `plugin-dev` の範囲と一致することを利用者が確認済み。範囲を狭める意図はない。 [Q7]
- **今回の実装対象**: ドメイン層・ユースケース層・インターフェイスアダプタ層の**3層すべて**。3本の設計ドキュメントはいずれも確定済みであり、その内容を実装する。 [Q8]

## Assumptions & Open Questions

- SM4「実プロジェクトで DDD 設計の手戻りが減る」の測定方法は確定していない。指標として採用することは確認済みだが、何をもって「減った」と判定するかは定義されていない。 [assumption]
- 3本の設計ドキュメントの技術的内容は、確定済みの設計として本ワークフローで実装対象になることのみ確認されている。個々の技術判断そのものは本ステージの確認対象ではなく、後続ステージで詳細化される。 [assumption]
