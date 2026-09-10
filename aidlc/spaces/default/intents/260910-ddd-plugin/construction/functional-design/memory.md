<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->


- 2026-09-10T11:05:04Z — ProcessManager は Aggregate ではなく BoundedContext が所有し、Aggregate.process_managers は読み込み器が補完する導出値にした; components.md は Aggregate の属性に process_managers を挙げるが、複数集約に跨がる要素を 1 集約の入れ子にはできない。
<!-- aidlc-wave-memory:u1-sensor-foundation:949f57501c1d7d05391da2031bf170824e4e1108ef2c3a7a032155b24f5d9c69 -->

- 2026-09-10T11:05:04Z — Q1 の「集約配下の要素は <kind>.<aggregate>.<name>」を、Invariant / Command / Event / Error / Transition / Factory に適用し、Entity / VO / Primitive は設計書の例（entity.invoice、primitive.invoice-number）どおり <kind>.<name> とした; Domain Primitive は複数の集約から共有され得るため集約名を含めない方が自然で、設計書の例とも一致する。
<!-- aidlc-wave-memory:u1-sensor-foundation:98f5a41212406e6552b92686863d86f562aef9a120c99178da44cd46ce0df817 -->

- 2026-09-10T10:51:43Z — components.md は SensorRuntime が「詳細ファイルを書く」と記すが、エンジンのディスパッチャ（aidlc-sensor.ts）はスクリプトの標準出力 JSON（pass / findings_count ほか）から詳細ファイルを自分で生成する; スクリプト側は終了コード 0 で JSON を出すだけにし、SensorVerdict は「ディスパッチャに渡す報告」として定義する。終了コード非 0 は advisory の script-error になるため、blocking 違反は必ず終了コード 0 + pass:false で返す。
<!-- aidlc-wave-memory:u1-sensor-foundation:0b34b4dccc8c656738befb344fc073f9fbe20dfe2afe72282b445966d36671f5 -->

- 2026-09-10T11:16:31Z — getter の構文的定義を「本体が self.<field>（参照・clone・as_ref を含む）を返すだけの単一式」とし、body_shape として U2 が返す; 設計書 §6 の「フィールドを返すだけのメソッドは名前に関係なく getter」を構文だけで判定できる形に落とした。境界事例はゴールデンケースで広げる。
<!-- aidlc-wave-memory:u2-rust-analysis-foundation:9b8d48c77ad285e5193c3672aa725e43f8be27cf4425d9834f78f6958792fff2 -->

- 2026-09-10T11:16:31Z — RMU クレート（例: billing-rmu）は層接尾辞を持たないため、層の列挙に rmu を加えて「層不明」から区別した; ADR-005 は RMU を CQRS 側の印としてしか定めておらず、そのままでは FR9.4 の層不明違反になる。IA 設計書 §4 の「独立ブリッジ」に合わせた解釈。
<!-- aidlc-wave-memory:u2-rust-analysis-foundation:e0139955022ff1abdea3e43b00397a0e1b59a755f59465ffb5837cd040e71be2 -->

- 2026-09-10T11:07:42Z — 要件書の未解決事項 OQ7（マクロ展開が必要な箇所の扱い）は決着先が functional-design のため、U2 の質問 Q1 として人間に確定してもらう; 解析器は「解析不能」を明示的に返す（components.md）ことは確定しており、決めるのは報告の重大度だけ。
<!-- aidlc-wave-memory:u2-rust-analysis-foundation:26ef964c261a1004cb927b3f1f91be333c0af7f78a62e06f411f362436f4cba6 -->

- 2026-09-10T11:43:46Z — マニフェストの command は参照プラグイン test-pro と同じ bun {{HARNESS_DIR}}/tools/ddd-sensor-<name>.ts の形にした; プラグインは複数ハーネスに投影されるため、ハーネス固有のパスを書けない。
<!-- aidlc-wave-memory:u4-design-sensors:5d715422bb7d6e459737ca86faf7f08d29b5fd4a26b5016917b432bb9dd44f73 -->

