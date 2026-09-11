---
target: code-generation
plugin: ddd
adds:
  sensors:
    - ddd-rust-domain
    - ddd-rust-use-case
    - ddd-rust-interface-adapter
fragments:
  - anchor: after-step:1
    order: 100
  - anchor: in:Sensors
    order: 100
---

## fragment: after-step:1

### Step 1x (ddd): Read the DDD conventions

Before planning, read the naming and placement conventions and carry them into
the plan:

- **Naming and placement.** Crate suffixes (`-domain`, `-use-case`,
  `-interface-adapter`, `-infrastructure`), the `packages/<layer>/` or
  `modules/<layer>/` placement, the command / query / rmu segments, and the
  composition-root markers. Derive layers from the crate, not from a config file.
- **Domain layer.** No public fields; no mutating method that is not a declared
  Command; construct aggregates only through a full constructor; `&mut self`
  replay paths must be named `apply` / `apply_event` / `replay` / `on_event`.
- **Use-case layer.** `execute` takes IDs and value objects, never an aggregate;
  a use case never calls another use case.
- **Interface-adapter layer.** The command side and query side do not depend on
  each other; the query side never references a domain type or repository port;
  repositories are named `<Aggregate>Repository`; adapters restore aggregates
  through the full constructor.

Report only source files in `source-manifest.json`; the sensors inspect exactly
those claims.

## fragment: in:Sensors

The three DDD Rust sensors fire on `code-summary.md`: `ddd-rust-domain`
(rules a, b, c, d, g plus the layer diagnostics), `ddd-rust-use-case`
(rules g, h, i, d) and `ddd-rust-interface-adapter` (rules k, l, m, n, g, and
every query-side file). Fix the code as the finding names the rule; a repeated
failure means the plan did not carry the conventions above.
