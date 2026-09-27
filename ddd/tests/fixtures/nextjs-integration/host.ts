/**
 * The ESM Next.js application that hosts a TypeScript generation sample on the server-side Node.js
 * runtime (T-11-06), and the project that joins the two.
 *
 * The host is what `create-next-app` 16.3.6 generates, changed only where the integration needs it:
 * the package is `"type": "module"` and pins exact versions, `next.config.mjs` transpiles the
 * sample's packages, the generated `tsconfig.json` also allows the `.ts` import extensions the
 * sample's sources are written with, and one route handler issues an invoice through the sample's
 * use case. The sample's sources are not changed; its packages' `tsconfig.json` state the target the
 * host states, because a project whose packages state different settings is refused.
 *
 * `package-lock.json` beside this file is the lockfile npm wrote for this project; it is the same for
 * every sample, since the samples differ only in their sources.
 */

import type { GenerationSample } from "../typescript-generation/samples.ts";

export const HOST_DIR = "apps/web";
const HOST_NAME = "@acme/web";

/** The target `create-next-app` writes, which every package of the joined project states. */
const HOST_TARGET = "ES2017";

/** The invoices the host's repository starts from. */
const OPEN_INVOICE = "invoice-open";
const EMPTY_INVOICE = "invoice-empty";
const UNKNOWN_INVOICE = "invoice-unknown";

export interface IssueRequest {
  readonly invoice: string;
  readonly status: number;
  readonly body: { readonly ok: true } | { readonly ok: false; readonly error: string };
}
/**
 * The issue requests the verification sends in this order, one server process for all of them, and
 * the answers that show the sample's use case ran against one repository: the open invoice is issued
 * and then refused as already issued, the empty one is refused, and an unknown one is not found.
 */
export const ISSUE_REQUESTS: readonly IssueRequest[] = [
  { invoice: OPEN_INVOICE, status: 200, body: { ok: true } },
  { invoice: OPEN_INVOICE, status: 409, body: { ok: false, error: "already-issued" } },
  { invoice: EMPTY_INVOICE, status: 409, body: { ok: false, error: "empty-lines" } },
  { invoice: UNKNOWN_INVOICE, status: 404, body: { ok: false, error: "invoice-not-found" } },
];

const SAMPLE_PACKAGES = [
  "@acme/language-extensions",
  "@acme/billing-domain",
  "@acme/billing-use-case",
  "@acme/billing-interface-adapter",
];

const ROOT_MANIFEST = `${JSON.stringify(
  {
    name: "acme-billing",
    private: true,
    type: "module",
    workspaces: ["packages/infrastructure/*", "packages/command/*", HOST_DIR],
  },
  null,
  2,
)}\n`;

const HOST_MANIFEST = `${JSON.stringify(
  {
    name: HOST_NAME,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: { build: "next build", start: "next start" },
    dependencies: {
      ...Object.fromEntries(SAMPLE_PACKAGES.map((name) => [name, "0.1.0"])),
      next: "16.3.6",
      react: "19.2.8",
      "react-dom": "19.2.8",
    },
    devDependencies: {
      "@types/node": "20.19.43",
      "@types/react": "19.3.0",
      "@types/react-dom": "19.3.0",
      typescript: "6.0.3",
    },
  },
  null,
  2,
)}\n`;

/** The `tsconfig.json` create-next-app 16.3.6 generates, with `allowImportingTsExtensions` added. */
const HOST_TSCONFIG = `${JSON.stringify(
  {
    compilerOptions: {
      target: HOST_TARGET,
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "esnext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "react-jsx",
      incremental: true,
      plugins: [{ name: "next" }],
      paths: { "@/*": ["./*"] },
      allowImportingTsExtensions: true,
    },
    include: [
      "next-env.d.ts",
      "**/*.ts",
      "**/*.tsx",
      ".next/types/**/*.ts",
      ".next/dev/types/**/*.ts",
      "**/*.mts",
    ],
    exclude: ["node_modules"],
  },
  null,
  2,
)}\n`;

const NEXT_CONFIG = `const nextConfig = {
  transpilePackages: ${JSON.stringify(SAMPLE_PACKAGES)},
};

export default nextConfig;
`;

// One repository for the server process: the route module is loaded once, so an invoice issued by
// one request is the invoice the next request finds.
const INVOICES = `import { InMemoryInvoiceRepository } from "@acme/billing-interface-adapter";
import { IssueInvoice } from "@acme/billing-use-case";

const invoices = new InMemoryInvoiceRepository(
  new Map([
    ["${OPEN_INVOICE}", { customer: "acme", amounts: [100], issued: false }],
    ["${EMPTY_INVOICE}", { customer: "acme", amounts: [], issued: false }],
  ]),
);

export const issueInvoice = new IssueInvoice(invoices);
`;

const ISSUE_ROUTE = `import { issueInvoice } from "@/lib/invoices";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  const issued = issueInvoice.execute(id);
  if (issued.ok) return Response.json({ ok: true });
  return Response.json({ ok: false, error: issued.error }, { status: issued.error === "invoice-not-found" ? 404 : 409 });
}
`;

/** The path of the route that issues the invoice `id`. */
export function issuePath(id: string): string {
  return `/api/invoices/${encodeURIComponent(id)}/issue`;
}

const HOST_FILES: Readonly<Record<string, string>> = {
  [`${HOST_DIR}/package.json`]: HOST_MANIFEST,
  [`${HOST_DIR}/tsconfig.json`]: HOST_TSCONFIG,
  [`${HOST_DIR}/next.config.mjs`]: NEXT_CONFIG,
  [`${HOST_DIR}/lib/invoices.ts`]: INVOICES,
  [`${HOST_DIR}/app/api/invoices/[id]/issue/route.ts`]: ISSUE_ROUTE,
};

/** The package `tsconfig.json` of the sample, stating the host's target instead of its own. */
function atHostTarget(tsconfig: string): string {
  const document = JSON.parse(tsconfig) as { compilerOptions: Record<string, unknown> };
  return `${JSON.stringify({ ...document, compilerOptions: { ...document.compilerOptions, target: HOST_TARGET } }, null, 2)}\n`;
}

/**
 * Every file of the project that joins `sample` and the host: the sample's workspace with its
 * package configs at the host's target, the root `tsconfig.json` referencing the host as well, the
 * npm workspace manifest, and the host.
 */
export function integratedWorkspace(sample: GenerationSample): Record<string, string> {
  const workspace: Record<string, string> = {};
  for (const [path, content] of Object.entries(sample.workspace))
    workspace[path] = path.endsWith("/tsconfig.json") ? atHostTarget(content) : content;
  const root = JSON.parse(sample.workspace["tsconfig.json"]) as { references: { path: string }[] };
  workspace["tsconfig.json"] =
    `${JSON.stringify({ ...root, references: [...root.references, { path: `./${HOST_DIR}` }] }, null, 2)}\n`;
  workspace["package.json"] = ROOT_MANIFEST;
  return { ...workspace, ...HOST_FILES };
}