- 2026-09-10T11:43:46Z — 3 つの ddd- 宣言成果物（aggregate-mapping / use-case-declarations / layer-structure）の yaml 形式は U4 が所有し、U7 はそれを fragments で指示する側とした; U7 は U4 に依存する（依存グラフ）ため、解析契約の所有者は読む側の U4 が自然。components.md のエンティティに ADR-009 の必須項目と advisory 用の io_unit / store_semantics を足した。
<!-- aidlc-wave-memory:u4-design-sensors:c4d4843a22b333d67cf3f0eae89b7fdf463abbfda8c599f0b0eef2a2409639a3 -->

- 2026-09-10T11:55:38Z — Q1 で本文は英語と決まったため、ADR-010 の矛盾一覧に引用する日本語の設計書の記述は英訳し、原文の出典を併記する扱いにした; 会話言語（日本語）と成果物言語（英語）が分かれる初めてのケース。
<!-- aidlc-wave-memory:u8-knowledge-pack:2a902eb51b4d1d88b5dab380fe33ce6e83b008779b3004b4342dd77846ee6571 -->

- 2026-09-10T11:55:38Z — kind: spec の Unit に対して entities.md / rules.md を「文書集合の構造」と「執筆規則」として書いた; ステージ定義は spec にも entities と rules を要求しており、ナレッジでは規則の Enforcement（強制手段の明示）が FR10.5 / FR10.6 を担保する要になる。
<!-- aidlc-wave-memory:u8-knowledge-pack:b9e11c3300dae2bc45c644c7dd28d2a8fbe6de837ad72c2ec3a3623c92d3ca9e -->

- 2026-09-10T12:32:35Z — 規則 (b) の Command 照合は名前の正規化（型名 PascalCase→ケバブ、メソッド名 snake→ケバブ）で行う（Q1）; 型推論なしで正規モデルの ID と結び付ける唯一の決定的な手段で、注記方式は注記漏れがそのまま違反になるため採らなかった。
<!-- aidlc-wave-memory:u5-rust-code-sensors:ed30398391b49ed435a554c7a001e642a91092cf70c04c4872a2562cbfc17057 -->

- 2026-09-10T12:32:35Z — 規則 (d)(h)(l)(n) の名前照合に使うドメイン型名・getter 名の一覧は、申告ソースではなくワークスペースのドメイン層クレート全体から作る（Q4）; 以前の Unit で生成した型への呼び出しを見逃さないため。判定対象は申告ソースだけに保つ。
<!-- aidlc-wave-memory:u5-rust-code-sensors:1ce2b109fa50108173515068dbe2e1736128f27a997b9c971abd2f99f2883d3c -->

- 2026-09-10T13:17:03Z — requires_stage に user-stories を足した（Q1）; requirements-analysis だけだとアルファベット順のタイブレークで user-stories より前に走り、推奨入力のストーリーが存在しない。コアの domain-design が refined-mockups を要求するのと同じ扱い。
<!-- aidlc-wave-memory:u6-domain-modeling-stage:8b76c890d8a3685ca9b8a2f2a080659af541f0c3cfc435cde4244f4bbefb5b3e -->

- 2026-09-10T13:17:03Z — support_agents に aidlc-product-agent を置いた; ユビキタス言語とストーリーの読み手として妥当で、inline なのでハーネス依存（CON7）は増えない。ADR-007 が禁じるのは独自エージェントだけ。
<!-- aidlc-wave-memory:u6-domain-modeling-stage:7d3226a115c6cd6684523f2447e7b1d29ddf67cddad57ed13061c07d59c5764b -->

- 2026-09-10T13:46:26Z — FR4.3 の「(g)(h)(i)(d)(j) を functional-design にバインド」は、(j) と 6 項目を設計側（mapping-declarations）で、(g)(h)(i)(d) を code-generation の Rust マニフェストで満たすと解釈した; functional-design のゲートには Rust コードが無く、ADR-009 の設計側／コード側の分離をそのまま当てはめた。
<!-- aidlc-wave-memory:u7-core-contributions:83cec5f18cc318ebb2e2eb3d3f20d8ccaa607fd791e76731e3d701f7998b8cb8 -->
## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->


