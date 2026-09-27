# TypeScript の事実抽出

[English](typescript-fact-extraction.md) | [ネイティブ抽出器の配布](native-extractor-distribution.ja.md)

TypeScript の事実抽出は、TypeScript のソースを、TypeScript の規則が判定に使う事実へ変換する。事実は、各ファイルの宣言、そのメンバーと可視性、import と export（型だけのものを区別する）、呼び出し、構築である。この文書は、Compiler API が導入先へどう届くか、対応する Compiler API の版とプロジェクト設定、抽出を起動できないときに何を報告するか、返す事実の契約を記録する。この事実を読むセンサーはまだ無い。TypeScript の規則は T-11 の後続作業である。

## 配布する Compiler API

配布物が Compiler API を同梱する。導入先のプロジェクトには `typescript` パッケージが無いことも、別の版があることもあり、抽出は配布物だけから起動しなければならない。

```
tools/ddd/lib/typescript/vendor/typescript.js               # typescript@6.0.3 の lib/typescript.js をそのまま複製
tools/ddd/lib/typescript/vendor/manifest.json               # {"typescript.js": {"sha256": "<digest>"}}
tools/ddd/lib/typescript/vendor/LICENSE.txt                 # Apache-2.0
tools/ddd/lib/typescript/vendor/ThirdPartyNoticeText.txt
tools/ddd/lib/typescript/vendor/NOTICE.md
```

[`compiler/launch.ts`](../../tools/ddd/lib/typescript/compiler/launch.ts) は `vendor/` を自身からの相対で解決する。そのため、ソースツリー、`dist/<harness>/`、導入先で同じ相対位置が成り立つ。compiler は絶対パスで読み込む。抽出のどのモジュールも実行時に素の `typescript` を import しないので、導入先の `node_modules` は参照されない。

導入先の `typescript` を使い、その版を検査する方式は採らなかった。パッケージが無い、または別の版があるプロジェクトでは抽出を起動できず、配布物だけから起動するという条件に反するためである。

これらのファイルは `tools/` の他の配布物と一緒に届く。プラグインのビルドが `dist/claude/` と `dist/codex/` へ射影し、compose が導入先へ書き込み、[`install.ts`](../../scripts/install.ts) が `owned_files` に記録する。新規導入と `--update` のどちらでも配置される。このディレクトリは lint とカバレッジの対象外で、`.gitattributes` でバイト列を保ち、`.gitignore` で明示的に追跡対象にしている。リモート導入は git ソースを取得するためである。

### 同梱する compiler の準備

`ddd/` で実行する。

```sh
bun install --frozen-lockfile
bun run prepare:typescript
```

[`prepare-typescript-compiler.ts`](../../scripts/prepare-typescript-compiler.ts) は、対応する版以外の `node_modules/typescript` を拒否し、`lib/typescript.js` と2つのライセンス文書を `vendor/` へ複製し、複製したバイト列から `manifest.json` を書き直す。`bun run check` は試験の前にこれを実行する。同梱した compiler が開発用依存関係や記録した digest と異なれば、試験が失敗する。

## 対応する Compiler API の版とプロジェクト設定

版と設定は [`compiler/settings.ts`](../../tools/ddd/lib/typescript/compiler/settings.ts) の1か所で定める。error-contract の入口と事実抽出は、どちらもここから読む。

| 項目 | 対応範囲 |
|---|---|
| Compiler API | `6.0.3` ちょうど（開発用依存関係も同じ版に固定している） |
| ルートの `tsconfig.json` | 存在し、解析でき、1件以上のパッケージを references で参照する |
| 参照する各パッケージの `tsconfig.json`（継承する設定を含む） | `module: esnext`、`moduleResolution: bundler`、`target: esnext`、`strict: true` |
| `customConditions` | 空でない名前の任意の並び |
| パッケージ間 | すべてのパッケージが、`customConditions` を含めて同じ設定を持つ |

