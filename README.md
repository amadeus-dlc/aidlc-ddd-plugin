# aidlc-ddd-plugin

English | [Japanese](README.ja.md)

An AI-DLC plugin that adds design procedures for aggregates, invariants, and Domain Primitives, plus checks for design artifacts and Rust code. The implementation lives in [ddd/](ddd/README.md).

Work toward completion is ongoing. Claude/Codex sandbox verification passes, with normal approval checks, corrected Rust evaluation, and vocabulary-based domain packaging implemented. Framework standalone completion guards and actual model execution still have outstanding work. See the [assessment](ddd/docs/current-state-assessment.md) and [task list](ddd/docs/completion-tasks.md).

## What it provides

One dedicated stage, four contributions to existing stages, six design sensors, three Rust sensors, and nine knowledge files. Designs reference IDs in one canonical model. Bundled tree-sitter handles Rust analysis without Cargo; building and testing generated Rust applications still requires a Rust toolchain.

Completion targets are Claude Code and Codex. Kimi/opencode are excluded, and custom builds for them are not maintained.

## Start development

Use Bun and this working copy with AI-DLC development tools installed.

```sh
cd ddd
bun install
bun run validate
bun run test:sandbox
```

The sandbox builds and composes both harnesses, runs 277 distribution cases per harness, and tests normal approval admission. [Recorded verification](ddd/docs/evidence/current-check-verification.json) passes. Run the full suite with `bun run check`.

## Install into a destination project

Start with a dry-run against an AI-DLC-enabled test project:

```sh
bun ddd/scripts/install.ts --project /path/to/project --from /path/to/aidlc-ddd-plugin --harness codex --dry-run
```

Use `--harness claude` for Claude Code. Fresh-install/update CLI behavior is [verified](ddd/docs/installation-verification.md); actual model-driven stage execution remains unverified. See the [usage guide](docs/usage.md).

## Documentation and development

- [Document index](ddd/docs/README.md): design, decisions, compatibility.
- [Plugin structure and verification](ddd/README.md).
- [Architecture overview](docs/architecture.md).
- [Tests](ddd/tests/README.md).
- [Changelog](ddd/CHANGELOG.md).

Runtime knowledge, sensors, stages, and contributions are English-only. Reader documentation has full English `.md` and Japanese `.ja.md` editions. Records under `aidlc/` remain Japanese.

## Help

Report issues through [GitHub Issues](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues), including commands, AI-DLC/Bun versions, harness, and reproduction conditions.

## License

[MIT](LICENSE). Bundled libraries have licenses under [tree-sitter](ddd/tools/ddd/lib/rust/vendor/) and [Rust grammar](ddd/tools/ddd/wasm/LICENSE).
