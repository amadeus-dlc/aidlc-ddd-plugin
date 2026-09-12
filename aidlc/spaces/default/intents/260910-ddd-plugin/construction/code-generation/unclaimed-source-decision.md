# 未申告ソース変更 9 件の扱い（RFC #662 の判定と、バイパスの根拠）

**日付**: 2026-09-12
**ステージ**: code-generation（3.5）
**判断**: `AIDLC_SKIP_SOURCE_FRESHNESS=1` でソース帰属検査をバイパスする
**判断者**: 人間（承認ゲートの直前に提示し、明示的に選択を得た）

## 何が起きたか

9 Unit すべてのレビューを終えて `aidlc-orchestrate.ts report --stage code-generation --result revised`
を実行したところ、ゲートが fail closed で閉じた。

```
Refusing to complete "code-generation": 9 application-source path(s) changed during
this stage run that no reviewed unit's source manifest claims
(.gitignore, README.ja.md, README.md, ddd/docs/decisions.ja.md, ddd/docs/decisions.md,
 ddd/patches/installed-harnesses.patch, ddd/scripts/install.ts, ddd/tests/install.test.ts,
 ddd/tsconfig.json).
Add each path to the owning unit's source-manifest.json and record that unit's one
bounded stale-receipt recovery review …, or revert the change.
Unclaimed source changes fail closed (RFC #662).
```

判定は `aidlc-state.ts:3962-3983`。ステージ開始時の source baseline と現在の一覧を比較し、
どの Unit の `source-manifest.json` にも現れないパスを拒否する。

## 9 件の出所

作業ツリーの未コミット変更はすべて Unit 所有で申告済みである（`git status` で確認）。
9 件は**このブランチの 3 つのコミット**に由来し、いずれもステージ実行中に行われたが
**Unit 分解の外側**の作業である。

| コミット | 内容 | 該当パス |
|---|---|---|
| `d7bbffa` | `feat(ddd): add a one-command installer for user projects` | `ddd/scripts/install.ts`、`ddd/tests/install.test.ts`、`ddd/patches/installed-harnesses.patch` |
| `6c97188` | `docs: rewrite the README in the deep-spec-analysis style` | `README.md`、`README.ja.md`（**ワークスペース根**） |
| `424cf7f` | `docs: add the usage, architecture, decisions and test guides` | `ddd/docs/decisions.md`、`ddd/docs/decisions.ja.md` |
| — | （U1 のコミット `0f08272` 由来） | `ddd/tsconfig.json` |
| — | | `.gitignore`（**ワークスペース根**） |

## なぜ「所有 Unit に割り当てる」を選ばなかったか

エンジンが第一に勧める手順は、各パスを所有 Unit の `source-manifest.json` に追加し、
その Unit の bounded recovery review を回すことである。**9 件中 7 件でこれが虚偽の帰属になる。**

| パス | 帰属できない理由 |
|---|---|
| `README.md`、`README.ja.md` | **`ddd/` の外**。AI-DLC フレームワーク自身の README であり、DDD プラグインのどの Unit の成果物でもない |
| `.gitignore` | **`ddd/` の外**。ワークスペース根のフレームワーク設定 |
| `ddd/patches/installed-harnesses.patch` | U9 のレビュー（前周回 R-03）が「フレームワーク側（ワークスペース根）の修正で U9 の責務外」と明示的に判定し、U9 の manifest から**撤回済み**（U9 逸脱 7） |
| `ddd/docs/decisions.md`、`decisions.ja.md` | U9 のレビュー（前周回 R-04）が「構築時の決定記録であり公開品質文書ではない」と判定し、**撤回済み**（同上） |
| `ddd/tsconfig.json` | U3 のレビュー（前周回 R-03）が「最新変更は U1 のコミット `0f08272` であり、本 Unit のステージ実行中に生じたドリフトではない」と判定し、**撤回済み**（U3 逸脱 6） |

残る 2 件（`ddd/scripts/install.ts`、`ddd/tests/install.test.ts`）だけは U9（packaging）に
近いが、installer は `unit-of-work.md` の U9 の責務記述（README / CHANGELOG / LICENSE /
統合テスト / 両ハーネスでの投影確認）に含まれない。

**つまり 4 件は、過去のレビューが「その Unit のものではない」と明示的に判定して撤回させた
まさにそのパスである。** いま再び manifest に書き戻すのは、レビューの判断を覆して
記録を実態と食い違わせる行為になる。本ワークフローで繰り返し是正してきた
「記録と実態の食い違い」を、ゲートを通すためだけに新たに作ることになる。

## 選んだ手段とその代償

`AIDLC_SKIP_SOURCE_FRESHNESS=1` を立てて `report` を実行する。
`aidlc-state.ts:3946-3948` の `attributionApplies` が偽になり、帰属検査全体が無効化される。

**これは fail-closed のガバナンス検査を意図的に迂回するものである。** 代償を明記する。

- 9 件の変更は、**どの Unit のレビューも通っていない**。本ステージのレビュー 9 回は
  いずれもこれらのパスを対象にしていない。
- 迂回するのは帰属検査だけで、他のゲート条件（全 Unit のレビュー完了、センサー判定）は
  通常どおり適用される。
- `AIDLC_SKIP_SOURCE_FRESHNESS=1` は**この `report` の 1 回にだけ**渡す。
  環境変数として永続化しない。

## 引き取り先

- **installer（`d7bbffa` の 3 パス）と docs（`6c97188` / `424cf7f` の 4 パス）は、
  この intent の Unit 分解に含まれない別の作業である。** 本来は別 intent として
  扱うべきもので、そこでレビューを受けるのが正しい。
- `build-and-test`（3.6）で全体スイートを回す際、これらのパスが含まれることを前提にする。
  特に `ddd/tests/install.test.ts` は既存スイートの一部として緑である必要がある。
- `.gitignore` と ワークスペース根の `README` は AI-DLC フレームワーク側の資産であり、
  DDD プラグインの公開品質（U9）の対象外である。
