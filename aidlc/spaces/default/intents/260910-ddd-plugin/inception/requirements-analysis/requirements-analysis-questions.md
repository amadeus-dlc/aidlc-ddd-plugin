# Requirements Analysis — 確認事項

## Sources

- [desc] Initial description: "DDDプラグインを開発してください。\nddd/docs/domain-layer-design.md\nddd/docs/use-case-layer-design.md\nddd/docs/interface-adapter-layer-design.md"
- [scope] Workflow-selected scope: `plugin-dev`.
- Intent Capture の確認済み回答（`ideation/intent-capture/intent-capture-questions.md` Q1〜Q8）と `intent-statement.md`
- 確定済み設計ドキュメント3本（`ddd/docs/domain-layer-design.md`、`ddd/docs/use-case-layer-design.md`、`ddd/docs/interface-adapter-layer-design.md`）
- コード知識ベース（`aidlc/spaces/default/codekb/aidlc-workflows/`、`aidlc/spaces/default/codekb/ddd/`）

以下は、上記を読んだうえで**要件として確定させるために残っている未決点**だけを聞くものです。設計書で確定済みの内容（ステージ構成、正規モデル、コード規約、センサー (a)〜(n)、ナレッジ構成）は再確認しません。

---

## Q1. `domain-modeling` を `domain-design` の前に置く順序を、どこまで機械的に保証しますか？

文脈: プラグイン機構では contribution の `adds.requires_stage` が未実装で、宣言しても破棄されます（コード知識ベース 制約 C1）。自ステージの `requires_stage` でグラフ上の前後は決められますが、「`domain-design` が `domain-modeling` の完了を待つ」ことは順序辺では強制できません。成功指標 SM2（違反を含んだまま先へ進めない）をこの順序にも適用するかの判断です。

- A. 順序は `requires_stage`（例: `requirements-analysis` の後）だけで表現し、`domain-design` 側での強制はしない（規約と手順書で担保する）
- B. A に加えて、`domain-design` に `adds.consumes` で正規モデルを足し、正規モデルが無ければ `domain-design` の入力欠落として扱う
- C. B に加えて、`domain-design` のゲートに blocking センサーをバインドし、`domain-model.yaml` が存在し参照IDが解決できなければ承認に進めなくする
- D. `domain-modeling` を独立ステージにせず、`domain-design` への contribution（`fragments` + `adds.produces`）として実装し、順序問題そのものを無くす（設計書 §2 の方針を変更する）
- X. Other (please specify)

[Answer]: C. 入力欠落 + blocking センサー (Recommended)

---

## Q2. 初版で動作を保証する対象ハーネスはどれですか？

文脈: `mode: inline` 以外のステージや `reviewer:` を持つステージは、Kiro CLI / Codex / OpenCode では手書きのディスパッチ面がないと compose がそのステージを拒否します（制約 C3）。`ddd` リポジトリの現在のビルドスクリプトは `build:claude` と `build:codex` の2ハーネス分で、このワークスペースには Kimi Code の投影もあります。対象ハーネスの数が、エージェント設計とテスト範囲を直接決めます。

- A. Claude Code のみ
- B. Claude Code と Codex CLI（現在のビルドスクリプトどおり）
- C. Claude Code、Codex CLI、Kimi Code（このワークスペースに投影されている3ハーネス）
- D. エンジンが投影する8ハーネスすべて
- X. Other (please specify)

[Answer]: B. Claude Code + Codex CLI (Recommended)

---

## Q3. `domain-modeling` ステージのリードは誰にしますか？

文脈: コアには `aidlc-architect-agent` と、そのナレッジ `ddd-patterns.md` が既にあります（制約 C8: プラグイン側に DDD ナレッジを置くと二重になる）。プラグイン独自エージェントは `agents/ddd-<name>-agent.md` として追加でき、inline ステージなら追加のディスパッチ面は不要です。設計書 §9 は、既存ナレッジと矛盾した場合は「矛盾を明示して判断を求める」と定めています。

- A. コアの `aidlc-architect-agent` をリードにし、プラグインは `knowledge/aidlc-architect-agent/` に DDD ナレッジを足す（既存 `ddd-patterns.md` との重複や矛盾は明示して扱う）
- B. プラグイン独自の `ddd-domain-modeler-agent`（仮称）を新設してリードにし、ナレッジもそのエージェント配下に置く
- C. リードはコアの `aidlc-architect-agent`、サポートにプラグイン独自エージェントを置く（inline なので同一コンテキストで視点として読み込む）
- D. リードはコアの `aidlc-product-agent`（ユーザーストーリー起点でドメインイベントを逆算するため）、サポートに `aidlc-architect-agent` を置く
- X. Other (please specify)

[Answer]: A. コアの architect + ナレッジ追加 (Recommended)

---

## Q4. `domain-modeling` ステージをどのスコープで実行対象にしますか？

文脈: ステージの `scopes:` frontmatter が、どのスコープで EXECUTE になるかを決めます（`when:` 述語は未評価、制約 C4）。コアのスコープは11種で、express / poc / bugfix / refactor / security-patch は Minimal、mvp / feature / classic / workshop / infra は Standard、enterprise は Comprehensive です。設計書 §2 は「既存コードベースへの後付け適用」も想定しています。

