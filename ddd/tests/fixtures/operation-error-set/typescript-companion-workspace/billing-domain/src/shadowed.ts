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

const invoiceBrand: unique symbol = Symbol("Invoice");

export type Invoice = {
  readonly [invoiceBrand]: true;
  issue(): Result<void, IssueInvoiceError>;
};

export const Invoice = {
  open(): Result<Invoice, OpenInvoiceError> {
    const instance: Invoice = {
      [invoiceBrand]: true,
      issue() {
        return { ok: true, value: undefined };
      },
    };
    return { ok: true, value: instance };
  },
};
