# ネイティブ抽出器の配布

[English](native-extractor-distribution.md) | [検査契約の設計](inspection-contract-design.ja.md)

Rust + syn のネイティブ抽出器は、`error-contract/1`・`state-exposure/1`・`domain-facts/1` の抽出プロトコルに応答する1つの実行ファイルです。この文書は、設置先、この配布が対応するプラットフォーム、導入先へ届く経路、起動できないときの応答、ゲート実行時に Rust ツールチェーンを要求するかどうかを記録します。

## 設置先

1つのビルドを1か所に設置し、各入口がそれを起動します。

```
tools/ddd/bin/manifest.json                        # この配布が対応するプラットフォーム
tools/ddd/bin/<platform-key>/ddd-rust-syn-spike    # 1プラットフォーム分のビルド
```

`<platform-key>` は `${process.platform}-${process.arch}` です（例: `darwin-arm64`）。[`manifest.ts`](../../tools/ddd/lib/rust/native/manifest.ts) は自身からの相対でこのパスを解決するため、ソースツリー、`dist/<harness>/`、導入先プロジェクトのいずれでも同じ相対位置になります。

[`rust/error-contract/index.ts`](../../tools/ddd/lib/rust/error-contract/index.ts)、[`rust/state-evidence/index.ts`](../../tools/ddd/lib/rust/state-evidence/index.ts)、[`rust/domain-facts/index.ts`](../../tools/ddd/lib/rust/domain-facts/index.ts) は、いずれも既定の起動パスをこのモジュール経由で解決するため、独自の設置パスを持ちません。protocol のバージョンは各入口が持ったままです（error-contract は 3、state-exposure は 2、domain-facts は 5）。manifest はいずれも記録しません。protocol 番号と抽出器・syn のバージョンは、それを検証するコード側が正本です。

| protocol | 版フラグ | `protocol_version` | 読む側 |
|---|---|---|---|
| `error-contract/1` | `--error-contract-version` | 3 | 操作エラー集合の照合 |
| `state-exposure/1` | `--state-exposure-version` | 2 | 状態公開の検査 |
| `domain-facts/1` | `--domain-facts-version` | 5 | `ddd-rust-domain` が報告するすべての規則、および他の Rust ゲートとモジュール走査が用いるプログラム解決・モジュール解決 |

呼び出し側は `extractRust` に明示的な command を渡せます。これは制御された検証シナリオで観測する対象プロセスを指すため、渡されたまま起動し、設置済み抽出器の解決も検証も行いません。

## 対応プラットフォーム

| platform key | Rust ターゲットトリプル | 状態 |
|---|---|---|
| `darwin-arm64` | `aarch64-apple-darwin` | ビルド済み・同梱済み |

ビルドは対象プラットフォーム上でしか生成できないため、manifest にはこの配布を準備したプラットフォームを記録します。それ以外の環境（Linux、Windows、および x86_64 全般）は**対象外**であり、対応済みとは表示しません。manifest に行がないプラットフォームは、設置されたことのないパスを指すのではなく `unsupported-platform` として解決されます。プラットフォームを追加するには、そのプラットフォーム上で下記のビルドを実行し、生成されたバイナリと manifest の行をコミットします。

5つの入口がこの抽出器で判定するため、対象外の環境ではいずれも合格せず検査不能として停止します。申告ファイルを起点とする3つのゲート（`ddd-rust-domain`、`ddd-rust-use-case`、`ddd-rust-interface-adapter`）は、申告ファイルによって規則が判定する対象を持つ実行で停止し、そのようなファイルを申告しない実行では従来どおり verdict を報告します。`ddd-rust-module-layout` と CI 用入口 `ddd-check-rust-module-layout` は申告を読みません。モジュール走査は次に開くファイルをこの抽出器が報告する宣言から決めるため、すべての実行でこの抽出器を必要とします。

## ビルドとプラットフォームの記録

`ddd/` で実行します。

```sh
bun run prepare:native
```

[`prepare-native-extractor.ts`](../../scripts/prepare-native-extractor.ts) は `rustc -vV` からホストトリプルを読み、`cargo build --locked --offline --release` に明示的な `--target` を渡してビルドし、結果を製品パスへ設置し、実行権限を付与し、**3つすべて**の protocol を照会し、ホストの platform key に対する `{ target, sha256 }` を manifest へ記録します。内容が同一なら再コピーしません。ビルド準備の子コマンド上限は120秒、版プローブの上限は180秒で、失敗したビルドは設置しません。他プラットフォームの既存の行は保持します。

## 導入先へ届く経路

`tools/` は既に配布対象の payload であり、`tools/ddd/**` は既に導入の所有対象です。したがって抽出器と manifest は他のプラグインファイルと同じ経路を通ります。プラグインビルドが `dist/claude/` と `dist/codex/` へ射影し、compose がプロジェクトへ書き込み、[`install.ts`](../../scripts/install.ts) が `owned_files` へ記録します。新規導入と `--update` の両経路で配置されます。

射影と compose は payload のバイトをモード指定なしで書き込むため、抽出器は実行権限を持たない状態で届きます。導入側は、compose の完了後・候補ツリーの読み取り前に、候補ツリーの内側で実行権限を付与します。これにより導入先は衝突検出で保護されたままで、反映は原子的なままです。抽出器のパスに利用者所有のファイルが既にある場合は payload の衝突として拒否し、導入先は変更しません。

