/**
 * An application type named `Result`. This module never imports the configured
 * language-support result, so the spelling alone is all that could establish the
 * standard result identity here.
 */

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

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
