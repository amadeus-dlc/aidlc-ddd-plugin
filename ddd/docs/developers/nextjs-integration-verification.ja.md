# Next.js統合の検証

[English](nextjs-integration-verification.md) | 日本語 | [開発者向け文書](README.ja.md)

検証日: 2026-09-27。基準コミット: `a1c9f8969100ed47bc7a63e603dc3b424395dc0d`（T-11-06 の変更はこのコミットの上に積んだ未コミットの作業ツリーで実測した）。[実行記録](evidence/nextjs-integration-verification.json)を参照。

TypeScriptの生成見本を、サーバー側 Node.js 上の ESM Next.js アプリに組み込み、実際にビルドして起動し、HTTP 要求で動かした記録である。ソースの単独検査だけで統合を保証したことにはしない。[言語共通の設計](language-independent-design.ja.md) §1 が受入条件とする範囲（サーバー側 Node.js の ESM、Next.js のビルドと実行）に限り、それ以外のホスト環境や組み合わせは下の「未検証の範囲」に記載し、対応済みとは記載しない。

## 検証した版と環境

| 項目 | 版 |
|---|---|
| プラットフォーム | `darwin-arm64` |
| Node.js | `v24.19.0` |
| npm | `11.17.0` |
| Next.js | `16.3.6`（npm レジストリから取得。`next build` は Turbopack） |
| React / React DOM | `19.2.8` / `19.2.8` |
| TypeScript（ホストが `next build` の型検査に使う版） | `6.0.3` |
| `@types/node` / `@types/react` / `@types/react-dom` | `20.19.43` / `19.3.0` / `19.3.0` |
| bun（ゲートとスクリプトの実行） | `1.3.13` |
| ゲートの TypeScript Compiler API | 同梱の `6.0.3` |

版は、スクリプトが npm の導入したパッケージと実行したツールから読み取り、実行記録に書いたものである。

## 何を検証するか

[`scripts/verify-nextjs-integration.ts`](../../scripts/verify-nextjs-integration.ts)（`bun run verify:nextjs-integration`）は、4つの見本（`class`／`companion` × `named-file`／`index-file`）それぞれについて、新しい一時プロジェクトで次を順に行う。どれかの段階が失敗すると、その見本の残りの段階は行わず、失敗として記録する。サーバーと一時プロジェクトは、成功・失敗・例外・SIGINT/SIGTERM のすべての経路で片付ける。

| 段階 | 合格の条件 |
|---|---|
| 1. `npm ci` | コミットしたロックファイルから、npm レジストリの Next.js などを導入し、見本のパッケージを npm workspaces でリンクして終了コード0 |
| 2. `next build`（Node.js） | ホストをビルドし、`next build` の型検査も含めて終了コード0 |
| 3. TypeScript の4ゲート | ドメイン・ユースケース・インターフェースアダプタ・モジュール配置の各ゲートを、導入とビルドを終えた同じプロジェクトに対して実行し、所見0件で、検査対象なしの合格ではない |
| 4. CI 用入口 | `ddd-check-typescript-module-layout.ts` が終了コード0を返す（検査したパッケージが0件なら0以外になる入口である） |
| 5. `next start`（Node.js） | 60秒以内に HTTP に応答する |
| 6. HTTP 要求 | `POST /api/invoices/{id}/issue` を1つのサーバープロセスに順に送り、下の表のとおりに応答する |

| 要求 | 期待する応答 | 何を示すか |
|---|---|---|
| `invoice-open` を発行 | `200 {"ok":true}` | ホストが見本の `IssueInvoice` を実行し、発行した集約を保存する |
| もう一度 `invoice-open` を発行 | `409 {"ok":false,"error":"already-issued"}` | 前の要求で保存した集約を、同じリポジトリから読み戻している |
| `invoice-empty` を発行 | `409 {"ok":false,"error":"empty-lines"}` | 集約の業務エラーが、そのまま HTTP の応答まで届く |
| `invoice-unknown` を発行 | `404 {"ok":false,"error":"invoice-not-found"}` | リポジトリの不在が、そのまま HTTP の応答まで届く |

## 結果

4つの見本すべてで、6段階すべてが合格した。各段階の所要時間と応答は実行記録にある。

| コード表現 | モジュール配置 | `npm ci` | `next build` | 4ゲート | CI 用入口 | `next start` | HTTP 要求4件 |
|---|---|---|---|---|---|---|---|
| `class` | `named-file` | 合格 | 合格 | 合格 | 合格（4パッケージ） | 合格 | 合格 |
| `class` | `index-file` | 合格 | 合格 | 合格 | 合格（4パッケージ） | 合格 | 合格 |
| `companion` | `named-file` | 合格 | 合格 | 合格 | 合格（4パッケージ） | 合格 | 合格 |
| `companion` | `index-file` | 合格 | 合格 | 合格 | 合格（4パッケージ） | 合格 | 合格 |

## ホストの構成

