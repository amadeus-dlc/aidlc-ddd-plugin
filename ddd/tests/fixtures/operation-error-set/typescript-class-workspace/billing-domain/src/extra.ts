/** Each operation adds one case that no operation of the mapping names. */

import type { Result } from "./result.ts";

export type IssueInvoiceError = "already-issued" | "empty-lines" | "locked";
export type OpenInvoiceError = "negative-amount" | "missing-customer" | "expired";

export class Invoice {
  static open(): Result<Invoice, OpenInvoiceError> {
    return { ok: true, value: new Invoice() };
  }

  issue(): Result<void, IssueInvoiceError> {
    return { ok: true, value: undefined };
  }
}
