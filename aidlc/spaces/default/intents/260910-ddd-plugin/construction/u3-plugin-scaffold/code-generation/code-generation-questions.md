# Code Generation — 確認事項（U3 プラグイン足場 / u3-plugin-scaffold）

## Sources

- `inception/units-generation/unit-of-work.md`（U3 = PluginPackaging、kind: packaging、複雑度 S）
- `inception/requirements-analysis/requirements.md`（FR11.1、FR11.2、FR11.3、FR11.5）
- `ddd/.aidlc-plugin/plugin.json`、`ddd/package.json`、`ddd/biome.json`、`ddd/.gitignore`（既存の足場）
- `ddd/tests/README.md`（既存スイートの前提条件）

## 前提

本 Unit の足場はすでに作業ツリー上に存在し、`ddd/CHANGELOG.md` の v0.1.0 に含まれている。
Step 1・3・5・7・8 は既存の足場の検証であり、既存ファイルの改変も新規の足場の書き起こしも行わない。
アプリケーションソースの新規追加は Step 2・4・6・9 のテストファイル 1 本のみ、
記録の修正は Step 8b（本改訂で追加）のみである。

## 承認時に確認されたい点

**1. 本 Unit に属するテストファイルが存在しないため、計画は新設を含む。**
U3 は packaging であり、`ddd/tests/` の既存ファイル（`framework-compatibility.test.ts`、
`install.test.ts`、`codex-dispatch-bridge.test.ts`、U1・U2・U4・U5 のもの）はいずれも
本 Unit のものではない。Standard 戦略の「コンポーネントあたり 5〜8 件」を満たすため、
計画は Step 4・6 として `ddd/tests/u3-plugin-scaffold.test.ts` を**新規に追加し 6 件**を置く。
これが本 Unit で唯一新しく書く成果物である。床（5 件）は満たす。

**2. `bun run check` は終了コード 0 にならない見込みである（FR11.3 の一部未達）。**
既存の `tests/codex-dispatch-bridge.test.ts` の 12 件は `aidlc-workflows/dist/codex/aidlc` の
fixture を必要とし、`ddd/tests/README.md` が既知の前提条件として記載している。
`aidlc-workflows/` は読み取り専用のサブモジュールであり、明示的な指示なしには再生成しない。
したがって FR11.3 の 4 コマンドのうち `check` だけが環境の前提条件で未達となる見込みである。
目標を下げて通すことはせず、実測値を `code-summary.md` に記録する。

**3. 前回レビューの未解決 Major 所見 R-02 を、本改訂で Step 8b として計画に取り込んだ。**
`traceability.json` の FR11.2 の `target` が `ddd/stages/inception/ddd-domain-modeling.md`
——**U6 が所有し、本 Unit の `source-manifest.json`（5 パス）に含まれないファイル**——を
指していた。さらに `code-summary.md` の逸脱 5 は「FR11.2 は接頭辞規約を固定するテスト、
FR11.1 / FR11.5 は宣言そのもの」と書くが、実データは FR11.5 → テストファイル、
FR11.2 → U6 のステージ定義であり、説明と割り当てが一致していなかった。

Step 8b で次のとおり直す。修正後は 4 件すべてが本 Unit 所有のパスを指す。

| 要件 | 修正前の `target` | 修正後の `target` |
|---|---|---|
| FR11.1 | `ddd/.aidlc-plugin/plugin.json` | 変更なし |
| FR11.2 | `ddd/stages/inception/ddd-domain-modeling.md` | `ddd/tests/u3-plugin-scaffold.test.ts` |
| FR11.3 | `ddd/package.json`（GAP） | 変更なし |
| FR11.5 | `ddd/tests/u3-plugin-scaffold.test.ts` | 変更なし |

FR11.2 を本 Unit が最も直接に検証しているのは自分のテスト 2 件（`:141`、`:161`）である。
併せて `code-summary.md` の逸脱 5 の説明文を実データに一致させる。
アプリケーションソースは変更しない。

**この 3 点は隠さず計画に明記している。** 1 は計画で解消済み、2 は環境の前提条件による
既知の未達、3 は本改訂で Step 8b として取り込んだ。他に未解決の所見は無い。

---

## Plan Approval

承認対象は次の 3 つである。

1. `construction/u3-plugin-scaffold/code-generation/code-generation-plan.md`（埋め込みの Testing Contract を含む）
2. `construction/u3-plugin-scaffold/code-generation/unit-test-instructions.md`
3. 上記 2 つに埋め込まれた Testing Contract（`contract_sha256: sha256:8d7f1a7f51e8e641623b1e21dc4fed305238daeae0eb70f0d7e8c9b1a833a386`）

[Approval Fingerprint]: sha256:v3:9e15193828ee203f2301ac1c5fcd8eb401977002fb957ef022e4f7f5e30429ad
[Planned Source]: 149116c303229bbead56ee31f33c8444c8bffbe290c6504cdad9e7cbf4ceb706

- Approve Plan — proceed to code generation
- Request Changes — revise the plan

[Answer]: Approve Plan
