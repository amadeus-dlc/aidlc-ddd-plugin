/**
 * The command declares no result contract, and the generation method returns
 * its own type instead of the standard result.
 */

export type IssueInvoiceError = "already-issued" | "empty-lines";
export type OpenInvoiceError = "negative-amount" | "missing-customer";

export class Invoice {
  static open(): Invoice {
    return new Invoice();
  }

  issue(): void {}
}
