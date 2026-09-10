# Functional Design — 確認事項（U2 Rust 解析基盤 / u2-rust-analysis-foundation）

## Sources

- `inception/units-generation/unit-of-work.md`（U2 の責務: RustSyntaxAnalyzer と WorkspaceLayerResolver。規則の判定はしない）
- `inception/units-generation/unit-of-work-story-map.md`（U2 に割り当てた要件: FR8.4、FR8.6、FR9、FR9.1〜FR9.4、FR9.6、NFR2）
- `inception/requirements-analysis/requirements.md`（FR9 層判定、FR8.4 WASM 同梱、FR8.6 言語別検査器の分離、NFR2 実行時依存、未解決事項 OQ7）
- `inception/domain-design/components.md`（RustSyntaxAnalyzer / WorkspaceLayerResolver の振る舞い、CrateLayerAssignment）
- `inception/domain-design/decisions.md`（ADR-001 同梱と配置、ADR-005 層・CQRS 側・composition root の判定規約）
- `ddd/docs/domain-layer-design.md` §7-5、`ddd/docs/interface-adapter-layer-design.md` §2〜§4
- 確定済みで再確認しない事項: 層判定は接尾辞と配置の両方を認め、どちらにも当てはまらなければ「層不明」（RA-Q5、ADR-005）。CQRS 側は `-command-` / `-query-` / `-rmu` またはディレクトリ、composition root は `[[bin]]`・接尾辞・ディレクトリ（ADR-005）。tree-sitter-rust（WASM）を同梱し cargo を要求しない（RA-Q7、FR8.4）。

設計書と ADR で決まっていない点だけを聞きます。いずれも U5（Rust コードセンサー）の判定結果と、利用者が守るべきワークスペース規約に直結します。

---

## Q1. マクロ展開が必要で構文木だけでは判定できない箇所（未解決事項 OQ7）をどう扱いますか？

文脈: tree-sitter は型推論もマクロ展開も行いません。`macro_rules!` や属性マクロが生成する impl・フィールド・呼び出しは構文木に現れず、規則 (a)〜(n) の判定から漏れます。解析器はその箇所を「解析不能」として明示的に返す設計です（components.md）。センサー側がそれをどう報告するかを決めます。

- A. 解析不能箇所を advisory の所見（規則 ID `analyzer.macro-opaque`、ファイル・行付き）として報告し、進行は止めない。判定できた規則の結果とは独立に扱う
- B. 解析不能箇所があるファイルは blocking 違反にする（マクロ生成コードでの規則迂回を許さない）
- C. 解析不能箇所は黙って無視する（所見にしない）
- X. Other (please specify)

[Answer]: A. advisory の所見として報告 (Recommended)

---

## Q2. クレート名の接尾辞とディレクトリ配置が別の層を示すとき、どちらを採りますか？

文脈: RA-Q5 で「接尾辞と配置の両方を認める」と決めましたが、両方が当てはまって食い違う場合（例: `billing-domain` が `packages/use-case/` にある）の優先順位は未定です。センサー (d)(g)(k)(l) と依存方向検査（FR9.5）はこの判定結果だけを根拠にします。

- A. 食い違いは「層不明」と同じく blocking 違反にする（曖昧なワークスペースを許さない）
- B. 接尾辞を優先する（クレート名は Cargo が一意性を保証する識別子）
- C. ディレクトリ配置を優先する（物理分離の意図を表す）
- X. Other (please specify)

[Answer]: A. 食い違いは blocking 違反 (Recommended)

---

## Q3. ワークスペースのメンバークレートに属さないファイルや補助ターゲット（`tests/`、`examples/`、`benches/`、`build.rs`）は層規則の対象にしますか？

文脈: 申告ソース（source-manifest.json）に統合テストやビルドスクリプトが含まれることがあります。これらはクレートの層に属しますが、ドメイン型の getter を呼ぶなど「層規則をそのまま当てると必ず違反する」用途です。

- A. `tests/` `examples/` `benches/` と `build.rs` は層規則の対象外（`layer: auxiliary`）とし、センサーは検査を省略して note に記録する。メンバー外のファイルは「層不明」として blocking 違反
- B. すべて所属クレートの層として扱い、通常どおり検査する
- C. `tests/` `examples/` `benches/` `build.rs` は interface-adapter 層とみなして検査する（getter 呼び出しを許す層に寄せる）
- X. Other (please specify)

[Answer]: A. 補助ターゲットは対象外、メンバー外は違反 (Recommended)

---

## Q4. `[[bin]]` と lib の両方を持つクレートは、全体を composition root として扱いますか？

文脈: ADR-005 は `[[bin]]` ターゲットを持つクレートを composition root（層規則の対象外）と定めています。1 つのクレートが lib ターゲット（層のコード）と bin ターゲット（結線）を同居させる構成では、lib 側の規則違反が見逃されます。

- A. bin と lib が同居するクレートは「層不明」と同じく blocking 違反にし、composition root は bin 専用クレートに分けることを規約にする
- B. クレート全体を composition root として扱い、lib 側も検査しない（ADR-005 の文言どおり）
- C. `src/main.rs` と `src/bin/` 配下だけを composition root とし、それ以外のファイルは接尾辞・配置で判定した層として検査する
- X. Other (please specify)

[Answer]: A. 同居は blocking 違反 (Recommended)

---

## Consolidated Summary Confirmation

- Q1 マクロ不透明箇所: 解析不能箇所は advisory の所見（規則 ID `analyzer.macro-opaque`、ファイル・行付き）として報告し、進行は止めない。判定できた規則の結果とは独立に扱う（A）
- Q2 接尾辞と配置の食い違い: 「層不明」と同じく blocking 違反にする（A）
- Q3 補助ターゲット: `tests/` `examples/` `benches/` `build.rs` は `layer: auxiliary` として検査対象外（note に記録）。メンバークレートに属さないファイルは「層不明」で blocking 違反（A）
- Q4 bin と lib の同居: blocking 違反とし、composition root は bin 専用クレートに分けることを規約にする（A）

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
