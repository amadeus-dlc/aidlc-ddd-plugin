/**
 * Workspace fixtures for the canonical model migration suite.
 *
 * The migration is observed on one directory that survives preview -> apply ->
 * re-read -> re-run, so every helper here works against a root the test owns for
 * the whole sequence rather than rebuilding a fresh one per condition.
 */

import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { MODEL_DATA_PATH, MODEL_VIEW_FILE } from "../../../tools/ddd/lib/schema/artifacts.ts";
import { readYamlBlock } from "../../../tools/ddd/lib/shared/markdown-yaml.ts";

const INVOICE_STATEMENT = "請求金額は負であってはならない。";
const PAYMENT_STATEMENT = "入金額は負であってはならない。";

/** A business condition recorded in Japanese; the migration must not translate or reword it. */
export const ISSUE_CONDITION = "請求書が下書き状態ではない。";
/**
 * A condition whose *value* spells the key the migration renames elsewhere. A textual
 * substitution would rewrite this string; a structural one cannot reach it.
 */
export const SETTLE_CONDITION = "command: command.invoice.cancel を満たさない";

interface Fence {
  readonly open: string;
  readonly close: string;
}

const DEFAULT_FENCE: Fence = { open: "```yaml", close: "```" };

/** Fence spellings readYamlBlock accepts; the migration must select the same single block. */
export const FENCE_VARIANTS: readonly (readonly [string, Fence])[] = [
  ["a tilde fence", { open: "~~~yaml", close: "~~~" }],
  ["a four-backtick fence", { open: "````yaml", close: "````" }],
  ["a closing fence longer than its opener", { open: "```yaml", close: "````" }],
  ["a yml info string", { open: "```yml", close: "```" }],
];

/**
 * Prose, plus a non-YAML fence that nests a model-shaped ```yaml fence inside a longer outer
 * fence. readYamlBlock swallows the inner one, so the document still has exactly one migratable
 * block and the nested text is a region the migration must leave alone.
 */
const PROSE_HEAD = [
  "# 正規モデル",
  "",
  "移行はこの散文を書き換えない。`command:` という字面は散文にも現れる。",
  "",
  "````text",
  "commands:",
  "  - domain_errors:",
  "      - command: command.invoice.issue",
  "```yaml",
  "これは移行対象のブロックではない。",
  "```",
  "````",
  "",
].join("\n");

const PROSE_TAIL = ["", "## 付記", "", "このブロック以外は1バイトも変わらない。", ""].join("\n");

export function modelDocument(yaml: string, fence: Fence = DEFAULT_FENCE): string {
  return `${PROSE_HEAD}${fence.open}\n${yaml.trimEnd()}\n${fence.close}\n${PROSE_TAIL}`;
}

export function documentWithNoYamlBlock(): string {
  return `${PROSE_HEAD}${PROSE_TAIL}`;
}

export function documentWithTwoYamlBlocks(yaml: string): string {
  return `${modelDocument(yaml)}\n\`\`\`yaml\n${yaml.trimEnd()}\n\`\`\`\n`;
}

export function documentWithUnclosedYamlBlock(yaml: string): string {
  return `${PROSE_HEAD}\`\`\`yaml\n${yaml.trimEnd()}\n`;
}

/**
 * Everything outside the one labelled YAML block, split at the same boundary readYamlBlock
 * picks. Comparing this before and after an apply proves the fence delimiters, the prose and the
 * nested non-YAML fence are untouched. A document whose block is authoritative only inside one
 * section names that section, so the fences outside it stay part of the envelope.
 */
export function envelopeOf(markdown: string, heading?: string | readonly string[]): { head: string; tail: string } {
  const block = readYamlBlock(markdown, heading);
  const lines = markdown.split(/\r?\n/);
  const start = block.startLine - 1;
  const bodyLines = block.yaml.split("\n").length;
  return { head: lines.slice(0, start).join("\n"), tail: lines.slice(start + bodyLines).join("\n") };
}

