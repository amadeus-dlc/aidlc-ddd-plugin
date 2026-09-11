# DDD プラグイン利用ガイド

[English](usage.md) | 日本語

インストール後に実際にどう使うかのガイドです。新規プロジェクトからの利用と、途中からの（late）導入の両方を扱います。インストール手順そのものは [README の Quickstart](../README.ja.md#クイックスタート) を、仕組みの図解は [architecture.md](architecture.ja.md) を参照してください。

## 前提

1. **対象プロジェクトにプラグインが導入済み**であること。未導入なら README の Quickstart（ワンコマンド・インストーラ）から始めてください。
2. **それ以外は不要**。コードセンサーは tree-sitter-rust の WASM 文法を同梱して Rust を解析するため、対象プロジェクトに cargo・Node.js・ネットワークは要りません。
3. **確認** — 対象プロジェクトのセッションで `/aidlc --doctor` を実行し、`ddd` ステージとセンサーが登録されている（drops が無い）ことを確認します。

## 新規利用（最初から intent を作る）

**鍵はスコープ選択**です。ステージは `scopes: [enterprise, feature, mvp, classic, workshop, refactor]` を宣言するため、これらのスコープの intent で実行され、それ以外では SKIP されます。

1. `/aidlc "作りたいものの説明"` でワークフローを開始します。
2. Inception フェーズを進めます。`requirements-analysis` と `user-stories` が揃うと `ddd-domain-modeling` ステージが実行されます。
   - architect エージェントがドメインイベントを発見し、集約候補にまとめ、正規の `domain-model.yaml`（と派生 `domain-model.md`）を `inception/ddd-domain-modeling/` に書きます。
   - 書き込みが `ddd-model-completeness` を発火し、条件 (i)〜(v) を検査します。全集約に不変条件、全コマンドに状態効果とドメインエラー、全参照 ID の解決、md と yaml の一致。
   - 所見はゲートのフィードバックとして戻ります。Sensors 節の案内に従って yaml か md を直します。
3. `domain-design` へ進みます。プラグイン contribution により、全集約を 2 軸で写像し、モデル ID を引用する必要があり、`ddd-model-presence`・`ddd-reference-ids`・`ddd-mapping-declarations` がゲートします。
4. `functional-design` がユースケースを宣言し（必須 6 項目・複数集約戦略）、`ddd-reference-ids`・`ddd-mapping-declarations`・advisory の `ddd-design-advisories` が検査します。
5. `infrastructure-design` が層構造を宣言し、`ddd-layer-structure`（規則 (k)〜(n)）と `ddd-design-advisories` が検査します。
6. `code-generation` が Rust コードと `source-manifest.json` を書きます。`code-summary.md` の書き込みが `ddd-rust-domain`・`ddd-rust-use-case`・`ddd-rust-interface-adapter` を発火します（規則 (a)〜(n) と依存方向表）。

## 途中からの導入（進行中プロジェクトへの導入）

合成は追加型なので、**AI-DLC が進行中のプロジェクトへ途中で導入しても他は変わりません**。導入時期と intent の関係は次のとおりです。

| intent の状態 | 挙動 |
|---|---|
| 導入後に作成（対象スコープ） | 実行計画に自動で載る。「新規利用」と同じ |
| **導入前に作成済み** | 計画にステージ項目が無いが、単独実行で後からモデリングできる（下記） |
| 対象外スコープ | 設計上 SKIP。必要ならスコープを変更する |

導入前に作られた intent をモデリングするには、それを active intent にして実行します。

```
/aidlc --stage ddd-domain-modeling --single
```

（compose が生成する `/ddd-domain-modeling` スキルも同じものです。）この単独実行は:

- その intent の既存の要件・ストーリーを読み（どちらも任意。無い場合はドメイン語彙を対話で引き出します）
- その intent の記録の下に正規モデルを書きます
- **ワークフローの Current Stage を進めません** — モデリングして停止します

ステージが SKIP のときは下流の `ddd-model-presence` が note 付きで pass するため、既存 intent は緑のままです。

## 成果物の読み方

すべて対象 intent の記録の下に書かれます。

- **`inception/ddd-domain-modeling/domain-model.yaml`** — 正規モデル: bounded context、集約、要素、不変条件、コマンド、ドメインエラー、イベント、遷移、factory 規則、`lineage`。`ddd-model-completeness` が機械検証します。
- **`inception/ddd-domain-modeling/domain-model.md`** — 派生の人間向けビュー。全要素 ID の言及と全不変条件 statement の再掲が必要で、(f) 規則が検査します。
- **`inception/domain-design/ddd-aggregate-mapping.md`** — 集約ごとに 1 行: `programming_model` × `persistence_method`、crate/module/repository、写像する `reference_ids`。
- **`construction/<unit>/functional-design/ddd-use-case-declarations.md`** — ユースケースと回復・整合性の宣言。
- **`construction/<unit>/infrastructure-design/ddd-layer-structure.md`** — 層構造: 側クレート、`crate_dependencies`、ポート、リポジトリ、復元経路。
- **`construction/<unit>/code-generation/code-summary.md`** ＋ **`source-manifest.json`** — 契機と、コードセンサーが検査する正確な `.rs` ファイル。

## トラブルシューティング

- **ステージが計画に出ない** — intent のスコープを確認（`<record>/aidlc-state.md` の `Stages to Skip`）。対象外スコープは設計上 SKIP です。
- **`ddd-model-presence` が失敗** — `domain-modeling` が EXECUTE なのに `inception/ddd-domain-modeling/domain-model.yaml` が無いか読み込めません。ステージを実行するかモデルを直します。
- **`ddd-reference-ids` が `undefined` / `deprecated` を報告** — 宣言 ID がモデルに解決しません。宣言かモデルの `lineage` を直します。廃止 ID は再利用できません。
- **Rust センサーが何も報告しない** — `source-manifest.json` にそのファイルが列挙され、そのクレートが対象層に解決されるか確認します（クエリ側ファイルは interface-adapter センサーが検査します）。
- **コード所見の rule が違う** — センサーは構文だけで判定します（型推論なし）。(c-model) と内部可変性は意図的に機械検査せず、ナレッジ文書に委ねています。
- **`/aidlc --doctor` が drops を表示** — インストーラを再実行します。compose 前に自プラグインのファイルを更新し、compose は冪等です。