- 2026-09-10T11:50:27Z — レビュー R-01（expected.json に stage / output_path を持たせるか）を受け、起動引数と期待結果を expected.json 1 ファイルにまとめた; GoldenCase の属性として別に持つ形は仕様だけから出所が決まらず、ランナー実装者が迷う。entities.md / rules.md BR8.2 / functional-spec.md WF8 を揃えた。
<!-- aidlc-wave-memory:u4-design-sensors:dd3ab176b51ce7df130933e60d68ad96ffbdd4401f3a9755cc35b43fcb672a93 -->

- 2026-09-10T12:32:35Z — U2 Q1 の「マクロ不透明箇所は advisory の所見」を、所見ではなく verdict の note への転記に変えた; 3 マニフェストはすべて blocking で advisory を混在できない（ADR-002、U1 BR9.3）。件数と位置は note で読める。
<!-- aidlc-wave-memory:u5-rust-code-sensors:6584d6a08f628cd4fe46eb706edb7d182d860b51963e0b236257bb854c09e045 -->

- 2026-09-10T13:11:26Z — レビュー R-02 を受け、依存方向違反（FR9.5）の rule_id を独自の direction から要件の受け入れ基準どおり g に戻した; 安全網としての (g) を要件が名指ししており、別 ID は fixture の期待と一致しない。R-01 のクエリ側ユースケース層の扱いは BR1.2 と RustSensorManifest.includes_query_side に明記した。
<!-- aidlc-wave-memory:u5-rust-code-sensors:decc33e1e5217dead7a15439af9920bcef48be41d17b0ada5c86ee4eb16cf7da -->

- 2026-09-10T13:46:26Z — adds.required_sections は使わない; 機械強制されない（CON3）ため、章構造の保証は U4 の gate センサーに寄せた。
<!-- aidlc-wave-memory:u7-core-contributions:46a0fb519acd72f4be7b140b5c90a8d0cab85b8890651184353103489d234692 -->
## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->


- 2026-09-10T11:05:04Z — ランタイムの予期しない例外はフェイルクローズ（pass:false、reason runtime-error）にした; ディスパッチャは非 0 終了コードを advisory の script-error として pass 扱いにするため、例外を伝播させるとセンサーの欠陥が違反の見逃しになる。センサー自体のバグでゲートが閉じる副作用は、監査付き override（CON9）で回避できると判断した。
<!-- aidlc-wave-memory:u1-sensor-foundation:3380a93ee5934a211c3b2f2fc17281e09235bddae0073ff5735fd0b9d6efbd0b -->

- 2026-09-10T11:16:31Z — derive は不透明領域にせず StructDecl.derives として返す; derive(Default) は規則 (c) の材料になるため名前を残す価値がある一方、derive の生成物まで不透明扱いにすると全 struct が advisory になり信号が失われる。
<!-- aidlc-wave-memory:u2-rust-analysis-foundation:ac5b9218665e5ff72bafa3b145bc546a2b8f689cc6a9a9c0f2605450b49fd089 -->

- 2026-09-10T11:43:46Z — (m) の媒体語は固定リストで判定する; 正規表現や辞書の外部化は決定性と同梱の単純さを損なうため、初版は列挙で始めてゴールデンケースで広げる。
<!-- aidlc-wave-memory:u4-design-sensors:f4376dba4113f32f21d954e795b8cfa8c266a58d6395b06155855c7dc1676166 -->

- 2026-09-10T12:32:35Z — 正規モデルが無いワークフローでは (b) と Command 照合部分だけを note 付きで省略し、他の規則は検査する（Q2）; 全体 pass にすると express / poc で Rust 規約が一切効かず、欠落を違反にすると domain-modeling を実行しないスコープで毎回 override が要る。
<!-- aidlc-wave-memory:u5-rust-code-sensors:80ad5f5d6c5d851df077d30644d8a6bd383bfdbac6f4e444416eb5a4e36db53c -->

