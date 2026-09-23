/**
 * Runs the error-contract entry's default extraction path inside whatever tree this file is copied
 * into, so a test can place a manifest without an extractor beside it and observe what that entry
 * hands its consumers. The entry resolves the installation from its own module location, so only a
 * separate tree can put it in front of an installation that cannot be launched.
 */

import { join } from "node:path";
import { freezeInput } from "../../../tools/ddd/lib/error-contract-verification/input.ts";
import { LAYOUT, WORKSPACE, workspaceSources } from "../../../tools/ddd/lib/error-contract-verification/scenario.ts";
import { projectSettingsPayload } from "../../../tools/ddd/lib/project-settings/payload.ts";
import { resolveCargoCondition } from "../../../tools/ddd/lib/rust/error-contract/cargo-condition.ts";
import { extractRust, RUST_TOOLCHAIN } from "../../../tools/ddd/lib/rust/error-contract/index.ts";

const [targetTriple] = process.argv.slice(2);
if (!targetTriple) throw new Error("usage: error-contract-extract.ts <targetTriple>");

const resolution = await resolveCargoCondition({
  manifestPath: join(WORKSPACE, "Cargo.toml"),
  targetTriple,
  features: [],
});
if (resolution.kind !== "resolved") throw new Error(`cargo condition unavailable: ${JSON.stringify(resolution)}`);
const owner = resolution.condition.packages.find((candidate) => candidate.name === "billing-domain");
if (!owner) throw new Error("condition has no package billing-domain");

const frozen = freezeInput({
  language: "rust",
  cargoCondition: resolution.condition,
  target: {
    packageId: owner.packageId,
    targetName: owner.targets[0].name,
    file: "billing-domain/src/invoice.rs",
    declarationPath: ["invoice", "Invoice"],
    operation: "issue",
  },
  sources: workspaceSources(),
  settings: projectSettingsPayload({
    languages: ["rust"],
    rust: { moduleLayout: LAYOUT["billing-domain"] },
    typescript: null,
  }),
  toolchain: RUST_TOOLCHAIN,
});

console.log(JSON.stringify((await extractRust(frozen)).execution));
