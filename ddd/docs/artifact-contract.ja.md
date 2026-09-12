# DDD成果物と承認時検査の契約

[English](artifact-contract.md) | 日本語

更新: 2026-09-13、T-01のプラグイン側修正。標準AI-DLC 2.8.2の成果物名解決と既存のUnit種別を使う。フレームワーク本体へのパッチは追加していない。

## 正規データと説明を登録済みファイルへ揃える

| ステージ | 論理成果物 | ファイルと内容 |
|---|---|---|
| ddd-domain-modeling | ddd-domain-model-yaml | `ddd-domain-model-yaml.md` のラベル付きYAMLブロック1つが正規データ |
| ddd-domain-modeling | ddd-domain-model | `ddd-domain-model.md` が人間向けの説明 |
| domain-design | ddd-aggregate-mapping | `ddd-aggregate-mapping.md` のYAMLブロック1つが集約写像 |
| functional-design | functional-spec（既存） | `functional-spec.md` 内の `## DDD Use-case Declarations` にYAMLブロック1つ |
| infrastructure-design | cicd-pipeline（既存） | `cicd-pipeline.md` 内の `## DDD Layer Structure` にYAMLブロック1つ |

`model_ref` はレコード相対の `inception/ddd-domain-modeling/ddd-domain-model-yaml.md` を使う。YAMLのデータスキーマはversion 1のままで、Markdownは運搬形式である。説明文書とのID・不変条件本文の対応は引き続き検査する。

旧 `domain-model.yaml` と `domain-model.md` は自動探索しない。既存成果物を移す場合は、YAMLを新しいデータファイルのコードブロックへ包み、説明を新名へ移し、すべての `model_ref` を更新して再検査する。下位のローダーAPIは生YAMLも読めるが、通常ステージの生成先に旧名を使う根拠にはしない。

## 追加宣言を既存成果物の必須セクションにする

標準のcontributionは `produces_kinds` を合成できないため、新しい成果物を全Unitへ追加すると既存のレビュー対象の適用範囲と衝突する。独立した宣言ファイルを廃し、登録済みレビュー成果物の内容として組み込んだ。

| 必須セクションの所有者 | 適用するUnit種別 | 対象外 |
|---|---|---|
| functional-spec | service / spec / ui / library | packaging |
| cicd-pipeline | service / ui / packaging / library | spec |

層構造をcicd-pipelineへ置くのは、パイプラインが検証・配布するコンポーネントの境界をレビュー対象に含め、libraryにも同じ契約を適用するためである。インフラ構成全体は従来のinfrastructure-specificationが所有する。

対象Unitにユースケースや層構造がなければ、該当リストを明示的に空配列とし、理由を説明する。キー欠落や配列以外の値を空配列へ読み替えない。必須セクションの欠落・重複、YAMLの欠落・未閉鎖・複数ブロックも拒否する。他セクションのYAML例を誤って正規宣言に使わない。

英語の生成手順では英語の見出しを使う。既存成果物との互換性のため、従来の `## DDD ユースケース宣言` と `## DDD 層構造宣言` も受理する。両言語を通じて該当セクションは1つだけとし、英語・日本語を同じ成果物へ重複して置くことは拒否する。本文の言語はプロジェクト方針に従い、`aidlc/` の既存の日本語記録を書き換える必要はない。

## 集約写像にパッケージ宣言を含める

T-07で `ddd-aggregate-mapping.md` のYAMLに `domain_packages` を必須項目として追加した。各パッケージのcrate、module、term、model_refs、rationaleを記録し、root・親階層・集約配置も宣言する。既存成果物も追記して再検査する。モデル設計をSKIPしたことだけを理由に、コード側のパッケージ宣言を免除しない。形式と検査範囲は [パッケージング契約](domain-packaging-design.ja.md)を参照。

## 通常の承認開始で欠落を検出する

モデル完全性は、説明・データの両ファイルを発火対象にする。片方が残れば他方の欠落を検出し、両方なければ標準の成果物存在ガードが拒否する。

写像・ユースケース・層構造のセンサーは、そのステージの登録済み成果物から発火し、宣言を所有するファイルへ解決して検査する。例えばfunctional-specがなくtraceabilityだけが存在する場合も、宣言の欠落を検出する。`matches` は標準ディスパッチャの制限に合わせ、複数の波括弧展開を重ねない。

センサーの起点になるのは標準処理が列挙する登録済み成果物である。任意のファイルを置くだけでは発火しない。

## 単独完了には標準側の不足が残る

AI-DLC 2.8.2の `report --single --result completed` は、CodeKB以外の一般成果物の存在やゲートセンサーを確認しない。DDD成果物がゼロでも `kind: done` を返すことを、一時プロジェクトの再現テストで確認した。

そのため単独実行では、ステージ本文の完了前検査を明示的に実行する必要がある。検査を省略した `report --single` 自体をDDDプラグインだけで拒否できるとは主張しない。この機械的保証は標準側の別課題であり、T-01全体は未完了とする。

再現コマンド（現行2.8.2では失敗が期待される）:

```sh
DDD_VERIFY_FRAMEWORK_SINGLE=1 bun test ddd/tests/t1-gate-integration.test.ts -t 'standard isolated completion'
```

通常のテスト実行ではこの上流再現ケース1件をskipし、プラグインの回帰と区別する。標準側が修正されたら同じコマンドの成功を確認して必須検証へ移す。

## 検証範囲

[t1-gate-integration.test.ts](../tests/t1-gate-integration.test.ts) はClaude/Codexへ一時的にcomposeし、実際の `orchestrate report --result awaiting-approval` から検査する。正常・不正・ファイル欠落・セクション欠落・リスト欠落と、Unit種別の適用範囲を確認する。

このテストでは無関係なコア文書センサーを除外し、Q&A・レビュー証跡はテスト用設定で省略する。DDDセンサーと成果物ガードは有効なままにする。実際の人間の承認、モデルによる生成、レビューまでの一連の実機検証を代替するものではない。

[t1-model-artifacts.test.ts](../tests/t1-model-artifacts.test.ts) と既存ゴールデンケースは、同じファイル形式でセンサーを直接実行する。配布物も `bun scripts/verify-dist.ts claude codex` で確認する。