書かれていない設定は、別の値を持つ設定と同じく拒否する。そのため、プロジェクトが一度も書いていない設定で検査することはない。

## 抽出を起動できないとき

`classifyTypeScriptExtractor(workspaceRoot)` は1回の起動を1回だけ分類し、`typeScriptExtractorIssue` はその1つの結果を1件の報告へ投影する。報告の形はネイティブ抽出器と同じ `{code, subject, message, location: null}` である。各条件は前の条件の成立を前提とするため、固定した順で検査する。

| 順 | 条件 | 報告の subject | 理由コード |
|---|---|---|---|
| 1 | manifest が無い、manifest が digest の記録になっていない、または compiler のファイルが無い | `typescript-extractor:compiler-missing` | `tool-unavailable` |
| 2 | compiler のバイト列の sha256 が記録した digest と一致しない | `typescript-extractor:checksum-mismatch` | `tool-unavailable` |
| 3 | compiler の読み込みが例外を出す | `typescript-extractor:load-failed` | `tool-unavailable` |
| 4 | 読み込んだ compiler が別の版を報告する、または版を報告しない | `typescript-extractor:version-mismatch` | `unknown-version` |
| 5 | 検査対象のプロジェクトが対応範囲の外にある | `typescript-extractor:project-condition-mismatch` | `tsconfig.json` が無い、または読めない場合は `tool-unavailable`、設定が範囲外の場合は `unsupported-syntax` |

条件ごとに固有の subject を持ち、複数が成立する場合は最初のものだけを報告する。digest は compiler を読み込む前に照合するため、改変されたバイト列が評価されることはない。

いずれの条件でも合格にはならない。`requireTypeScriptFacts` は、起動できない結果と、完了しなかった抽出を `ToolUnavailableError` に変換する。センサーの実行基盤はこれを、ツールを利用できないときの終端にする。終了コードは 127、stdout に判定を出さず、stderr に理由を出す。Rust の `requireDomainFacts` と同じである。実行できない検査は承認しない。

## 事実の契約

`requireTypeScriptFacts(outcome, sources)` は `{file, source}` の組を受け取り、`{files, notes}` を返す。`files` は各ファイルからその事実への対応である。`notes` は、事実を隠しうる構文ごとに1行を持ち、整列し、重複を除く。ソースを1件も含まない要求には、空の `files` と空の `notes` を返す。

各ソースは、その本文だけから解析する。ライブラリ、モジュール解決、アンビエント型、出力はいずれも使わない。`.tsx` で終わるパスは TSX として、それ以外のパスは TypeScript として解析する。compiler が構文を拒否したファイルは、`files` に**記録を持たない**。空の記録にはしない。そのファイルには `domain-facts.unresolved: <file>:<line> syntax-error` の note が付き、同じ要求の他のファイルは読まれる。

位置: 行は1始まり。span は `{start_line, start_col, end_line, end_col}` で、列は UTF-16 のコード単位で数えた1始まり、終了列はノードの最後の文字の1つ後を指す。各リストはソース順に並ぶ。

