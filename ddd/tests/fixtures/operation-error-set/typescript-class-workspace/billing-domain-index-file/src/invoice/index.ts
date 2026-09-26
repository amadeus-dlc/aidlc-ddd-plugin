/**
 * Each operation returns exactly the closed set of cases the mapping names, written as the
 * directory entry of a module with children, which is where the `index-file` layout places it.
 */

import type { Result } from "billing-domain/result";

export type IssueInvoiceError = "already-issued" | "empty-lines";
export type OpenInvoiceError = "negative-amount" | "missing-customer";

export class Invoice {
  static open(): Result<Invoice, OpenInvoiceError> {
    return { ok: true, value: new Invoice() };
  }

  issue(): Result<void, IssueInvoiceError> {
    return { ok: true, value: undefined };
  }
}
