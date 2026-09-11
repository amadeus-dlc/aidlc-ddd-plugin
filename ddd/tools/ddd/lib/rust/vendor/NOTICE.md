# Vendored Rust analysis assets

U2 ships its Rust syntax analyzer so it runs from bun alone — no cargo, Node.js
or network at runtime (FR8.4, NFR2, ADR-001). The files below are copied
verbatim from published npm packages.

## `lib/rust/vendor/tree-sitter.js`, `tree-sitter.wasm`, `LICENSE`

- Package: `web-tree-sitter@0.25.10`
- License: MIT (see `LICENSE`)
- Source: https://github.com/tree-sitter/tree-sitter (`lib/binding_web`)
- `tree-sitter.js` is the ESM runtime (`type: module`); `tree-sitter.wasm` is
  the runtime's WASM. `web-tree-sitter.types.d.ts` is the upstream type
  declaration, kept for reference; `tree-sitter.d.ts` is the minimal local
  surface the analyzer imports.

## `wasm/tree-sitter-rust.wasm`, `wasm/LICENSE`

- Package: `tree-sitter-wasms@0.1.13` (`out/tree-sitter-rust.wasm`)
- License: The Unlicense (public domain, see `LICENSE`)
- Source: https://github.com/Gregoor/tree-sitter-wasms
- Grammar: `tree-sitter-rust` (MIT), built for tree-sitter language ABI 14,
  which `web-tree-sitter@0.25.10` accepts.

## Reproducing

```sh
bun add --no-save web-tree-sitter@0.25.10 tree-sitter-wasms@0.1.13
cp node_modules/web-tree-sitter/tree-sitter.js        ddd/tools/ddd/lib/rust/vendor/tree-sitter.js
cp node_modules/web-tree-sitter/tree-sitter.wasm      ddd/tools/ddd/lib/rust/vendor/tree-sitter.wasm
cp node_modules/web-tree-sitter/web-tree-sitter.d.ts  ddd/tools/ddd/lib/rust/vendor/web-tree-sitter.types.d.ts
cp node_modules/web-tree-sitter/LICENSE               ddd/tools/ddd/lib/rust/vendor/LICENSE
cp node_modules/tree-sitter-wasms/out/tree-sitter-rust.wasm ddd/tools/ddd/wasm/tree-sitter-rust.wasm
cp node_modules/tree-sitter-wasms/LICENSE             ddd/tools/ddd/wasm/LICENSE
```
