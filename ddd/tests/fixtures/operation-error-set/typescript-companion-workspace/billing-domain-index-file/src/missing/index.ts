/**
 * Each operation leaves out one case the mapping names, written as the directory entry of a
 * module with children.
 */

import type { Result } from "billing-domain/result";

export type IssueInvoiceError = "already-issued";
export type OpenInvoiceError = "negative-amount";

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