- A. 新規開発系のみ: enterprise / feature / mvp / classic / workshop
- B. A に refactor を加える（既存コードへの後付け適用を想定）
- C. infra / security-patch を除く全スコープ（express / poc / bugfix も含める）
- D. プラグイン独自スコープ（例: `ddd-feature`）を追加し、そのスコープでのみ実行する
- X. Other (please specify)

[Answer]: B. 新規開発系 + refactor (Recommended)

---

## Q5. センサーが Rust コードの「層」を判定するとき、どの規約でサブプロジェクトを層に対応づけますか？

文脈: 設計書 §7-5 は「設定ファイルではなく、ファイルの所属サブプロジェクトから機械的に導く」とだけ定めています。センサー (d)（getter 呼び出し元の層判定）、(g)、(k)、(l) はすべてこの判定に依存しますが、Cargo workspace のどの情報を層の根拠にするかは未定です。

- A. クレート名の接尾辞で判定する: `<name>-domain` / `<name>-use-case` / `<name>-interface-adapter` / `<name>-infrastructure`
- B. ディレクトリ配置で判定する: `packages/domain/`、`packages/use-case/`、`packages/interface-adapter/`、`packages/infrastructure/`（`modules/` も同様）
- C. A と B の両方を認め、どちらにも当てはまらないクレートは「層不明」として blocking 違反にする
- D. `domain-design` の写像成果物にクレート→層の対応表を必須で書かせ、センサーはそれを読む（「設定ファイルではなく」は成果物には適用しない）
- X. Other (please specify)

[Answer]: C. 名前と配置の両方、不明は違反 (Recommended)

---

## Q6. 集約ごとの「プログラミングモデル／永続化方式」の2軸宣言と、それに連動する検査は今回のスコープに含めますか？

文脈: `domain-layer-design.md` §11 は「永続化方式別チェックの詳細設計」を後続フェーズとしていますが、`use-case-layer-design.md` §6 は2軸を `domain-design` のマッピング属性として宣言させ、センサーが宣言と実装の齟齬を検出するとしています。どこまでを今回の実装対象にするかを確定させたい点です。

- A. 2軸の宣言スキーマと、センサー (j)（非冪等操作なのに冪等性戦略が未宣言）まで含める。方式別の必須設計リスト（ES の1コマンド1イベント等）の検査は後続に回す
- B. A に加えて、方式別の必須設計リストの検査（宣言と実装の齟齬検出）も含める
- C. 2軸の宣言スキーマだけ含め、それに連動する検査はすべて後続に回す
- D. 2軸宣言も含めて後続に回す（今回は (a)〜(n) のうち宣言に依存しないものだけを実装する）
- X. Other (please specify)

[Answer]: A. 宣言スキーマ + センサー (j) まで (Recommended)

---

## Q7. Rust コードを検査するセンサーの実行時依存は、何まで許容しますか？

文脈: プラグインの `tools/` は bun で動く TypeScript が前提です。Rust の構文解析には、TypeScript 製の限定パーサ、tree-sitter（WASM）、Rust 製ヘルパ（cargo でビルド）のいずれかが必要で、利用者の環境に何を要求するかが要件になります。

- A. 純 TypeScript の手書きパーサ（検査に必要なサブセット構文のみ）。追加の実行時依存なし
- B. tree-sitter-rust（WASM）を同梱して bun から呼ぶ。cargo は要求しない
- C. Rust 製ヘルパ（`syn` ベース）を `tools/` に置き、初回に cargo でビルドする。対象が Rust プロジェクトなので cargo は前提にしてよい
- D. `cargo` のカスタム lint（dylint / clippy 拡張）として実装し、センサーはその結果を読む
- X. Other (please specify)

[Answer]: B. tree-sitter-rust (WASM) を同梱 (Recommended)

---

## Consolidated Summary Confirmation

- Q1 順序保証: `domain-design` に `adds.consumes` で正規モデルを足して入力欠落として扱い、さらに `domain-design` のゲートに blocking センサーをバインドして `domain-model.yaml` の存在と参照IDの解決を必須にする（C）
- Q2 対象ハーネス: Claude Code と Codex CLI の2ハーネスで動作を保証する（B）
- Q3 リード: `domain-modeling` のリードはコアの `aidlc-architect-agent`。プラグインは `knowledge/aidlc-architect-agent/` に DDD ナレッジを追加し、既存 `ddd-patterns.md` との重複・矛盾は明示して扱う（A）
- Q4 スコープ: enterprise / feature / mvp / classic / workshop に refactor を加えた6スコープで `domain-modeling` を EXECUTE にする（B）
- Q5 層判定: クレート名の接尾辞とディレクトリ配置の両方を認め、どちらにも当てはまらないクレートは「層不明」として blocking 違反にする（C）
- Q6 2軸宣言: プログラミングモデル／永続化方式の宣言スキーマと、非冪等操作の冪等性戦略未宣言を検出するセンサー (j) までを今回に含め、方式別の必須設計リストの検査は後続に回す（A）
- Q7 実行時依存: tree-sitter-rust（WASM）を同梱して bun から呼ぶ。cargo は要求しない（B）

Does this all look correct before I generate the requirements artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
