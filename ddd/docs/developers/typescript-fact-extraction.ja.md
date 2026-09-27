# TypeScript の事実抽出

[English](typescript-fact-extraction.md) | [ネイティブ抽出器の配布](native-extractor-distribution.ja.md)

TypeScript の事実抽出は、TypeScript のソースを、TypeScript の規則が判定に使う事実へ変換する。事実は、各ファイルの宣言、そのメンバーと可視性、import と export（型だけのものを区別する）、呼び出し、構築である。この文書は、Compiler API が導入先へどう届くか、対応する Compiler API の版とプロジェクト設定、抽出を起動できないときに何を報告するか、返す事実の契約を記録する。TypeScript のゲート、すなわちドメインゲート `ddd-typescript-domain`（T-11-02）と、ユースケースゲート `ddd-typescript-use-case`・インターフェースアダプタゲート `ddd-typescript-interface-adapter`（T-11-03）がこの事実で判定する。それらの[契約](../users/typescript-sensor-contract.ja.md)を参照。

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

版と設定は [`compiler/settings.ts`](../../tools/ddd/lib/typescript/compiler/settings.ts) の1か所で定める。error-contract の入口と事実抽出は、どちらもここから読む。例外は、受け入れる target の名前だけである。名前は共通の [`error-contract/contract.ts`](../../tools/ddd/lib/error-contract/contract.ts) の `TYPESCRIPT_LANGUAGE_TARGETS` に置く。error-contract の要求が target を記録し、言語に依存しない比較器が TypeScript のモジュールに届かずにその契約を読むためである。各名前をコンパイラの設定値へ対応させるのは `compiler/settings.ts` である。

| 項目 | 対応範囲 |
|---|---|
| Compiler API | `6.0.3` ちょうど（開発用依存関係も同じ版に固定している） |
| ルートの `tsconfig.json` | 存在し、解析でき、1件以上のパッケージを references で参照する |
| 参照する各パッケージの `tsconfig.json`（継承する設定を含む） | `module: esnext`、`moduleResolution: bundler`、`target` は `ES2017` 以上 `ESNext` 以下（`ES2017` 〜 `ES2025` と `ESNext`。大文字小文字は問わない）、`strict: true` |
| `customConditions` | 空でない名前の任意の並び |
| パッケージ間 | すべてのパッケージが、`target` と `customConditions` を含めて同じ設定を持つ |

書かれていない設定は、別の値を持つ設定と同じく拒否する。そのため、プロジェクトが一度も書いていない設定で検査することはない。`target` も同じで、コンパイラの既定値を補わない。

