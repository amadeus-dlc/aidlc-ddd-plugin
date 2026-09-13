// Controlled process fixture. Never imports or executes inspected source.
const mode = process.argv[2];
if (!["empty", "null", "whitespace", "invalid", "multiple", "failed", "timeout", "overflow", "resource"].includes(mode)) throw new Error("unknown controlled scenario");
process.stderr.write(`state-exposure-scenario:${mode}\n`);
if (mode === "empty") process.exit(0);
if (mode === "whitespace") process.stdout.write(" \n\t");
if (mode === "invalid") process.stdout.write("{");
if (mode === "multiple") process.stdout.write("{}\n{}");
if (mode === "failed") process.exit(7);
if (mode === "timeout") setInterval(() => {}, 1000);
if (mode === "overflow") process.stdout.write("x".repeat(10000));
if (mode === "resource") process.stderr.write("x".repeat(10000));

if (mode === "null") process.stdout.write("null");
