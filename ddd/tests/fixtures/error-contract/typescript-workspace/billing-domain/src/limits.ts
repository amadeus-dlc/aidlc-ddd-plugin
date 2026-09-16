/**
 * Shapes whose resolution is bounded. The cases that break their own module -
 * an import with no referent, a cyclic alias chain, a locally declared `Result`
 * - live in one file each under `limits/` so that none of them can widen the
 * others. This module is their named-file parent and re-exports them.
 */

import { IssueInvoiceError } from "./errors.ts";
import type { Result } from "./result.ts";

export { Cyclic } from "./limits/cycle.ts";
export { MissingReferent } from "./limits/missing.ts";
export { Shadowed } from "./limits/shadowed.ts";

/** The spelling of a declared result contract, in type position only. */
export type Note = "Result<void, IssueInvoiceError>";

export class EscapeAny {
  issue(): Result<void, any> {
    return { ok: true, value: undefined };
  }
}

export class EscapeUnknown {
  issue(): Result<void, unknown> {
    return { ok: true, value: undefined };
  }
}

/** A union that no longer bounds its members once a wide member joins it. */
export class WideUnion {
  issue(): Result<void, IssueInvoiceError | string> {
    return { ok: true, value: undefined };
  }
}

/** A union member that carries no business error case. */
export class Optional {
  issue(): Result<void, IssueInvoiceError | undefined> {
    return { ok: true, value: undefined };
  }
}

/** A named error type whose own declaration a wide member has joined, so the name alone reaches no closed set. */
export type WidenedInvoiceError = "already-issued" | "empty" | string;

export class WidenedAlias {
  issue(): Result<void, WidenedInvoiceError> {
    return { ok: true, value: undefined };
  }
}

/** Nothing but the assertion states that this operation returns the result. */
export class Asserted {
  issue() {
    return { ok: false, error: "already-issued" } as Result<void, IssueInvoiceError>;
  }
}

/** No declared return type and no assertion: only the body states the shape. */
export class Inferred {
  issue() {
    return { ok: true, value: undefined };
  }
}

/**
 * The same spelling appears in a documentation comment, in both string quote
 * forms and in both template literal forms, and the operation itself declares no
 * return type.
 *
 * Historical note: this operation used to return `Result<void, IssueInvoiceError>`.
 */
export class Documented {
  issue() {
    // Result<void, IssueInvoiceError>
    /* Result<void, IssueInvoiceError> */
    const doubleQuoted = "Result<void, IssueInvoiceError>";
    const singleQuoted = 'Result<void, IssueInvoiceError>';
    const template = `Result<void, IssueInvoiceError>`;
    const substituted = `Result<void, ${doubleQuoted.length}IssueInvoiceError>`;
    return [doubleQuoted, singleQuoted, template, substituted];
  }
}

/** The same spelling in type position is a case name, not a type reference. */
export class Noted {
  issue(): Result<void, Note> {
    return { ok: true, value: undefined };
  }
}