| フィールド | 記録 |
|---|---|
| `declarations` | ファイル先頭の各文について `{name, kind, binding?, exported, default_export, ambient, span, members}`。`kind` は `class`、`interface`、`type-alias`、`enum`、`function`、`variable` のいずれか。変数は `binding`（`const`、`let`、`var`、`using`、`await-using`）も持つ。名前の無い default export のクラスや関数の名前は `default`。`exported`、`default_export`、`ambient` は、宣言に書かれた `export`、`default`、`declare` から決まる |
| `members` | `{name, kind, visibility, static, readonly, span}`。クラスのメンバー（プロパティ、メソッド、アクセサ、コンストラクタ、コンストラクタのパラメータプロパティ）、interface と型リテラルのメンバー、enum のメンバー、変数を初期化するオブジェクトリテラルのメンバー。`visibility` は `public`、`protected`、`private`、`private-name`（`#name`。名前は `#` 付きで綴る）のいずれか。呼び出しシグネチャ、構築シグネチャ、インデックスシグネチャ、static ブロックはメンバーにしない。そのオブジェクトリテラル内のスプレッドはメンバーにせず、未解決（`object-spread`）として返す |
| `imports` | `{specifier, kind, type_only, bindings, line}`。`kind` は `named`、`default`、`namespace`、`side-effect`、`dynamic`（`import("…")`）、`type-query`（`import("…").T` のような import 型）のいずれか。`bindings` は `{name, imported, type_only}` で、default import の `imported` は `default`、名前空間 import では `*` |
| `exports` | export 文ごとに `{kind, specifier?, type_only, names, line}`。`kind` は `named`、`all`、`namespace`、`default-expression` のいずれか。`names` は `{name, local, type_only}`。宣言に書かれた `export` は export 文ではなく、宣言の `exported` が表す |
| `calls` | `{kind, callee_text, receiver_text?, span}`。`kind` は `function-call`、`method-call`（受け手を綴りのまま持つ）、`super-call` のいずれか。タグ付きテンプレートは、そのタグの呼び出しとして扱う |
| `constructions` | `{kind, type_text, span}`。`new-expression` は構築するクラスを綴りのまま持つ。`typed-object-literal` は、`as T`、`satisfies T`、`<T>`、または初期化する変数の型注釈によって型が書かれたオブジェクトリテラルである。`as const` は型を書いていない |
| `unresolved` | `{line, reason}`。各項目は `domain-facts.unresolved: <file>:<line> <reason>` の note にもなる |

### 型だけの依存

依存が型だけになるのは、出力から消える場合である。`import type …`、`export type …`、import 型が該当する。値の import の中で `type B` と書いた束縛は型だけだが、import 自体は型だけではない。その文はモジュールを読み込むためである。値としての `import("…")` は型だけにならない。

### 未解決の構文

理由は閉じた集合である。いずれも、宣言、依存、呼び出し先を構文から決められない構文を表す。

| 理由 | 構文 |
|---|---|
| `decorator` | すべてのデコレータ。修飾する対象を置き換えうる |
| `computed-name` | 記録する宣言の、計算されたメンバー名。そのメンバーは記録しない |
| `object-spread` | ファイル先頭の変数を初期化するオブジェクトリテラル内のスプレッド（`...x`）。それが持ち込むメンバーは記録しない |
| `binding-pattern` | ファイル先頭の分割代入による変数宣言。その名前は記録しない |
| `import-equals` | ファイル先頭の `import x = require("…")` と `import x = N.y` |
| `export-assignment` | `export = …` |
| `dynamic-import` | 指定子が文字列リテラルでない `import(…)` または import 型 |
| `namespace` | namespace または module の宣言、`declare global`、`export as namespace`。その中の宣言は記録しない |
| `dynamic-callee` | 呼び出しや `new` の対象が名前でもプロパティアクセスでもないもの。例: `handlers[kind]()` |

### 抽出が決めないこと

抽出は型チェッカーを使わない。すべての事実は構文ノードから作るため、コメント、文字列、置換の無いテンプレート、正規表現の中の綴りは事実にならず、名前が何に解決されるかに依存する事実も無い。型が必要な区別はこの事実集合に含まれない。例えば、値として import したが型としてしか使わない名前、呼び出しが到達する宣言、型の無いオブジェクトリテラルの型である。それを必要とする規則は、[言語非依存の設計](language-independent-design.ja.md)が求めるとおり、Program と TypeChecker で確立しなければならない。

## 対象外

TypeScript の規則とゲート（T-11 の後続作業）、TypeScript 以外の言語、neverthrow・Effect・fp-ts との個別統合は対象外である。error-contract と state-evidence の入口は、引き続き開発用依存関係を import する。これらはどのセンサーからも到達しない検証用の経路であり、同梱した compiler への移行はこの変更に含めない。Linux、Windows、x86_64 での実測は行っていない。同梱する compiler は JavaScript であり、プラットフォームに依存しない。