`target` の範囲を `ES2017` からにしたのは、`create-next-app` が生成する `tsconfig.json` の target が `ES2017` であり、事実と規則が target に依存しないためである。それより低い target（`ES2016`、`ES2015`、`ES5` など）は、従来どおり `typescript-extractor:project-condition-mismatch`（`unsupported-syntax`）として拒否する。target はプロジェクトが書いたものを小文字（`es2017`、`esnext`）で記録し、範囲内の別の値に読み替えない。`ES2017` のプロジェクトでは、error-contract の条件にも `target: "es2017"` が記録される。残る3つの設定は1つの値のままで、これも `create-next-app` が生成する値と一致する。パッケージ間で設定が一致する必要があるため、`ES2017` と `ESNext` のパッケージが混在するプロジェクトは `tsconfig.json.compilerOptions` で拒否される。すべてのパッケージで同じ target を書くこと。`ES2017` のプロジェクトを検査し、ビルドした記録は [Next.js 統合の検証](nextjs-integration-verification.ja.md) にある。

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
| `declarations` | ファイル先頭の各文について `{name, kind, binding?, exported, default_export, ambient, span, members}`。`kind` は `class`、`interface`、`type-alias`、`enum`、`function`、`variable` のいずれか。変数は `binding`（`const`、`let`、`var`、`using`、`await-using`）も持つ。名前の無い default export のクラスや関数の名前は `default`。`exported`、`default_export`、`ambient` は、宣言に書かれた `export`、`default`、`declare` から決まる。class は `heritage` も持ち、名指す型ごとに `{kind: extends \| implements, type_text}` を記録する。型の別名は、`{ … }` の型リテラルを名指すかどうかを `type_literal` に持つ。変数は、型を書いたときに `type_text` を、初期化式があるときに `initializer` を持つ。`initializer` は、1つの識別子で名指す関数の呼び出しなら `{kind: call, callee_text, arguments}`（各引数は `string-literal` か `other`）、オブジェクトリテラルなら `{kind: object-literal}`、それ以外は `{kind: other}` である。関数は、メソッドと同じく各引数の `{name, type_text?}` を `params` に持つ |
| `members` | `{name, kind, visibility, static, readonly, ambient, abstract, span}`。該当する場合は `computed_key`、`type_text`、`params`、`writes`、`returns_state_only` も持つ。クラスのメンバー（プロパティ、メソッド、アクセサ、コンストラクタ、コンストラクタのパラメータプロパティ）、interface と型リテラルのメンバー、enum のメンバー、変数を初期化するオブジェクトリテラルのメンバー。`visibility` は `public`、`protected`、`private`、`private-name`（`#name`。名前は `#` 付きで綴る）のいずれか。`ambient` と `abstract` はメンバーに書かれた `declare` と `abstract` から決まる。1つの識別子で綴った計算名は、`computed_key: "key"` を持つメンバー `[key]` になる。その識別子がどの値を持つかは規則が判断する。`type_text` はプロパティ（またはパラメータプロパティ）に書かれた型、`params` はメソッド、メソッドシグネチャ、コンストラクタの `{name, type_text?}` である。本体を持つメソッドは `writes` と `returns_state_only` を記録する。`writes` は、代入・更新・削除する `this` のメンバーを `{target: this, name}`、自身で宣言していない束縛を `{target: captured, name}` として持つ。閉包の状態（囲む関数が宣言した束縛）を配列・`Map`・`Set` の変更メソッドで変える呼び出しもこれに含む。`returns_state_only` は、本体が `this` の1つのメンバー、閉包の状態の1つのメンバー、または閉包の状態そのものを `return` するだけかどうかである。ファイル先頭の束縛は閉包の状態ではない。呼び出しシグネチャ、構築シグネチャ、インデックスシグネチャ、static ブロックはメンバーにしない。そのオブジェクトリテラル内のスプレッドはメンバーにせず、未解決（`object-spread`）として返す |
| `imports` | `{specifier, kind, type_only, bindings, line}`。`kind` は `named`、`default`、`namespace`、`side-effect`、`dynamic`（`import("…")`）、`type-query`（`import("…").T` のような import 型）のいずれか。`bindings` は `{name, imported, type_only}` で、default import の `imported` は `default`、名前空間 import では `*` |
| `exports` | export 文ごとに `{kind, specifier?, type_only, names, line}`。`kind` は `named`、`all`、`namespace`、`default-expression` のいずれか。`names` は `{name, local, type_only}`。宣言に書かれた `export` は export 文ではなく、宣言の `exported` が表す |
| `calls` | `{kind, callee_text, receiver_text?, receiver_binding_type?, forwarded_to?, span}`。`kind` は `function-call`、`method-call`（受け手を綴りのまま持つ）、`super-call` のいずれか。タグ付きテンプレートは、そのタグの呼び出しとして扱う。1つの識別子に対するメソッド呼び出しは、その識別子の最も近い束縛（引数か変数）に書かれた型を `receiver_binding_type` に記録する。その束縛が型を書いていない、または束縛が見つからないときは持たない。`forwarded_to` は、この呼び出しの結果を変更せずに渡した先の呼び出しの span を、ソース順に並べる。渡し方は、呼び出しの引数（括弧だけで囲んでもよい）か、すべての参照がそのように渡される `const` の束縛（そうした束縛の連鎖を含み、64段まで）である。参照とは、最も近い束縛がその束縛である識別子であり、プロパティ名、メンバー名、宣言する名前、型の中に書いた名前は参照ではない。結果をほかの形（演算の項、受け手、型アサーション、条件、`let`、参照の1つをほかに使う束縛、`case` 節または `default` 節の直下で宣言した `const`（有効範囲が case ブロック全体になるため））で使う場合と、使わない場合は持たない |
| `constructions` | `{kind, type_text, span}`。`new-expression` は構築するクラスを綴りのまま持つ。`type-assertion` は、`x` がオブジェクトリテラルではないときの、`const` 以外の名前付きの型 `T` への `x as T` または `<T>x` である。`typed-object-literal` は、`as T`、`satisfies T`、`<T>`、または初期化する変数の型注釈によって型が書かれたオブジェクトリテラルである。これは `form`（`annotation`、`assertion`、`satisfies`）、`members`、`opaque`（スプレッドや1つの識別子ではない計算名がメンバーの一部を隠すかどうか）も持つ。`as const` は型を書いていない |
| `keyed_literals` | 型が書かれていないオブジェクトリテラルのうち、計算名 `[identifier]` をキーに持つメンバーを含むものごとに `{members, opaque, span}` |
| `unresolved` | `{line, reason}`。各項目は `domain-facts.unresolved: <file>:<line> <reason>` の note にもなる |

