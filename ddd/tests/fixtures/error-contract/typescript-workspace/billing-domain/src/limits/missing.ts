/** An import whose module is not part of the snapshot. */

import type { AbsentInvoiceError } from "./absent.ts";
import type { Result } from "../result.ts";

export class MissingReferent {
  issue(): Result<void, AbsentInvoiceError> {
    return { ok: true, value: undefined };
  }
}
