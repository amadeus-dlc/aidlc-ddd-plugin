# Functional Design — 確認事項（U8 ナレッジ / u8-knowledge-pack）

## Sources

- `inception/units-generation/unit-of-work.md`（U8 の責務: 役割別ディレクトリの方法論ナレッジ、Rust コード規約、IA 層規約、層境界の原則、メタ規律、ADR-010 の矛盾一覧の転記。kind: spec）
- `inception/units-generation/unit-of-work-story-map.md`（U8 に割り当てた要件: FR10、FR10.1〜FR10.6。先に固める要件は FR10.3 配置と FR10.4 矛盾一覧）
- `inception/requirements-analysis/requirements.md`（FR10.1 基盤ナレッジのトピック、FR10.2 Rust ナレッジのトピック、FR10.3 配置、FR10.4 命名と矛盾、FR10.5 メタ規律、FR10.6 ナレッジだけに任せない）
- `inception/domain-design/components.md`（DddKnowledgePack の振る舞い）と `decisions.md`（ADR-006 役割別配置、ADR-010 矛盾 4 件の確定）
- `ddd/docs/domain-layer-design.md` §9、`ddd/docs/use-case-layer-design.md` §9、`ddd/docs/interface-adapter-layer-design.md` §9
- コアのナレッジの書式の例: `.claude/knowledge/aidlc-architect-agent/ddd-patterns.md`（見出しと表を中心にした英語の Markdown）
- 確定済みで再確認しない事項: 配置は architect（基盤＋設計規約）、developer（Rust）、aws-platform（IA 層）、aidlc-shared（層境界の原則のみ）で、ディレクトリ名は slug 完全一致（ADR-006、CON6）。ファイル名は `ddd-` 接頭辞（FR10.4）。矛盾 4 件は ADR-010 の表を転記する。スキーマと命名規約の出典は U1・U2 の設計。

ナレッジは Markdown 文書の集合なので、機能設計で決めるのは「どの文書を、どの粒度と書式で、何を出典に書くか」です。設計書と ADR で決まっていない点だけを聞きます。

---

## Q1. ナレッジ本文の言語はどうしますか？

文脈: このプロジェクトの設計書と成果物は日本語です。一方、プラグインは OSS として公開し（G3）、コアのナレッジは英語で書かれており、ナレッジを読むのは AI エージェントです。

- A. 日本語で書く（設計書と同じ言語。用語は英語の識別子を併記する）
- B. 英語で書く（コアのナレッジと同じ言語。OSS 利用者の範囲が広い）
- C. 英語を正とし、日本語訳を `ddd-*.ja.md` として併置する（ファイル数が倍になる）
- X. Other (please specify)

[Answer]: B. 英語

---

## Q2. ファイルの粒度をどうしますか？

文脈: FR10.1 は基盤トピックを約 18 件、FR10.2 は Rust トピックを約 11 件挙げています。1 トピック 1 ファイルだと約 30 ファイル（役割別に分散）、まとめると数ファイルになります。エージェントはステージ開始時に担当ディレクトリの全ファイルを読むため、ファイル数よりも合計の分量が読み込みコストを決めます。

- A. 主題ごとにまとめる: architect に 4 本（always-valid-model、aggregate-and-invariants、use-case-conventions、cqrs-and-consistency）、developer に 2 本（rust-domain-conventions、rust-persistence-conventions）、aws-platform に 1 本（interface-adapter-conventions）、shared に 1 本（layer-boundaries）。合計 8 本
- B. 1 トピック 1 ファイル（約 30 本）。各ファイルは短く、索引ファイルを役割ごとに置く
- C. 役割ごとに 1 本（architect / developer / aws-platform / shared の 4 本）
- X. Other (please specify)

[Answer]: A. 主題ごとに 8 本 (Recommended)

---

## Q3. 「良い例は実在ファイルへの索引にする」（FR10.5）の索引先をどうしますか？

文脈: メタ規律は、例をスニペットで書かず実在ファイルを指すことを求めます。プラグインが同梱する実在の Rust ファイルは、U5 のゴールデンケース fixture（`tests/golden/rust/`）だけです。ただし `tests/` は投影時に除外されるため、投影先のハーネスからは参照できません。

- A. ゴールデンケースの「違反なし」fixture をリポジトリ相対パスで索引し、投影先では参照できないことを注記する（規律を守り、例の実体は fixture に一本化する）
- B. 索引の代わりに、ナレッジ本文に 15 行以下の最小スニペットを置く（投影先でも自己完結する。メタ規律の「索引にする」は緩める）
- C. `knowledge/aidlc-developer-agent/examples/` に例示用の Rust ファイルを同梱し、そこを索引する（投影される。fixture と二重管理になる）
- X. Other (please specify)

[Answer]: A. ゴールデンケースを索引＋投影先での注記 (Recommended)

---

## Consolidated Summary Confirmation

- Q1 言語: ナレッジ本文は英語で書く（コアのナレッジと同じ言語。OSS 利用者の範囲を広くする）。ADR-010 の矛盾一覧に引用する日本語の設計書の記述は英訳し、原文の出典を併記する（B）
- Q2 粒度: 主題ごとに 8 本。architect 4（always-valid-model / aggregate-and-invariants / use-case-conventions / cqrs-and-consistency）、developer 2（rust-domain-conventions / rust-persistence-conventions）、aws-platform 1（interface-adapter-conventions）、shared 1（layer-boundaries）（A）
- Q3 例の索引: 「違反なし」ゴールデンケース fixture をリポジトリ相対パスで索引し、投影先では参照できないことを注記する。例の実体は fixture に一本化する（A）

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