interface LegacyModelOptions {
  readonly issueCondition?: string;
  /** Factory rules carry no business errors in the legacy format, so they are what a migration cannot complete. */
  readonly withFactory?: boolean;
  /** An empty list under a key the loader requires, which the rewritten document must still declare. */
  readonly emptyProcessSteps?: boolean;
}

/** The legacy schema_version = 1 model a record has to be migrated from. */
export function legacyModelYaml(options: LegacyModelOptions = {}): string {
  const issue = JSON.stringify(options.issueCondition ?? ISSUE_CONDITION);
  const factory = options.withFactory
    ? [
        "        factory_rules:",
        "          - element_id: factory.invoice.open",
        "            name: Open",
        "            target_element: entity.invoice",
        "            preconditions: [invariant.invoice.total-positive]",
      ]
    : [];
  const steps = options.emptyProcessSteps
    ? ["        steps: []"]
    : [
        "        steps:",
        "          - { name: issue, command: command.invoice.issue, on_failure: refund }",
        "          - { name: settle, command: command.payment.settle }",
      ];
  return [
    "schema_version: 1",
    "bounded_contexts:",
    "  - element_id: bc.billing",
    "    name: Billing",
    "    aggregates:",
    "      - element_id: aggregate.invoice",
    "        name: Invoice",
    "        bounded_context: bc.billing",
    "        root_element: entity.invoice",
    "        states: [draft, issued]",
    "        elements:",
    "          - { element_id: entity.invoice, kind: entity, name: Invoice, aggregate: aggregate.invoice }",
    "        invariants:",
    "          - element_id: invariant.invoice.total-positive",
    "            name: TotalPositive",
    "            aggregate: aggregate.invoice",
    `            statement: ${JSON.stringify(INVOICE_STATEMENT)}`,
    "        commands:",
    "          - element_id: command.invoice.issue",
    "            name: Issue",
    "            aggregate: aggregate.invoice",
    "            effect: transition",
    "            state_effect: transitions",
    "            transitions: [transition.invoice.issue]",
    "            domain_errors:",
    "              - element_id: error.invoice.issue.already-issued",
    "                name: AlreadyIssued",
    "                command: command.invoice.issue",
    `                condition: ${issue}`,
    "            events: [event.invoice.issued]",
    "            idempotency: { strategy: none }",
    "        events:",
    "          - { element_id: event.invoice.issued, name: Issued, aggregate: aggregate.invoice, produced_by: command.invoice.issue }",
    "        transitions:",
    "          - element_id: transition.invoice.issue",
    "            name: Issue",
    "            aggregate: aggregate.invoice",
    "            from_state: draft",
    "            to_state: issued",
    "            command: command.invoice.issue",
    ...factory,
    "      - element_id: aggregate.payment",
    "        name: Payment",
    "        bounded_context: bc.billing",
    "        root_element: entity.payment",
    "        elements:",
    "          - { element_id: entity.payment, kind: entity, name: Payment, aggregate: aggregate.payment }",
    "        invariants:",
    "          - element_id: invariant.payment.non-negative",
    "            name: NonNegative",
    "            aggregate: aggregate.payment",
    `            statement: ${JSON.stringify(PAYMENT_STATEMENT)}`,
    "        commands:",
    "          - element_id: command.payment.settle",
    "            name: Settle",
    "            aggregate: aggregate.payment",
    "            effect: transition",
    "            state_effect: none",
    "            domain_errors:",
    "              - element_id: error.payment.settle.already-settled",
    "                name: AlreadySettled",
    "                command: command.payment.settle",
    `                condition: ${JSON.stringify(SETTLE_CONDITION)}`,
    "            idempotency: { strategy: none }",
    "          - element_id: command.payment.refund",
    "            name: Refund",
    "            aggregate: aggregate.payment",
    "            effect: transition",
    "            state_effect: none",
    "            domain_errors:",
    "              - element_id: error.payment.refund.not-settled",
    "                name: NotSettled",
    "                command: command.payment.refund",
    '                condition: "未決済である。"',
    "            idempotency: { strategy: none }",
    "    process_managers:",
    "      - element_id: pm.billing-flow",
    "        name: BillingFlow",
    "        aggregates: [aggregate.invoice, aggregate.payment]",
    ...steps,
    "        compensations:",
    "          - { name: refund, command: command.payment.refund }",
    "lineage: []",
    "",
  ].join("\n");
}

