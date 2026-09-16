/**
 * Supported reference variants written through a renamed re-export and through a
 * transparent type alias. Both reach the declaration in `../errors.ts`, one by
 * way of the package entry module and one by way of the alias declared here.
 */

import { RejectedInvoiceError } from "../index.ts";
import type { Result } from "../result.ts";

export type Outcome<T> = Result<T, RejectedInvoiceError>;

export class Reexported {
  issue(): Result<void, RejectedInvoiceError> {
    return { ok: true, value: undefined };
  }
}

export class Aliased {
  issue(): Outcome<void> {
    return { ok: true, value: undefined };
  }
}