ホストは [`tests/fixtures/nextjs-integration/host.ts`](../../tests/fixtures/nextjs-integration/host.ts) が書き出す `apps/web` で、ロックファイルは同じディレクトリの `package-lock.json` である。4つの見本はソースだけが異なり、パッケージ名・版・依存が同じなので、1つのロックファイルを共有する。

`create-next-app@16.3.6`（`--ts --app --no-eslint --no-tailwind --no-src-dir --import-alias "@/*"`）が生成したものから、統合に必要な次の点だけを変えた。

| 変更 | 理由 |
|---|---|
| `package.json` に `"type": "module"` を書き、依存の版を完全一致で固定した（生成時は `@types/*` と `typescript` が範囲指定） | ESM のアプリとして検証するため。検証した版を固定するため |
| `typescript` を `^5` ではなく `6.0.3` にした | ゲートの Compiler API と同じ版で、`next build` の型検査も成功したため |
| `next.config.ts` の代わりに `next.config.mjs` を置き、`transpilePackages` に見本の4パッケージを書いた | 見本のパッケージは `.ts` のソースを `exports` で公開するため、Next.js に変換させる |
| `tsconfig.json` に `allowImportingTsExtensions: true` を加えた | 見本のソースは `./invoice/line.ts` のように `.ts` 拡張子付きで import する。この設定が無いと、`next build` の型検査が見本のソースに対して TS5097 を報告して失敗することを実測した |
| `lib/invoices.ts` と route handler `app/api/invoices/[id]/issue/route.ts` を追加し、生成されたページ・レイアウト・`public/` などは置かない | route handler は `export const runtime = "nodejs"` を書く。リポジトリはモジュールに1つだけ作り、1つのサーバープロセスの要求間で共有する |
| ルートに npm workspaces の `package.json` を置いた | 見本のパッケージを `node_modules/@acme/*` にリンクするため |

`tsconfig.json` の `target: "ES2017"`・`module: "esnext"`・`moduleResolution: "bundler"`・`strict: true`・`paths`（`@/*`）は生成されたままである。`next build` はこの `tsconfig.json` を書き換えなかった（実測）。

ルートの `tsconfig.json` は、見本の4パッケージに加えてホスト `apps/web` も references で参照する。そのため、ゲートと CI 用入口は `target: "ES2017"` のホストの設定を含むプロジェクトを読む。パッケージ間で設定が一致する必要があるため（[TypeScriptの事実抽出](typescript-fact-extraction.ja.md)）、見本の4パッケージの `tsconfig.json` も `target: "ES2017"` にそろえた。見本のソースは変えていない。ホストの `paths` がゲートの所見になることはなかった。

## 未検証の範囲

次のホスト環境と組み合わせは検証していない。いずれも対応済みとはしない。

| 範囲 | 状態 |
|---|---|
| Linux、Windows、x86_64 | 検証していない。実測は `darwin-arm64` だけである |
| Node.js 24 以外、npm 11 以外、pnpm・yarn・bun による導入 | 検証していない |
| Next.js 16.3.6 以外の版、`next build --webpack` | 検証していない |
| Edge Runtime、Cloudflare Workers など Node.js 以外のランタイム | 対象外（[言語共通の設計](language-independent-design.ja.md) §1） |
| `next dev` | 検証していない |
| クライアント境界（`"use client"` のコンポーネントから見本を使うこと、Server Components のページ） | 検証していない。ホストは route handler だけを持つ |
| ホスト（`apps/web`）のソースをTypeScriptのゲートで判定すること | 行っていない。ホストはどの層にも属さず、CI 用入口が検査したのは見本の4パッケージだけである。ホストを判定対象にするには新しい解析対象の定義が必要で、この課題の範囲外である |
| パッケージ間で target が異なる構成 | 拒否される構成であり、統合では扱わない |

## 限界

- リポジトリはメモリ上の `InMemoryInvoiceRepository` で、1つのサーバープロセスの寿命のあいだだけ状態を保つ。データベースなど外部の永続化は扱わない。
- この検証はネットワーク取得と `next build` を伴うため、`bun run check`（CI）には含めていない。CI で動くことを確認しているのは、ゲート・CI 用入口・承認経路の試験（[TypeScriptの実行モデルと永続化方式の検証](typescript-execution-persistence-verification.ja.md)の経路表）である。
- ロックファイルは検証時点の npm レジストリから作った。レジストリの内容が変わった場合の再現性は、ロックファイルの `integrity` に依存する。

## 再実行して結果を確認する

`PATH` 上の Node.js と npm、npm レジストリへの接続が必要である。

```sh
cd ddd
bun install --frozen-lockfile
bun run prepare:typescript
bun run verify:nextjs-integration
```

結果は JSON で標準出力に出る。すべての見本が合格すると終了コード0を返す。ホストの依存を変えたときは、`host.ts` の版を変えたうえで、見本1つと組み合わせたプロジェクトで `npm install` を実行し、生成された `package-lock.json` を `tests/fixtures/nextjs-integration/` に置き換える。
