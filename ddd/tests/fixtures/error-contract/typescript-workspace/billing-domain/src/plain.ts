/**
 * Class operations whose declared return type is not the standard result: one
 * returns nothing, one returns a declaration of this module, and one returns a
 * declaration it imports under a second name. None of them states an error type.
 */

import { Invoice as Billed } from "./invoice.ts";

export class Plain {
  close(): void {}

  copy(): Plain {
    return new Plain();
  }

  billed(): Billed {
    return new Billed();
  }
}
