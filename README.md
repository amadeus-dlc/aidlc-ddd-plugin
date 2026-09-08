# aidlc-ddd-plugin

AI-DLC v2 向け DDD（ドメイン駆動設計）プラグインの開発ひな型です。
`deep-spec-analysis` のリポジトリ構成をもとに、プラグイン本体とフレームワークを分離しています。
現在は構成とビルド経路のみを用意しており、DDD 固有のステージやセンサーは未実装です。

## セットアップ

```sh
# 初回clone時にサブモジュールを取得しておきます。
mise trust
mise install
cd ddd
bun install
bun run prepare:harnesses
bun run check
bun run build:claude
bun run build:codex
```

ビルド結果は `ddd/dist/<harness>/` に生成されます。
対象プロジェクトへのインストールや compose は、このセットアップでは行いません。

## 構成

| パス | 役割 |
| --- | --- |
| `ddd/` | プラグインのソース。詳細は [ddd/README.md](ddd/README.md) |
| `aidlc-workflows/` | 参照元と同じリビジョンに固定したフレームワークのサブモジュール |
| `ddd-sandbox/` | 今後 compose の検証に使う使い捨て環境。Git 管理対象外 |
| `mise.toml` | 参照元からコピーした Bun・Node のバージョン指定 |

DDD の機能は `ddd/` の追加定義で拡張します。
`aidlc-workflows/` は本家参照用で、変更しません。Codex互換性の修正は `.claude/`・`.codex/` のコピーにだけ適用します。
修正内容と再適用手順は [互換性パッチと検証](ddd/docs/framework-compatibility.md) を参照してください。
`.claude/`・`.codex/`・`.agents/` には、開発用ハーネスのコピーを含めています。
参照元のソルバー実装、仕様解析固有のテスト、実行履歴は含めていません。
CI と配布用インストーラは、DDD の実装・配布方針が決まった段階で追加します。

## ライセンス

参照元の [MIT ライセンス](LICENSE) と著作権表記を引き継いでいます。
フレームワークにはサブモジュール内のライセンスが適用されます。

参照元の保護設定は [読み取り専用の運用](ddd/docs/reference-read-only.md) を参照してください。
