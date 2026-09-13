import { parseOptions } from "../tools/ddd/lib/state-exposure-verification/options.ts";
import { issue } from "../tools/ddd/lib/state-exposure-verification/process.ts";
import { exitCode, newReport } from "../tools/ddd/lib/state-exposure-verification/report.ts";

const args = process.argv.slice(2);
let report = newReport(["bun", "run", "verify:state-exposure", ...args]);
try {
  parseOptions(args);
} catch (error) {
  report.status = "usage-error";
  report.errors.push(issue("invalid-request", "options", error instanceof Error ? error.message : String(error)));
}
if (report.status !== "usage-error") {
  try {
    const { runVerification } = await import("../tools/ddd/lib/state-exposure-verification/run.ts");
    report = await runVerification(args);
  } catch (error) {
    report.status = "execution-error";
    report.errors.push(
      issue("tool-unavailable", "verification", error instanceof Error ? error.message : String(error)),
    );
  }
}
process.stdout.write(`${JSON.stringify(report)}\n`);
process.exitCode = exitCode(report);
