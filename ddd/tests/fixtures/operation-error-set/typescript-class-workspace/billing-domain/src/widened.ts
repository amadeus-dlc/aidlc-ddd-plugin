/**
 * Each operation joins a wide member to its own error type, so the error type
 * no longer bounds its cases even though every literal member is mapped.
 */

import type { Result } from "./result.ts";

export type IssueInvoiceError = "already-issued" | "empty-lines";
export type OpenInvoiceError = "negative-amount" | "missing-customer";

export class Invoice {
  static open(): Result<Invoice, OpenInvoiceError | string> {
    return { ok: true, value: new Invoice() };
  }

  issue(): Result<void, IssueInvoiceError | string> {
    return { ok: true, value: undefined };
  }
}
