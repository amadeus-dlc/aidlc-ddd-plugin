<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-09-10T04:06:57Z — 登録リポジトリが `aidlc-workflows` だけで、開発の主戦場である `ddd/` が漏れていた; 利用者の指摘を受けて intents.json に `ddd` を追加した（登録を編集する専用コマンドはないため手で1行追加、バックアップ取得済み）。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-09-10T04:06:57Z — `aidlc-workflows` の scope fingerprint が `unknown` になった; サブモジュールのためコミット sha を取れず、テンプレートの「計算不能なら unknown」に該当する。再現性を確認した上で公開した。影響は次回再スキャン時に鮮度検証ができず読み直しに倒れることのみ（安全側）。
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-09-10T04:06:57Z — エンジン側は focused（プラグイン拡張点のみ深く）、ddd は full を選んだ; エンジン全体は TS 659 ファイルあり、今回使わない領域まで読むコストに見合わないと判断した。harness 投影の実装本体は skim 止まりなので、そこを根拠にする判断が出たら追加スキャンが要る。
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-09-10T04:06:57Z — 設計着手前に決着が要る4点: ステージ配置を自ステージの requires_stage だけで表現できる形に畳むか / 章構造強制の自前 gate センサーを書くか / mode: inline に寄せるか対象ハーネスを絞るか / コアの aidlc-architect-agent に足すか自前ペルソナを立てるか。
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
