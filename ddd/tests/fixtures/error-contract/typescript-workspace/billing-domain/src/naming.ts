/**
 * A second declaration that carries the same name as the one in `errors.ts`.
 * Both are reachable as the error type of their own operation, so the symbols
 * they resolve to are observable and must stay apart.
 */

import type { Result } from "./result.ts";

export type IssueInvoiceError = "declared-elsewhere" | "still-elsewhere";

export class Naming {
  issue(): Result<void, IssueInvoiceError> {
    return { ok: true, value: undefined };
  }
}
