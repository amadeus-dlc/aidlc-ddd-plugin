/** Only the bodies state what the operations return. */

export class Invoice {
  static open() {
    return new Invoice();
  }

  issue() {
    return 0;
  }
}
