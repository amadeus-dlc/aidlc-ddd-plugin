# コードレビューの共有用控え — u2-language-state-verification / 1

## 出典

ローカルの正式レビュー記録から本文を無変更で転記した共有用の控え。ワークフローの承認権限を持つ実行時記録ではない。

- 元の記録: `.aidlc-reviews/code-generation/units/u2-language-state-verification/e67b77dd1ffcfde3/1.json`
- 元記録のSHA-256: `da3a4b13238bb557f5f3d14517f9faedd8c78bc95981bb9f8a46e73154e0a470`
- 判定: `NOT-READY`

## Review

**Reviewer:** aidlc-architecture-reviewer-agent
**Verdict:** NOT-READY
**Date:** 2026-09-13T14:19:41Z
**Iteration:** 1

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Critical | ddd/tools/ddd/lib/typescript/state-evidence/constructor.ts > constructorAssignments の visit にある ts.isFunctionLike の早期 return、および class.ts > construction.reasons からの完全性判定 | constructor内で即時実行するarrow関数や同期callbackを走査対象から無条件に除外するため、その中の Object.assign(this, { publicState: 1 }) を見落とす。同じ処理の直接呼出しは partial/unresolved だが、arrow即時実行とforEach callbackでは complete/pass、所見・理由とも空になることを独立再現した。3入力すべて固定Compiler APIのsemantic diagnosticsは0。必要一覧を変える未対応構文を未解決にするBR2.7、AC1.2.4、および functional-spec.md > Supported Source Shapes / WF2.3 に反し、公開状態を持つ構築経路へ根拠のない正常判定を与える。 | constructorの入れ子関数を無条件に安全扱いせず、インスタンスを捕捉・変更する構築経路を証明できない場合は、該当範囲をunsupported-syntaxとして一覧をpartialにする。直接呼出し、arrowの即時実行、同期callbackをそれぞれ試験し、独立に確認済みの公開所見も保持する。通常のインスタンス操作メソッド内returnを生成経路と混同しない既存動作は維持する。 | New |

### Reproduction Evidence

対象は `model.ts`、宣言経路は `Model`、表現は `ts-class`、設定は空オブジェクト、ツール版は実装の `TS_TOOLCHAIN`。以下を文字列として `freezeInput` → `extractTypeScriptLocal` → `inspectStateExposure` に渡した。検査対象のソース自体は実行していない。

```typescript
// 対照: partial / unresolved / unsupported-syntax
class Model {
  #value = 1;
  constructor() {
    Object.assign(this, { publicState: 1 });
  }
}

// 不一致1: complete / pass / findings=[] / unresolvedReasons=[]
class Model {
  #value = 1;
  constructor() {
    (() => { Object.assign(this, { publicState: 1 }); })();
  }
}

// 不一致2: complete / pass / findings=[] / unresolvedReasons=[]
class Model {
  #value = 1;
  constructor() {
    [1].forEach(() => { Object.assign(this, { publicState: 1 }); });
  }
}
```

再現スクリプトは `/tmp/aidlc-u2-review-repro.ts`。`bun /tmp/aidlc-u2-review-repro.ts` で対照1件と不一致2件を確認した。両不一致ともcheckedEvidenceには非公開の `Model::#value` だけが残り、一覧をcompleteとしている。

この所見は通常操作の副作用一般を解析する要求ではない。constructorによるインスタンス構築の対応範囲を証明できない場合に、承認済み仕様どおり未解決へ落とす要求である。高度な関数間解析を新しく実装する必要はない。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `bun /tmp/aidlc-u2-review-repro.ts` | 対照はunresolved、arrow即時実行と同期callbackはpass。全3入力のsemantic diagnosticsは0 | R-01を独立に再現。構文・型エラーが原因のケースではない |
| `bun test tests/state-exposure-typescript.test.ts`（dddで実行） | 46 pass、0 fail、108 assertions | 既存の正常・不正ブランド・位置・構築経路試験は成功するが、R-01の経路は未収録 |
| `./node_modules/.bin/tsc --noEmit --project tsconfig.state-exposure.json`（dddで実行） | exit0 | U1依存を含む限定strict型検査が成功 |
| 承認済みunit-test-instructions.mdの変更範囲Biomeコマンド（dddで実行） | 23ファイル、修正なし、exit0 | 指定コマンドの対象でエラー・警告なし。提供証跡の25ファイル検査とは対象数を区別 |
| source-manifestと開始時ハッシュ・実変更一覧の機械照合 | 59パスが一意・存在、実変更一覧と一致。開始時に存在した対象は全て変更後のハッシュ | 開始前からの無関係なユーザー編集をU2所見へ混ぜていない |
| traceability.jsonの機械照合 | 16 ACと14 BRの30 ID、重複なし、各OKが実在する単一ファイルを参照 | 構造的な追跡は成立。ただしBR2.7 / AC1.2.4の意味上の充足にはR-01の修正が必要 |
| 保存済み実行証跡の照合 | C2は23件のexpected/actual全一致、sourceHashesは58件すべて現ファイルと一致 | 提供された検証実績とレビュー対象ソースの対応を確認。証跡自身は自己ハッシュ対象外 |

### Scope and Assessment

指定されたU2の計画・確認記録・手順・実装結果・追跡・マニフェスト、同Unitの機能設計、共有要件・ストーリー・構成要素・契約・作業単位、およびマニフェストのアプリケーション変更を対象とした。U1の3パスは親による型注釈/import整形という申告と開始時ハッシュを踏まえ、共有APIの意味変更として扱っていない。既存scaffold試験の変更も今回のcheck追加分と開始前の編集を区別した。

独立した固定期待値を保持する比較、正常時のtarget/checkedEvidence保持、C1への判定委譲、Rustネイティブ版2の要求・対象・本文ダイジェスト検証、UTF-8境界検証、プロセス終了後の応答採用、実準備不足と意図した異常の区別には、確認範囲で追加の阻害所見はない。

U2全110件、native7件、C2全23件、既存Rust79件、版1比較31件等は提供された実績として確認し、長時間の初回コピー検証や全体checkは再実行していない。実装途中の全体check失敗と確定ソースの全体checkがBuild and Testで未実施であることは、code-summary.mdとJSONで明示されている。全体greenとは評価していない。

### Summary

R-01により、対応を証明できないconstructorの構築経路へ誤った正常判定を返すため、修正が必要である。入れ子の構築処理に対する未解決判定と回帰試験を追加した後、関連する専用検証と独立レビューで再確認する。
