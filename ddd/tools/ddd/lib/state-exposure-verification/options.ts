import { DEFAULT_LIMITS, type Limits } from "./process.ts";
export interface Options extends Limits {
  caseId: string;
}
export function parseOptions(args: readonly string[]): Options {
  const options: Options = { ...DEFAULT_LIMITS, caseId: "all" };
  const seen = new Set<string>();
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    if (!["--case", "--timeout-ms", "--max-output-bytes"].includes(key) || seen.has(key) || !value)
      throw new Error("unknown, duplicate, or incomplete option");
    seen.add(key);
    if (key === "--case") options.caseId = value;
    else {
      if (!/^[0-9]+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0)
        throw new Error("limits must be positive safe integers");
      if (key === "--timeout-ms") options.timeoutMs = Number(value);
      else options.maxOutputBytes = Number(value);
    }
  }
  return options;
}
