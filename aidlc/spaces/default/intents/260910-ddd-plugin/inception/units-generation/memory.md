<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-09-10T10:25:19Z — 承認ゲートで Request Changes が選ばれた直後に確認質問（What should change?）を挟んだところ、その回答が人間ターンを消費して却下の記録が拒否され、セッションが終了した; 再開時はゲートを再提示して選び直してもらう。フィードバックが既に明確なときは確認質問を挟まず、そのまま却下として記録する。
- 2026-09-10T09:56:24Z — user-stories を実行しないスコープでは、ストーリーマップの代わりに要件 ID（FR／NFR）を Unit に写像した; ステージ定義は「stories.md が無ければ FR を列挙」と定めているが、対応表の自動検査はストーリー ID（USx.y）の行しか読まないため、FR ベースの対応表は「写像なし」と誤判定され、全 FR が GAP として報告される。検査は advisory で承認は止まらない。プラグイン開発のように user-stories を省くスコープでは、この誤報を承知の上で対応表を読む必要がある。
- 2026-09-10T09:56:24Z — 要約確認で「合計 10 Unit」と書いたが実際は 9 Unit だった; 分解計画の承認時に訂正して人間の承認を得た。要約の合計数は候補を数え直してから書く。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-09-10T10:39:00Z — R-03 の修正で質問ファイルの要約を「合計 9 Unit」に直し要約確認を取り直したところ、成果物が旧確認のもとで保存された記録のままだったため再レビューの受付が拒否された; 成果物の保存し直しは作業フォルダがプロジェクトルートでないと記録に残らない。最終的に redo で試行を作り直し、既存成果物を Keep したうえで要約確認と保存し直しを行った。成果物の内容は一切変えていない（ハッシュ一致）。
- 2026-09-10T09:21:05Z — レビュー所見が未解決のまま残る承認ゲートでは、Request Changes を先頭、Approve を2番目に提示する; 利用者からの指摘（Domain Design のゲートで Approve が先頭だった）。標準の並び（Approve 先頭）から意図的に外す。所見が無い、または全件解消済みのゲートは標準どおり Approve 先頭。
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-09-10T10:12:01Z — レビュー R-03（確認済み要約の「合計 10 Unit」）は質問ファイルを直さず、分解計画の承認記録と成果物側の 9 Unit を正とした; 確認済みの要約を書き換えると要約確認のやり直しが必要になり、成果物はすでに 9 Unit で一貫しているため、修正の益より手戻りの方が大きいと判断した。
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