function legacyModelElementIds(options: { withFactory?: boolean }): string[] {
  return [
    "bc.billing",
    "aggregate.invoice",
    "entity.invoice",
    "invariant.invoice.total-positive",
    "command.invoice.issue",
    "error.invoice.issue.already-issued",
    "event.invoice.issued",
    "transition.invoice.issue",
    ...(options.withFactory ? ["factory.invoice.open"] : []),
    "aggregate.payment",
    "entity.payment",
    "invariant.payment.non-negative",
    "command.payment.settle",
    "error.payment.settle.already-settled",
    "command.payment.refund",
    "error.payment.refund.not-settled",
    "pm.billing-flow",
  ];
}

/**
 * The review document ddd-model-completeness cross-checks. It names every element id and repeats
 * both invariant statements, and deliberately carries no business condition: a condition text
 * that mentions an id would be read as a reference to an element the model does not declare.
 */
export function viewDocument(options: { withFactory?: boolean } = {}): string {
  const ids = legacyModelElementIds(options)
    .map((id) => `- ${id}`)
    .join("\n");
  return `# 正規モデル（レビュー用）\n\n${ids}\n\n- ${INVOICE_STATEMENT}\n- ${PAYMENT_STATEMENT}\n`;
}

const RECORD_DIR = "aidlc/spaces/default/intents/i1";

/** Where AI-DLC resolves the model data artifact inside an intent record. */
export const MODEL_IN_RECORD = `${RECORD_DIR}/${MODEL_DATA_PATH}`;

/** An intent record the shipped production sensors can be pointed at unchanged. */
export function recordFiles(modelMarkdown: string, view: string): Record<string, string> {
  return {
    [`${RECORD_DIR}/aidlc-state.md`]: "## Stage Progress\n- [x] ddd-domain-modeling — EXECUTE\n",
    [MODEL_IN_RECORD]: modelMarkdown,
    [`${RECORD_DIR}/${dirname(MODEL_DATA_PATH)}/${MODEL_VIEW_FILE}`]: view,
  };
}

/** Files the migration must never touch: sibling artifacts, notes and project settings. */
export function untouchableUserFiles(): Record<string, string> {
  return {
    [MODEL_VIEW_FILE]: "# 正規モデル（レビュー用）\n\n- command.invoice.issue\n",
    "ddd-aggregate-mapping.md":
      "# Aggregate mapping\n\n```yaml ddd-aggregate-mapping\naggregates:\n  - aggregate_ref: AGG-001\n```\n",
    "notes/design.md": "# メモ\n\n`command:` という字面はここにも現れる。\n",
    ".ddd.toml": 'schema_version = 2\nlanguages = ["rust"]\n\n[rust]\nmodule_layout = "file"\n',
  };
}

function createWorkspace(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "ddd-domain-model-"));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

export function withWorkspace<T>(files: Record<string, string>, body: (root: string) => T): T {
  const root = createWorkspace(files);
  try {
    return body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** Byte-level census of every entry below the root, so "unchanged" means unchanged and not merely re-parsed. */
export function snapshotBytes(root: string): Record<string, string> {
  const census: Record<string, string> = {};
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = join(directory, entry.name);
      const key = relative(root, full).split(sep).join("/");
      if (entry.isSymbolicLink()) census[key] = `symlink:${readlinkSync(full)}`;
      else if (entry.isDirectory()) {
        census[key] = "directory";
        walk(full);
      } else census[key] = `sha256:${createHash("sha256").update(readFileSync(full)).digest("hex")}`;
    }
  };
  walk(root);
  return census;
}

export function without(census: Record<string, string>, path: string): Record<string, string> {
  return Object.fromEntries(Object.entries(census).filter(([entry]) => entry !== path));
}
