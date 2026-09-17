/** The mapped type and its companion exist, but neither mapped operation does. */

import type { Result } from "./result.ts";

export type IssueInvoiceError = "already-issued" | "empty-lines";

const invoiceBrand: unique symbol = Symbol("Invoice");

export type Invoice = {
  readonly [invoiceBrand]: true;
  close(): Result<void, IssueInvoiceError>;
};

export const Invoice = {
  restore(): Invoice {
    return {
      [invoiceBrand]: true,
      close() {
        return { ok: true, value: undefined };
      },
    };
  },
};
