/**
 * An application type named `Result`. This module never imports the configured
 * language-support result, so the spelling alone is all that could establish the
 * standard result identity here.
 */

import { IssueInvoiceError } from "../errors.ts";

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export class Shadowed {
  issue(): Result<void, IssueInvoiceError> {
    return { ok: true, value: undefined };
  }
}
