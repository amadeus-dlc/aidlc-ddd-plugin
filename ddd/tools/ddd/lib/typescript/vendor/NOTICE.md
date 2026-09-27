# Vendored TypeScript Compiler API

The TypeScript fact extraction runs on the Compiler API this directory carries,
so an installed project needs no `typescript` package of its own. The files
below are copied verbatim from the published npm package.

## `typescript.js`, `LICENSE.txt`, `ThirdPartyNoticeText.txt`

- Package: `typescript@6.0.3` (`lib/typescript.js`)
- License: Apache-2.0 (see `LICENSE.txt`); third-party notices in
  `ThirdPartyNoticeText.txt`
- Source: https://github.com/microsoft/TypeScript
- `manifest.json` records the sha256 of `typescript.js`. The extractor compares
  it before loading the file and refuses to load bytes that do not match.

## Reproducing

From `ddd/`, with the pinned development dependencies installed:

```sh
bun install --frozen-lockfile
bun run prepare:typescript
```

The script refuses to copy any `typescript` version other than the supported
one and rewrites `manifest.json` from the copied bytes.
