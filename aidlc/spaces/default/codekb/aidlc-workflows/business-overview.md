# ビジネス概要 — aidlc-workflows

## ドメインと目的

`aidlc-workflows` は AI-DLC（AI-Driven Development Life Cycle）v2 のエンジン本体である。本ワークスペースには git submodule として vendored されている。

解こうとしている問題は「エージェントに任せた開発が、記録も承認もないまま進んでしまう」こと。エンジンはソフトウェア開発ライフサイクル全体を**順序づけられたステージの有向グラフ**として定義し、各ステージの実行・レビュー・人間承認ゲート・監査ログを決定論的なツール群で強制する。LLM は判断と文章生成を担い、状態遷移・順序・検証はツール側に閉じ込める、という役割分担が中核の設計思想である。

## 主要な提供価値

1. **ステージグラフによるライフサイクル定義** — ideation / inception / construction / operation / initialization の 5 フェーズ、コア 33 ステージ。ステージは Markdown ファイル 1 本（YAML frontmatter + 手順本文）として表現される。
2. **スコープによる可変な重さ** — `express` から `enterprise` まで 11 スコープが、どのステージを EXECUTE / SKIP するかのグリッドを決める。同じライフサイクル定義を軽い変更にも大規模開発にも当てられる。
3. **人間ゲートと監査** — すべてのステージ遷移は承認ゲートを伴い、監査シャードに追記される。
4. **センサーによる自動検証** — 成果物の書き込み時またはゲート時に決定論的チェックが走り、`blocking` 判定はゲートを閉じる。
5. **8 ハーネスへの投影** — 同一のライフサイクル定義を Claude / Codex / Copilot / Cursor / Kimi / Kiro / Kiro-IDE / OpenCode それぞれのネイティブ形式へ投影する（`harness/<name>/manifest.ts` が真実源）。
6. **プラグインによる開放** — サードパーティがステージ・スコープ・エージェント・センサー・ナレッジ・コントリビューションを追加できる。

## 本件にとっての意味

本作業（インテント `260910-ddd-plugin`）は AI-DLC v2 向けの **DDD プラグイン** を作る。したがってこのリポジトリは「作る対象」ではなく「拡張先のプラットフォーム」であり、知識ベースの重心はプラグイン拡張機構に置いてある。ビジネス的に言えば、DDD プラグインは上記 (1)(2)(6) の交点に価値を足す試み — コアの `domain-design` ステージに DDD の設計語彙（集約・エンティティ・値オブジェクト・境界づけられたコンテキスト）を持ち込み、DDD 固有の成果物を生む、という形になる。

## 主要ユーザー

- **ライフサイクル利用者** — スコープを選んでワークフローを走らせる開発チーム。
- **ハーネス実装者** — 新しい CLI / IDE に AI-DLC を投影する担当（`docs/harness-engineering/`）。
- **プラグイン作者** — 本件の立ち位置。契約は `docs/reference/18-plugin-mechanism.md`（613 行）が正典。

## 出典

- 開発者スキャン: `aidlc/spaces/default/intents/260910-ddd-plugin/inception/reverse-engineering/developer-scan-aidlc-workflows.md`
- `docs/reference/18-plugin-mechanism.md`, `docs/reference/15-stage-definition.md`, `core/aidlc-common/protocols/stage-definition.md`
