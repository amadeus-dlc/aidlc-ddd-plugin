/** Each operation leaves out one case the mapping names. */

import type { Result } from "./result.ts";

export type IssueInvoiceError = "already-issued";
export type OpenInvoiceError = "negative-amount";

export class Invoice {
  static open(): Result<Invoice, OpenInvoiceError> {
    return { ok: true, value: new Invoice() };
  }

  issue(): Result<void, IssueInvoiceError> {
    return { ok: true, value: undefined };
  }
}
