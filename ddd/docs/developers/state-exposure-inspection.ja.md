# 状態公開の共通検査

[English](state-exposure-inspection.md)

`state-exposure/1` は要求と抽出済みの証跡を検証し、指定型が保持する状態を直接公開しているかを判定する契約です。公開入口は [`tools/ddd/lib/state-exposure/index.ts`](../../tools/ddd/lib/state-exposure/index.ts) です。ファイル読取りや解析器の起動は行わず、既存の本番 Rust センサーも切り替えません。

`prepareInspectionRequest(input: unknown)` は、要求を持つ `prepared` または一件以上の理由を持つ `input-rejected` を返します。`inspectStateExposure(request: unknown, execution: unknown)` は、検査結果を持つ `evaluated` または `input-rejected` を返します。共通型は公開入口から名前付きで export しており、正確なフィールドとタグは [`contract.ts`](../../tools/ddd/lib/state-exposure/contract.ts) に定義しています。

## 要求識別

呼出し元は言語（`rust` または `typescript`）、一つの対象、一件以上のソースとツール版、確定した設定を渡します。Rust の表現は `rust-struct`、TypeScript は `ts-class` と `ts-companion` です。抽出は呼出し元の責務であり、要求準備に使ったものと同じ本文・設定・実際のツール版を使用する必要があります。

ソースは一意な相対 POSIX パスを持ちます。空、絶対パス、バックスラッシュ、NUL、空やドットのパス要素は拒否します。対象ファイルはソース内に存在し、宣言パスには一個以上の空でない名前が必要です。ツール名は一意で、版は空にできません。ファイル探索や大文字小文字・Unicode の正規化は行いません。

ソースごとに、本文の SHA-256、UTF-8 バイト長、行開始位置を保存します。BOM と改行は変更しません。CRLF は一改行、CR・LF・U+2028・U+2029 もそれぞれ一改行です。末尾改行の後の空行も保持し、空の本文は `lineStarts: [0]` となります。

要求識別は、自身を除く要求の既知フィールドを正規化 JSON にした SHA-256 で、`sha256:` と小文字16進数64桁です。ソースはパス順、ツールは名前順、オブジェクトのキーは再帰的に Unicode スカラー値順へ並べます。配列順は保持し、安全な整数は10進数、負のゼロは0とします。設定の全キーを識別へ含めます。設定以外の未知の補足フィールドは JSON 検証後に無視します。検査時にも並び順・範囲・参照・再計算した識別を確認します。

JSON の境界では undefined、関数、BigInt、非有限数、安全でない整数や小数、不正 Unicode、クラスのインスタンス、疎または拡張された配列、アクセサー、Symbol キー、循環を拒否します。循環ではない共有参照は値として複製します。深い設定についても、検証・複製・正規化を反復走査で処理します。

## 証跡と判定

実行状態は `completed`・`unavailable`・`failed` です。完了の外枠には `response` キーが必要で、キー欠落や非 JSON 値は呼出し自体を拒否します。`response: null` は応答なしを表し、`evaluated / completed / unresolved`、理由 `invalid-response`、`checkedEvidence: null` となります。不正な JSON 応答も同様です。未知版と別要求の識別は、それぞれ `unknown-version` と `identity-mismatch` で拒否し、所見を採用しません。

対象を解決できた場合は対象の証跡とメンバー一覧が必要です。各メンバーは一意な ID と次の Fact を持ちます。

| Fact | 意味 | 必須の根拠 |
| --- | --- | --- |
| `resolved / true` | readonly を含む保持状態の直接公開 | 一件以上の位置 |
| `resolved / false` | 保持状態を直接公開していない | 一件以上の位置 |
| `absent` | 保持状態ではないと確認済み | 一件以上の位置 |
| `unresolved` | メンバーの意味を確認できない | 一件以上の理由 |

一覧が `complete` なら一覧自体の理由は空です。`partial` は理由が必要で、項目は空でも構いません。対象・メンバーの証跡は対象ファイル内に限定します。位置は安全な整数の UTF-8 バイト範囲 `0 <= byteStart < byteEnd <= byteLength` と、それに対応する1始まりの開始行です。理由の位置は要求内の他のソースでもよく、不明なら null にします。U1 はハッシュから文字境界や構文を再証明できません。その確認は言語別抽出の試験が担当します。

