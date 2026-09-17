/** Both error types are imported from a module the snapshot does not contain. */

import type { IssueInvoiceError, OpenInvoiceError } from "./absent.ts";
import type { Result } from "./result.ts";

export class Invoice {
  static open(): Result<Invoice, OpenInvoiceError> {
    return { ok: true, value: new Invoice() };
  }

  issue(): Result<void, IssueInvoiceError> {
    return { ok: true, value: undefined };
  }
}
