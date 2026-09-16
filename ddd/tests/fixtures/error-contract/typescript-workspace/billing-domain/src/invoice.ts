/**
 * Supported reference variants written under the declared name, under an import
 * alias, and through a type-only import. The remaining two variants live in the
 * child module `invoice/line.ts`; this module is the named-file parent that owns
 * the directory beside it.
 */

import { IssueInvoiceError } from "./errors.ts";
import { IssueInvoiceError as RenamedInvoiceError } from "./errors.ts";
import type { IssueInvoiceError as TypeOnlyInvoiceError } from "./errors.ts";
import type { Result } from "./result.ts";

/**
 * Shares its spelling with `billing-use-case`'s own declarations; the two are
 * different symbols in different packages.
 */
export class Invoice {
  issue(): Result<void, IssueInvoiceError> {
    return { ok: true, value: undefined };
  }

  renamed(): Result<void, RenamedInvoiceError> {
    return { ok: true, value: undefined };
  }

  typeOnly(): Result<void, TypeOnlyInvoiceError> {
    return { ok: true, value: undefined };
  }
}
