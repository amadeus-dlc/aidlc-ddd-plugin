# Code Structure — `ddd`

## ディレクトリ構成

```
ddd/
├── .aidlc-plugin/
│   └── plugin.json          # プラグインマニフェスト（唯一の契約定義）
├── package.json             # 開発用パッケージ ddd-plugin-dev（private）
├── bun.lock                 # lockfileVersion: 1
├── tsconfig.json            # strict, noEmit, types:["bun"], include: scripts/** src/** tests/**
├── biome.json               # lint/format 設定
├── .gitignore               # node_modules/, dist/
├── README.md                # 日本語。拡張ポイント表・検証手順・既知の制約
├── scripts/                 # 開発用ツール 3 ファイル
│   ├── apply-harness-patches.ts
│   ├── verify-codex-host.ts
│   └── copy-reference-fixture.ts
├── tests/                   # テスト 2 ファイル（+ .gitkeep）
│   ├── framework-compatibility.test.ts
│   └── codex-dispatch-bridge.test.ts
├── patches/
│   └── installed-harnesses.patch   # 425 行、親リポジトリ向け
├── docs/                    # 設計文書 6 本（計 561 行）+ evidence/ 3 本
│   ├── domain-layer-design.md            (205)  ← 設計入力
│   ├── use-case-layer-design.md          (124)  ← 設計入力
│   ├── interface-adapter-layer-design.md (100)  ← 設計入力
│   ├── framework-compatibility.md         (45)
│   ├── codex-host-verification.md         (58)
│   ├── reference-read-only.md             (29)
│   └── evidence/*.json                     (3)
├── dist/                    # ビルド生成物（.gitignore 対象、計 24 ファイル）
│   ├── claude/
│   └── codex/
└── ── 以下すべて .gitkeep のみ（実体ゼロ）──
    ├── stages/inception/
    ├── stages/construction/
    ├── contributions/inception/
    ├── contributions/construction/
    ├── sensors/
    ├── src/
    ├── knowledge/
    └── tools/
```

## ファイル分類

| 分類 | パス | 実体数 | 備考 |
|---|---|---|---|
| プラグイン契約 | `.aidlc-plugin/plugin.json` | 1 | 5貢献面を宣言 |
| ビルド／設定 | `package.json`, `tsconfig.json`, `biome.json`, `bun.lock`, `.gitignore` | 5 | — |
| 開発用スクリプト | `scripts/*.ts` | 3 | プラグイン機能ではない |
| テスト | `tests/*.test.ts` | 2 | 親リポジトリのパッチを検証 |
| パッチ | `patches/installed-harnesses.patch` | 1 | 425 行、未上流化 |
| ドキュメント | `README.md`, `docs/*.md` | 7 | うち3本は**設計入力** |
| 検証証跡 | `docs/evidence/*.json` | 3 | — |
| ビルド生成物 | `dist/claude/`, `dist/codex/` | 24 | Git 管理外 |
| **足場のみ（空）** | `stages/`, `contributions/`, `sensors/`, `src/`, `knowledge/`, `tools/` | **0** | `.gitkeep` のみ |
| 外部参照 | `aidlc-workflows/`（サブモジュール） | — | 読み取り専用 |

## 足場だけで中身が無いディレクトリ

以下の8ディレクトリは `.gitkeep` 1ファイルのみを含み、実装が1件もない。

- `stages/inception/`, `stages/construction/` — 新設ステージ（`domain-modeling` ほか）の置き場
- `contributions/inception/`, `contributions/construction/` — 既存ステージへの overlay
- `sensors/` — `aidlc-<id>.md` 形式のセンサーマニフェスト（フラット走査）
- `knowledge/` — `<agent-slug>/` 単位のナレッジ（slug 完全一致が必須）
- `tools/` — センサーが呼ぶ実行スクリプト
- `src/` — TypeScript 実装（`tsconfig.json` の include 対象だが空）

## コード規約

- 言語: TypeScript（ESM、`"type": "module"`）
- フォーマット: biome — space インデント / 幅 2 / 行幅 120 / `quoteStyle: double`
- lint プリセット: `recommended`、`--error-on-warnings` により警告も失敗扱い
- 対象範囲: `src/**` `scripts/**` `tests/**` と主要設定ファイル。`vcs.useIgnoreFile: true`
- ドックコメントは最小限（`copy-reference-fixture.ts` と `verify-codex-host.ts` の冒頭コメントのみ）

## Sources

- `ddd/` のファイル一覧、`ddd/tsconfig.json`, `ddd/biome.json`, `ddd/.gitignore`
- `developer-scan-ddd.md`（Scan Coverage / Packages Found / Code Quality Indicators）
