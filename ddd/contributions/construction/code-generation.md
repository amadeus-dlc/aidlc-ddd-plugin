---
target: code-generation
plugin: ddd
adds:
  consumes:
    - artifact: ddd-aggregate-mapping
      required: false
  sensors:
    - ddd-rust-domain
    - ddd-rust-use-case
    - ddd-rust-interface-adapter
fragments:
  - anchor: after-step:1
    order: 100
  - anchor: in:Sensors
    order: 100
---

## fragment: after-step:1

### Step 1x (ddd): Read the DDD conventions

Before planning, read the naming and placement conventions and carry them into
the plan:

- **ドメインのパッケージ名。** 共有ナレッジ `ddd-domain-packaging.md` と、集約写像の
  domain_packagesを読む。変更するドメインクレートの実モジュールを宣言に合わせ、
  aggregate/・impl/・vo/・entities/等の技術分類を作らない。宣言がなければ上流で確認し、
  コード生成側が勝手な用語で補わない。空・非公開・インラインmodやpath属性による配置も対象になる。
- **Naming and placement.** Crate suffixes (`-domain`, `-use-case`,
  `-interface-adapter`, `-infrastructure`), the `packages/<layer>/` or
  `modules/<layer>/` placement, the command / query / rmu segments, and the
  composition-root markers. Derive layers from the crate, not from a config file.
- **Domain layer.** No public fields; no mutating method that is not a declared
  Command; construct aggregates only through a full constructor.
  Rustのreplayは集約写像の `replay_methods` と一致させる。イベントソーシングの宣言、
  集約のクレート・モジュール、対象イベントID、単一のイベント引数型を照合する。
  `apply` などの名前だけで変更メソッドを例外にしない。
- **Use-case layer.** `execute` takes IDs and value objects, never an aggregate;
  a use case never calls another use case.
- **Interface-adapter layer.** The command side and query side do not depend on
  each other; the query side never references a domain type or repository port;
  repositories are named `<Aggregate>Repository`; adapters restore aggregates
  through the full constructor.

Report only source files in `source-manifest.json`; these claims identify the
affected files and crates. Domain packaging also inspects the reachable module
layout of each affected domain crate.

Rustの検査では、型宣言、明示された引数・変数・フィールドの型、モジュールのuse/aliasを照合する。
型推論が必要な箇所や曖昧な対応は違反と断定しない。各Rustセンサーを直接実行したJSONの
`note` も確認し、`syntax.unresolved` / `model.unresolved` の未検査箇所をcode-summaryへ記載してレビューする。
標準ディスパッチャが成功時にこの注記を転送するとは限らないため、ゲート通過だけで全箇所の検査済みを主張しない。

## fragment: in:Sensors

The three DDD Rust sensors fire on `code-summary.md`: `ddd-rust-domain`
(rules a, b, c, d, g plus the layer diagnostics), `ddd-rust-use-case`
(rules g, h, i, d) and `ddd-rust-interface-adapter` (rules k, l, m, n, g, and
every query-side file). Fix the code as the finding names the rule; a repeated
failure means the plan did not carry the conventions above.

ドメインセンサーは変更したファイルだけでなく、影響するドメインクレートのモジュール構成を検査する。
技術分類名、未宣言のモジュール、参照切れ、解析不能を解消する。語彙と責務の対応はコードレビューでも確認する。