| 証跡 | 規則結果 | 所見 |
| --- | --- | --- |
| 完全な一覧、全 Fact 確定、公開なし | `pass` | 空 |
| 完全な一覧、全 Fact 確定、公開あり | `violation` | 確定した公開メンバー |
| 対象未解決、一覧 partial、または Fact 未解決 | `unresolved` | 確定した公開メンバーを保持 |
| 不正応答、解析器の起動不能、実行失敗 | `unresolved` | 空 |

不正な証跡は応答全体を不採用にし、一部の所見を救出しません。一方、妥当な部分証跡に含まれる確定違反と未解決理由は両方を保持します。初版に `not-applicable` はありません。

結果は独立した対象値を必ず持ちます。証跡を検証できた場合は、正常でも `checkedEvidence` に対象位置・完全性・非公開／不在の Fact と根拠位置を保持し、未知フィールドを除きます。メンバーと所見は ID 順、位置はファイル・開始・終了順、理由はコード・対象・位置・メッセージ順です。null 位置は先、文字列は Unicode スカラー値順とし、重複した根拠や理由も削除しません。返却後に入力を変更しても過去の結果は変わりません。

## 明示した固定証跡を使う例

`ddd/` から利用する例です。証跡を手で渡す例であり、Rust の抽出を実行した証拠ではありません。

```typescript
import { inspectStateExposure, prepareInspectionRequest } from "./tools/ddd/lib/state-exposure/index.ts";

const prepared = prepareInspectionRequest({
  language: "rust",
  target: { file: "model.rs", declarationPath: ["Model"], representation: "rust-struct" },
  sources: [{ path: "model.rs", content: "struct Model;\n" }],
  settings: {},
  toolchain: [{ name: "fixture", version: "1" }],
});
if (prepared.kind === "prepared") {
  const outcome = inspectStateExposure(prepared.request, {
    status: "completed",
    response: {
      schemaVersion: "state-exposure/1",
      requestIdentity: prepared.request.requestIdentity,
      evidence: {
        targetStatus: "resolved",
        targetEvidence: [{ file: "model.rs", line: 1, byteStart: 0, byteEnd: 13 }],
        members: { completeness: "complete", items: [], reasons: [] },
      },
    },
  });
  console.log(JSON.stringify(outcome));
}
```

## 単独検証

既存の Bun 環境とインストール済みの開発依存を使います。作業ディレクトリは `ddd/` です。

```sh
bun test tests/state-exposure-contract.test.ts tests/state-exposure-inspection.test.ts
./node_modules/.bin/biome check --error-on-warnings tools/ddd/lib/state-exposure tests/state-exposure-contract.test.ts tests/state-exposure-inspection.test.ts
bun build tools/ddd/lib/state-exposure/index.ts --target bun --format esm --outfile /tmp/aidlc-u1-01a09a8b-smoke.mjs
bun test tests/u2-rust-analysis-foundation.test.ts tests/u5-rust-code-sensors.test.ts tests/u5-golden.test.ts
```

試験は期待と一致すれば終了コード0、失敗すれば非0です。共通試験は Rust や TypeScript の解析器を起動しません。最後のコマンドは既存 Rust の回帰を別に確認します。

macOS arm64、Bun 1.3.13、Biome 2.5.12 で、共通試験138件成功（273 assertions）、Biome 対象9ファイルのエラー・警告なし、Bun で7モジュールの束ね成功を確認しました。既存 Rust 基準は実装前後とも79件成功（162 assertions）です。初回にあった固定入力の期待バイト数の誤りは修正済みで、既存試験と受入条件は変更していません。

Bun build は構文・束ねの検査であり、**静的型検査ではありません**。両単位の静的型検査、Rust／TypeScript の実ソース抽出、開発用検証コマンドは U2 が担当し、この単独試験の完了実績には含めません。新しい実行時依存や本番統合は追加していません。
