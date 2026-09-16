/**
 * The structure and companion representation, written in the directory-entry
 * module layout. The instance operation belongs to the type and the generation
 * method belongs to the companion, and both state the same error contract.
 *
 * Every reference crosses the package boundary through `billing-domain`'s own
 * entry points.
 */

import type { IssueInvoiceError } from "billing-domain";
import type { Result } from "billing-domain/result";

const entryBrand: unique symbol = Symbol("Entry");

export type Entry = {
  readonly [entryBrand]: true;
  issue(): Result<void, IssueInvoiceError>;
};

export const Entry = {
  create(): Result<Entry, IssueInvoiceError> {
    const instance: Entry = {
      [entryBrand]: true,
      issue() {
        return { ok: true, value: undefined };
      },
    };
    return { ok: true, value: instance };
  },
};
