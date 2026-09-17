/**
 * Each operation joins a wide member to its own error type, so the error type
 * no longer bounds its cases even though every literal member is mapped.
 */

import type { Result } from "./result.ts";

export type IssueInvoiceError = "already-issued" | "empty-lines";
export type OpenInvoiceError = "negative-amount" | "missing-customer";

const invoiceBrand: unique symbol = Symbol("Invoice");

export type Invoice = {
  readonly [invoiceBrand]: true;
  issue(): Result<void, IssueInvoiceError | string>;
};

export const Invoice = {
  open(): Result<Invoice, OpenInvoiceError | string> {
    const instance: Invoice = {
      [invoiceBrand]: true,
      issue() {
        return { ok: true, value: undefined };
      },
    };
    return { ok: true, value: instance };
  },
};
