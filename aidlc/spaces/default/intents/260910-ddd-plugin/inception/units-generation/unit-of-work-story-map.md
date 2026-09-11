# 要件 → Unit 対応表（ストーリーマップ相当）— DDD プラグイン（AI-DLC v2）

## Sources

- `inception/requirements-analysis/requirements.md`（FR1〜FR11 の全サブ要件と NFR1〜NFR10。本スコープでは `user-stories` を実行していないため、ストーリー ID（USx.y）の代わりに要件 ID を写像する）
- `inception/units-generation/unit-of-work.md`（U1〜U9）
- `inception/domain-design/components.md`（要件 → コンポーネントの写像を Unit に畳み込んだ）
- `inception/domain-design/decisions.md`（ADR-009 により FR5.4 は設計側検査として U4 に割り当てる）

## 割り当て方針

- 各要件 ID を、それを主として実現する Unit 1つに割り当てる。グループ ID（FR1 など）はそのグループの主担当 Unit に置く。
- 複数 Unit に跨がる要件は「横断要件」の節に補足し、主担当以外の Unit が負う分担を書く。
- 各 Unit 内の実装順は、その Unit の機能設計（functional-design）で決める。ここでは Unit 内で先に固めるべき要件だけを示す。

## 要件 → Unit

| 要件 ID | Unit ID | Directory |
|---|---|---|
| FR1 | U6 | u6-domain-modeling-stage |
| FR1.1 | U6 | u6-domain-modeling-stage |
| FR1.2 | U6 | u6-domain-modeling-stage |
| FR1.3 | U6 | u6-domain-modeling-stage |
| FR1.4 | U6 | u6-domain-modeling-stage |
| FR1.5 | U6 | u6-domain-modeling-stage |
| FR1.6 | U6 | u6-domain-modeling-stage |
| FR1.7 | U6 | u6-domain-modeling-stage |
| FR1.8 | U6 | u6-domain-modeling-stage |
| FR1.9 | U6 | u6-domain-modeling-stage |
| FR2 | U1 | u1-sensor-foundation |
| FR2.1 | U1 | u1-sensor-foundation |
| FR2.2 | U1 | u1-sensor-foundation |
| FR2.3 | U1 | u1-sensor-foundation |
| FR2.4 | U1 | u1-sensor-foundation |
| FR2.5 | U1 | u1-sensor-foundation |
| FR2.6 | U1 | u1-sensor-foundation |
| FR2.7 | U1 | u1-sensor-foundation |
| FR3 | U7 | u7-core-contributions |
| FR3.1 | U7 | u7-core-contributions |
| FR3.2 | U7 | u7-core-contributions |
| FR3.3 | U7 | u7-core-contributions |
| FR3.4 | U7 | u7-core-contributions |
| FR3.5 | U7 | u7-core-contributions |
| FR4 | U7 | u7-core-contributions |
| FR4.1 | U7 | u7-core-contributions |
| FR4.2 | U7 | u7-core-contributions |
| FR4.3 | U7 | u7-core-contributions |
| FR4.4 | U4 | u4-design-sensors |
| FR5 | U7 | u7-core-contributions |
| FR5.1 | U7 | u7-core-contributions |
| FR5.2 | U7 | u7-core-contributions |
| FR5.3 | U7 | u7-core-contributions |
| FR5.4 | U4 | u4-design-sensors |
| FR5.5 | U4 | u4-design-sensors |
| FR6 | U4 | u4-design-sensors |
| FR6.1 | U4 | u4-design-sensors |
| FR6.2 | U4 | u4-design-sensors |
| FR6.3 | U4 | u4-design-sensors |
| FR6.4 | U4 | u4-design-sensors |
| FR6.5 | U4 | u4-design-sensors |
| FR6.6 | U4 | u4-design-sensors |
| FR7 | U5 | u5-rust-code-sensors |
| FR7.1 | U5 | u5-rust-code-sensors |
| FR7.2 | U5 | u5-rust-code-sensors |
| FR7.3 | U5 | u5-rust-code-sensors |
| FR7.4 | U5 | u5-rust-code-sensors |
| FR7.5 | U5 | u5-rust-code-sensors |
| FR7.6 | U5 | u5-rust-code-sensors |
| FR7.7 | U5 | u5-rust-code-sensors |
| FR7.8 | U5 | u5-rust-code-sensors |
| FR7.9 | U5 | u5-rust-code-sensors |
| FR7.10 | U5 | u5-rust-code-sensors |
| FR7.11 | U5 | u5-rust-code-sensors |
| FR7.12 | U5 | u5-rust-code-sensors |
| FR7.13 | U5 | u5-rust-code-sensors |
| FR8 | U1 | u1-sensor-foundation |
| FR8.5 | U1 | u1-sensor-foundation |
| FR8.1 | U4 | u4-design-sensors |
| FR8.2 | U4 | u4-design-sensors |
| FR8.7 | U4 | u4-design-sensors |
| FR8.3 | U7 | u7-core-contributions |
| FR8.4 | U2 | u2-rust-analysis-foundation |
| FR8.6 | U2 | u2-rust-analysis-foundation |
| FR9 | U2 | u2-rust-analysis-foundation |
| FR9.1 | U2 | u2-rust-analysis-foundation |
| FR9.2 | U2 | u2-rust-analysis-foundation |
| FR9.3 | U2 | u2-rust-analysis-foundation |
| FR9.4 | U2 | u2-rust-analysis-foundation |
| FR9.6 | U2 | u2-rust-analysis-foundation |
| FR9.5 | U5 | u5-rust-code-sensors |
| FR10 | U8 | u8-knowledge-pack |
| FR10.1 | U8 | u8-knowledge-pack |
| FR10.2 | U8 | u8-knowledge-pack |
| FR10.3 | U8 | u8-knowledge-pack |
| FR10.4 | U8 | u8-knowledge-pack |
| FR10.5 | U8 | u8-knowledge-pack |
| FR10.6 | U8 | u8-knowledge-pack |
| FR11 | U3 | u3-plugin-scaffold |
| FR11.1 | U3 | u3-plugin-scaffold |
| FR11.2 | U3 | u3-plugin-scaffold |
| FR11.5 | U3 | u3-plugin-scaffold |
| FR11.3 | U9 | u9-release-quality |
| FR11.4 | U9 | u9-release-quality |
| FR11.6 | U9 | u9-release-quality |
| NFR1 | U5 | u5-rust-code-sensors |
| NFR3 | U5 | u5-rust-code-sensors |
| NFR2 | U2 | u2-rust-analysis-foundation |
| NFR4 | U4 | u4-design-sensors |
| NFR5 | U9 | u9-release-quality |
| NFR6 | U9 | u9-release-quality |
| NFR10 | U9 | u9-release-quality |
| NFR7 | U3 | u3-plugin-scaffold |
| NFR8 | U1 | u1-sensor-foundation |
| NFR9 | U1 | u1-sensor-foundation |