## 抽出器を起動できないとき

[`launch.ts`](../../tools/ddd/lib/rust/native/launch.ts) は1回の起動を1回だけ分類し、各入口はその1つの結果を1件の報告へ投影します。各条件は後段が前段の成立を前提とするため、固定順で判定します。存在しないファイルはハッシュできず、実行権限のないファイルは照会できず、protocol の不一致は完了した照会でしか判定できません。

| 順序 | 条件 | 報告される subject | reason code |
|---|---|---|---|
| 1 | manifest にこのプラットフォームの行がない | `native-extractor:unsupported-platform` | `tool-unavailable` |
| 2 | 設置先にファイルがない | `native-extractor:binary-missing` | `tool-unavailable` |
| 3 | ファイルに実行権限がない | `native-extractor:binary-not-executable` | `tool-unavailable` |
| 4 | バイトが記録済みダイジェストと一致しない | `native-extractor:checksum-mismatch` | `tool-unavailable` |
| 5 | 照会が完了せず、応答が得られない | `native-extractor:probe-failed` | 観測が報告した code（`tool-unavailable`、`execution-failed`、`timeout`、`output-limit`、`resource-limit` のいずれか） |
| 6 | 照会は完了したが、期待する protocol を返さない | `native-extractor:protocol-mismatch` | `unknown-version` |

各条件は固有の subject を持つため、報告が2つを混同することはありません。複数が同時に成立する場合は、順序が先のものだけを報告します。ダイジェストの検査は起動より前に行うため、改変されたバイトが実行されることはありません。完了しなかった照会は、観測が与えた reason code をそのまま保ちます。起動の失敗、タイムアウト、出力量の超過は、protocol の不一致として言い換えられることなく、それぞれのまま報告されます。

いずれも合格になりません。2つの検査契約では、抽出は `completed` 以外の実行状態を返し、その reasons が該当の報告を運びます。共通の検査規則により `executionState` は `unavailable`、`ruleResult` は `unresolved` となり、未解決理由に該当の報告が載ります。

`domain-facts/1` を読む入口では、同じ報告が次の2つの終端のいずれかに届きます。終端の形が違うのは入口が違うためで、分類が入口ごとに変わるわけではありません。

| 入口 | 起動が止まったときの終端 |
|---|---|
| `ddd-rust-domain`、`ddd-rust-use-case`、`ddd-rust-interface-adapter`、`ddd-rust-module-layout` | センサー実行時の tool-unavailable の終端。終了コード 127、stdout に verdict を出さず、理由は stderr へ出す |
| `ddd-check-rust-module-layout` | 自身の catch。終了コード 1 と stdout の `{"pass": false, "reason": …}`。走査を完了した実行が返す件数の結果はいずれも含まない |

申告ファイルを起点とする3つのゲートでは、申告ファイルによって規則が判定する対象を持つ実行でこの終端に達します。そのようなファイルを申告しない実行ではどの規則も評価されないため、この分類はその実行の verdict を変えず、ゲートは従来どおり verdict を報告します。モジュール走査は申告を読まないため、その2つの入口は起動が止まった時点で終端に達します。実行できない検査は承認しません。

## ゲート実行時の Rust ツールチェーン

**ゲートは抽出器のために Rust ツールチェーンを要求しません。** ビルドを同梱しているため、解決・検証・起動のいずれにも `rustc` と `cargo` は不要です。platform key は実行中のプロセスから、ターゲットトリプルとダイジェストは manifest から得られ、実行ファイルはパスで起動します。[`operation-error-set-verification/rust.ts`](../../tools/ddd/lib/operation-error-set-verification/rust.ts) が Cargo 条件へ渡すトリプルを manifest から読むのは、この理由によります。

`resolveCargoCondition` は引き続き `cargo metadata --format-version 1 --frozen` を実行します。これは**検査対象プロジェクト**側の要求であり、本プラグインの要求ではありません。検査対象ワークスペースのビルド条件を解決するもので、`--frozen` は取得と lockfile の書き込みを禁じるため、準備されていないワークスペースは暗黙に準備されるのではなく利用不能として報告されます。

開発用コマンドはこれとは別です。`bun run prepare:native`、`bun run verify:error-contract`、`bun run verify:operation-error-set`、`bun run experiment:rust-syn` は Rust ソースのビルドや測定を行うため、従来どおり `cargo` と `rustc` を必要とします。

## 対象外

TypeScript 側抽出器の配布と、Rust crate の `experiments/rust-syn/` からの移動は、この変更の範囲外です。規則 `a`・`d` は T-10-02 で接続済みで、T-10-03 では `ddd-rust-domain` が報告する残りの規則と、その packaging 規則が読むパッケージ解決・モジュール解決を接続しました。`ddd-rust-use-case` と `ddd-rust-interface-adapter` だけが報告する6件の規則のうち4件（`h`・`l`・`m`・`n`）は、今も宣言の列挙を tree-sitter の構文木から行い、各候補の解決はネイティブのプログラム解決で行います。`i` と `k` はすでにネイティブの呼び出し事実と `use` 事実で判定します。tree-sitter 資産自体は同梱を続けます。
