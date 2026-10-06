# Domain construction and repository contracts

Updated: 2026-10-06. These are the default conventions for Rust and TypeScript generation and review.

## Domain Primitives

Create a Domain Primitive only when its business invariant restricts the backing type's valid values. A wrapper that accepts every value of its backing type adds no domain meaning. An identifier such as a reservation, member or room ID accepts integers greater than or equal to one.

Every Domain Primitive provides both `of(input)` and `parse(input)`, with the same explicitly typed input. `of` returns the value itself and delegates the unchanged input to `parse`; it panics in Rust or throws in TypeScript on invalid input because the caller violated its contract. `parse` returns `Result<Value, ParseValueError>` and rejects invalid input before initialization. Numeric input is valid for `parse`; parsing is not restricted to strings. The mapped fallible factory is `parse`, and its error belongs to that operation.

The initialization path is `of → parse → primary constructor`. A conversion factory also goes through the checked path. Do not normalize or replace the input after validating a different value. Do not derive unchecked deserialization for a Domain Primitive.

## One primary constructor

A stateful domain class, struct or companion has exactly one primary constructor that assembles its complete state. In TypeScript class representation it is one `private constructor` implementation. Overload signatures do not add implementations. In Rust it is one private associated function containing the raw struct or tuple initialization. In TypeScript companion representation it is the one factory that owns the typed instance literal and captures its complete closure state.

Auxiliary construction paths such as `of`, `parse`, `create` and `from` reach that primary constructor directly or through other auxiliary paths. A function that takes an instance of its own type (`replay(events, snapshot)`) continues that instance and constructs nothing new, so it is not an auxiliary path; in Rust only a by-value `Self` parameter counts, and a reference, an `Option` or a slice of the type does not. Delegation chains are allowed. Missing or multiple primary constructors, cycles, unproven delegation and raw initialization elsewhere are rejected. Validate before allocating, and do not complete construction through `init`, `setup`, setters or partial state. A rejected-input path does not construct an instance and need not call the primary constructor.

Enum variants, stateless unit types and the language's standard structural copying of already valid values follow their language rules. The rule concerns initialization of new instances.

## Factory names

| Name | Contract |
|---|---|
| `of` | Construct a value object from one or more values and return that value directly. Invalid input violates the caller's contract. Do not use it to create an Entity. |
| `parse` | Check input and return `Result<Value, ParseValueError>`. Typed numbers and other typed input are supported. |
| `from` | Convert one explicitly stated, distinct source type. Do not use it to copy the same type or merely wrap a Domain Primitive's backing input. Rust `From` is infallible. |
| `try_from` | Rust conversion that can fail, returning `Result<Self, ConversionError>`. |
| `create` or a business name | Create an Entity. Prefer the declared business operation, such as `reserve` or `open`, where it explains the intent. |
| `generate` | Produce a value through a stated algorithm, calculation or randomness. |
| `valueOf`, `getInstance`, `newInstance` | State conversion or instance-acquisition intent when needed. Caching, sharing and allocation guarantees require an explicit contract and implementation review. |

These naming checks apply to factories of the project's own domain types, not calls to standard libraries or an instance's `valueOf()`. Do not add all factory names to every type.

## Event Sourcing and repositories

Use Event Sourcing for the standard generated example. A successful state-changing command returns its one declared event; the same event-application path serves commands and replay. Replay applies recorded facts without making new business decisions.

The aggregate and each event carry a sequence number: the creation event is 1, and each event the aggregate produces is the previous number plus 1; a refused command produces no event and leaves the number as it was. The event carries the aggregate ID. The aggregate rebuilds from history through `replay(events, snapshot)`: the snapshot is the aggregate itself, and the events are those that follow it. `replay` checks that each event has the snapshot's aggregate ID and the next number, and applies it through the declared replay method. It leaves the snapshot it received as it was. A broken continuation (another ID, a missing number, a second creation event, a transition the state forbids) is not a business error: TypeScript throws and Rust panics, and the adapter turns it into `RepositoryError` (in Rust through `catch_unwind`) before publishing a partially reconstructed aggregate. No `restore` that replays the whole history exists.

The repository loads and returns the replayed aggregate. Keep raw event-history loading and replay inside the adapter; the use case calls the aggregate's command and stores the returned event together with the aggregate after it. The public lookup is `Result<Option<Aggregate>, RepositoryError>` in Rust and `Result<Aggregate | undefined, RepositoryError>` in TypeScript. `store(event, snapshot)` takes the domain event and the aggregate right after it, and nothing else, because the event carries the aggregate ID; each is one named type (or a reference to it), not a collection or an `Option`, and the event is the aggregate's `<Aggregate>Event` or an event the model declares for it, never a business error type; in Rust it is `fn store(&mut self, event: Event, snapshot: Aggregate)` (a reference is accepted) and in TypeScript `store(event: Event, snapshot: Aggregate)`. It returns `Result<(), RepositoryError>` or `Result<void, RepositoryError>`. Use the common `RepositoryError`. A reusable generic `StoreResult<E>` may express the unit result; a concrete operation-specific Result alias adds no contract and is rejected.

An in-memory Event Sourcing repository keeps exactly one map of event streams, `HashMap<Id, Vec<Event>>` or `Map<Id, readonly Event[]>`, and exactly one map of snapshots whose value is the aggregate itself, `HashMap<Id, Aggregate>` or `Map<Id, Aggregate>`. The snapshot interval is a required constructor argument, and an unusable value (zero, negative, not an integer) is rejected. `findById` reads the latest snapshot and replays only the events numbered after it, and answers "none" when there is no snapshot. The snapshot passed to `store` is the aggregate the command returned together with the event, so the adapter trusts its state and does not replay history while storing. `store` checks that the snapshot is the aggregate right after the event (same ID, same number) and that the event follows the stored events (the next number) before it appends, and replaces the snapshot at number 1 and at each multiple of the interval. A snapshot is the aggregate, not a wrapper: do not introduce `ReservationSnapshot`, `StoredReservation`, aggregate-state records, version envelopes or a second aggregate representation merely to store or return data. The repository exposes only the port methods and the constructor: no accessor of the stored events such as `eventsFor` and no public field, and tests check it through `findById`. If a project explicitly declares State Sourcing, its in-memory repository retains aggregate objects directly and does not rebuild them through a persistence record.

## Automated coverage

Both domain gates report `primitive-initialization`, `factory-naming` and `primary-constructor`. Both use-case gates report `repository-result-contract` and `event-sourcing-store`. Both adapter gates report `event-sourcing-storage`, `in-memory-restoration` and `repository-adapter-surface`, using the declared persistence mode and backend. The native Rust domain-facts protocol is 13.

The gates check stated signatures, call paths and supported initialization guards. Review and behavior tests still establish the meaning and completeness of invariants, replay validity, conversion semantics, caching and generation algorithms. An opaque construction path does not become an approved one.

## Sources

- [Scala auxiliary constructors](https://docs.scala-lang.org/overviews/scala-book/classes-aux-constructors.html)
- [Scala classes and objects specification](https://www.scala-lang.org/files/archive/spec/2.13/05-classes-and-objects.html)
- [Adopted constructor rule in TAKT workflows](https://github.com/ideo-plus/takt-workflows/pull/57)
- [Event Sourcing repository shape in TAKT workflows](https://github.com/ideo-plus/takt-workflows/pull/59)
