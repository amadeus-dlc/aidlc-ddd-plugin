/**
 * The language-support result of this scenario. The inspected condition names
 * this declaration, so identity rather than the spelling `Result` decides
 * whether an operation returns the standard result.
 */

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
