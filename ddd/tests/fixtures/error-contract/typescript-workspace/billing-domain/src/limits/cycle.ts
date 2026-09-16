/** A type alias chain that references itself. */

export type Cycle<T> = CycleStep<T>;
export type CycleStep<T> = Cycle<T>;

export class Cyclic {
  issue(): Cycle<void> {
    throw new Error("the alias chain above never resolves");
  }
}
