//! Domain crate of the error-set comparison scenario.
//!
//! Module layout: `file`. Each module is one scenario and declares its own
//! `Invoice` with the command `issue` and the generation method `open`, so a
//! shape that breaks one module never widens another. `invoice` is the module
//! the mapping names; every other module is reached by a mapping that names it.

pub mod contract;
pub mod extra;
pub mod foreign;
pub mod inferred;
pub mod invoice;
pub mod missing;
pub mod open_extra;
pub mod shadowed;
pub mod undeclared;
pub mod unreferenced;
pub mod widened;
