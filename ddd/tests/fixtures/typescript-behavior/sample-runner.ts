/**
 * Runs the shared behavior scenarios against one installed generation sample, inside a child
 * `bun test` process the behavior test starts (tests/t11-typescript-behavior.test.ts).
 *
 * The samples run in that child rather than in the test process so that the sample sources, which
 * every test run executes, never enter the coverage the test process measures. Each scenario is its
 * own test here; what it reports is written, in registration order, to a JSON file the behavior test
 * reads and judges.
 */

import { afterAll, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { BEHAVIOR_SCENARIOS, type BehaviorScenario, type SampleModules } from "./scenarios.ts";

/** What the child reports for one scenario. */
export type ScenarioReport =
  | { readonly id: BehaviorScenario["id"]; readonly ok: true }
  | { readonly id: BehaviorScenario["id"]; readonly ok: false; readonly message: string };

/** Loads the packages the scenarios call through the names their consumers import them by. */
async function loadModules(root: string): Promise<SampleModules> {
  const load = (name: string) => import(join(root, "node_modules", name, "src/index.ts"));
  const [domain, useCase, interfaceAdapter] = await Promise.all([
    load("@acme/billing-domain"),
    load("@acme/billing-use-case"),
    load("@acme/billing-interface-adapter"),
  ]);
  return {
    Invoice: domain.Invoice,
    Money: domain.Money,
    InvoiceLine: domain.InvoiceLine,
    IssueInvoiceUseCase: useCase.IssueInvoiceUseCase,
    InMemoryInvoiceRepository: interfaceAdapter.InMemoryInvoiceRepository,
  };
}

/** Registers one test per scenario against the sample installed at `root` and reports to `reportPath`. */
export function registerSampleScenarios(root: string, reportPath: string): void {
  const reports: ScenarioReport[] = [];
  for (const scenario of BEHAVIOR_SCENARIOS) {
    test(scenario.id, async () => {
      try {
        // A failure to load the sample is reported against the scenario it prevented from running.
        scenario.run(await loadModules(root));
      } catch (error) {
        reports.push({ id: scenario.id, ok: false, message: error instanceof Error ? error.message : String(error) });
        throw error;
      }
      reports.push({ id: scenario.id, ok: true });
    });
  }
  afterAll(() => {
    writeFileSync(reportPath, JSON.stringify(reports));
  });
}
