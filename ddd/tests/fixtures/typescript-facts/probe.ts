/**
 * Launches the TypeScript extractor of the tools tree named by the first argument for the project
 * named by the second, and prints the classification and what the facts of one source construct.
 *
 * The modules are loaded from the named tree by absolute path, so a bare `typescript` import inside
 * them resolves from that tree and nowhere else.
 */

import { join } from "node:path";
import { PROBE_CONSTRUCTED_TYPE, PROBE_FILE } from "./project.ts";

const [tools, workspace] = process.argv.slice(2);
const launch = await import(join(tools, "ddd/lib/typescript/compiler/launch.ts"));
const domainFacts = await import(join(tools, "ddd/lib/typescript/domain-facts/index.ts"));

const outcome = await launch.classifyTypeScriptExtractor(workspace);
if (outcome.kind !== "ready") {
  process.stdout.write(JSON.stringify({ kind: outcome.kind, detail: outcome.detail }));
} else {
  const facts = domainFacts.requireTypeScriptFacts(outcome, [
    { file: PROBE_FILE, source: `export const invoice = new ${PROBE_CONSTRUCTED_TYPE}();\n` },
  ]);
  const file = facts.files.get(PROBE_FILE);
  process.stdout.write(
    JSON.stringify({
      kind: outcome.kind,
      constructions: file ? file.constructions.map((entry: { type_text: string }) => entry.type_text) : null,
    }),
  );
}
