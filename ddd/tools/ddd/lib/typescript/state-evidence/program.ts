import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import ts from "typescript";
import type { FrozenTask } from "../../state-exposure-verification/input.ts";

export const TS_TOOLCHAIN = [
  { name: "ddd-typescript-state-evidence", version: "1" },
  { name: "typescript", version: ts.version },
];
export function createFrozenProgram(task: FrozenTask): ts.Program {
  if (ts.version !== "6.0.3") throw new Error("TypeScript 6.0.3 is required");
  const compilerLib = dirname(require.resolve("typescript"));
  const files = new Map<string, string>();
  for (const source of task.input.sources) files.set(`/input/${source.path}`, source.content);
  // Only compiler-owned standard library assets are allowed; no ambient @types or project discovery.
  for (const name of readdirSync(compilerLib))
    if (/^lib\.[\w.]+\.d\.ts$/.test(name)) files.set(`/lib/${name}`, readFileSync(join(compilerLib, name), "utf8"));
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    strict: true,
    noEmit: true,
    noResolve: false,
    types: [],
    lib: ["lib.esnext.d.ts"],
  };
  const host: ts.CompilerHost = {
    getSourceFile: (file, version) => {
      const text = files.get(posix.normalize(file));
      return text === undefined ? undefined : ts.createSourceFile(file, text, version, true);
    },
    getDefaultLibFileName: () => "/lib/lib.esnext.d.ts",
    getDefaultLibLocation: () => "/lib",
    writeFile: () => {
      throw new Error("source emission forbidden");
    },
    getCurrentDirectory: () => "/input",
    getDirectories: () => [],
    fileExists: (file) => files.has(posix.normalize(file)),
    readFile: (file) => files.get(posix.normalize(file)),
    getCanonicalFileName: (file) => file,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
  };
  return ts.createProgram(
    task.input.sources.map((s) => `/input/${s.path}`),
    options,
    host,
  );
}