- 2026-09-10T12:32:35Z — 完全コンストラクタは名前ではなく戻り型（Self 系）で判定し、replay 経路と後付け初期化は固定の名前リストで見分ける（Q5）; 戻り型判定は命名の自由度を保ち、固定リストは決定性と単純さを優先した。リストはゴールデンケースで見直す。
<!-- aidlc-wave-memory:u5-rust-code-sensors:df669cb6c52c876ec67ffde3d8f035dec7d222d30a2fdfc2652e85df2a877218 -->

- 2026-09-10T13:17:03Z — 非 ASCII の用語からの ID は英訳案を人間に確認させる（Q2）; ローマ字化は決定的だが下流の Rust 命名（U5 の PascalCase→ケバブ照合）と噛み合わず、確認なしの英訳は永続キーの誤りを残す。
<!-- aidlc-wave-memory:u6-domain-modeling-stage:cbb01d354ecebec16246439b6e26f1a09f0359eca21ae8fc4bfd632e17575467 -->

- 2026-09-10T13:46:26Z — fragments は質問生成の直後と成果物生成の直後の対で挿入する（Q1）; end-of-steps は保守が楽だが質問に宣言事項が含まれず、宣言が後追いになる。コアのステップ番号の変更には U9 の drops ログ検出で追随する。
<!-- aidlc-wave-memory:u7-core-contributions:24dc77937a20883662af35ea9160cdf19f487a9257faa7dd87d5f1faff39d568 -->
## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->

- 2026-09-10T11:05:04Z — YAML 解析器を bun 組み込みにするか最小実装を同梱するかは code-generation の計画で確定する（NFR2 の実行時依存に関わる）。
<!-- aidlc-wave-memory:u1-sensor-foundation:9b7427eaec1c5c4ee6a12f08fb1bda066737973f205b435a7c053a818406ae46 -->

- 2026-09-10T11:16:31Z — web-tree-sitter の同梱方法（vendor ディレクトリとライセンス表記）は code-generation の計画で確定する。
<!-- aidlc-wave-memory:u2-rust-analysis-foundation:b19c39f9f6439774c334f5540bd4d0de78a9d0032b271fa056dcb81a4172ea38 -->

- 2026-09-10T11:55:38Z — 例の索引先（clean fixture のパス）は U5 の code-generation まで確定しない。U8 の執筆時は予定パスを書き、U9 で実在を検証する。
<!-- aidlc-wave-memory:u8-knowledge-pack:06f5b5bb861514f80b900f5bc042403cccacbe2c58d11655d66478a05d2e33ad -->

- 2026-09-10T12:32:35Z — c-model（FactoryRule の前提条件を検査しない復元経路）と &self の内部可変性による setter 偽装は構文だけでは判定できず、初版では所見にしない。ナレッジと設計側の宣言で補う。
<!-- aidlc-wave-memory:u5-rust-code-sensors:59d6ebbb75b962d615f2ba50707c018207595ef8fc617d0872a4151ccf32b272 -->

- 2026-09-10T12:32:35Z — I/O クレートの固定一覧（Q6）と NFR3 の 10 秒目安は仮置き。性能計測ケース（BR10.4）の結果で見直す。
<!-- aidlc-wave-memory:u5-rust-code-sensors:947613d3efce9d45954816378afeb839f836f6485b7029761f4f78ff56c1e163 -->

- 2026-09-10T13:17:03Z — (i)〜(v) を承認前に手元で検査する CLI は定義しなかった。U1 の code-generation 計画で ddd-model-check のような入口を検討する。
<!-- aidlc-wave-memory:u6-domain-modeling-stage:578dc2520c8abc86f74ea7c3bc1b1c227b43bfde622eb99026164ee72a1773ec -->

- 2026-09-10T13:46:26Z — adds.produces で追加した per-unit 成果物が対象外の Unit でも完了条件として要求されるかはエンジン実装に依存する。Q2 の空の宣言で安全側に倒し、U9 の統合テストで確認する。
<!-- aidlc-wave-memory:u7-core-contributions:019026b93f54e9707fe609fb968e49bf1e9ad2a82709c5bc13327edcaa23a916 -->
