/**
 * Each operation returns exactly the closed set of cases the mapping names, written as the
 * directory entry of a module with children, which is where the `index-file` layout places it.
 * The command belongs to the type and the generation method to the companion.
 */

import type { Result } from "billing-domain/result";

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
