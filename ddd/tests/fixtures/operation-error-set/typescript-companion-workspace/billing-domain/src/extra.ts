/** Each operation adds one case that no operation of the mapping names. */

import type { Result } from "./result.ts";

export type IssueInvoiceError = "already-issued" | "empty-lines" | "locked";
export type OpenInvoiceError = "negative-amount" | "missing-customer" | "expired";

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
