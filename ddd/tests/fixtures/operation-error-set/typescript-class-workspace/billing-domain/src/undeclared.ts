/** The mapped type exists, but neither mapped operation does. */

import type { Result } from "./result.ts";

export type IssueInvoiceError = "already-issued" | "empty-lines";

export class Invoice {
  static restore(): Invoice {
    return new Invoice();
  }

  close(): Result<void, IssueInvoiceError> {
    return { ok: true, value: undefined };
  }
}
