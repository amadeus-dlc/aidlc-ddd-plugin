# センサー契約のテスト対応表

[English](sensor-coverage.md) | 日本語

この表は `bun scripts/report-sensor-coverage.ts --write` で生成する。変更元は [契約表](../../tests/golden/contract/coverage.ts) と [ケース一覧](../../tests/golden/catalog.ts)。手作業で件数を更新しない。

対象は9センサー・70規則項目。68項目は対応する所見を直接検証し、2項目はローダーによる先行拒否を検証する。配布物では277ケースを各環境で実行する。承認経路には、この表から選んだ138入力を各環境で通す。

規則IDが同じでも、別センサーのケースで検証済みとは扱わない。正常例は対象構造を持つ入力、境界例は対象外・最小件数・別表記・別経路などの区別を確認する入力として選ぶ。この表は宣言した検査契約への対応を示し、Rustの全構文・業務上の意味・全分岐の網羅を保証しない。

## 規則ごとの正常・異常・境界条件

ケース名はセンサー内で一意。異常欄には期待する規則を含むケースをすべて列挙する。先行拒否の2項目は、代わりに実際に発生する規則を明記する。

| センサー / 規則 | 正常例 | 異常例 | 境界例と根拠 |
|---|---|---|---|
| ddd-design-advisories<br>`design-advisories.document` | `clean-use-case` | `violation-document`<br>`violation-mixed-headings`<br>`violation-missing-list` | `violation-mixed-headings`<br>宣言不正は助言として報告し、承認開始を遮断しない。 |
| ddd-design-advisories<br>`design-advisories.multi-aggregate` | `clean-use-case` | `violation-multi-aggregate` | `clean-empty-use-cases`<br>対象0件・1件と、2集約以上の助言の境界。 |
| ddd-design-advisories<br>`design-advisories.repository-scope` | `clean` | `violation-repository-scope` | `clean-collection-repository`<br>集約の集合は有効、集約の一部を扱う宣言は助言対象。 |
| ddd-design-advisories<br>`design-advisories.store-upsert` | `clean` | `violation-store-upsert` | `clean-collection-repository`<br>集約の集合は有効、集約の一部を扱う宣言は助言対象。 |
| ddd-layer-structure<br>`layer-structure.cqrs-sides` | `clean` | `violation-cqrs-sides` | `clean-non-cqrs`<br>クエリ側が必須になるCQRSと非CQRSを区別する。 |
| ddd-layer-structure<br>`layer-structure.dependencies-incomplete` | `clean` | `violation-item` | `clean-empty-layers`<br>完全な層宣言と、明示的に層構造がないUnitを区別する。 |
| ddd-layer-structure<br>`layer-structure.item` | `clean` | `violation-item`<br>`violation-mixed-headings`<br>`violation-missing-list` | `clean-empty-layers`<br>完全な層宣言と、明示的に層構造がないUnitを区別する。 |
| ddd-layer-structure<br>`layer-structure.k` | `clean-rmu-cross-side` | `violation-k`<br>`violation-k-reverse` | `violation-k-reverse`<br>RMUの橋渡しは許可し、クエリ側からの逆方向依存も検出する。 |
| ddd-layer-structure<br>`layer-structure.l` | `clean-rmu-cross-side` | `violation-l`<br>`violation-k-reverse` | `violation-k-reverse`<br>RMUの橋渡しは許可し、クエリ側からの逆方向依存も検出する。 |
| ddd-layer-structure<br>`layer-structure.m-media` | `clean` | `violation-m-media` | `violation-m-media`<br>媒体名入りのポートは正式名と媒体名禁止の両方で違反になる。 |
| ddd-layer-structure<br>`layer-structure.m-name` | `clean` | `violation-m-name`<br>`violation-m-media` | `violation-m-media`<br>媒体名入りのポートは正式名と媒体名禁止の両方で違反になる。 |
| ddd-layer-structure<br>`layer-structure.model` | `clean` | `violation-model` | `violation-missing-list`<br>一覧の欠落はモデル検査の前に拒否する。 |
| ddd-layer-structure<br>`layer-structure.n` | `clean` | `violation-n` | `clean-collection-repository`<br>集合を扱うリポジトリでも完全コンストラクタによる復元を確認する。 |
| ddd-mapping-declarations<br>`domain-packaging.coverage` | `clean-packaging-declarations` | `violation-packaging-empty-declarations`<br>`violation-packaging-missing-parent` | `violation-packaging-missing-parent`<br>rootと親階層を必須にし、将来のモジュールの即時実装は要求しない。 |
| ddd-mapping-declarations<br>`domain-packaging.declaration` | `clean-packaging-declarations` | `violation-packaging-missing-declarations`<br>`violation-packaging-missing-term`<br>`violation-packaging-missing-rationale`<br>`violation-packaging-missing-reference` | `violation-packaging-empty-declarations`<br>宣言欠落、明示的な空一覧、パッケージ宣言ありを区別する。 |
| ddd-mapping-declarations<br>`domain-packaging.duplicate` | `clean-packaging-declarations` | `violation-packaging-duplicate` | `violation-packaging-duplicate`<br>異なる将来パッケージは先行宣言可能だが、同じ識別子の重複は拒否する。 |
| ddd-mapping-declarations<br>`domain-packaging.technical-name` | `clean-packaging-declarations` | `violation-packaging-technical-name`<br>`violation-packaging-name-aggregate`<br>`violation-packaging-name-aggregates`<br>`violation-packaging-name-impl`<br>`violation-packaging-name-vo`<br>`violation-packaging-name-entities`<br>`violation-packaging-name-entity`<br>`violation-packaging-name-value_objects`<br>`violation-package-reserved-impls`<br>`violation-package-reserved-implementation`<br>`violation-package-reserved-implementations`<br>`violation-package-reserved-vos`<br>`violation-package-reserved-value_object`<br>`violation-package-reserved-valueobject`<br>`violation-package-reserved-valueobjects`<br>`violation-package-reserved-VO` | `violation-package-reserved-VO`<br>大小文字・raw識別子を正規化して要素全体で照合し、部分文字列では判定しない。 |
| ddd-mapping-declarations<br>`mapping-declarations.aggregate-unmapped` | `clean-mapping` | `violation-aggregate-unmapped` | `clean-multi-aggregate-mapping`<br>複数actor集約の正常な写像と、単一class集約の写像を確認する。 |
| ddd-mapping-declarations<br>`mapping-declarations.axes` | `clean-mapping` | `violation-axes` | `clean-multi-aggregate-mapping`<br>複数actor集約の正常な写像と、単一class集約の写像を確認する。 |
| ddd-mapping-declarations<br>`mapping-declarations.document` | `clean-use-case` | `violation-document`<br>`violation-replay-shape`<br>`violation-packaging-shape`<br>`violation-mixed-headings`<br>`violation-missing-list` | `violation-mixed-headings`<br>見出しの言語をまたいでも正規セクションは1つだけ。 |
| ddd-mapping-declarations<br>`mapping-declarations.duplicate` | `clean-mapping` | `violation-duplicate` | `clean-multi-aggregate-mapping`<br>複数actor集約の正常な写像と、単一class集約の写像を確認する。 |
| ddd-mapping-declarations<br>`mapping-declarations.j` | `clean-additive-idempotency` | `violation-j` | `clean-mapping`<br>加算型はID記憶必須、状態遷移型はnoneを宣言可能。 |
| ddd-mapping-declarations<br>`mapping-declarations.model` | `clean-mapping` | `violation-model` | `violation-document`<br>壊れた宣言はモデル読込み前に拒否する。 |
| ddd-mapping-declarations<br>`mapping-declarations.multi-aggregate-strategy` | `clean-actor-process-manager` | `violation-multi-aggregate-strategy`<br>`violation-process-manager-required` | `clean-class-re-execution`<br>actorのProcess Managerとclassの再実行戦略を両方確認する。 |
| ddd-mapping-declarations<br>`mapping-declarations.process-manager-required` | `clean-actor-process-manager` | `violation-process-manager-required` | `clean-class-re-execution`<br>actorのProcess Managerとclassの再実行戦略を両方確認する。 |
| ddd-mapping-declarations<br>`mapping-declarations.use-case-item` | `clean-use-case` | `violation-use-case-item` | `clean-empty-use-cases`<br>必須項目のあるユースケースと、明示的な空一覧を区別する。 |
| ddd-model-completeness<br>`model-completeness.f-absent` | `clean-complete` | `violation-f-absent` | `violation-empty-model-view`<br>ファイル欠落と、存在するが空の説明を区別する。 |
| ddd-model-completeness<br>`model-completeness.f-invariant` | `clean-complete` | `violation-f-invariant`<br>`violation-empty-model-view` | `clean-model-whitespace`<br>空白の違いだけで不変条件本文の一致を否定しない。 |
| ddd-model-completeness<br>`model-completeness.f-missing` | `clean-complete` | `violation-f-missing`<br>`violation-empty-model-view` | `violation-empty-model-view`<br>ファイル欠落と、存在するが空の説明を区別する。 |
| ddd-model-completeness<br>`model-completeness.f-unknown` | `clean-complete` | `violation-f-unknown` | `clean-retired-view-reference`<br>廃止済みIDの記載は許可し、未定義IDの記載は拒否する。 |
| ddd-model-completeness<br>`model-completeness.i` | `clean-complete` | `violation-i` | `violation-i`<br>不変条件1件と0件の境界。 |
| ddd-model-completeness<br>`model-completeness.ii` | `clean-complete` | `violation-ii` | `clean-no-transition`<br>遷移ありと、遷移なしを明示したコマンドを区別する。 |
| ddd-model-completeness<br>`model-completeness.iv` | `clean-complete` | `violation-unresolved-model-reference`<br>先行拒否: `model-completeness.schema` | `violation-unresolved-model-reference`<br>ローダーが未解決参照を先に拒否するため、防御的チェックへは到達しない。 |
| ddd-model-completeness<br>`model-completeness.schema` | `clean-complete` | `violation-schema`<br>`violation-unresolved-model-reference` | `violation-unresolved-model-reference`<br>正常モデルと、形式は正しいが参照先が存在しないモデルを区別する。 |
| ddd-model-presence<br>`model-presence.invalid` | `clean-execute` | `violation-invalid`<br>`violation-unresolved-model-reference` | `clean-skip`<br>SKIP時の対象外と、EXECUTE時の検証を区別する。 |
| ddd-model-presence<br>`model-presence.missing` | `clean-execute` | `violation-missing` | `clean-absent-stage`<br>ステージ未登録は対象外、EXECUTEはモデル必須。 |
| ddd-model-presence<br>`model-presence.unresolved` | `clean-execute` | `violation-unresolved-model-reference`<br>先行拒否: `model-presence.invalid` | `violation-unresolved-model-reference`<br>ローダーが未解決参照を先に拒否するため、防御的チェックへは到達しない。 |
| ddd-reference-ids<br>`reference-ids.cycle` | `clean-mapping` | `violation-cycle` | `clean-renamed-lineage`<br>名称変更で有効なIDを維持し、廃止や系譜の循環と区別する。 |
| ddd-reference-ids<br>`reference-ids.deprecated` | `clean-mapping` | `violation-deprecated` | `clean-renamed-lineage`<br>名称変更で有効なIDを維持し、廃止や系譜の循環と区別する。 |
| ddd-reference-ids<br>`reference-ids.document` | `clean-use-case` | `violation-document`<br>`violation-mixed-headings`<br>`violation-missing-list` | `violation-mixed-headings`<br>英語・従来の日本語見出しは同じ宣言を指し、重複は拒否する。 |
| ddd-reference-ids<br>`reference-ids.kind` | `clean-mapping` | `violation-kind` | `clean-replay-reference`<br>replayはイベント種別を要求し、一般のreference_idsとの違いを確認する。 |
| ddd-reference-ids<br>`reference-ids.malformed` | `clean-mapping` | `violation-malformed-id`<br>`violation-id-arity` | `violation-id-arity`<br>IDの文法とセグメント数の両方を検証する。 |
| ddd-reference-ids<br>`reference-ids.missing` | `clean-mapping` | `violation-missing` | `clean-single-reference`<br>集約写像の参照1件が最小の正常値で、0件は拒否する。 |
| ddd-reference-ids<br>`reference-ids.model` | `clean-mapping` | `violation-model` | `violation-document`<br>宣言形式の不正はモデル読込みより先に拒否する。 |
| ddd-reference-ids<br>`reference-ids.undefined` | `clean-mapping` | `violation-undefined`<br>`violation-replay-reference`<br>`violation-packaging-reference-id` | `clean-replay-reference`<br>replayはイベント種別を要求し、一般のreference_idsとの違いを確認する。 |
| ddd-rust-domain<br>`a` | `clean-domain` | `violation-a` | `violation-a`<br>同じ集約の非公開フィールドと公開フィールドを比較する。 |
| ddd-rust-domain<br>`b` | `clean-b-split-command` | `violation-b`<br>`violation-b-split-impl`<br>`violation-b-arbitrary-apply`<br>`violation-b-trait-impl`<br>`violation-b-value-object`<br>`violation-b-replay-state-sourcing`<br>`violation-b-replay-wrong-crate`<br>`violation-b-replay-wrong-module`<br>`violation-b-replay-unknown-event`<br>`violation-b-replay-unlisted-method`<br>`violation-b-replay-duplicate-method`<br>`violation-b-replay-scalar` | `clean-b-declared-replay`<br>宣言済みコマンドと、契約に一致するreplayを許可する。 |
| ddd-rust-domain<br>`c` | `clean-full-constructor` | `violation-c-literal`<br>`violation-c-default` | `violation-c-default`<br>inherent impl内の生成とDefaultによる迂回を区別する。 |
| ddd-rust-domain<br>`d` | `clean-self-getter` | `violation-d`<br>`violation-d-split-getter` | `violation-d-split-getter`<br>self呼出しは許可し、別ファイルの受信型も照合する。 |
| ddd-rust-domain<br>`domain-packaging.coverage` | `clean-packaging-inline` | `violation-packaging-undeclared`<br>`violation-packaging-code-root-coverage` | `clean-packaging-planned-module`<br>rootと親階層を必須にし、将来のモジュールの即時実装は要求しない。 |
| ddd-rust-domain<br>`domain-packaging.declaration` | `clean-packaging-inline` | `violation-packaging-no-mapping` | `violation-packaging-no-mapping`<br>宣言欠落、明示的な空一覧、パッケージ宣言ありを区別する。 |
| ddd-rust-domain<br>`domain-packaging.duplicate` | `clean-packaging-inline` | `violation-packaging-code-duplicate` | `clean-packaging-planned-module`<br>異なる将来パッケージは先行宣言可能だが、同じ識別子の重複は拒否する。 |
| ddd-rust-domain<br>`domain-packaging.reference` | `clean-packaging-inline` | `violation-packaging-code-reference`<br>`violation-model-invalid` | `violation-model-invalid`<br>正規モデルを読めなければパッケージ参照も検証済みと扱わない。 |
| ddd-rust-domain<br>`domain-packaging.technical-name` | `clean-packaging-inline` | `violation-packaging-empty-inline`<br>`violation-packaging-mod-aggregate`<br>`violation-packaging-mod-aggregates`<br>`violation-packaging-mod-impl`<br>`violation-packaging-mod-vo`<br>`violation-packaging-mod-entities`<br>`violation-packaging-mod-entity`<br>`violation-packaging-mod-value_objects`<br>`violation-packaging-under-business-name`<br>`violation-packaging-physical-classification`<br>`violation-packaging-crate-classification`<br>`violation-package-reserved-impls`<br>`violation-package-reserved-implementation`<br>`violation-package-reserved-implementations`<br>`violation-package-reserved-vos`<br>`violation-package-reserved-value_object`<br>`violation-package-reserved-valueobject`<br>`violation-package-reserved-valueobjects`<br>`violation-package-reserved-VO` | `clean-packaging-word-substring`<br>大小文字・raw識別子を正規化して要素全体で照合し、部分文字列では判定しない。 |
| ddd-rust-domain<br>`domain-packaging.unresolved` | `clean-packaging-path-child` | `violation-packaging-item-macro`<br>`violation-packaging-missing-module-file`<br>`violation-packaging-path-escape`<br>`violation-packaging-orphan-claim`<br>`violation-packaging-ambiguous-source`<br>`violation-packaging-conditional-path`<br>`violation-module-cycle` | `violation-module-cycle`<br>明示的なpathをたどり、循環は停止して報告する。 |
| ddd-rust-domain<br>`g` | `clean-g-domain-to-infrastructure-use` | `violation-g`<br>`violation-g-domain-to-use-case-use`<br>`violation-g-domain-to-use-case-cargo`<br>`violation-g-domain-to-interface-adapter-use`<br>`violation-g-domain-to-interface-adapter-cargo`<br>`violation-g-domain-to-rmu-use`<br>`violation-g-domain-to-rmu-cargo`<br>`violation-g-domain-to-composition-root-use`<br>`violation-g-domain-to-composition-root-cargo`<br>`violation-g-domain-external-io-use`<br>`violation-g-domain-external-io-cargo` | `clean-g-domain-to-infrastructure-cargo`<br>独立した層の許可表をuseとCargoのみの依存で検証し、外部I/Oも含める。 |
| ddd-rust-domain<br>`layer.conflict` | `clean-domain` | `violation-layer-conflict` | `violation-layer-conflict`<br>layer.*を一括除外せず、具体的な診断ごとに検証する。 |
| ddd-rust-domain<br>`layer.mixed-targets` | `clean-domain` | `violation-layer-mixed-targets` | `violation-layer-mixed-targets`<br>layer.*を一括除外せず、具体的な診断ごとに検証する。 |
| ddd-rust-domain<br>`layer.unknown` | `clean-domain` | `violation-layer-unknown` | `violation-layer-unknown`<br>layer.*を一括除外せず、具体的な診断ごとに検証する。 |
| ddd-rust-domain<br>`layer.unowned` | `clean-domain` | `violation-layer-unowned` | `violation-layer-unowned`<br>layer.*を一括除外せず、具体的な診断ごとに検証する。 |
| ddd-rust-domain<br>`model.invalid` | `clean-domain` | `violation-model-invalid` | `clean-model-skipped`<br>EXECUTEのモデル検証と、SKIPによるモデル依存検査の対象外を区別する。 |
| ddd-rust-interface-adapter<br>`g` | `clean-g-interface-adapter-to-infrastructure-use` | `violation-g-interface-adapter-to-rmu-use`<br>`violation-g-interface-adapter-to-rmu-cargo`<br>`violation-g-interface-adapter-to-composition-root-use`<br>`violation-g-interface-adapter-to-composition-root-cargo`<br>`violation-g-rmu-to-use-case-use`<br>`violation-g-rmu-to-use-case-cargo`<br>`violation-g-rmu-to-composition-root-use`<br>`violation-g-rmu-to-composition-root-cargo` | `clean-g-interface-adapter-to-infrastructure-cargo`<br>独立した層の許可表をuseとCargoのみの依存で検証し、外部I/Oも含める。 |
| ddd-rust-interface-adapter<br>`k` | `clean-rmu-bridge` | `violation-k`<br>`violation-k-reverse` | `violation-k-reverse`<br>RMUの橋渡しを許可し、それ以外はcommand/query両方向を禁止する。 |
| ddd-rust-interface-adapter<br>`l` | `clean-query-dto` | `violation-l` | `violation-l`<br>クエリDTOは許可し、更新用ドメイン型は拒否する。 |
| ddd-rust-interface-adapter<br>`m` | `clean-repository` | `violation-m-media` | `clean-storage-implementation-name`<br>実装名の媒体名は許可し、リポジトリポートのtraitでは拒否する。 |
| ddd-rust-interface-adapter<br>`n` | `clean-restoration-constructor` | `violation-n`<br>`violation-default-restoration` | `violation-default-restoration`<br>既知の完全コンストラクタを許可し、Defaultによる復元は拒否する。 |
| ddd-rust-use-case<br>`d` | `clean-d-unrelated-getter-name` | `violation-d-getter-alias` | `violation-d-getter-alias`<br>名前の衝突やimport別名があっても受信型の同一性で判定する。 |
| ddd-rust-use-case<br>`g` | `clean-g-use-case-to-infrastructure-use` | `violation-g-use-case-to-interface-adapter-use`<br>`violation-g-use-case-to-interface-adapter-cargo`<br>`violation-g-use-case-to-rmu-use`<br>`violation-g-use-case-to-rmu-cargo`<br>`violation-g-use-case-to-composition-root-use`<br>`violation-g-use-case-to-composition-root-cargo`<br>`violation-g-use-case-external-io-use`<br>`violation-g-use-case-external-io-cargo` | `clean-g-use-case-to-infrastructure-cargo`<br>独立した層の許可表をuseとCargoのみの依存で検証し、外部I/Oも含める。 |
| ddd-rust-use-case<br>`h` | `clean-h-value-object` | `violation-h`<br>`violation-h-import-alias`<br>`violation-h-type-alias`<br>`violation-h-qualified`<br>`violation-h-grouped-alias`<br>`violation-h-imported-box` | `clean-h-domain-primitive`<br>VOとDomain Primitiveの引数は許可し、集約引数は拒否する。 |
| ddd-rust-use-case<br>`i` | `clean-i-port-execute` | `violation-i`<br>`violation-i-field-use-case`<br>`violation-i-associated-call`<br>`violation-i-imported-use-case` | `clean-i-own-associated-call`<br>ポート呼出しと同型自身への呼出しを別ユースケースと混同しない。 |

## 承認経路と対象外

承認開始のテストは、対象センサーの発火・正常／異常の監査記録・異常時の規則IDを確認する。blocking所見は承認開始を拒否し、advisory所見は記録したうえで通過する。規則ごとのテストは対象センサーを単独で合成し、既存の結合テストではDDDセンサーをまとめて有効にする。無関係な成果物は補助入力を置き、Q&A・レビュー証跡はテスト設定で除外する。

層の依存方向は、domain・use-case・インターフェイスアダプタ・rmuを起点に6層への依存をuse/Cargoの両方で検証し、外部I/Oの許可・禁止も確認する。技術分類の予約名14種類は設計・コード両方で違反ケースを持つ。英日見出しの互換性テストもtest:sandboxに含める。

標準AI-DLCの単独完了ガードの再現1件は任意実行のまま残る。新規導入・更新・モデルによる生成・生成アプリケーションの動作は、この検証の対象外。[残作業](completion-tasks.ja.md)を参照。
