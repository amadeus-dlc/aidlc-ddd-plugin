# aidlc-ddd-plugin

English | [日本語](README.ja.md)

Domain-driven design for [AI-DLC v2](https://github.com/awslabs/aidlc-workflows), packaged as an additive plugin. A `ddd-domain-modeling` stage turns requirements into a **canonical domain model** — aggregates as finite state machines, invariants, commands, events, domain errors, transitions, Domain Primitives and Always Valid models — then design sensors check that model and its downstream declarations, and Rust code sensors check the generated code against rules (a)–(n) and the layer dependency table. Core is never modified: disable the plugin and the vanilla workflow remains.

This is the development workspace. The plugin itself lives in [`ddd/`](ddd/) — see its [README](ddd/README.md) for the design.

## Highlights

- **A canonical model with a real gate** — the `ddd-domain-modeling` stage owns the model up to aggregate boundaries and gates on the machine conditions (i)–(v): every aggregate has invariants, every command declares its state effect and its domain errors, every referenced ID resolves, and `domain-model.yaml` agrees with the derived `domain-model.md`. The yaml is canonical; the markdown is derived.
- **Two declaration axes, checked** — every aggregate is declared on `programming_model` (actor/class) × `persistence_method` (state-sourcing/event-sourcing); multi-aggregate use cases must carry a Process Manager or an explicit re-execution strategy.
- **Stable IDs and lineage** — element IDs are permanent (`aggregate.invoice`, `command.invoice.issue`); rename, split, merge and removal are recorded in `lineage:` so downstream references never silently break.
- **Design sensors** — six sensors (five blocking, one advisory) validate the canonical model, resolution of every declared ID, the aggregate mapping, the use-case declarations, and the layer-structure declaration, including rules (k)–(n).
- **Rust code sensors** — three blocking sensors implement rules (a)–(n) on the generated code: no public fields, no mutation outside a declared command, construction only through a full constructor, no getters from the domain/use-case layers, dependency direction and external I/O (g), use-case chaining, cross-side references, repository naming and restoration bypass.
- **No toolchain at analysis time** — the Rust analyzer ships a vendored tree-sitter-rust WASM grammar and runs from bun alone; no cargo, Node.js or network.
- **Deterministic and golden-tested** — design and Rust golden-case suites run every rule through the real script entry point and assert byte-identical verdicts across runs.

## Quickstart

### Requirements

- [bun](https://bun.sh/)
- A target project with [AI-DLC v2](https://github.com/awslabs/aidlc-workflows) installed

No Rust toolchain is needed: the code sensors analyze with a bundled WASM grammar.

### Install into your AI-DLC project

Install a specific stable release. The bootstrap script and the installed source come from the same immutable tag:

```sh
VERSION=v0.1.0
curl -fsSL "https://raw.githubusercontent.com/amadeus-dlc/aidlc-ddd-plugin/${VERSION}/ddd/scripts/install.ts" |
  bun - --project <your-aidlc-project> --tag "${VERSION}"   # --harness codex, kimi, opencode, … (default: claude)
```

Until the first tag is published, install from the development checkout instead:

```sh
git clone --recurse-submodules https://github.com/amadeus-dlc/aidlc-ddd-plugin.git
bun aidlc-ddd-plugin/ddd/scripts/install.ts --project <your-aidlc-project> --from aidlc-ddd-plugin
# or: --ref main
```

The installer builds the harness projection under `ddd/dist/<harness>/` and composes the stage, contributions, sensors, tools and knowledge into the project's harness tree (`.claude/`, `.codex/`, `.kimi-code/`, `.aidlc/`, …). Store harnesses (Claude Code, Codex, Kimi Code, opencode) compose directly from `dist/` and copy nothing into the project; storeless harnesses (Kiro, Kiro IDE, Cursor) first folder-drop the projection into the project root, as those hosts expect. Add `--dry-run` to verify the compose without touching the project. Nothing outside that project is changed, and disabling the plugin recomposes the vanilla workflow. During an update the installer refreshes the plugin's own previously composed files before composing, so stale schemas and tools do not survive a version change.

Source and update selectors:

| Option | Meaning |
|---|---|
| no selector | Resolve and install the latest stable Semantic Versioning tag. |
| `--tag v0.1.0` | Install one immutable release. This is the recommended production path. |
| `--from <repo-root>` | Build from a local checkout; useful while developing the plugin. |
| `--ref <branch>` | Download a moving branch ref. Use this only to follow development, not for a reproducible installation. |
| `--update` | Reuse the recorded selector: latest resolves again, while local and ref reacquire the same source. A fixed tag is already immutable and returns `Changed 0`. It cannot be combined with a selector. |

Each successful install records its version, source selector, timestamp and payload digest at `<harness>/tools/data/ddd-install.json` in the target project. Here `<harness>` is the selected harness tree, such as `.claude` or `.codex`. Plugin distribution does not use an npm package or a GitHub Release asset; tagged and branch installs fetch GitHub source archives directly.

> The installer is a folder-drop: it has no install-time trust gate, so only point it at a build you would run code from.

Note: the stage declares `scopes: [enterprise, feature, mvp, classic, workshop, refactor]`, so it runs for intents created with those scopes.

### Adopting mid-project

You don't need to have started with this plugin. Composition is additive, so installing into a project whose AI-DLC workflow is already underway changes nothing else — and **intents that predate the install can still be modeled**. Run the stage in isolation against an existing intent, without advancing its workflow:

```
/aidlc --stage ddd-domain-modeling --single
```

(also packaged as the composed `/ddd-domain-modeling` skill). The engine resolves the intent's existing requirements and stories, the stage writes its canonical model under that intent's record, and the workflow's Current Stage is never touched. When the stage is SKIP, the `ddd-model-presence` sensor passes with a note, so downstream stages stay green. Intents created after the install pick the stage up automatically.

## Development

For development, clone the repository with its submodule and install the plugin's dev dependencies:

```sh
git clone --recurse-submodules https://github.com/amadeus-dlc/aidlc-ddd-plugin.git
cd aidlc-ddd-plugin/ddd
bun install        # dev dependencies only — installs nothing into any project
```

Verify changes with:

```sh
bun run check          # biome + plugin validation + unit / golden tests
bun run build:all      # dist/claude, codex, kimi, opencode
bun run test:sandbox   # compose all four harnesses, then verify the built tools
bun run test:dist      # verify the built dist/<harness>/tools against the golden cases
```

`test:sandbox` runs `aidlc-plugin-test --install` against claude, codex, kimi and opencode (0 drops, the stage on the graph, an idempotent second compose) and then runs the design and Rust golden cases through the projected tools.

## Repository layout

| Path | Role |
|---|---|
| [`ddd/`](ddd/) | The plugin's authored source: stage, contributions, sensors, tools, knowledge, tests |
| `ddd/scripts/install.ts` | The one-command installer for user projects |
| [`aidlc-workflows/`](https://github.com/j5ik2o/aidlc-workflows) | Framework checkout (submodule) — supplies the validate/build/test toolchain; never edited here |
| `ddd-sandbox/` | Disposable AI-DLC install used as the compose-test target — gitignored |
| `aidlc/` | This repository's own AI-DLC workspace state (canonical models, CodeKB, intent artifacts) |

## Documentation

- Plugin design, sensors, install and constraints: [ddd/README.md](ddd/README.md)
- Release history: [ddd/CHANGELOG.md](ddd/CHANGELOG.md)
- Design inputs — domain, use-case and interface-adapter layers: [ddd/docs/domain-layer-design.md](ddd/docs/domain-layer-design.md), [use-case](ddd/docs/use-case-layer-design.md), [interface-adapter](ddd/docs/interface-adapter-layer-design.md)
- Installed-harness compatibility patches: [ddd/docs/framework-compatibility.md](ddd/docs/framework-compatibility.md)

## Getting help

- Issues: <https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues>

## License

MIT. See [LICENSE](LICENSE). The bundled `web-tree-sitter` (MIT) and `tree-sitter-rust` WASM (The Unlicense) carry their own licenses under [`ddd/tools/ddd/lib/rust/vendor/`](ddd/tools/ddd/lib/rust/vendor/) and [`ddd/tools/ddd/wasm/`](ddd/tools/ddd/wasm/).
