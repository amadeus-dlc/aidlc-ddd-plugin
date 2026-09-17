/**
 * The command declares no result contract, and the generation method returns
 * its own type instead of the standard result.
 */

export type IssueInvoiceError = "already-issued" | "empty-lines";
export type OpenInvoiceError = "negative-amount" | "missing-customer";

const invoiceBrand: unique symbol = Symbol("Invoice");

export type Invoice = {
  readonly [invoiceBrand]: true;
  issue(): void;
};

export const Invoice = {
  open(): Invoice {
    return {
      [invoiceBrand]: true,
      issue() {},
    };
  },
};
