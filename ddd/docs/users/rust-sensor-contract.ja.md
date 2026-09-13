# Rustセンサーの判定契約

[English](rust-sensor-contract.md) | 日本語

更新: 2026-09-13、T-02。変更先は `ddd/` の解析器、規則、テスト、生成手順、文書に限定した。第三者のフレームワーク配布物は変更していない。

## 名前の一致と、型の対応を区別する

| 規則 | 修正後の判定 |
|---|---|
| h: executeへの集約引数 | 正規モデルのAggregate.root_elementと対応するドメイン型だけを集約として検出。VO・Domain Primitive・同名の別型は区別する |
| i: 別ユースケース呼出し | 受信側を特定し、use-case層の具象型が持つinherent executeへの呼出しを検出。ポートtrait、他層の型、自分自身の同じ型への呼出しは区別する |
| b: 未宣言の変更 | クレート・モジュールを含む型の識別子でstruct/enumとimplを結び付ける。別ファイル・trait実装の変更も、実際のファイルと行で報告する |
| d: getter呼出し | 特定した受信側のドメイン型が持つgetterを調べる。同じ名前の別型のメソッドは違反扱いしない。既存どおりself自身への呼出しは対象外 |

集約のRust型は、モデルのルート要素の名前または安定IDからのPascalCaseで対応付ける。同名候補が複数ある場合は集約写像のcrate/moduleで特定し、それでも決まらなければ `model.unresolved` を残す。VOに集約と同名のコマンドメソッドを付けても、可変操作を許可する根拠にはならない。

## 照合する構文

通常のクレート・モジュール配置、インラインモジュール、module単位のuseと別名、グループ化use、単純なtypeエイリアス、crate/self/superを含むパスを扱う。集約引数は参照やBox/Arc/Rc/Option/Vec等の標準ラッパーの内側も調べる。

メソッドの受信側には、引数とletに明示された型、selfや明示型を持つ変数のフィールドを使う。型注釈のない初期化式からは推論しない。変数のシャドーイングやパターンによる再束縛がある場合は、外側の変数の型を誤って流用しない。

これはRustコンパイラの名前解決ではない。ジェネリックなtypeエイリアス、関連型、traitの実装選択、マクロ展開、型推論が必要な式は対象外。関数ローカルのuseがあるファイルでは型照合を抑制する。Cargoの依存別名やlib名変更など、通常の名前から対応しない構成は完全には扱わない。T-07でドメインクレートの明示的なpath属性をたどり、論理モジュールを型照合にも使うよう変更した。cfg_attrによるpath切替やマクロ生成等は解析不能として扱う。[パッケージング契約](domain-packaging-design.ja.md)を参照。生成コードのコンパイルとテストは別途必要である。

`&self` による内部可変性の全検出や、所有権を消費する操作全般の正当性判定も、この修正で保証する範囲に含めない。

## replayは明示した契約で許可する

集約写像の各行に、任意の `replay_methods` を追加した。既存の行で省略した場合は空配列として扱う。正規モデルのスキーマ自体は変更していない。

```yaml
aggregate_ref: aggregate.invoice
programming_model: class
persistence_method: event-sourcing
crate: billing-domain
module: crate
replay_methods:
  - method: apply_event
    event_ref: event.invoice.issued
```

規則bがreplayとして許すには、対象集約の写像が一意で、保存方式がevent-sourcingであり、crate/moduleが型の配置と一致する必要がある。該当メソッドの宣言も一意でなければならない。

さらに、引数が単一のドメインイベント型であり、event_refがその集約に所属するイベントへ解決されることを確認する。イベントのコード型は同じクレート内で一意に識別できる名前にする。数値引数、未知イベント、別クレート・別モジュール、重複した宣言では例外にしない。

名前をapplyやreplayへ変えるだけでは許可されない。逆に、以上の条件を満たせば別ファイルのimplでも許可する。メソッド本体が正しくイベントを適用するかは、レビューと動作テストで確認する。

設計センサーもreplay_methodsの形式とevent_refの参照を検査する。書式が壊れたリストを黙って省略しない。

## 未検査の箇所を残す

各センサースクリプトを直接実行したJSONには、`syntax.unresolved`、`model.unresolved`、必要に応じて `replay.disabled` のnoteを付ける。モデルがSKIP/absentなら、モデルに依存するb/h等の検査を行わない旨も記録する。

標準AI-DLC 2.8.2のディスパッチャは、成功したセンサーの任意のnoteをそのまま転送しない。このため、生成手順には直接実行のnoteを読み、未検査箇所をcode-summaryへ記載する指示を加えた。標準側を直接変更してはいない。`pass: true` は「確定した違反がない」という結果であり、全Rust構文や不変条件の検証済みという意味ではない。

## 回帰テスト

[追加Rustケース](../../tests/golden/rust/t2-cases.ts)は、VO・Domain Primitive、ポート、別ユースケース、別ファイルのimpl、traitの変更、別名・修飾型、getter名衝突、シャドーイング、明示replayと不正な例外を、実際のセンサースクリプトから検査する。

[設計ケース](../../tests/golden/design/cases.ts)には、replay参照の正常・未知ID・壊れた書式を追加した。同じケースをソースとClaude/Codexの配布物の両方で実行する。
