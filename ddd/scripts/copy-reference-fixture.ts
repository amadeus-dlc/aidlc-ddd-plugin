import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Copy template bytes into a fresh writable fixture. Never alter source modes.
export function copyReferenceFixture(source: string, destination: string): void {
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(destination, entry.name);
    if (entry.isDirectory()) copyReferenceFixture(from, to);
    else if (entry.isFile()) writeFileSync(to, readFileSync(from));
    else throw new Error(`Unsupported reference fixture entry: ${from}`);
  }
}
