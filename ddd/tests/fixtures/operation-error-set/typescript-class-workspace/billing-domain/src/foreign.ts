/** Each operation adds one case the mapping gives to the other operation. */

import type { Result } from "./result.ts";

export type IssueInvoiceError = "already-issued" | "empty-lines" | "negative-amount";
export type OpenInvoiceError = "negative-amount" | "missing-customer" | "already-issued";

export class Invoice {
  static open(): Result<Invoice, OpenInvoiceError> {
    return { ok: true, value: new Invoice() };
  }

  issue(): Result<void, IssueInvoiceError> {
    return { ok: true, value: undefined };
  }
}
