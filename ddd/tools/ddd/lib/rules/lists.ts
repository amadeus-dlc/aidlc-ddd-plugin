/**
 * Fixed lists shared by the Rust rule evaluators (BR9.2). The storage-medium
 * list is the same value the design-side layer-structure sensor uses (U4
 * BR6.4), so the design and code checks agree (ADR-009).
 */

export const POST_INIT = new Set(["init", "setup", "initialize", "reset", "configure"]);

export const MEDIA_WORDS = [
  "dynamodb",
  "dynamo",
  "postgres",
  "mysql",
  "sqlite",
  "redis",
  "mongo",
  "s3",
  "jdbc",
  "sql",
  "http",
  "grpc",
  "kafka",
  "inmemory",
];

export interface ExternalCrateRule {
  pattern: string;
  category: "database" | "cache" | "message-broker" | "http-client" | "rpc" | "web-framework" | "cloud-sdk";
}

/** Q6 initial denylist. A trailing `*` is a prefix match. */
export const IO_CRATES: readonly ExternalCrateRule[] = [
  { pattern: "sqlx", category: "database" },
  { pattern: "diesel", category: "database" },
  { pattern: "rusqlite", category: "database" },
  { pattern: "mongodb", category: "database" },
  { pattern: "redis", category: "cache" },
  { pattern: "aws-sdk-*", category: "cloud-sdk" },
  { pattern: "aws-config", category: "cloud-sdk" },
  { pattern: "reqwest", category: "http-client" },
  { pattern: "hyper", category: "http-client" },
  { pattern: "axum", category: "web-framework" },
  { pattern: "actix-web", category: "web-framework" },
  { pattern: "tonic", category: "rpc" },
  { pattern: "rdkafka", category: "message-broker" },
  { pattern: "lapin", category: "message-broker" },
];

export function matchesIoRule(
  crateName: string,
  rules: readonly ExternalCrateRule[] = IO_CRATES,
): ExternalCrateRule | undefined {
  return rules.find((rule) =>
    rule.pattern.endsWith("*") ? crateName.startsWith(rule.pattern.slice(0, -1)) : crateName === rule.pattern,
  );
}

export function containsMediaWord(name: string): boolean {
  const lower = name.toLowerCase();
  return MEDIA_WORDS.some((word) => lower.includes(word));
}

/** PascalCase / camelCase -> lower kebab (InvoiceLine -> invoice-line, HTTPClient -> http-client). */
export function toKebab(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

/** snake_case -> kebab (add_item -> add-item). */
export function snakeToKebab(name: string): string {
  return name
    .replace(/_/g, "-")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

export function toPascal(name: string): string {
  return name
    .split(/[-_]/)
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}