## 横断要件（主担当以外の分担）

| 要件 | 主担当 | 他 Unit の分担 |
|---|---|---|
| FR1.7（成果物 `ddd-domain-model` / `ddd-domain-model-yaml`） | U6 | U1 が YAML のスキーマを定義し、U4 が md／yaml の整合を検査する |
| FR1.8（機械完了条件 (i)〜(v)） | U6 | 検査の実体は U4 の model-completeness |
| FR3.5、FR4.3、FR5.4、FR8.3（`adds.sensors` でのバインド） | U7（バインド宣言）／U4（FR5.4 の検査実体） | 検査の実体は U4（設計側）と U5（コード側）。U7 は ID を列挙するだけ |
| FR7.2、FR7.3、FR7.11（宣言済み Command と復元経路の照合） | U5 | U1 の読み込み器で正規モデルの Command 集合を得る |
| FR7.4、FR7.5、FR7.8、FR7.9（層・CQRS 側に基づく判定） | U5 | 層判定の実体は U2 |
| FR8.7（ゴールデンケース） | U4（規約） | U5 は Rust センサー分の fixture を同梱する |
| FR10.4（コア `ddd-patterns.md` との矛盾一覧） | U8 | 一覧の内容は `decisions.md` ADR-010 が出典 |
| FR11.1、FR11.2、FR11.5（plugin.json と論理名） | U3 | U6・U7 が宣言する論理名は U3 の規約に従う |
| FR11.3、FR11.4（4コマンドと `aidlc-plugin-test`） | U9 | 各 Unit が自分のテストを緑にしておく |
| NFR1（確定性）、NFR3（性能） | U5 | U4 の設計センサーも同じ基準で確認する |
| NFR2（実行時依存） | U2 | U1 もネットワークにアクセスしない |
| NFR5（ハーネス互換） | U9 | U6 は `mode: inline` とコアエージェントのみ（ADR-007）で U9 の確認に備える |

## Unit 内で先に固める要件

| Unit | 先に固める要件 | 理由 |
|---|---|---|
| U1 | FR8.5（ディスパッチャ契約）、FR2.1〜FR2.3（スキーマと ID 文法） | U4・U5・U6・U7 の統合点になる |
| U2 | FR9.1〜FR9.4（層判定）、FR8.4（WASM 同梱） | U5 の全規則がこの判定に依存する |
| U3 | FR11.1、FR11.2（contributes 宣言と論理名） | 他の Unit の投影可否を決める |
| U4 | FR8.7（fixture 規約）、FR8.2（blocking/advisory の分け方） | U5 が同じ規約に従う |
| U5 | FR9.5（依存方向）、FR7.1〜FR7.4（ドメイン層の規則） | 規則モジュールの形を最初の4規則で固める |
| U6 | FR1.1〜FR1.4（frontmatter） | compose に載ることが先 |
| U7 | FR3.1（`adds.consumes`）、FR3.5（`adds.sensors`） | domain-design への順序強制が中核（ADR-007） |
| U8 | FR10.3（配置）、FR10.4（矛盾一覧） | 配置ミスは黙って無視されるため先に確認する（CON6） |
| U9 | FR11.4（統合テスト） | README より先に compose の3条件を通す |

## 網羅性の確認

- 要件 ID の総数: 95（FR グループ 11、FR サブ要件 74、NFR 10）。すべて上の表に1行ずつ割り当てた。
- Unit ごとの割り当て数: U1 12、U2 9、U3 5、U4 14、U5 17、U6 10、U7 15、U8 7、U9 6。要件を持たない Unit はない。
- `traceability.json` の `coverage` は本表と同じ写像を持つ（target は Unit ID）。
