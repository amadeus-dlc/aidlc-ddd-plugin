/** Each operation adds one case the mapping gives to the other operation. */

import type { Result } from "./result.ts";

export type IssueInvoiceError = "already-issued" | "empty-lines" | "negative-amount";
export type OpenInvoiceError = "negative-amount" | "missing-customer" | "already-issued";

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
