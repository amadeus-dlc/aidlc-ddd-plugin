# ドメイン層のパッケージング契約

[English](domain-packaging-design.md) | 日本語

更新: 2026-09-13。T-07として実装済み。ユーザー指定の「パッケージ名をユビキタス言語へ結び付け、aggregate/・impl/・vo/・entities/等の技術分類で分けない」を、ナレッジ、ステージ手順、設計・Rustセンサーへ反映した。

## 業務概念を配置の単位にする

集約、Entity、VOはモデル上の役割であり、それだけをパッケージ分割の理由にはしない。請求書・請求書番号・明細が業務語彙として確認できているなら、例えば次のようにまとめる。

```text
billing-domain/src/
  lib.rs
  invoice.rs
  invoice/
    number.rs
    line.rs
  money.rs
```

各コード名には用語と配置理由が必要になる。1集約＝1パッケージは強制しない。共有する値も、common/voへ集める前にmoney等の業務概念から責務を決める。名前だけを変更して責務の混在を残すことは、レビューで指摘する。

## domain-designが配置を宣言する

既存の登録済み成果物 `ddd-aggregate-mapping.md` の正規YAMLに、必須の `domain_packages` を追加した。正規ドメインモデルのスキーマには物理配置を追加していない。

```yaml
domain_packages:
  - crate: billing-domain
    module: crate
    term: 請求
    model_refs: [bc.billing]
    rationale: 請求のドメインを所有する
  - crate: billing-domain
    module: invoice
    term: 請求書
    model_refs: [aggregate.invoice]
    rationale: 請求書の状態と操作、その構成要素をまとめる
  - crate: billing-domain
    module: invoice::number
    term: 請求書番号
    model_refs: [primitive.invoice-number]
    rationale: 請求書番号の表現と検証を所有する
```

例のIDは利用先の正規モデルに定義する。各行のcrate、module、term、model_refs、rationaleは必須で、model_refsは1件以上。クレートのrootは `module: crate`、内部はクレート相対の `::` 区切りで表す。同じクレート・モジュールの重複、rootや親階層の欠落、aggregate_mappings.moduleの宣言漏れを拒否する。

日本語の用語とコード名の文字列一致は要求しない。関連するモデルIDを参照し、グルーピング語の定義と配置理由を説明する。パッケージを作るためだけに架空の集約やEntityを増やさない。

未実装のパッケージは計画として宣言できる。コード検査は「実モジュールが宣言されているか」を調べ、将来のUnit向けに宣言した全パッケージの実装を現在のUnitへ要求しない。既存成果物も宣言を補う必要があり、旧形式を自動免除しない。

## 技術分類名の機械検査

次の名前を予約名として拒否する。

```text
aggregate aggregates impl impls implementation implementations
vo vos entity entities value_object value_objects valueobject valueobjects
```

大小文字とRustの `r#` 接頭辞を正規化し、要素単位で照合する。部分文字列では判定しないため、identityやinvoice_entitiesを一律には拒否しない。common/shared/utils等の適切さは意味のレビューに残す。

| 対象 | 扱い |
|---|---|
| billing-domainのbilling部分 | 業務語彙への対応を要求。技術分類名も検査 |
| -domain、packages/domain | 既存の層表示として維持 |
| 内部のinvoice/vo、空・非公開・インラインmod | 技術分類として検出 |
| src、lib.rs、main.rs、mod.rs | 配置上の要素として区別 |
| impl Invoice構文、aggregate.invoice等のモデルID | パッケージ名ではない |
| 外部依存のuse参照、対象外クレート | 所有するドメインパッケージとして検査しない |

## Rustの検査範囲

変更があるドメインクレートのlib/binを起点にmod宣言をたどる。申告ファイルだけでなく、そのクレートの到達可能なモジュールを調べる。既存の違反も対象になり、他のクレートへ検査を無制限に広げない。

通常のファイル分割、mod.rs、インラインmod、明示的なpath属性を扱い、論理名と物理配置の両方で技術分類名を検出する。path属性で業務名へ隠したvo.rsも対象になる。型・replayの照合にも同じ論理モジュール情報を使う。ファイル解決は [Rust Referenceのpath属性](https://doc.rust-lang.org/reference/items/modules.html#the-path-attribute)を基準にし、代表的な配置をrustcでも確認した。

`#[cfg(test)]` のモジュール、tests/benches/examples/vendor/target配下の内容は補助コードとして除外する。ただし、アプリケーション側が書いたラッパーのmod宣言は検査する。

参照先の欠落・複数候補、クレート外へのpath、循環、cfg_attrによるpath切替、項目マクロによるモジュール生成等は `domain-packaging.unresolved` で停止する。cfg全般の評価、マクロ展開、コンパイラと同等の意味解析は行わない。到達できない申告Rustファイルも検査済みとは扱わない。

## 担当と検査の分担

規約の正文は [共有ナレッジ](../knowledge/aidlc-shared/ddd-domain-packaging.md)に置く。

| ステージ | 責務 |
|---|---|
| ddd-domain-modeling | 業務語彙とコード名の対応を明らかにする |
| domain-design | domain_packagesと集約写像を作り、名前・階層・責務をレビューする |
| functional-design | 上流の配置を引き継ぐ |
| code-generation | 宣言に従って生成し、実モジュールとの照合結果を確認する |

| センサー | 検査 |
|---|---|
| ddd-mapping-declarations | 必須項目、予約名、重複、root・親・集約配置の宣言漏れ |
| ddd-reference-ids | パッケージが参照するモデルIDの解決 |
| ddd-rust-domain | 影響クレートの宣言・参照、実配置、予約名、宣言漏れ、解析不能 |

これらはblockingで通常の承認開始へ接続している。用語の意味や責務の妥当性はレビュー対象であり、センサー通過だけで保証しない。単独完了の標準側制約は [成果物契約](artifact-contract.ja.md)と同じ。

## 検証と実装

[直接回帰テスト](../tests/t7-domain-packaging.test.ts)と [入力ケース](../tests/golden/packaging/cases.ts)は、正常・禁止名・宣言不正・実配置・補助コード・解析不能・path経由replayを検査する。[承認テスト](../tests/t1-gate-integration.test.ts)はClaude/Codexそれぞれのdomain-designとcode-generationで正常・違反を検査する。配布物にも同じ入力を実行する。

実装は [宣言検査](../tools/ddd/lib/packaging/declarations.ts)、[Rustモジュール収集](../tools/ddd/lib/packaging/rust-modules.ts)、[実配置の照合](../tools/ddd/lib/packaging/evaluate.ts)。第三者のフレームワーク配布コードは変更していない。件数と実測結果は [現状評価](current-state-assessment.ja.md)に記録する。
