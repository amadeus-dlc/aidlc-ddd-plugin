//! Domain crate of the error-set comparison scenario in the other module layout.
//!
//! Module layout: `mod-rs`. Each module is one scenario and declares its own
//! `Invoice` with the command `issue` and the generation method `open`, exactly
//! as `billing_domain` does; only where the module file sits differs. A module
//! with children owns its directory through `mod.rs`, so each scenario module
//! carries one leaf child. `invoice` is the module the mapping names; `missing`
//! is reached by a mapping that names it.

pub mod invoice;
pub mod missing;
