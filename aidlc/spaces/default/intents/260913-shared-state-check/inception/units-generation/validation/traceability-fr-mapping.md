# plugin-devのAI-DLC 2.8.2互換性 — ローカル調査メモ

## 結論と扱い

2026-09-13、AI-DLC 2.8.2の`units-generation`に対する`sensor-traceability`で、FR形式の要件IDをUnitへ対応付けた表が認識されないことを再現した。同じ列構成でUS形式を使った対照ケースは合格した。

この利用条件に対して、こちらの`plugin-dev`はUser Storiesを省略してUnits Generationを実行する構成だった。対応対象を2.8.2とする開発スコープ側の互換性問題として、User Storiesを含め、要件→ストーリー→Unitを生成・検証する経路へ合わせる。

ユーザーの指示に従い、この調査はローカルのメモとして残す。本家への連絡・Issue作成は行っていない。外部への投稿や第三者の実装変更は、ユーザーから別途明示された場合に扱う。

## 発生した問題

[要件対応表](../unit-of-work-story-map.md)と[traceability.json](../traceability.json)には、FR1〜FR6と全小項目の21 IDを記載している。主担当はU1が11 ID、U2が10 IDで、独自検証と独立レビューでは一致を確認した。

一方、専用センサーは全21 IDを対応なしとし、`pass=false`、21件のgaps、21件のinvalid_targets、全体理由を含む43件のfindingsを返した。診断の要旨は`unit-of-work-story-map.md contains no story-to-unit mappings`である。

[配置済みのステージ定義](../../../../../../../../.codex/aidlc-common/stages/inception/units-generation.md)は、User Storiesがない場合にFRを使うよう指定している。今回の要件ID利用はその指定に従っている。

## 切り分け結果

元の21 IDを使い、独立した一時ワークスペースで次の表現を比較した。

| 入力 | 結果 |
|---|---|
| 元の表のコピー | 不合格、43 findings |
| 要件ID・Unit ID・Directoryの三列だけにした表 | 不合格、43 findings |
| 各IDをインラインコード表記にした表 | 不合格、43 findings |
| Unit IDを先頭列にした表 | 不合格、43 findings |
| FRを維持し、列名だけStory IDにした表 | 不合格、43 findings |
| 隔離した対照ケースでUSを使った表 | 合格、0 findings。Requirement ID、Story IDのどちらの列名でも同じ結果 |

さらに一項目だけの独立した最小入力でも再現した。

| 入力 | 期待する結果 | 実際の結果 |
|---|---|---|
| FR1 → U1 | 合格 | `pass=false`、3 findings |
| US1.1 → U1（対照） | 合格 | `pass=true`、0 findings |

この結果から、列名・列順・説明列の有無ではなく、少なくとも2.8.2のFRを使う対応検証経路に不整合があると判断する。第三者の実装は読んでおらず、内部のどの関数が原因かまでは断定していない。

## 再現手順と証跡

必要なものはBunと`aidlc`。ワークスペースのルートから次を実行する。

```sh
bun run aidlc/spaces/default/intents/260913-shared-state-check/inception/units-generation/validation/reproduce-traceability-fr.ts
```

[再現スクリプト](reproduce-traceability-fr.ts)は、独立した一時ディレクトリに検査入力を作り、FRとUSの二ケースを実行する。既存の作業記録・設定・要件IDを変更せず、承認や監査イベントも作らない。出力先と結果を標準出力へ表示する。

スクリプトの終了コードは、両ケースが期待どおり合格すれば0、どちらかが未合格なら1。確認した2.8.2ではFR側が失敗するため1になる。センサー自身のプロセス終了コードは両ケースとも0であり、合否はJSONの`pass`で確認する。

[保存した最小再現の結果](traceability-fr-results.json)には、実際の判定と診断を残した。一時ディレクトリの絶対パスだけを`<fixture-root>`へ置換している。

確認した版は`aidlc 2.8.2 (runtime 2.8.2)`。同日の`aidlc update --check`も`binary 2.8.2 is latest`を返した。バイナリの更新は行っていない。

## 作業の状態

[初回レビューのR-01](../../../.aidlc-reviews/units-generation/stage/1d497e2cc260e231/1.json)は未解決のままである。User Storiesは実際の計画へ追加しておらず、FRをUSへ置き換えて合格させる変更も行っていない。

再利用する`plugin-dev`定義にはUser Storiesを追加した。`ddd/scripts/verify-development-scopes.ts`では、標準2.8.2に対する要件→ストーリー、ストーリー→Unitの合格と、不一致Unitの拒否を確認する。修正前のスコープはこの検査で失敗し、修正後は合格した。通常の`bun run check`へも接続する。

進行中の作業単位は修正中である。標準の経路変更で実際のUser Storiesを作成し、承認済み要件との対応と、影響する設計・Unitの対応表を更新して専用検証と再レビューを行う。2.8.2本体の修正版待ちを、こちらの互換性対応の前提にはしない。
