import { posix } from "node:path";
import { fixtureMapping } from "../package-fixture.ts";
import type { GoldenCase } from "../runner.ts";
import { MAP, SOURCE_MANIFEST, specimen, workspace } from "./fixtures.ts";

const cases: GoldenCase[] = [];
// Independent policy table: do not derive expected permission from production isAllowed().
const permissions: Record<string, string[]> = {
  domain: ["domain", "infrastructure"],
  "use-case": ["use-case", "domain", "infrastructure"],
  "interface-adapter": ["interface-adapter", "use-case", "domain", "infrastructure"],
  rmu: ["rmu", "domain", "interface-adapter", "infrastructure"],
};
const layers = ["domain", "use-case", "interface-adapter", "infrastructure", "rmu", "composition-root"];
for (const [from, allowed] of Object.entries(permissions)) {
  const sensor = from === "rmu" ? "ddd-rust-interface-adapter" : `ddd-rust-${from}`;
  for (const to of layers) {
    for (const evidence of ["use", "cargo"] as const) {
      const pass = allowed.includes(to);
      const entry = specimen("ddd-rust-domain", "clean-domain");
      entry.sensor = sensor;
      entry.name = `${pass ? "clean" : "violation"}-g-${from}-to-${to}-${evidence}`;
      const fromName = `billing-${from}`;
      const toName = `pricing-${to}`;
      const fromPath = `packages/${from}/${fromName}`;
      const toPath = `packages/${to}/${toName}`;
      const sourcePath = `${fromPath}/src/lib.rs`;
      const cargo = `${fromPath}/Cargo.toml`;
      const header = (name: string) => `[package]\nname = "${name}"\nversion = "0.1.0"\nedition = "2021"\n`;
      entry.workspace = {
        "Cargo.toml": `[workspace]\nmembers = ["${fromPath}", "${toPath}"]\nresolver = "2"\n`,
        [cargo]: `${header(fromName)}\n[dependencies]\n${toName} = { path = "${posix.relative(fromPath, toPath)}" }\n`,
        [`${toPath}/Cargo.toml`]: header(toName),
        [sourcePath]: `${evidence === "use" ? `use ${toName.replaceAll("-", "_")}::Marker;\n` : ""}pub struct Invoice;\n`,
        [`${toPath}/src/lib.rs`]: "pub struct Marker;\n",
      };
      entry.files[MAP] = fixtureMapping();
      entry.files[SOURCE_MANIFEST] = JSON.stringify({
        stage: "code-generation",
        unit: "u1",
        version: 1,
        writes: [{ path: sourcePath }],
      });
      entry.expect = { pass, rules: pass ? [] : ["g"], files: { g: evidence === "use" ? sourcePath : cargo } };
      cases.push(entry);
    }
  }
  for (const evidence of ["use", "cargo"] as const) {
    const source = cases.find((c) => c.name === `clean-g-${from}-to-infrastructure-${evidence}`);
    if (!source) throw new Error(`Missing dependency fixture for ${from}/${evidence}`);
    const entry = structuredClone(source);
    entry.name = `${from === "domain" || from === "use-case" ? "violation" : "clean"}-g-${from}-external-io-${evidence}`;
    const path = `packages/${from}/billing-${from}`;
    workspace(entry)[`${path}/Cargo.toml`] += '\nreqwest = "0.12"\n';
    if (evidence === "use") workspace(entry)[`${path}/src/lib.rs`] = "use reqwest::Client;\npub struct Invoice;\n";
    const pass = from === "interface-adapter" || from === "rmu";
    entry.expect = {
      pass,
      rules: pass ? [] : ["g"],
      files: { g: `${path}/${evidence === "use" ? "src/lib.rs" : "Cargo.toml"}` },
    };
    cases.push(entry);
  }
}

export const DEPENDENCY_CASES = cases;