### 型だけの依存

依存が型だけになるのは、出力から消える場合である。`import type …`、`export type …`、import 型が該当する。値の import の中で `type B` と書いた束縛は型だけだが、import 自体は型だけではない。その文はモジュールを読み込むためである。値としての `import("…")` は型だけにならない。

### 未解決の構文

理由は閉じた集合である。いずれも、宣言、依存、呼び出し先を構文から決められない構文を表す。

| 理由 | 構文 |
|---|---|
| `decorator` | すべてのデコレータ。修飾する対象を置き換えうる |
| `computed-name` | 記録する宣言の、1つの識別子ではない計算されたメンバー名（例: `[keys.main]`）。そのメンバーは記録しない。型付きのリテラルやキー付きのリテラルの中では、代わりにそのリテラルを `opaque` にする |
| `object-spread` | ファイル先頭の変数を初期化するオブジェクトリテラル内のスプレッド（`...x`）。それが持ち込むメンバーは記録しない。型付きのリテラルやキー付きのリテラルの中では、代わりにそのリテラルを `opaque` にする |
| `binding-pattern` | ファイル先頭の分割代入による変数宣言。その名前は記録しない |
| `import-equals` | ファイル先頭の `import x = require("…")` と `import x = N.y` |
| `export-assignment` | `export = …` |
| `dynamic-import` | 指定子が文字列リテラルでない `import(…)` または import 型 |
| `namespace` | namespace または module の宣言、`declare global`、`export as namespace`。その中の宣言は記録しない |
| `dynamic-callee` | 呼び出しや `new` の対象が名前でもプロパティアクセスでもないもの。例: `handlers[kind]()` |

### 抽出が決めないこと

抽出は型チェッカーを使わない。すべての事実は構文ノードから作るため、コメント、文字列、置換の無いテンプレート、正規表現の中の綴りは事実にならず、名前が何に解決されるかに依存する事実も無い（構文から見える最も近い束縛を使う `receiver_binding_type` と `forwarded_to` を除く）。型が必要な区別はこの事実集合に含まれない。例えば、値として import したが型としてしか使わない名前、呼び出しが到達する宣言、型の無いオブジェクトリテラルの型である。[言語非依存の設計](language-independent-design.ja.md)は、そうした規則が Program と TypeChecker で確立することを想定している。TypeScript のゲートはそうせず、Rust のゲートが明示的な型で照合するのと同じく、書かれた型と構文で決まることだけを判定し、決まらない箇所では検査不能として停止する。配布物は、TypeChecker が必要とするライブラリの宣言を同梱しないためである。

### ゲートが読むプロジェクト

[`domain-facts/project.ts`](../../tools/ddd/lib/typescript/domain-facts/project.ts) は、起動を分類した compiler で、ルートの `tsconfig.json` が参照するパッケージと、各パッケージの `paths` エイリアス（それを書いた設定のディレクトリを基準に解決する）と `baseUrl` の有無を読む。起動が ready でない場合と、設定が拒否された場合は、事実と同じく検査を停止する。Compiler API の値は `domain-facts/` の外へ出ない。

## 対象外

モジュール配置の検査（T-11-04）、TypeScript 以外の言語、neverthrow・Effect・fp-ts との個別統合は対象外である。error-contract と state-evidence の入口は、引き続き開発用依存関係を import する。これらはどのセンサーからも到達しない検証用の経路であり、同梱した compiler への移行はこの変更に含めない。Linux、Windows、x86_64 での実測は行っていない。同梱する compiler は JavaScript であり、プラットフォームに依存しない。
