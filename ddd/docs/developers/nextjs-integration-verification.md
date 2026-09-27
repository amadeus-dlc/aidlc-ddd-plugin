# Next.js integration verification

English | [日本語](nextjs-integration-verification.ja.md) | [Developer documents](README.md)

Verified: 2026-09-27. Base commit: `a1c9f8969100ed47bc7a63e603dc3b424395dc0d` (the T-11-06 changes were measured as an uncommitted working tree on top of it). See the [execution evidence](evidence/nextjs-integration-verification.json).

This records the TypeScript generation samples joined to an ESM Next.js application on the server-side Node.js runtime, actually built, started and driven by HTTP requests. Inspecting the sources on their own is not taken as proof of integration. It is limited to what §1 of the [language-independent design](language-independent-design.md) sets as acceptance — ESM on the server-side Node.js runtime, with a Next.js build and execution; every other host and combination is listed under "Not verified" below and is not presented as supported.

## Versions and environment verified

| Item | Version |
|---|---|
| Platform | `darwin-arm64` |
| Node.js | `v24.19.0` |
| npm | `11.17.0` |
| Next.js | `16.3.6` (from the npm registry; `next build` with Turbopack) |
| React / React DOM | `19.2.8` / `19.2.8` |
| TypeScript (the version the host's `next build` type-checks with) | `6.0.3` |
| `@types/node` / `@types/react` / `@types/react-dom` | `20.19.43` / `19.3.0` / `19.3.0` |
| bun (runs the gates and the script) | `1.3.13` |
| TypeScript Compiler API of the gates | the distributed `6.0.3` |

The script reads these versions from the packages npm installed and from the tools it ran, and writes them into the execution evidence.

## What is verified

[`scripts/verify-nextjs-integration.ts`](../../scripts/verify-nextjs-integration.ts) (`bun run verify:nextjs-integration`) does the following, in a fresh temporary project, for each of the four samples (`class` / `companion` × `named-file` / `index-file`). When a stage fails, the sample's remaining stages are not run and the sample is recorded as failed. The server and the temporary project are removed on every path: success, failure, exception, SIGINT and SIGTERM.

| Stage | Passes when |
|---|---|
| 1. `npm ci` | it installs Next.js and the rest from the npm registry through the committed lockfile, links the sample's packages as npm workspaces, and exits 0 |
| 2. `next build` (Node.js) | it builds the host, including the type check of `next build`, and exits 0 |
| 3. The four TypeScript gates | the domain, use-case, interface-adapter and module layout gates, run over the same project after it was installed and built, report no finding and did not pass by inspecting nothing |
| 4. CI entry | `ddd-check-typescript-module-layout.ts` exits 0 (it exits nonzero when it inspected zero packages) |
| 5. `next start` (Node.js) | it answers HTTP within 60 seconds |
| 6. HTTP requests | `POST /api/invoices/{id}/issue` sent in order to one server process answers as the table below states |

| Request | Expected answer | What it shows |
|---|---|---|
| issue `invoice-open` | `200 {"ok":true}` | the host runs the sample's `IssueInvoice`, which stores the issued aggregate |
| issue `invoice-open` again | `409 {"ok":false,"error":"already-issued"}` | the aggregate stored by the previous request is read back from the same repository |
| issue `invoice-empty` | `409 {"ok":false,"error":"empty-lines"}` | the aggregate's business error reaches the HTTP answer unchanged |
| issue `invoice-unknown` | `404 {"ok":false,"error":"invoice-not-found"}` | the repository's absence reaches the HTTP answer unchanged |

## Result

Every stage passed for all four samples. The time each stage took and each answer are in the execution evidence.

| Code representation | Module layout | `npm ci` | `next build` | Four gates | CI entry | `next start` | Four HTTP requests |
|---|---|---|---|---|---|---|---|
| `class` | `named-file` | pass | pass | pass | pass (4 packages) | pass | pass |
| `class` | `index-file` | pass | pass | pass | pass (4 packages) | pass | pass |
| `companion` | `named-file` | pass | pass | pass | pass (4 packages) | pass | pass |
| `companion` | `index-file` | pass | pass | pass | pass (4 packages) | pass | pass |

## The host

The host is `apps/web` as [`tests/fixtures/nextjs-integration/host.ts`](../../tests/fixtures/nextjs-integration/host.ts) writes it, and its lockfile is `package-lock.json` in the same directory. The four samples differ only in their sources and share package names, versions and dependencies, so they share one lockfile.

It is what `create-next-app@16.3.6` (`--ts --app --no-eslint --no-tailwind --no-src-dir --import-alias "@/*"`) generates, changed only where the integration needs it.

| Change | Why |
|---|---|
| `package.json` states `"type": "module"` and pins every dependency exactly (the generated one gives ranges for `@types/*` and `typescript`) | to verify an ESM application, at fixed versions |
| `typescript` is `6.0.3` rather than `^5` | the same version as the gates' Compiler API, and the type check of `next build` passes with it |
| `next.config.mjs` replaces `next.config.ts` and lists the four sample packages in `transpilePackages` | the sample packages publish `.ts` sources through `exports`, so Next.js has to transpile them |
| `tsconfig.json` adds `allowImportingTsExtensions: true` | the sample sources import with the `.ts` extension, as in `./invoice/line.ts`; without the setting the type check of `next build` was measured to fail with TS5097 on those sources |
| `lib/invoices.ts` and the route handler `app/api/invoices/[id]/issue/route.ts` are added, and the generated page, layout, `public/` and the like are left out | the route handler states `export const runtime = "nodejs"`. The repository is created once in its module and shared between the requests of one server process |
| a root `package.json` declares npm workspaces | to link the sample's packages under `node_modules/@acme/*` |

`target: "ES2017"`, `module: "esnext"`, `moduleResolution: "bundler"`, `strict: true` and `paths` (`@/*`) of `tsconfig.json` are as generated. `next build` did not rewrite that `tsconfig.json` (measured).

The root `tsconfig.json` references the host `apps/web` besides the sample's four packages, so the gates and the CI entry read a project that includes the host's settings at `target: "ES2017"`. Because packages have to state the same settings ([TypeScript fact extraction](typescript-fact-extraction.md)), the `tsconfig.json` of the sample's four packages state `target: "ES2017"` too; the sample sources are unchanged. The host's `paths` did not become a gate finding.

## Not verified

The following hosts and combinations are not verified, and none of them is presented as supported.

| Scope | Status |
|---|---|
| Linux, Windows, x86_64 | not verified; the measurements are on `darwin-arm64` only |
| Node.js other than 24, npm other than 11, installation with pnpm, yarn or bun | not verified |
| Next.js other than 16.3.6, `next build --webpack` | not verified |
| Edge Runtime, Cloudflare Workers and other runtimes than Node.js | out of scope ([language-independent design](language-independent-design.md) §1) |
| `next dev` | not verified |
| Client boundaries (using the sample from a `"use client"` component, Server Component pages) | not verified; the host has route handlers only |
| Deciding the host's (`apps/web`) sources with the TypeScript gates | not done. The host belongs to no layer, and the CI entry inspected the sample's four packages only. Deciding the host needs a new analysis target to be defined, which is outside this issue |
| Packages stating different targets | a refused configuration, not part of the integration |

## Limits

- The repository is the in-memory `InMemoryInvoiceRepository`, which keeps its state only for the lifetime of one server process. No external persistence such as a database is covered.
- The verification fetches from the network and runs `next build`, so it is not part of `bun run check` (CI). What CI confirms is the tests of the gates, the CI entry and the approval path (the path table of [TypeScript execution and persistence verification](typescript-execution-persistence-verification.md)).
- The lockfile was made from the npm registry at the time of verification. Reproducing it after the registry changes relies on the lockfile's `integrity`.

## Rerun and check the result

Node.js and npm on `PATH` and access to the npm registry are required.

```sh
cd ddd
bun install --frozen-lockfile
bun run prepare:typescript
bun run verify:nextjs-integration
```

The result is printed as JSON on standard output, and the exit status is 0 when every sample passes. When the host's dependencies change, change the versions in `host.ts`, run `npm install` in a project joining one sample and the host, and replace `tests/fixtures/nextjs-integration/package-lock.json` with the lockfile it writes.
