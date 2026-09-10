# Intent Capture & Framing — 確認事項

## Sources

- [desc] Initial description: "DDDプラグインを開発してください。\nddd/docs/domain-layer-design.md\nddd/docs/use-case-layer-design.md\nddd/docs/interface-adapter-layer-design.md"
- [scope] Workflow-selected scope: `plugin-dev`.

---

## Q1. このプラグインが解決する業務課題は何ですか？

`ddd/docs/domain-layer-design.md` は「DDD／クリーンアーキテクチャを実現するときに機能するガイドとガードレールを提供する」「デフォルトのワークフローでは Domain Primitive／Always Valid Domain Model は作られない」と述べています。これを課題の記述として確定させたいので、最も近いものを選んでください。

- A. AI-DLC の標準ワークフローには DDD の設計工程がなく、Domain Primitive／Always Valid Domain Model が作られないまま実装に進んでしまう
- B. 設計ドキュメントに DDD のルールを書いても、生成されるコードがそれに従っているかを機械的に検証する手段がない
- C. A と B の両方（設計工程の欠落と、設計・コード双方の検証手段の欠落）
- D. 上記とは別の課題がある
- E. まだ明確に定義していない
- X. Other (please specify)

[Answer]: C. A と B の両方（設計工程の欠落と、設計・コード双方の検証手段の欠落）

---

## Q2. このプラグインの利用者は誰で、どの範囲に届けますか？

- A. 自分（および自分が関わるプロジェクト）のみ。社内・外部への配布は当面考えない
- B. 社内の開発チーム。組織内で共有して使う
- C. OSS として外部に公開し、AI-DLC 利用者一般に届ける
- D. まずは自分用に作り、将来的に OSS 公開を視野に入れる
- E. まだ決めていない
- X. Other (please specify)

[Answer]: C. OSS として外部に公開し、AI-DLC 利用者一般に届ける

---

## Q3. 成功をどう測りますか？何をもって「効いている」と判断しますか？

（複数選択可。当てはまるものをすべて選んでください）

- A. `domain-modeling` ステージが動き、`domain-model.md` と `domain-model.yaml` が生成されること
- B. ブロッキングセンサー（設計ドキュメントの (a)〜(n)）が実際の違反を検出して進行を止めること
- C. 生成された Rust コードが Always Valid Domain Model の規約に違反しないこと
- D. 実プロジェクトに適用して、DDD 設計の手戻りが減ること
- E. まだ測定方法を定義していない
- X. Other (please specify)

[Answer]: A, B, C, D

---

## Q4. なぜ今このプラグインを作るのですか？（きっかけ）

- A. AI-DLC v2 のプラグイン機構が使えるようになり、実現可能になったから
- B. 既存プロジェクトで DDD のルールが守られない問題が実際に起きているから
- C. grilling セッションで設計が固まり、実装できる状態になったから
- D. 上記の複数が重なっている
- E. 特定のきっかけはない
- X. Other (please specify)

[Answer]: A. AI-DLC v2 のプラグイン機構が使えるようになり、実現可能になったから

---

## Q5. このプラグイン開発の関係者は誰ですか？意思決定者と影響を与える人を分けて教えてください。

- A. 意思決定者も実装者も自分ひとり。他の関係者はいない
- B. 意思決定は自分。レビューや意見をくれる人が別にいる
- C. 意思決定者が自分以外にいる（承認を得る必要がある）
- D. チームで合議して決める
- E. まだ特定していない
- X. Other (please specify)

[Answer]: A. 意思決定者も実装者も自分ひとり。他の関係者はいない

---

## Q6. 進捗の報告や共有の要件はありますか？

- A. 特にない。報告先も定例もない
- B. GitHub の Issue／PR 上で経過が追える状態であればよい
- C. 定期的な報告先がある（頻度と相手を Other で補足）
- D. まだ決めていない
- X. Other (please specify)

[Answer]: A. 特にない。報告先も定例もない

---

## Q7. このワークフローは `plugin-dev` というスコープで開始しました。これは今回作るものの範囲と一致していますか？

`plugin-dev` は「AI-DLC v2 プラグインの開発」に合わせた 11 ステージの流れです（Ideation は本ステージのみ、Inception は既存コードの読み取り → 要件 → ドメイン設計 → Unit 分解、Construction は機能設計 → コード生成 → ビルドとテスト。運用フェーズは持ちません）。

- A. 一致している。`plugin-dev` の範囲で進めてよい
- B. 一致しているが、範囲を狭めたい（Other で補足）
- C. 一致していない。別の製品境界を想定している（Other で補足）
- D. 判断できないので、このまま進めて後で見直したい
- X. Other (please specify)

[Answer]: A. 一致している。`plugin-dev` の範囲で進めてよい

---

## Q8. 3本の設計ドキュメントの位置づけを確認させてください。

`ddd/docs/domain-layer-design.md`、`ddd/docs/use-case-layer-design.md`、`ddd/docs/interface-adapter-layer-design.md` は、いずれも「未決定事項なし」と記載されています。

- A. 3本とも確定した設計であり、この内容を実装する。今回のスコープは3層すべて
- B. 3本とも確定しているが、今回はドメイン層（`domain-modeling` ステージ）から着手し、残り2層は後続に回す
- C. 確定はしているが、実装着手前に見直したい箇所がある（Other で補足）
- D. まだ確定とは言えない
- X. Other (please specify)

[Answer]: A. 3本とも確定した設計であり、この内容を実装する。今回のスコープは3層すべて

---

## Consolidated Summary Confirmation

- Q1 業務課題: 設計工程の欠落と、設計・コード双方の検証手段の欠落の両方
- Q2 利用者: OSS として外部に公開し、AI-DLC 利用者一般に届ける
- Q3 成功指標: ステージが動く／センサーが違反を止める／生成 Rust コードが規約を守る／実プロジェクトで手戻りが減る（4つすべて）
- Q4 きっかけ: AI-DLC v2 のプラグイン機構が使えるようになり、実現可能になった
- Q5 関係者: 意思決定者も実装者も自分ひとり
- Q6 報告要件: 特にない
- Q7 スコープ: `plugin-dev` で一致
- Q8 設計書: 3本とも確定。今回のスコープは3層すべて

- Looks correct
- Request changes

[Answer]: Looks correct

---

## Assumption Confirmation

以下は成果物に `[assumption]` として記録した、未確認の仮定です。

1. （intent-statement）SM4「実プロジェクトで DDD 設計の手戻りが減る」の測定方法は確定していない。何をもって「減った」と判定するかが未定義。
2. （intent-statement）3本の設計ドキュメントの技術的内容は、確定済み設計として実装対象になることのみ確認されている。個々の技術判断そのものは本ステージの確認対象外で、後続ステージで詳細化される。
3. （stakeholder-map）OSS 公開先である AI-DLC 利用者一般について、具体的なペルソナ、想定利用規模、フィードバック経路、公開後の受け入れ体制（Issue 対応、コントリビューション方針など）は未定義。

- A. Accept assumptions
- B. Convert to follow-up questions

[Answer]: A. Accept assumptions
