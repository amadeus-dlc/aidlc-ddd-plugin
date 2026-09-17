/**
 * Only the bodies state what the operations return: the command's signature on
 * the type states no return type, and neither does the generation method.
 */

const invoiceBrand: unique symbol = Symbol("Invoice");

export type Invoice = {
  readonly [invoiceBrand]: true;
  issue();
};

export const Invoice = {
  open() {
    return {
      [invoiceBrand]: true,
      issue() {
        return 0;
      },
    };
  },
};
