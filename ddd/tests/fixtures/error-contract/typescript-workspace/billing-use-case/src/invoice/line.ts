/**
 * Two operations that reach the same declaration of `billing-domain` by two
 * access paths: `viaEntry` through the package's declared entry point, and
 * `viaInternalPath` through a relative path into the package's internals that
 * its entry points do not publish.
 */

import type { IssueInvoiceError } from "billing-domain";
import type { Result } from "billing-domain/result";
import type { IssueInvoiceError as InternalInvoiceError } from "../../../billing-domain/src/errors.ts";

const lineBrand: unique symbol = Symbol("Line");

export type Line = {
  readonly [lineBrand]: true;
  viaEntry(): Result<void, IssueInvoiceError>;
  viaInternalPath(): Result<void, InternalInvoiceError>;
};

export const Line = {
  create(): Result<Line, IssueInvoiceError> {
    const instance: Line = {
      [lineBrand]: true,
      viaEntry() {
        return { ok: true, value: undefined };
      },
      viaInternalPath() {
        return { ok: true, value: undefined };
      },
    };
    return { ok: true, value: instance };
  },
};
