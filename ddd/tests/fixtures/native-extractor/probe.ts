/**
 * Resolves, verifies and launches the native extractor in a child process, so a test can strip the
 * Rust toolchain from PATH and observe that the gate path never needs `rustc` or `cargo`.
 */

import { classifyNativeExtractor } from "../../../tools/ddd/lib/rust/native/launch.ts";

const [binDir, platformKey, flag, version] = process.argv.slice(2);
if (!binDir || !platformKey || !flag || !version) throw new Error("usage: probe.ts <binDir> <platformKey> <flag> <version>");

const outcome = await classifyNativeExtractor(binDir, platformKey, { flag, version: Number(version) });
console.log(JSON.stringify(outcome));
